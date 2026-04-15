import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { Prisma } from "@prisma/client";

// ─── Weight constants ────────────────────────────────────────────────────────

const WEIGHTS = {
  winRate: 0.25,
  sharpe: 0.2,
  profitFactor: 0.15,
  consistency: 0.15,
  avgReturn: 0.1,
  tradeVolume: 0.1,
  drawdown: 0.05,
} as const;

// ─── Normalization helpers ───────────────────────────────────────────────────

/** Normalize a value from [min, max] to [0, 100], clamped. */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/** Inverse normalize — lower is better (e.g. drawdown). */
function normalizeInverse(value: number, min: number, max: number): number {
  return 100 - normalize(value, min, max);
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ScoreCalculatorService {
  private readonly logger = new Logger(ScoreCalculatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Run daily at 3:00 AM */
  @Cron("0 3 * * *")
  async recalculateAll(): Promise<void> {
    this.logger.log("Starting daily score recalculation...");

    const usersWithTrades = await this.prisma.order.groupBy({
      by: ["userId"],
      where: { status: { in: ["CONFIRMED", "MATCHED", "MINED"] } },
      _count: { id: true },
    });

    let updated = 0;

    for (const row of usersWithTrades) {
      try {
        await this.calculateForUser(row.userId);
        updated++;
      } catch (err) {
        this.logger.error(
          `Failed to calculate score for user ${row.userId}: ${String(err)}`,
        );
      }
    }

    this.logger.log(`Score recalculation complete — ${updated} users updated`);
  }

  /** Calculate and upsert the score for a single user. */
  async calculateForUser(userId: string): Promise<void> {
    const positions = await this.prisma.position.findMany({
      where: { userId },
    });

    if (positions.length === 0) return;

    // ── Win rate ──────────────────────────────────────────────────────────────
    const closedPositions = positions.filter(
      (p) => p.resolutionStatus === "RESOLVED" || Number(p.realizedPnl) !== 0,
    );
    const wins = closedPositions.filter(
      (p) => Number(p.realizedPnl) > 0,
    ).length;
    const winRate =
      closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : 0;

    // ── Average return per trade ─────────────────────────────────────────────
    const returns = closedPositions.map((p) => Number(p.realizedPnl));
    const avgReturn =
      returns.length > 0
        ? returns.reduce((sum, r) => sum + r, 0) / returns.length
        : 0;

    // ── Sharpe ratio (simplified: mean / stdDev of returns) ──────────────────
    const mean = avgReturn;
    const variance =
      returns.length > 1
        ? returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
          (returns.length - 1)
        : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? mean / stdDev : 0;

    // ── Profit factor (gross profit / gross loss) ────────────────────────────
    const grossProfit = returns
      .filter((r) => r > 0)
      .reduce((sum, r) => sum + r, 0);
    const grossLoss = Math.abs(
      returns.filter((r) => r < 0).reduce((sum, r) => sum + r, 0),
    );
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 0;

    // ── Max drawdown ─────────────────────────────────────────────────────────
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    for (const r of returns) {
      cumulative += r;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // ── Consistency (% of profitable 30-day periods) ─────────────────────────
    // Use TimescaleDB time_bucket aggregation instead of loading all snapshots
    const buckets = await this.prisma.$queryRaw<
      Array<{ bucket: Date; total_pnl: string }>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    >(Prisma.sql`SELECT time_bucket('30 days', time) AS bucket, SUM(pnl) AS total_pnl
       FROM pnl_snapshots WHERE "userId" = ${userId}
       GROUP BY 1 ORDER BY 1`);

    let consistency = 0;
    if (buckets.length > 0) {
      const profitableBuckets = buckets.filter(
        (b) => Number(b.total_pnl) > 0,
      ).length;
      consistency =
        buckets.length > 0 ? (profitableBuckets / buckets.length) * 100 : 0;
    }

    // ── Total trades ─────────────────────────────────────────────────────────
    const totalTrades = await this.prisma.order.count({
      where: {
        userId,
        status: { in: ["CONFIRMED", "MATCHED", "MINED"] },
      },
    });

    // ── Compute final score ──────────────────────────────────────────────────
    const score = this.computeScore({
      winRate,
      sharpeRatio,
      profitFactor,
      consistency,
      avgReturn,
      totalTrades,
      maxDrawdown,
    });

    // ── Upsert ───────────────────────────────────────────────────────────────
    await this.prisma.traderScore.upsert({
      where: { userId },
      create: {
        userId,
        score,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        winRate: new Prisma.Decimal(winRate.toFixed(2)),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        sharpeRatio: new Prisma.Decimal(sharpeRatio.toFixed(4)),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        avgReturn: new Prisma.Decimal(avgReturn.toFixed(4)),
        totalTrades,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        profitFactor: new Prisma.Decimal(profitFactor.toFixed(4)),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        maxDrawdown: new Prisma.Decimal(maxDrawdown.toFixed(4)),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        consistency: new Prisma.Decimal(consistency.toFixed(2)),
      },
      update: {
        score,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        winRate: new Prisma.Decimal(winRate.toFixed(2)),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        sharpeRatio: new Prisma.Decimal(sharpeRatio.toFixed(4)),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        avgReturn: new Prisma.Decimal(avgReturn.toFixed(4)),
        totalTrades,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        profitFactor: new Prisma.Decimal(profitFactor.toFixed(4)),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        maxDrawdown: new Prisma.Decimal(maxDrawdown.toFixed(4)),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        consistency: new Prisma.Decimal(consistency.toFixed(2)),
      },
    });
  }

  /** Weighted average of normalized metric scores → 0-100 */
  computeScore(metrics: {
    winRate: number;
    sharpeRatio: number;
    profitFactor: number;
    consistency: number;
    avgReturn: number;
    totalTrades: number;
    maxDrawdown: number;
  }): number {
    const components = {
      winRate: normalize(metrics.winRate, 0, 100),
      sharpe: normalize(metrics.sharpeRatio, -1, 3),
      profitFactor: normalize(metrics.profitFactor, 0, 5),
      consistency: normalize(metrics.consistency, 0, 100),
      avgReturn: normalize(metrics.avgReturn, -50, 50),
      tradeVolume: normalize(metrics.totalTrades, 0, 500),
      drawdown: normalizeInverse(metrics.maxDrawdown, 0, 1000),
    };

    const weighted =
      components.winRate * WEIGHTS.winRate +
      components.sharpe * WEIGHTS.sharpe +
      components.profitFactor * WEIGHTS.profitFactor +
      components.consistency * WEIGHTS.consistency +
      components.avgReturn * WEIGHTS.avgReturn +
      components.tradeVolume * WEIGHTS.tradeVolume +
      components.drawdown * WEIGHTS.drawdown;

    return Math.max(0, Math.min(100, Math.round(weighted)));
  }
}
