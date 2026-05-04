import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService, runOncePerCluster } from "@polyforge/shared-redis";
import { StrategyStatus } from ".prisma/client";
import { safeDecimalToNumber } from "@polyforge/shared-types";

const DEBOUNCE_KEY = (userId: string) => `cb:tripped:${userId}`;
const STREAM = "stream:events";

@Injectable()
export class DrawdownCircuitBreakerService {
  private readonly logger = new Logger(DrawdownCircuitBreakerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Runs every 60 seconds. For each user who has drawdown protection enabled
   * and whose circuit breaker has not already fired, compute the portfolio PnL
   * change over the configured lookback window. If the loss exceeds the
   * configured threshold, pause all running strategies and mark the breaker as
   * tripped.
   */
  @Interval(60_000)
  async check(): Promise<void> {
    await runOncePerCluster({
      redis: this.redis,
      key: "lock:cron:drawdown-circuit-breaker:check",
      ttlMs: 50_000,
      job: async () => {
        // Only fetch limits rows where the feature is on and not already tripped
        const limits = await this.prisma.userLimit.findMany({
          where: { drawdownEnabled: true, circuitBreakerTripped: false },
          select: {
            userId: true,
            drawdownLookbackHours: true,
            drawdownThresholdPct: true,
          },
        });

        if (limits.length === 0) return;

        await Promise.allSettled(
          limits.map((limit) =>
            this.checkUser(limit).catch((err: unknown) => {
              this.logger.warn(
                `Drawdown check failed for ${limit.userId}: ${(err as Error).message}`,
              );
            }),
          ),
        );
      },
    });
  }

  private async checkUser(limit: {
    userId: string;
    drawdownLookbackHours: number;
    drawdownThresholdPct: unknown;
  }): Promise<void> {
    const { userId, drawdownLookbackHours } = limit;
    const thresholdPct = Math.max(
      0,
      safeDecimalToNumber(limit.drawdownThresholdPct, 0),
    );

    // Find the most recent PnL snapshot that falls at or before the lookback start
    const lookbackStart = new Date(
      Date.now() - drawdownLookbackHours * 60 * 60 * 1000,
    );

    // Sum realizedPnl from orders filled in the lookback window
    const _result = await this.prisma.$queryRaw<Array<{ total_pnl: string }>>`
      SELECT COALESCE(SUM(fill_size * (fill_price - avg_price)), 0)::text AS total_pnl
      FROM "orders" o
      JOIN "positions" p ON p.user_id = o.user_id AND p.token_id = o.token_id
      WHERE o.user_id = ${userId}
        AND o.status = 'FILLED'
        AND o.created_at >= ${lookbackStart}
        AND o.side = 'SELL'
    `;

    // Also compute unrealized change: current vs lookback-start snapshot
    const snapshots = await this.prisma.$queryRaw<Array<{ pnl: string }>>`
      SELECT pnl::text
      FROM "pnl_snapshots"
      WHERE user_id = ${userId}
        AND time >= ${lookbackStart}
      ORDER BY time ASC
      LIMIT 1
    `;

    const latestPortfolio = await this.prisma.$queryRaw<Array<{ pnl: string }>>`
      SELECT pnl::text
      FROM "pnl_snapshots"
      WHERE user_id = ${userId}
      ORDER BY time DESC
      LIMIT 1
    `;

    if (latestPortfolio.length === 0) return;

    const latestPnl =
      latestPortfolio[0].pnl == null
        ? 0
        : safeDecimalToNumber(latestPortfolio[0].pnl, Number.NaN);
    const baselinePnl =
      snapshots.length > 0
        ? snapshots[0].pnl == null
          ? 0
          : safeDecimalToNumber(snapshots[0].pnl, Number.NaN)
        : 0;
    const invalidPnl =
      !Number.isFinite(latestPnl) ||
      (snapshots.length > 0 && !Number.isFinite(baselinePnl));

    // If no meaningful baseline, skip
    if (!invalidPnl && baselinePnl === 0) return;

    const drawdownPct = invalidPnl
      ? Number.POSITIVE_INFINITY
      : (baselinePnl - latestPnl) / Math.abs(baselinePnl);

    if (drawdownPct < thresholdPct) return;
    const drawdownPctText = Number.isFinite(drawdownPct)
      ? (drawdownPct * 100).toFixed(2)
      : "invalid";

    // Threshold breached — trip the breaker
    this.logger.warn(
      `Circuit breaker tripped for ${userId}: drawdown=${drawdownPctText}% (threshold=${(thresholdPct * 100).toFixed(2)}%)`,
    );

    // Deduplicate — skip if already fired in this interval via Redis
    const dedupeKey = DEBOUNCE_KEY(userId);
    const alreadyFired = await this.redis.get(dedupeKey);
    if (alreadyFired) return;
    await this.redis.set(dedupeKey, "1", 120); // 2 min lock

    // Pause all running strategies
    const pausedCount = await this.prisma.strategy.updateMany({
      where: {
        userId,
        status: { in: [StrategyStatus.RUNNING, StrategyStatus.PAPER] },
      },
      data: { status: StrategyStatus.PAUSED },
    });

    // Mark the circuit breaker as tripped
    await this.prisma.userLimit.update({
      where: { userId },
      data: {
        circuitBreakerTripped: true,
        circuitBreakerTrippedAt: new Date(),
      },
    });

    // Emit event to notification stream
    try {
      await this.redis.xadd(STREAM, {
        type: "CIRCUIT_BREAKER_TRIGGERED",
        userId,
        drawdownPct: drawdownPctText,
        thresholdPct: (thresholdPct * 100).toFixed(2),
        strategiesPaused: String(pausedCount.count),
        lookbackHours: String(limit.drawdownLookbackHours),
        triggeredAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to publish circuit breaker event for ${userId}`,
        err,
      );
    }

    this.logger.log(
      `Paused ${pausedCount.count} strategies for user ${userId} due to drawdown circuit breaker`,
    );
  }
}
