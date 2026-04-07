import { Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { StrategyStatus } from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { StrategyVariable, SubStrategyMode } from "@polyforge/shared-types";
import { EvalContext, OrderIntent, DelayedAction } from "../blocks/block.types";
import {
  SAFETY_REGISTRY,
  TRIGGER_REGISTRY,
  CONDITION_REGISTRY,
  ACTION_REGISTRY,
  LOGIC_REGISTRY,
  CALC_REGISTRY,
} from "../blocks/registry";
import { resolveParams } from "../blocks/resolve-params";
import { StateService } from "../state/state.service";
import { safeEvaluate } from "../common/safe-evaluate";

const MIN_TICK_MS = 200;
const STALE_PRICE_MS = 5_000;

export type StrategyRunnerStatus = "RUNNING" | "PAUSED" | "STOPPED";

interface Block {
  id: string;
  type: string;
  params?: Record<string, unknown>;
}

interface LogicBlock extends Block {
  outputs?: string[];
}

interface LogicConnection {
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

/**
 * Runs a single strategy's evaluation loop.
 *
 * Tick mode: setInterval at strategy.tickMs (min 200ms)
 * Event mode: driven externally by StrategyRegistryService.onPriceEvent()
 * Hybrid: both
 */
export class StrategyRunner {
  private readonly logger: Logger;
  status: StrategyRunnerStatus = "RUNNING";
  private timer: NodeJS.Timeout | null = null;
  private pauseReason: string | null = null;
  private delayedActions: Map<string, NodeJS.Timeout> = new Map();

  /** Tracks child strategy IDs launched by RUN_STRATEGY action blocks */
  readonly childStrategies: Set<string> = new Set();
  /** Maps child strategy IDs to their sub-strategy mode */
  private readonly childModes: Map<string, SubStrategyMode> = new Map();

  constructor(
    private readonly strategyId: string,
    private readonly userId: string,
    private readonly execMode: string,
    private readonly tickMs: number,
    private readonly triggers: Block[],
    private readonly conditions: Block[],
    private readonly actions: Block[],
    private readonly safety: Block[],
    private readonly variables: StrategyVariable[],
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly state: StateService,
    private readonly onIntents: (intents: OrderIntent[]) => Promise<void>,
    private readonly onStatusChange: (
      status: StrategyRunnerStatus,
      reason?: string,
    ) => Promise<void>,
    private readonly logicBlocks: LogicBlock[] = [],
    private readonly logicConnections: LogicConnection[] = [],
    private readonly calcBlocks: Block[] = [],
    private readonly onRunStrategy?: (
      childStrategyId: string,
      parentId: string,
      mode: SubStrategyMode,
      context?: { userId: string },
    ) => Promise<void>,
  ) {
    this.logger = new Logger(`StrategyRunner:${strategyId}`);
  }

  /** Register a child strategy launched by this runner */
  addChild(childId: string, mode: SubStrategyMode) {
    this.childStrategies.add(childId);
    this.childModes.set(childId, mode);
  }

  /** Remove a child strategy (e.g. when it stops on its own) */
  removeChild(childId: string) {
    this.childStrategies.delete(childId);
    this.childModes.delete(childId);
  }

  /** Get the mode for a child strategy */

  getChildMode(childId: string): SubStrategyMode | undefined {
    return this.childModes.get(childId);
  }

  start() {
    if (this.execMode === "TICK" || this.execMode === "HYBRID") {
      const interval = Math.max(this.tickMs, MIN_TICK_MS);
      this.timer = setInterval(() => void this.tick(), interval);
    }
    this.logger.log(`Started (mode=${this.execMode}, tickMs=${this.tickMs})`);
  }

  pause(reason = "manual") {
    this.status = "PAUSED";
    this.pauseReason = reason;
    this.logger.log(`Paused: ${reason}`);
  }

  resume() {
    this.status = "RUNNING";
    this.pauseReason = null;
    this.logger.log("Resumed");
  }

  stop() {
    this.status = "STOPPED";
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Clear all delayed action timers
    for (const timer of this.delayedActions.values()) {
      clearTimeout(timer);
    }
    this.delayedActions.clear();
    // Note: cascade stop of managed/scoped children is handled by StrategyRegistryService
    if (this.childStrategies.size > 0) {
      this.logger.log(
        `Stopping with ${this.childStrategies.size} child strategies to cascade`,
      );
    }
    this.logger.log("Stopped");
  }

  /** Called on price events from market-data-service (EVENT/HYBRID mode) */
  async onPriceEvent(tokenId: string, price: number) {
    if (this.execMode === "EVENT" || this.execMode === "HYBRID") {
      await this.tick();
    }
  }

  // ─── Core evaluation pipeline ─────────────────────────────────────────────

  private async tick() {
    if (this.status !== "RUNNING") return;

    try {
      await this.evaluate();
    } catch (err) {
      this.logger.error("Tick evaluation failed", err);
    }
  }

  private async evaluate() {
    const stateData = await this.state.get(this.strategyId);
    const ctx: EvalContext = {
      strategyId: this.strategyId,
      userId: this.userId,
      state: stateData,
      now: Date.now(),
    };

    // 0. Evaluate user-defined calculation variables
    const variables: Record<string, number> = {};
    if (this.variables.length > 0) {
      const scope: Record<string, number> = {
        dailyPnl: stateData.dailyPnl,
        betsToday: stateData.betsToday,
        consecutiveLoss: stateData.consecutiveLoss,
        consecutiveWin: stateData.consecutiveWin,
        totalOrders: stateData.totalOrders,
      };

      // Try to resolve currentPrice from the first trigger/action tokenId
      const primaryTokenId = this.getPrimaryTokenId();
      if (primaryTokenId) {
        const priceData = await this.state.getPrice(primaryTokenId);
        scope.currentPrice = priceData?.price ?? 0;
      }

      for (const v of this.variables) {
        try {
          variables[v.name] = safeEvaluate(v.expression, {
            ...scope,
            ...variables,
          });
        } catch {
          this.logger.warn(
            `Variable "${v.name}" evaluation failed: ${v.expression}`,
          );
        }
      }
    }
    ctx.variables = variables;

    // 0.5 Evaluate calculation blocks — produce computed values for downstream use
    if (this.calcBlocks.length > 0) {
      for (const block of this.calcBlocks) {
        const evaluator = CALC_REGISTRY[block.type];
        if (!evaluator) continue;

        const resolvedBlock = {
          ...block,
          params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
        };

        // Gather numeric inputs from variables referenced in params
        const inputA = Number(resolvedBlock.params?.inputA ?? 0);
        const inputB = Number(resolvedBlock.params?.inputB ?? 0);
        const inputs = [inputA, inputB];

        const result = evaluator.evaluate(resolvedBlock as any, inputs, ctx);

        // Store the result in context variables so other blocks can reference it
        ctx.variables = ctx.variables ?? {};
        ctx.variables[`__calc_${block.id}`] = result.value;
        if (result.booleanValue !== undefined) {
          ctx.variables[`__calc_bool_${block.id}`] = result.booleanValue
            ? 1
            : 0;
        }
      }
    }

    // 1. Check stale data — pause if any subscribed token's price is stale
    const staleToken = await this.detectStaleData();
    if (staleToken) {
      if (this.status === "RUNNING") {
        this.pause(`stale_market_data:${staleToken}`);
        await this.onStatusChange("PAUSED", `stale_market_data:${staleToken}`);
        await this.emitStrategyEvent(
          "STRATEGY_PAUSED",
          `stale_market_data:${staleToken}`,
        );
      }
      return;
    }

    // Auto-resume from stale pause when data is fresh again
    if (
      this.status === "PAUSED" &&
      this.pauseReason?.startsWith("stale_market_data")
    ) {
      this.resume();
      await this.onStatusChange("RUNNING");
      await this.emitStrategyEvent("STRATEGY_STARTED");
    }

    // 2. SAFETY — any failure stops the strategy
    for (const block of this.safety) {
      const evaluator = SAFETY_REGISTRY[block.type];
      if (!evaluator) continue;

      const resolvedBlock = {
        ...block,
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };
      const result = await evaluator.evaluate(
        resolvedBlock as any,
        ctx,
        this.redis,
        this.prisma,
      );
      if (!result.fired) {
        this.stop();
        await this.onStatusChange("STOPPED", result.reason);
        await this.prisma.strategy
          .update({
            where: { id: this.strategyId },
            data: { status: StrategyStatus.IDLE },
          })
          .catch(() => {});
        await this.emitStrategyEvent("STRATEGY_STOPPED", result.reason);
        return;
      }
    }

    // 3. TRIGGERS — any trigger must fire
    let triggerFired = this.triggers.length === 0; // no triggers = always fire
    for (const block of this.triggers) {
      const evaluator = TRIGGER_REGISTRY[block.type];
      if (!evaluator) continue;

      const resolvedBlock = {
        ...block,
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };
      const result = await evaluator.evaluate(
        resolvedBlock as any,
        ctx,
        this.redis,
        this.prisma,
      );
      if (result.fired) {
        triggerFired = true;
        break;
      }
    }
    if (!triggerFired) return;

    // 4. CONDITIONS — ALL conditions must pass
    for (const block of this.conditions) {
      const evaluator = CONDITION_REGISTRY[block.type];
      if (!evaluator) continue;

      const resolvedBlock = {
        ...block,
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };
      const result = await evaluator.evaluate(
        resolvedBlock as any,
        ctx,
        this.redis,
        this.prisma,
      );
      if (!result.fired) return; // condition failed, skip tick
    }

    // 5. LOGIC BLOCKS — evaluate in topological order if present
    if (this.logicBlocks.length > 0) {
      const logicResults = this.evaluateLogicGraph(ctx);
      // If any logic block produces false and gates the action pipeline,
      // the downstream connections determine whether actions fire.
      // For now, store results in context variables so actions can reference them.
      for (const [blockId, result] of logicResults.entries()) {
        const block = this.logicBlocks.find((b) => b.id === blockId);
        if (block) {
          ctx.variables = ctx.variables ?? {};
          ctx.variables[`__logic_${blockId}`] = result.value ? 1 : 0;
        }
      }
    }

    // 6. ACTIONS — collect all OrderIntents
    const allIntents: OrderIntent[] = [];
    for (const block of this.actions) {
      const evaluator = ACTION_REGISTRY[block.type];
      if (!evaluator) continue;

      const resolvedBlock = {
        ...block,
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };
      const result = await evaluator.execute(
        resolvedBlock as any,
        ctx,
        this.redis,
        this.prisma,
      );
      allIntents.push(...result.intents);
    }

    // Separate RUN_STRATEGY sentinel intents from real order intents
    const runStrategyIntents = allIntents.filter(
      (i) => i.marketId === "__run_strategy__",
    );
    const orderIntents = allIntents.filter(
      (i) => i.marketId !== "__run_strategy__",
    );

    // Handle sub-strategy launches
    for (const intent of runStrategyIntents) {
      const childStrategyId = intent.tokenId;
      const mode = intent.size as SubStrategyMode;

      // Enforce max 10 concurrent sub-strategies
      if (this.childStrategies.size >= 10) {
        this.logger.warn(
          `Max concurrent sub-strategies (10) reached, skipping launch of ${childStrategyId}`,
        );
        continue;
      }

      // Skip if already running as a child
      if (this.childStrategies.has(childStrategyId)) {
        this.logger.debug(
          `Child strategy ${childStrategyId} already running, skipping`,
        );
        continue;
      }

      if (this.onRunStrategy) {
        try {
          await this.onRunStrategy(childStrategyId, this.strategyId, mode, {
            userId: ctx.userId,
          });
          this.addChild(childStrategyId, mode);
          this.logger.log(
            `Launched sub-strategy ${childStrategyId} in ${mode} mode`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to launch sub-strategy ${childStrategyId}: ${String(err)}`,
          );
        }
      }
    }

    if (orderIntents.length > 0) {
      // Update state: increment betsToday
      await this.state.update(this.strategyId, {
        betsToday: stateData.betsToday + orderIntents.length,
        totalOrders: stateData.totalOrders + orderIntents.length,
        lastTradeAt: ctx.now,
      });

      await this.onIntents(orderIntents);
    }
  }

  // ─── Logic graph evaluation ──────────────────────────────────────────────

  private evaluateLogicGraph(
    ctx: EvalContext,
  ): Map<string, { value: boolean; activeOutput?: string }> {
    const results = new Map<
      string,
      { value: boolean; activeOutput?: string }
    >();

    // Build adjacency: which logic blocks feed into which
    const incomingEdges = new Map<
      string,
      { source: string; sourceHandle?: string }[]
    >();
    for (const conn of this.logicConnections) {
      const list = incomingEdges.get(conn.target) ?? [];
      list.push({ source: conn.source, sourceHandle: conn.sourceHandle });
      incomingEdges.set(conn.target, list);
    }

    // Topological sort using Kahn's algorithm
    const blockIds = this.logicBlocks.map((b) => b.id);
    const inDegree = new Map<string, number>();
    for (const id of blockIds) inDegree.set(id, 0);

    for (const conn of this.logicConnections) {
      if (inDegree.has(conn.target)) {
        inDegree.set(conn.target, (inDegree.get(conn.target) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      sorted.push(id);

      for (const conn of this.logicConnections) {
        if (conn.source === id && inDegree.has(conn.target)) {
          const newDeg = (inDegree.get(conn.target) ?? 1) - 1;
          inDegree.set(conn.target, newDeg);
          if (newDeg === 0) queue.push(conn.target);
        }
      }
    }

    // Evaluate in topological order
    for (const blockId of sorted) {
      const block = this.logicBlocks.find((b) => b.id === blockId);
      if (!block) continue;

      const evaluator = LOGIC_REGISTRY[block.type];
      if (!evaluator) continue;

      // Gather input values from upstream blocks
      const incoming = incomingEdges.get(blockId) ?? [];
      const inputs: boolean[] = incoming.map((edge) => {
        const upstream = results.get(edge.source);
        if (!upstream) return false;
        // For IF_THEN_ELSE, check which output port matches
        if (edge.sourceHandle && upstream.activeOutput) {
          return edge.sourceHandle === upstream.activeOutput;
        }
        return upstream.value;
      });

      const resolvedBlock = {
        ...block,
        params: resolveParams(block.params ?? {}, ctx.variables ?? {}),
      };

      const result = evaluator.evaluate(resolvedBlock, inputs, ctx);
      results.set(blockId, result);

      // Handle DELAY blocks: schedule delayed execution
      if (block.type === "DELAY" && result.value) {
        const seconds = Number(block.params?.seconds ?? 0);
        if (seconds > 0) {
          this.scheduleDelayedAction(blockId, seconds, result.value);
        }
      }
    }

    return results;
  }

  private scheduleDelayedAction(
    blockId: string,
    seconds: number,
    value: boolean,
  ) {
    // Clear any existing timer for this block
    const existing = this.delayedActions.get(blockId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.delayedActions.delete(blockId);
      this.logger.debug(`Delay block ${blockId} fired after ${seconds}s`);
    }, seconds * 1000);

    this.delayedActions.set(blockId, timer);
  }

  /** Precomputed: all tokenIds referenced in triggers + actions */
  private _cachedTokenIds: string[] | null = null;

  private getReferencedTokenIds(): string[] {
    if (this._cachedTokenIds) return this._cachedTokenIds;
    const ids = new Set<string>();
    for (const block of [...this.triggers, ...this.actions]) {
      const params = (block as any).params;
      if (params?.tokenId && typeof params.tokenId === "string")
        ids.add(params.tokenId);
    }
    this._cachedTokenIds = [...ids];
    return this._cachedTokenIds;
  }

  /** Returns the first tokenId found in triggers or actions (for variable scope). */
  private getPrimaryTokenId(): string | null {
    return this.getReferencedTokenIds()[0] ?? null;
  }

  private async detectStaleData(): Promise<string | null> {
    const tokenIds = this.getReferencedTokenIds();
    if (tokenIds.length === 0) return null;

    // Batch fetch all price ages in one MGET
    const keys = tokenIds.map((id) => `cache:price:${id}`);
    const values = await this.redis.getClient().mget(...keys);
    const now = Date.now();

    for (let i = 0; i < tokenIds.length; i++) {
      const raw = values[i];
      if (!raw) return tokenIds[i];
      try {
        const { timestamp } = JSON.parse(raw);
        if (now - timestamp > STALE_PRICE_MS) return tokenIds[i];
      } catch {
        return tokenIds[i];
      }
    }
    return null;
  }

  private async emitStrategyEvent(type: string, reason?: string) {
    await this.redis.xadd("stream:events", {
      type,
      strategyId: this.strategyId,
      userId: this.userId,
      reason: reason ?? "",
      ts: String(Date.now()),
    });
  }
}
