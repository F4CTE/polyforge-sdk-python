import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { Prisma } from "@prisma/client";
import { BETA_LIMITS } from "../common/beta-limits.config";
import {
  Block,
  PriceState,
  SimPosition,
  createSimState,
  checkSafety,
  checkTriggers,
  checkConditions,
  executeActions,
  checkAutoExits,
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

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

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
      if (runningCount >= BETA_LIMITS.maxConcurrentBacktests) {
        this.logger.log(
          `Backtest run ${runId} deferred — user ${run.userId} already has ${runningCount} running`,
        );
        // Re-enqueue so it will be picked up when the running job finishes
        await this.redis.xadd("stream:backtests", {
          runId,
          userId: run.userId,
          strategyId: run.strategyId ?? "",
          ts: String(Date.now()),
          requeued: "1",
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
      const fillRecs: FillRecord[] = [];
      const pending: Prisma.BacktestOrderCreateManyInput[] = [];

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
        if (!checkTriggers(triggers, prices)) continue;
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

  private extractTokenIds(blocks: Block[]): string[] {
    const ids = new Set<string>();
    for (const b of blocks) {
      const tokenId = String((b.config ?? {}).tokenId ?? "").trim();
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
      side: fill.side as any,
      outcome: fill.outcome as any,
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
