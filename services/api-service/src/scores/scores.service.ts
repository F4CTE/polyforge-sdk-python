import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { type TraderScore } from "@prisma/client";

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
      winRate: String(s.winRate),
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

  private buildBreakdown(score: TraderScore) {
    return {
      score: score.score,
      components: {
        winRate: {
          value: String(score.winRate),
          weight: 0.25,
          weighted: parseFloat(String(score.winRate)) * 0.25,
        },
        sharpe: {
          value: String(score.sharpeRatio),
          weight: 0.2,
          weighted: parseFloat(String(score.sharpeRatio)) * 0.2,
        },
        profitFactor: {
          value: String(score.profitFactor),
          weight: 0.15,
          weighted: parseFloat(String(score.profitFactor)) * 0.15,
        },
        consistency: {
          value: String(score.consistency),
          weight: 0.15,
          weighted: parseFloat(String(score.consistency)) * 0.15,
        },
        avgReturn: {
          value: String(score.avgReturn),
          weight: 0.1,
          weighted: parseFloat(String(score.avgReturn)) * 0.1,
        },
        tradeVolume: {
          value: score.totalTrades,
          weight: 0.1,
          weighted: score.totalTrades * 0.1,
        },
        drawdown: {
          value: String(score.maxDrawdown),
          weight: 0.05,
          weighted: parseFloat(String(score.maxDrawdown)) * 0.05,
        },
      },
      totalTrades: score.totalTrades,
      updatedAt: score.updatedAt.toISOString(),
    };
  }
}
