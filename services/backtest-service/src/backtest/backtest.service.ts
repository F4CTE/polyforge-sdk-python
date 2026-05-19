import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService, BetaLimitsConfigService } from "@polyforge/shared-redis";
import { Prisma } from "@prisma/client";
import {
  Block,
  PriceState,
  SimPosition,
  createSimState,
  clearPendingOrders,
  checkSafety,
  checkTriggers,
  checkConditions,
  executeActions,
  checkAutoExits,
  computeMaxLookback,
  SimFill,
} from "./evaluator";
import { MetricsService, FillRecord } from "./metrics.service";

interface PriceSnapshot {
  time: Date;
  tokenId: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

const PROGRESS_KEY = (runId: string) => `backtest:${runId}:progress`;
const BATCH_SIZE = 500; // BacktestOrders written per DB flush
const PROGRESS_EVERY = 200; // ticks between progress broadcasts
const STREAM_BACKTESTS = "stream:backtests";
const DEFERRED_REQUEUE_KEY = "backtest:deferred-requeues";
const DEFER_REQUEUE_BACKOFF_MS = 1000;
const DEFERRED_REQUEUE_POLL_MS = 250;
const DEFERRED_REQUEUE_BATCH_SIZE = 100;

interface DeferredBacktestRequeue {
  runId: string;
  userId: string;
  strategyId: string;
}

const DRAIN_DEFERRED_REQUEUES_SCRIPT = `
local due = redis.call(
  "ZRANGEBYSCORE",
  KEYS[1],
  "-inf",
  ARGV[1],
  "LIMIT",
  0,
  tonumber(ARGV[3])
)

for _, member in ipairs(due) do
  local ok, payload = pcall(cjson.decode, member)
  if ok and type(payload) == "table" and payload["runId"] and payload["userId"] then
    redis.call(
      "XADD",
      KEYS[2],
      "*",
      "runId",
      tostring(payload["runId"]),
      "userId",
      tostring(payload["userId"]),
      "strategyId",
      tostring(payload["strategyId"] or ""),
      "ts",
      ARGV[2],
      "requeued",
      "1"
    )
  end
  redis.call("ZREM", KEYS[1], member)
end

return #due
`;

@Injectable()
export class BacktestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BacktestService.name);
  private deferredRequeueTimer: ReturnType<typeof setTimeout> | null = null;
  private deferredRequeuePumpRunning = false;
  private deferredRequeueDrainInFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
    private readonly betaLimits: BetaLimitsConfigService,
  ) {}

  onModuleInit() {
    this.deferredRequeuePumpRunning = true;
    this.scheduleDeferredRequeueDrain(0);
  }

  onModuleDestroy() {
    this.deferredRequeuePumpRunning = false;
    if (this.deferredRequeueTimer) {
      clearTimeout(this.deferredRequeueTimer);
      this.deferredRequeueTimer = null;
    }
  }

  // ─── Entry point ─────────────────────────────────────────────────────────

  async run(runId: string): Promise<void> {
    this.logger.log(`Starting backtest run ${runId}`);

    // Enforce concurrent backtest limit per user (queue model)
    const run = await this.prisma.backtestRun.findUnique({
      where: { id: runId },
      select: { userId: true, strategyId: true },
    });
    if (run) {
      const runningCount = await this.prisma.backtestRun.count({
        where: {
          userId: run.userId,
          status: "RUNNING",
          id: { not: runId },
        },
      });
      const maxConcurrent = await this.betaLimits.getLimit(
        "maxConcurrentBacktests",
      );
      if (runningCount >= maxConcurrent) {
        this.logger.log(
          `Backtest run ${runId} deferred — user ${run.userId} already has ${runningCount} running`,
        );
        // Store the retry durably, then let the consumer move on to unrelated
        // stream entries while the background pump applies the backoff.
        await this.deferBacktestRequeue({
          runId,
          userId: run.userId,
          strategyId: run.strategyId ?? "",
        });
        return;
      }
    }

    await this.prisma.backtestRun.update({
      where: { id: runId },
      data: { status: "RUNNING" },
    });
    await this.setProgress(runId, 0);

    try {
      const run = await this.prisma.backtestRun.findUniqueOrThrow({
        where: { id: runId },
      });
      const { userId, strategyId, dateRangeStart, dateRangeEnd } = run;

      const strategy = await this.prisma.strategy.findUniqueOrThrow({
        where: { id: strategyId },
      });

      const safety = (strategy.safety as unknown as Block[]) ?? [];
      const triggers = (strategy.triggers as unknown as Block[]) ?? [];
      const conditions = (strategy.conditions as unknown as Block[]) ?? [];
      const actions = (strategy.actions as unknown as Block[]) ?? [];

      const allBlocks = [...safety, ...triggers, ...conditions, ...actions];
      const tokenIds = this.extractTokenIds(allBlocks);

      if (tokenIds.length === 0) {
        await this.finalize(runId, userId, [], false);
        return;
      }

      // Data-gap check
      const gapCount = await this.prisma.dataGap.count({
        where: {
          tokenId: { in: tokenIds },
          gapStart: { lte: dateRangeEnd },
          gapEnd: { gte: dateRangeStart },
        },
      });
      const hasDataGaps = gapCount > 0;

      // Load price snapshots in chronological order
      const ticks = await this.fetchTicks(
        tokenIds,
        dateRangeStart,
        dateRangeEnd,
      );

      if (ticks.length === 0) {
        await this.finalize(runId, userId, [], hasDataGaps);
        return;
      }

      // ─── Simulation ────────────────────────────────────────────────
      const state = createSimState();
      const positions = new Map<string, SimPosition>();
      const prices = new Map<string, PriceState>();
      const priceHistory = new Map<string, number[]>();
      const fillRecs: FillRecord[] = [];
      const pending: Prisma.BacktestOrderCreateManyInput[] = [];

      // Compute the maximum TA lookback required by triggers, with a
      // sensible floor for strategies that have no TA triggers configured
      const computedLookback = computeMaxLookback(triggers);
      const maxLookback = computedLookback > 0 ? computedLookback : 200;

      let cumulativePnl = 0;
      let currentDay = "";

      for (let i = 0; i < ticks.length; i++) {
        const tick = ticks[i];
        const tokenId = tick.tokenId;
        const nowMs = tick.time.getTime();
        const day = tick.time.toISOString().slice(0, 10);

        // Reset per-day counters at midnight
        if (day !== currentDay) {
          currentDay = day;
          state.betsToday = 0;
          state.dailyPnl = 0;
        }

        // Update in-memory price state for this token
        const prev = prices.get(tokenId);
        const ps: PriceState = {
          price: Number(tick.close),
          prevPrice: prev ? prev.price : Number(tick.close),
          bid: Number(tick.low),
          ask: Number(tick.high),
          timestamp: nowMs,
        };
        prices.set(tokenId, ps);

        // Accumulate rolling price history for TA indicators
        if (!priceHistory.has(tokenId)) {
          priceHistory.set(tokenId, []);
        }
        const hist = priceHistory.get(tokenId)!;
        hist.push(ps.price);
        // Trim to configured lookback to prevent unbounded growth on long date ranges
        if (hist.length > maxLookback) {
          priceHistory.set(tokenId, hist.slice(-maxLookback));
        }

        // Clear stale pending orders from previous ticks before safety/conditions
        clearPendingOrders(state);

        // Auto-exits (stop-loss / take-profit)
        const autoFills = checkAutoExits(state, prices, positions);
        for (const fill of autoFills) {
          const rec = this.applyFill(
            fill,
            positions,
            state,
            cumulativePnl,
            tick.time,
          );
          cumulativePnl = rec.equityCurve;
          fillRecs.push(rec);
          pending.push(this.toOrderInput(runId, fill, rec));
        }

        // Safety halt check
        if (!checkSafety(safety, state, prices, positions)) {
          this.logger.log(
            `Safety halt at tick ${i} (${tick.time.toISOString()}) for run ${runId}`,
          );
          break;
        }

        // Trigger + condition gates
        if (!checkTriggers(triggers, prices, priceHistory, tokenId)) continue;
        if (!checkConditions(conditions, state, prices, positions, nowMs))
          continue;

        // Execute strategy actions
        const actionFills = executeActions(actions, prices, positions, state);
        for (const fill of actionFills) {
          const rec = this.applyFill(
            fill,
            positions,
            state,
            cumulativePnl,
            tick.time,
          );
          cumulativePnl = rec.equityCurve;
          fillRecs.push(rec);
          pending.push(this.toOrderInput(runId, fill, rec));
        }

        // Flush DB batch
        if (pending.length >= BATCH_SIZE) {
          await this.prisma.backtestOrder.createMany({
            data: pending.splice(0, BATCH_SIZE),
          });
        }

        // Broadcast progress
        if (i % PROGRESS_EVERY === 0 || i === ticks.length - 1) {
          const pct = Math.min(99, Math.floor((i / ticks.length) * 100));
          await this.setProgress(runId, pct);
          await this.emitProgress(runId, userId, pct);
        }
      }

      // Final flush
      if (pending.length > 0) {
        await this.prisma.backtestOrder.createMany({ data: pending });
      }

      await this.finalize(runId, userId, fillRecs, hasDataGaps);
    } catch (err: any) {
      this.logger.error(
        `Backtest run ${runId} failed: ${err?.message}`,
        err?.stack,
      );
      await this.prisma.backtestRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          errorMessage: String(err?.message ?? "Unknown error"),
        },
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async deferBacktestRequeue(
    payload: DeferredBacktestRequeue,
  ): Promise<void> {
    await this.redis
      .getClient()
      .zadd(
        DEFERRED_REQUEUE_KEY,
        String(Date.now() + DEFER_REQUEUE_BACKOFF_MS),
        JSON.stringify(payload),
      );
  }

  private scheduleDeferredRequeueDrain(delayMs = DEFERRED_REQUEUE_POLL_MS) {
    if (!this.deferredRequeuePumpRunning || this.deferredRequeueTimer) return;

    this.deferredRequeueTimer = setTimeout(() => {
      this.deferredRequeueTimer = null;
      void this.drainDeferredBacktestRequeues()
        .catch((err: unknown) => {
          this.logger.error(
            "Deferred backtest requeue drain failed",
            err instanceof Error ? err.message : String(err),
          );
        })
        .finally(() => {
          this.scheduleDeferredRequeueDrain();
        });
    }, delayMs);
    this.deferredRequeueTimer.unref?.();
  }

  private async drainDeferredBacktestRequeues(): Promise<void> {
    if (this.deferredRequeueDrainInFlight) return;

    this.deferredRequeueDrainInFlight = true;
    try {
      const now = String(Date.now());
      await this.redis.getClient().eval(
        DRAIN_DEFERRED_REQUEUES_SCRIPT,
        2,
        DEFERRED_REQUEUE_KEY,
        STREAM_BACKTESTS,
        now,
        now,
        String(DEFERRED_REQUEUE_BATCH_SIZE),
      );
    } finally {
      this.deferredRequeueDrainInFlight = false;
    }
  }

  private extractTokenIds(blocks: Block[]): string[] {
    const ids = new Set<string>();
    for (const b of blocks) {
      const tokenId = String(
        b.params?.tokenId ?? b.config?.tokenId ?? "",
      ).trim();
      if (tokenId) ids.add(tokenId);
    }
    return Array.from(ids);
  }

  private async fetchTicks(
    tokenIds: string[],
    start: Date,
    end: Date,
  ): Promise<PriceSnapshot[]> {
    // Query each token separately to avoid complex array-casting with $queryRaw
    const results: PriceSnapshot[] = [];
    for (const tokenId of tokenIds) {
      const rows = await this.prisma.$queryRaw<PriceSnapshot[]>`
                SELECT "time", "tokenId", "open", "high", "low", "close"
                FROM price_snapshots
                WHERE "tokenId" = ${tokenId}
                  AND "time" >= ${start}
                  AND "time" <= ${end}
                ORDER BY "time" ASC
            `;
      results.push(...rows);
    }
    // Merge into a single timeline
    results.sort((a, b) => a.time.getTime() - b.time.getTime());
    return results;
  }

  private applyFill(
    fill: SimFill,
    positions: Map<string, SimPosition>,
    state: ReturnType<typeof createSimState>,
    prevCumPnl: number,
    simulatedAt: Date,
  ): FillRecord {
    const { tokenId, side, size, price } = fill;
    let pnl = 0;
    let equityCurve = prevCumPnl;

    if (side === "BUY") {
      const existing = positions.get(tokenId);
      if (existing) {
        const totalSize = existing.size + size;
        const avgPrice =
          (existing.avgPrice * existing.size + price * size) / totalSize;
        positions.set(tokenId, { size: totalSize, avgPrice });
      } else {
        positions.set(tokenId, { size, avgPrice: price });
      }
      state.betsToday++;
      state.totalOrders++;
      state.lastTradeAt = simulatedAt.getTime();
    } else {
      const pos = positions.get(tokenId);
      if (pos) {
        pnl = (price - pos.avgPrice) * size;
        equityCurve = prevCumPnl + pnl;
        const remaining = pos.size - size;
        if (remaining <= 0.0001) {
          positions.delete(tokenId);
        } else {
          positions.set(tokenId, { size: remaining, avgPrice: pos.avgPrice });
        }
      }
      state.dailyPnl += pnl;
      state.totalOrders++;
      state.lastTradeAt = simulatedAt.getTime();
      if (pnl > 0) {
        state.consecutiveLoss = 0;
      } else {
        state.consecutiveLoss++;
      }
    }

    return { side, pnl, equityCurve, simulatedAt };
  }

  private toOrderInput(
    runId: string,
    fill: SimFill,
    rec: FillRecord,
  ): Prisma.BacktestOrderCreateManyInput {
    return {
      runId,
      tokenId: fill.tokenId,
      side: fill.side,
      outcome: fill.outcome,
      size: new Prisma.Decimal(fill.size.toFixed(6)),
      price: new Prisma.Decimal(fill.price.toFixed(6)),
      fillPrice: new Prisma.Decimal(fill.price.toFixed(6)),
      pnl: new Prisma.Decimal(rec.pnl.toFixed(6)),
      equityCurve: new Prisma.Decimal(rec.equityCurve.toFixed(6)),
      simulatedAt: rec.simulatedAt,
    };
  }

  private async finalize(
    runId: string,
    userId: string,
    fills: FillRecord[],
    hasDataGaps: boolean,
  ): Promise<void> {
    const computed = this.metrics.compute(fills);

    await this.prisma.backtestRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        progress: 100,
        totalOrders: fills.length,
        filledOrders: fills.length,
        totalPnl: new Prisma.Decimal(computed.totalPnl.toFixed(6)),
        winRate: new Prisma.Decimal(computed.winRate.toFixed(4)),
        maxDrawdown: new Prisma.Decimal(computed.maxDrawdown.toFixed(6)),
        sharpeRatio: new Prisma.Decimal(computed.sharpeRatio.toFixed(4)),
        hasDataGaps,
        completedAt: new Date(),
      },
    });

    await this.setProgress(runId, 100);
    await this.emitProgress(runId, userId, 100);

    this.logger.log(
      `Backtest run ${runId} completed — fills: ${fills.length}, pnl: ${computed.totalPnl.toFixed(2)}`,
    );
  }

  private async setProgress(runId: string, progress: number): Promise<void> {
    await this.redis
      .getClient()
      .set(PROGRESS_KEY(runId), String(progress), "EX", 3600);
  }

  private async emitProgress(
    runId: string,
    userId: string,
    progress: number,
  ): Promise<void> {
    await this.redis.xadd("stream:events", {
      type: "BACKTEST_PROGRESS",
      userId,
      runId,
      progress: String(progress),
      ts: String(Date.now()),
    });
  }
}
