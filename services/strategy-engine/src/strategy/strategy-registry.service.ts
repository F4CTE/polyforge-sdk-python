import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { StrategyStatus } from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { StrategyRunner, StrategyRunnerStatus } from "./strategy-runner";
import { StateService } from "../state/state.service";
import { OrderIntent } from "../blocks/block.types";

const ORDER_STREAM = "stream:orders";
const PAPER_ORDER_STREAM = "stream:paper_orders";

@Injectable()
export class StrategyRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StrategyRegistryService.name);
  private readonly runners = new Map<string, StrategyRunner>();

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
          const variables = Array.isArray((canvas as any)?.variables)
            ? (canvas as any).variables
            : [];

          const logicBlocks = Array.isArray((canvas as any)?.logicBlocks)
            ? (canvas as any).logicBlocks
            : [];
          const logicConnections = Array.isArray((canvas as any)?.connections)
            ? (canvas as any).connections
            : [];
          const calcBlocks = Array.isArray((canvas as any)?.calcBlocks)
            ? (canvas as any).calcBlocks
            : (strategy as any).calcBlocks ?? [];

          const runner = new StrategyRunner(
            strategy.id,
            strategy.userId,
            strategy.execMode,
            strategy.tickMs ?? 1000,
            (strategy.triggers as any[]) ?? [],
            (strategy.conditions as any[]) ?? [],
            (strategy.actions as any[]) ?? [],
            (strategy.safety as any[]) ?? [],
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
    const variables = Array.isArray((canvas as any)?.variables)
      ? (canvas as any).variables
      : [];
    const logicBlocks = Array.isArray((canvas as any)?.logicBlocks)
      ? (canvas as any).logicBlocks
      : [];
    const logicConnections = Array.isArray((canvas as any)?.connections)
      ? (canvas as any).connections
      : [];
    const calcBlocks = Array.isArray((canvas as any)?.calcBlocks)
      ? (canvas as any).calcBlocks
      : (strategy as any).calcBlocks ?? [];

    const runner = new StrategyRunner(
      strategyId,
      strategy.userId,
      strategy.execMode,
      strategy.tickMs ?? 1000,
      (strategy.triggers as any[]) ?? [],
      (strategy.conditions as any[]) ?? [],
      (strategy.actions as any[]) ?? [],
      (strategy.safety as any[]) ?? [],
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
      runner.stop();
      this.runners.delete(strategyId);
    }
    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: { status: StrategyStatus.IDLE },
    });
    await this.emitEvent(
      strategyId,
      await this.getUserId(strategyId),
      "STRATEGY_STOPPED",
      "manual stop",
    );
  }

  /** Forward price events to all running EVENT/HYBRID strategies watching this token */
  async onPriceEvent(tokenId: string, price: number) {
    for (const [, runner] of this.runners) {
      runner.onPriceEvent(tokenId, price).catch(() => {});
    }
  }

  getStatus(strategyId: string): StrategyRunnerStatus | null {
    return this.runners.get(strategyId)?.status ?? null;
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

  private async onRunnerStatusChange(
    strategyId: string,
    userId: string,
    status: StrategyRunnerStatus,
    reason?: string,
  ) {
    if (status === "STOPPED") {
      this.runners.delete(strategyId);
    }
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
