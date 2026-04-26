import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService, runOncePerCluster } from "@polyforge/shared-redis";
import { Prisma } from "@prisma/client";

interface TradeOutcome {
  walletAddress: string;
  pnl: number;
  isWin: boolean;
}

@Injectable()
export class SmartMoneyService {
  private readonly logger = new Logger(SmartMoneyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron("15 * * * *")
  async computeScores() {
    await runOncePerCluster({
      redis: this.redis,
      key: "lock:cron:smart-money:computeScores",
      ttlMs: 3_000_000,
      job: async () => {
        this.logger.log("Computing smart money scores");

        try {
          const profiles = await this.prisma.whaleProfile.findMany({
            where: { tradeCount: { gte: 5 } },
            select: { walletAddress: true },
          });

          if (profiles.length === 0) return;

          const addresses = profiles.map((p) => p.walletAddress);

          const outcomes = await this.computeTradeOutcomes(addresses);

          const scoreUpdates = this.buildScoreUpdates(outcomes);

          if (scoreUpdates.length === 0) return;

          await this.prisma.$transaction(
            scoreUpdates.map(
              ({
                walletAddress,
                totalPnl,
                winCount,
                tradeCount: _tradeCount,
                winRate,
                sharpeRatio,
                score,
              }) =>
                this.prisma.whaleProfile.update({
                  where: { walletAddress },
                  data: {
                    totalPnl: new Prisma.Decimal(totalPnl.toFixed(6)),
                    winCount,
                    winRate: new Prisma.Decimal(winRate.toFixed(2)),
                    sharpeRatio: new Prisma.Decimal(sharpeRatio.toFixed(4)),
                    smartMoneyScore: new Prisma.Decimal(score.toFixed(2)),
                  },
                }),
            ),
          );

          await this.redis.set(
            "smart_money:last_computed",
            new Date().toISOString(),
            3600,
          );

          this.logger.log(
            `Updated smart money scores for ${scoreUpdates.length} wallets`,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error("Smart money score computation failed", msg);
        }
      },
    });
  }

  async getLeaderboard(limit = 20, period?: string) {
    const minDate = this.getPeriodStart(period);

    const profiles = await this.prisma.whaleProfile.findMany({
      where: {
        tradeCount: { gte: 5 },
        smartMoneyScore: { gt: 0 },
        ...(minDate ? { lastTradeAt: { gte: minDate } } : {}),
      },
      orderBy: { smartMoneyScore: "desc" },
      take: limit,
    });

    return profiles.map((p, idx) => ({
      rank: idx + 1,
      walletAddress: p.walletAddress,
      smartMoneyScore: String(p.smartMoneyScore),
      totalPnl: String(p.totalPnl),
      winRate: String(p.winRate),
      sharpeRatio: String(p.sharpeRatio),
      tradeCount: p.tradeCount,
      winCount: p.winCount,
      totalVolume: String(p.totalVolume),
      lastTradeAt: p.lastTradeAt?.toISOString() ?? null,
    }));
  }

  private async computeTradeOutcomes(
    addresses: string[],
  ): Promise<Map<string, TradeOutcome[]>> {
    const resolvedMarkets = await this.prisma.market.findMany({
      where: { closed: true },
      select: { id: true, tokens: { select: { outcome: true, price: true } } },
    });

    // Determine winning outcome per market: the token with price closest to 1.0
    const marketWinners = new Map<string, string>();
    for (const m of resolvedMarkets) {
      if (m.tokens.length === 0) continue;
      const winner = m.tokens.reduce((best, t) =>
        parseFloat(String(t.price)) > parseFloat(String(best.price)) ? t : best,
      );
      if (parseFloat(String(winner.price)) >= 0.9) {
        marketWinners.set(m.id, winner.outcome);
      }
    }

    if (marketWinners.size === 0) return new Map();

    const alerts = await this.prisma.whaleAlert.findMany({
      where: {
        walletAddress: { in: addresses },
        marketId: { in: [...marketWinners.keys()] },
      },
      select: {
        walletAddress: true,
        marketId: true,
        side: true,
        outcome: true,
        size: true,
        price: true,
      },
    });

    const outcomes = new Map<string, TradeOutcome[]>();

    for (const alert of alerts) {
      const winningOutcome = marketWinners.get(alert.marketId);
      if (!winningOutcome) continue;

      const entryPrice = parseFloat(String(alert.price));
      const size = parseFloat(String(alert.size));

      const boughtWinner =
        alert.side === "BUY" && alert.outcome === winningOutcome;
      const soldLoser =
        alert.side === "SELL" && alert.outcome !== winningOutcome;
      const isWin = boughtWinner || soldLoser;

      let pnl: number;
      if (alert.side === "BUY") {
        const exitPrice = alert.outcome === winningOutcome ? 1.0 : 0.0;
        pnl = (exitPrice - entryPrice) * size;
      } else {
        const exitPrice = alert.outcome === winningOutcome ? 1.0 : 0.0;
        pnl = (entryPrice - exitPrice) * size;
      }

      if (!outcomes.has(alert.walletAddress)) {
        outcomes.set(alert.walletAddress, []);
      }
      outcomes.get(alert.walletAddress)!.push({
        walletAddress: alert.walletAddress,
        pnl,
        isWin,
      });
    }

    return outcomes;
  }

  private buildScoreUpdates(outcomes: Map<string, TradeOutcome[]>) {
    const updates: Array<{
      walletAddress: string;
      totalPnl: number;
      winCount: number;
      tradeCount: number;
      winRate: number;
      sharpeRatio: number;
      score: number;
    }> = [];

    for (const [walletAddress, trades] of outcomes) {
      if (trades.length < 3) continue;

      const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
      const winCount = trades.filter((t) => t.isWin).length;
      const tradeCount = trades.length;
      const winRate = (winCount / tradeCount) * 100;

      const sharpeRatio = this.computeSharpe(trades.map((t) => t.pnl));

      const score = this.computeCompositeScore(
        totalPnl,
        winRate,
        sharpeRatio,
        tradeCount,
      );

      updates.push({
        walletAddress,
        totalPnl,
        winCount,
        tradeCount,
        winRate,
        sharpeRatio,
        score,
      });
    }

    return updates;
  }

  computeSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance =
      returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return mean > 0 ? 3.0 : 0;

    return mean / stdDev;
  }

  computeCompositeScore(
    totalPnl: number,
    winRate: number,
    sharpeRatio: number,
    tradeCount: number,
  ): number {
    const pnlScore = Math.min(
      Math.max(this.normalizeLog(totalPnl, 1000), 0),
      100,
    );
    const winRateScore = Math.min(winRate, 100);
    const sharpeScore = Math.min(Math.max(sharpeRatio * 25, 0), 100);
    const activityBonus = Math.min(Math.log2(tradeCount + 1) * 5, 20);

    const raw =
      pnlScore * 0.35 +
      winRateScore * 0.3 +
      sharpeScore * 0.25 +
      activityBonus * 0.1;

    return Math.min(Math.max(raw, 0), 100);
  }

  private normalizeLog(value: number, scale: number): number {
    if (value <= 0) return 0;
    return Math.min((Math.log10(value + 1) / Math.log10(scale + 1)) * 100, 100);
  }

  private getPeriodStart(period?: string): Date | null {
    if (!period || period === "all") return null;
    const now = new Date();
    switch (period) {
      case "24h":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }
}
