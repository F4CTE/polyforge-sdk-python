import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { StrategyStatus } from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { SubStrategyMode, StrategyVariable } from "@polyforge/shared-types";
import {
  StrategyRunner,
  StrategyRunnerStatus,
  Block,
  LogicBlock,
  LogicConnection,
} from "./strategy-runner";
import { StateService } from "../state/state.service";
import { OrderIntent } from "../blocks/block.types";

const ORDER_STREAM = "stream:orders";
const PAPER_ORDER_STREAM = "stream:paper_orders";

/**
 * Filter blocks based on graph connectivity before passing to the runner.
 * Safety blocks always pass through — they are global guards on every tick.
 *
 * Wiring semantics per block type:
 *   - safety    : always active regardless of wiring (global interceptor)
 *   - trigger   : must have ≥1 outgoing edge to participate in any path
 *   - condition : always included — unwired = global gate (AND'd against all paths),
 *                 wired = scoped inline filter (same engine behaviour, visual only differs)
 *   - action    : must have ≥1 incoming edge (needs upstream context to fire)
 *
 * Legacy strategies with no connections return all blocks unchanged.
 */
/** Extract typed arrays from the strategy canvas JSON */
function extractCanvasFields(canvas: Record<string, unknown> | null): {
  variables: StrategyVariable[];
  logicBlocks: LogicBlock[];
  logicConnections: LogicConnection[];
  calcBlocks: Block[];
} {
  const c = canvas ?? {};
  return {
    variables: Array.isArray(c.variables)
      ? (c.variables as StrategyVariable[])
      : [],
    logicBlocks: Array.isArray(c.logicBlocks)
      ? (c.logicBlocks as LogicBlock[])
      : [],
    logicConnections: Array.isArray(c.connections)
      ? (c.connections as LogicConnection[])
      : [],
    calcBlocks: Array.isArray(c.calcBlocks) ? (c.calcBlocks as Block[]) : [],
  };
}

function filterByConnections(
  triggers: Block[],
  conditions: Block[],
  actions: Block[],
  connections: LogicConnection[],
): { triggers: Block[]; conditions: Block[]; actions: Block[] } {
  if (!connections || connections.length === 0) {
    return { triggers, conditions, actions };
  }
  const sources = new Set<string>(connections.map((c) => c.source));
  const targets = new Set<string>(connections.map((c) => c.target));
  return {
    triggers: triggers.filter((b) => sources.has(b.id)),
    conditions, // unwired = global gate, wired = same; always include all conditions
    actions: actions.filter((b) => targets.has(b.id)),
  };
}

