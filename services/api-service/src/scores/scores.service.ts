import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";

@Injectable()
export class ScoresService {
  private readonly logger = new Logger(ScoresService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Get my score + breakdown ──────────────────────────────────────────────

  async getMyScore(userId: string) {
    const score = await this.prisma.traderScore.findUnique({
      where: { userId },
    });

    if (!score) {
      return {
        score: null,
        breakdown: null,
      };
    }

    return {
      score,
      breakdown: this.buildBreakdown(score),
    };
  }

  // ─── Get user's score ──────────────────────────────────────────────────────

  async getUserScore(userId: string) {
    const score = await this.prisma.traderScore.findUnique({
      where: { userId },
    });

    if (!score) throw new NotFoundException("Score not found for this user");

    return {
      score,
      breakdown: this.buildBreakdown(score),
    };
  }

  // ─── Top 20 traders by score ───────────────────────────────────────────────

  async getTopTraders() {
    const scores = await this.prisma.traderScore.findMany({
      orderBy: { score: "desc" },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return scores.map((s) => ({
      userId: s.userId,
      username: s.user.username,
      displayName: s.user.displayName,
      avatarUrl: s.user.avatarUrl,
      score: s.score,
      winRate: s.winRate.toString(),
      totalTrades: s.totalTrades,
    }));
  }

  // ─── Get badges ────────────────────────────────────────────────────────────

  async getMyBadges(userId: string) {
    return this.prisma.traderBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
    });
  }

  async getUserBadges(userId: string) {
    return this.prisma.traderBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private buildBreakdown(score: any) {
    return {
      score: score.score,
      components: {
        winRate: {
          value: score.winRate.toString(),
          weight: 0.25,
          weighted: parseFloat(score.winRate.toString()) * 0.25,
        },
        sharpe: {
          value: score.sharpeRatio.toString(),
          weight: 0.2,
          weighted: parseFloat(score.sharpeRatio.toString()) * 0.2,
        },
        profitFactor: {
          value: score.profitFactor.toString(),
          weight: 0.15,
          weighted: parseFloat(score.profitFactor.toString()) * 0.15,
        },
        consistency: {
          value: score.consistency.toString(),
          weight: 0.15,
          weighted: parseFloat(score.consistency.toString()) * 0.15,
        },
        avgReturn: {
          value: score.avgReturn.toString(),
          weight: 0.1,
          weighted: parseFloat(score.avgReturn.toString()) * 0.1,
        },
        tradeVolume: {
          value: score.totalTrades,
          weight: 0.1,
          weighted: score.totalTrades * 0.1,
        },
        drawdown: {
          value: score.maxDrawdown.toString(),
          weight: 0.05,
          weighted: parseFloat(score.maxDrawdown.toString()) * 0.05,
        },
      },
      totalTrades: score.totalTrades,
      updatedAt: score.updatedAt.toISOString(),
    };
  }
}