@Injectable()
export class StrategyRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StrategyRegistryService.name);
  private readonly runners = new Map<string, StrategyRunner>();
  /** Maps child strategy ID -> parent strategy ID */
  private readonly parentChildMap = new Map<string, string>();
  /** Maps tokenId -> Set of strategyIds subscribed to that token's price events */
  private readonly tokenSubscribers = new Map<string, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly state: StateService,
  ) {}

  // ─── Startup reconciliation ─────────────────────────────────────────────────
  // After a restart, re-start runners for all strategies that should be active.

  async onApplicationBootstrap(): Promise<void> {
    try {
      const strategies = await this.prisma.strategy.findMany({
        where: {
          status: { in: [StrategyStatus.RUNNING, StrategyStatus.PAPER] },
        },
      });

      if (strategies.length === 0) {
        this.logger.log("Startup reconciliation: no strategies to resume");
        return;
      }

      this.logger.log(
        `Startup reconciliation: resuming ${strategies.length} strategies`,
      );

      let succeeded = 0;
      for (const strategy of strategies) {
        try {
          const isPaper = strategy.status === StrategyStatus.PAPER;
          const stream = isPaper ? PAPER_ORDER_STREAM : ORDER_STREAM;

          const canvas = strategy.canvas as Record<string, unknown> | null;
          const {
            variables,
            logicBlocks,
            logicConnections,
            calcBlocks: canvasCalcBlocks,
          } = extractCanvasFields(canvas);
          const calcBlocks =
            canvasCalcBlocks.length > 0
              ? canvasCalcBlocks
              : (((strategy as Record<string, unknown>).calcBlocks as
                  | Block[]
                  | undefined) ?? []);

          const wired = filterByConnections(
            (strategy.triggers as Block[] | null) ?? [],
            (strategy.conditions as Block[] | null) ?? [],
            (strategy.actions as Block[] | null) ?? [],
            logicConnections,
          );
          const runner = new StrategyRunner(
            strategy.id,
            strategy.userId,
            strategy.execMode,
            strategy.tickMs ?? 1000,
            wired.triggers as unknown as Block[],
            wired.conditions as unknown as Block[],
            wired.actions as unknown as Block[],
            ((strategy.safety as Block[] | null) ?? []) as unknown as Block[],
            variables,
            this.redis,
            this.prisma,
            this.state,
            (intents) => this.publishIntents(intents, stream),
            (status, reason) =>
              this.onRunnerStatusChange(
                strategy.id,
                strategy.userId,
                status,
                reason,
              ),
            logicBlocks,
            logicConnections,
            calcBlocks,
            (childId, parentId, mode, context) =>
              this.startAsChild(childId, parentId, mode, context),
          );

          this.runners.set(strategy.id, runner);
          runner.start();
          succeeded++;
        } catch (err) {
          this.logger.error(
            `Failed to reconcile strategy ${strategy.id}: ${String(err)}`,
          );
        }
      }

      this.logger.log(
        `Startup reconciliation complete: ${succeeded}/${strategies.length} strategies resumed`,
      );
    } catch (err) {
      this.logger.error(`Startup reconciliation failed: ${String(err)}`);
    }
  }

  async start(strategyId: string): Promise<void> {
    if (this.runners.has(strategyId)) {
      throw new ConflictException(`Strategy ${strategyId} is already running`);
    }

    const strategy = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
    });
    if (!strategy)
      throw new NotFoundException(`Strategy ${strategyId} not found`);

    // Paper strategies use a separate Redis stream; status stays PAPER
    const isPaper = strategy.status === StrategyStatus.PAPER;
    const stream = isPaper ? PAPER_ORDER_STREAM : ORDER_STREAM;
    const newStatus = isPaper ? StrategyStatus.PAPER : StrategyStatus.RUNNING;

    // Extract variables from canvas (if defined by the strategy builder)
    const canvas = strategy.canvas as Record<string, unknown> | null;
    const {
      variables,
      logicBlocks,
      logicConnections,
      calcBlocks: canvasCalcBlocks2,
    } = extractCanvasFields(canvas);
    const calcBlocks =
      canvasCalcBlocks2.length > 0
        ? canvasCalcBlocks2
        : (((strategy as Record<string, unknown>).calcBlocks as
            | Block[]
            | undefined) ?? []);

    const wired = filterByConnections(
      (strategy.triggers as Block[] | null) ?? [],
      (strategy.conditions as Block[] | null) ?? [],
      (strategy.actions as Block[] | null) ?? [],
      logicConnections,
    );
    const runner = new StrategyRunner(
      strategyId,
      strategy.userId,
      strategy.execMode,
      strategy.tickMs ?? 1000,
      wired.triggers as unknown as Block[],
      wired.conditions as unknown as Block[],
      wired.actions as unknown as Block[],
      ((strategy.safety as Block[] | null) ?? []) as unknown as Block[],
      variables,
      this.redis,
      this.prisma,
      this.state,
      (intents) => this.publishIntents(intents, stream),
      (status, reason) =>
        this.onRunnerStatusChange(strategyId, strategy.userId, status, reason),
      logicBlocks,
      logicConnections,
      calcBlocks,
      (childId, parentId, mode, context) =>
        this.startAsChild(childId, parentId, mode, context),
    );

    this.runners.set(strategyId, runner);
    runner.start();

    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: { status: newStatus },
    });

    await this.emitEvent(strategyId, strategy.userId, "STRATEGY_STARTED");
    this.logger.log(`Strategy ${strategyId} started`);
  }

  async pause(strategyId: string): Promise<void> {
    const runner = this.getRunner(strategyId);
    runner.pause("manual");
    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: { status: StrategyStatus.PAUSED },
    });
    await this.emitEvent(
      strategyId,
      await this.getUserId(strategyId),
      "STRATEGY_STOPPED",
      "manual pause",
    );
  }

  async resume(strategyId: string): Promise<void> {
    const runner = this.getRunner(strategyId);
    runner.resume();
    const s = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
      select: { status: true },
    });
    const resumeStatus =
      s?.status === StrategyStatus.PAPER
        ? StrategyStatus.PAPER
        : StrategyStatus.RUNNING;
    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: { status: resumeStatus },
    });
    await this.emitEvent(
      strategyId,
      await this.getUserId(strategyId),
      "STRATEGY_STARTED",
    );
  }

  async stop(strategyId: string): Promise<void> {
    const runner = this.runners.get(strategyId);
    if (runner) {
      try {
        // Cascade stop to managed and scoped children
        const childIds = [...runner.childStrategies];
        for (const childId of childIds) {
          const mode = runner.getChildMode(childId);
          if (mode === "managed" || mode === "scoped") {
            try {
              await this.stop(childId);
              this.logger.log(
                `Cascade-stopped child strategy ${childId} (mode=${mode}) of parent ${strategyId}`,
              );
            } catch (err) {
              this.logger.warn(
                `Failed to cascade-stop child ${childId}: ${String(err)}`,
              );
            }
          }
          runner.removeChild(childId);
        }

        runner.stop();
      } finally {
        // R4-02: Ensure runner is always cleaned up even if an error occurs
        this.runners.delete(strategyId);
        this.parentChildMap.delete(strategyId);
        this.unregisterTokenSubscriptions(strategyId);
      }
    }
    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: { status: StrategyStatus.IDLE, parentStrategyId: null },
    });
    await this.emitEvent(
      strategyId,
      await this.getUserId(strategyId),
      "STRATEGY_STOPPED",
      "manual stop",
    );
  }

  /** Forward price events only to strategies subscribed to this token */
  onPriceEvent(tokenId: string, price: number): void {
    const subscribers = this.tokenSubscribers.get(tokenId);
    if (!subscribers || subscribers.size === 0) return;
    for (const strategyId of subscribers) {
      const runner = this.runners.get(strategyId);
      if (runner) runner.onPriceEvent(tokenId, price).catch(() => {});
    }
  }

  /** Register a strategy's interest in specific tokens */
  registerTokenSubscriptions(strategyId: string, tokenIds: string[]) {
    for (const tokenId of tokenIds) {
      let subs = this.tokenSubscribers.get(tokenId);
      if (!subs) {
        subs = new Set();
        this.tokenSubscribers.set(tokenId, subs);
      }
      subs.add(strategyId);
    }
  }

  /** Remove a strategy's token subscriptions */
  unregisterTokenSubscriptions(strategyId: string) {
    for (const [tokenId, subs] of this.tokenSubscribers) {
      subs.delete(strategyId);
      if (subs.size === 0) this.tokenSubscribers.delete(tokenId);
    }
  }

  getStatus(strategyId: string): StrategyRunnerStatus | null {
    return this.runners.get(strategyId)?.status ?? null;
  }

  // ─── Sub-strategy management ─────────────────────────────────────────────

  /**
   * Start a strategy as a child of another strategy.
   * Validates ownership, circular dependencies (max depth 3), and concurrent limits.
   */
  async startAsChild(
    childStrategyId: string,
    parentId: string,
    mode: SubStrategyMode,
    context?: { userId: string },
  ): Promise<void> {
    // Already running check
    if (this.runners.has(childStrategyId)) {
      throw new ConflictException(
        `Strategy ${childStrategyId} is already running`,
      );
    }

    const child = await this.prisma.strategy.findUnique({
      where: { id: childStrategyId },
    });
    if (!child)
      throw new NotFoundException(
        `Child strategy ${childStrategyId} not found`,
      );

    // Ownership check
    const parentRunner = this.runners.get(parentId);
    if (context?.userId && child.userId !== context.userId) {
      throw new UnprocessableEntityException(
        `Child strategy ${childStrategyId} is not owned by the same user`,
      );
    }

    // Self-reference check
    if (childStrategyId === parentId) {
      throw new UnprocessableEntityException(
        `Strategy cannot launch itself as a sub-strategy`,
      );
    }

    // Circular dependency check (max depth 3)
    if (this.hasCircularDependency(parentId, childStrategyId)) {
      throw new UnprocessableEntityException(
        `Circular dependency detected: ${childStrategyId} is an ancestor of ${parentId}`,
      );
    }

    // Max concurrent sub-strategies per parent
    if (parentRunner && parentRunner.childStrategies.size >= 10) {
      throw new UnprocessableEntityException(
        `Parent strategy ${parentId} already has 10 concurrent sub-strategies`,
      );
    }

    // Set parent relationship in DB
    await this.prisma.strategy.update({
      where: { id: childStrategyId },
      data: { parentStrategyId: parentId },
    });

    // Track parent-child relationship
    this.parentChildMap.set(childStrategyId, parentId);

    // Determine stream based on parent's status
    const parentStrategy = await this.prisma.strategy.findUnique({
      where: { id: parentId },
      select: { status: true },
    });
    const isPaper = parentStrategy?.status === StrategyStatus.PAPER;
    const stream = isPaper ? PAPER_ORDER_STREAM : ORDER_STREAM;
    const newStatus = isPaper ? StrategyStatus.PAPER : StrategyStatus.RUNNING;

    const canvas = child.canvas as Record<string, unknown> | null;
    const {
      variables,
      logicBlocks,
      logicConnections,
      calcBlocks: canvasCalcBlocks3,
    } = extractCanvasFields(canvas);
    const calcBlocks =
      canvasCalcBlocks3.length > 0
        ? canvasCalcBlocks3
        : (((child as Record<string, unknown>).calcBlocks as
            | Block[]
            | undefined) ?? []);

    const wiredChild = filterByConnections(
      (child.triggers as Block[] | null) ?? [],
      (child.conditions as Block[] | null) ?? [],
      (child.actions as Block[] | null) ?? [],
      logicConnections,
    );
    const runner = new StrategyRunner(
      childStrategyId,
      child.userId,
      child.execMode,
      child.tickMs ?? 1000,
      wiredChild.triggers as unknown as Block[],
      wiredChild.conditions as unknown as Block[],
      wiredChild.actions as unknown as Block[],
      ((child.safety as Block[] | null) ?? []) as unknown as Block[],
      variables,
      this.redis,
      this.prisma,
      this.state,
      (intents) => this.publishIntents(intents, stream),
      (status, reason) =>
        this.onRunnerStatusChange(
          childStrategyId,
          child.userId,
          status,
          reason,
        ),
      logicBlocks,
      logicConnections,
      calcBlocks,
      (grandchildId, pId, m, ctx) =>
        this.startAsChild(grandchildId, pId, m, ctx),
    );

    this.runners.set(childStrategyId, runner);
    runner.start();

    await this.prisma.strategy.update({
      where: { id: childStrategyId },
      data: { status: newStatus },
    });

    await this.emitEvent(childStrategyId, child.userId, "STRATEGY_STARTED");
    this.logger.log(
      `Child strategy ${childStrategyId} started (parent=${parentId}, mode=${mode})`,
    );
  }

  /**
   * Check if starting childId under parentId would create a circular dependency.
   * Walks up the parent chain from parentId. Max depth 3.
   */
  hasCircularDependency(
    parentId: string,
    childId: string,
    visited = new Set<string>(),
  ): boolean {
    let current: string | undefined = parentId;
    let depth = 0;
    const MAX_DEPTH = 3;

    while (current && depth < MAX_DEPTH) {
      if (visited.has(current)) return false; // Already checked this node
      visited.add(current);
      if (current === childId) return true;
      current = this.parentChildMap.get(current);
      depth++;
    }

    // Also check if depth would exceed max
    let parentDepth = 0;
    let walk: string | undefined = parentId;
    while (walk && parentDepth < MAX_DEPTH + 1) {
      if (visited.has(walk) && walk !== parentId) break; // Already visited
      walk = this.parentChildMap.get(walk);
      parentDepth++;
    }
    if (parentDepth >= MAX_DEPTH) return true; // would exceed max depth

    return false;
  }

  /** Get children of a strategy */
  getChildStrategies(strategyId: string): string[] {
    const runner = this.runners.get(strategyId);
    if (!runner) return [];
    return [...runner.childStrategies];
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private getRunner(strategyId: string): StrategyRunner {
    const runner = this.runners.get(strategyId);
    if (!runner)
      throw new NotFoundException(`Strategy ${strategyId} is not running`);
    return runner;
  }

  private async publishIntents(
    intents: OrderIntent[],
    stream: string,
  ): Promise<void> {
    for (const intent of intents) {
      await this.redis.xadd(stream, {
        intentId: intent.intentId,
        userId: intent.userId,
        strategyId: intent.strategyId,
        marketId: intent.marketId,
        tokenId: intent.tokenId,
        side: intent.side,
        outcome: intent.outcome,
        size: intent.size,
        price: intent.price,
        orderType: intent.orderType,
        expiration: String(intent.expiration ?? ""),
        ts: String(Date.now()),
      });
    }
  }

  private onRunnerStatusChange(
    strategyId: string,
    _userId: string,
    status: StrategyRunnerStatus,
    _reason?: string,
  ): Promise<void> {
    if (status === "STOPPED") {
      this.runners.delete(strategyId);
    }
    return Promise.resolve();
  }

  private async emitEvent(
    strategyId: string,
    userId: string,
    type: string,
    reason?: string,
  ) {
    await this.redis.xadd("stream:events", {
      type,
      strategyId,
      userId,
      reason: reason ?? "",
      ts: String(Date.now()),
    });
  }

  private async getUserId(strategyId: string): Promise<string> {
    const s = await this.prisma.strategy.findUnique({
      where: { id: strategyId },
      select: { userId: true },
    });
    return s?.userId ?? "";
  }
}
