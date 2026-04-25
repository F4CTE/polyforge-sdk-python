import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { StrategyStatus, StrategyVisibility } from ".prisma/client";

@Injectable()
export class PublicUsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveUserId(username: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    return user.id;
  }

  async getPerformance(username: string, period: string) {
    const userId = await this.resolveUserId(username);

    const days = parseInt(period, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await this.prisma.pnlSnapshot.findMany({
      where: { userId, time: { gte: since } },
      orderBy: { time: "asc" },
      select: { time: true, pnl: true, realizedPnl: true },
    });

    let cumPnl = 0;
    const data = snapshots.map((s) => {
      const pnl = Number(s.pnl);
      cumPnl += pnl;
      return {
        date: s.time.toISOString().slice(0, 10),
        pnl,
        cumPnl,
      };
    });

    return { data };
  }

  async getStrategies(username: string, visibility: string, limit: number) {
    const userId = await this.resolveUserId(username);

    const vis =
      visibility === "PUBLIC"
        ? StrategyVisibility.PUBLIC
        : StrategyVisibility.PUBLIC;

    const strategies = await this.prisma.strategy.findMany({
      where: {
        userId,
        visibility: vis,
        status: { not: StrategyStatus.ARCHIVED },
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 50),
      select: {
        id: true,
        name: true,
        description: true,
        forkCount: true,
        likeCount: true,
        _count: { select: { orders: true } },
      },
    });

    const data = strategies.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      winRate: 0,
      tradeCount: s._count.orders,
      priceUsdc: 0,
      forkCount: s.forkCount,
      likeCount: s.likeCount,
      isLiked: false,
    }));

    return { data };
  }

  async getActivity(username: string, limit: number) {
    const userId = await this.resolveUserId(username);

    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        resolutionStatus: "RESOLVED",
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 50),
      select: {
        id: true,
        marketId: true,
        outcome: true,
        size: true,
        realizedPnl: true,
        resolutionOutcome: true,
        updatedAt: true,
      },
    });

    const marketIds = [...new Set(positions.map((p) => p.marketId))];
    const markets =
      marketIds.length > 0
        ? await this.prisma.market.findMany({
            where: { id: { in: marketIds } },
            select: { id: true, title: true },
          })
        : [];
    const marketMap = new Map(markets.map((m) => [m.id, m.title]));

    const data = positions.map((p) => ({
      id: p.id,
      marketQuestion: marketMap.get(p.marketId) ?? p.marketId,
      outcome: p.outcome,
      side: p.resolutionOutcome ?? "UNKNOWN",
      size: Number(p.size),
      pnl: Number(p.realizedPnl),
      resolvedAt: p.updatedAt.toISOString(),
    }));

    return { data };
  }

  async getBadges(username: string) {
    const userId = await this.resolveUserId(username);

    const badges = await this.prisma.traderBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
      select: { type: true, earnedAt: true },
    });

    const data = badges.map((b) => ({
      id: b.type,
      unlockedAt: b.earnedAt.toISOString(),
    }));

    return { data };
  }
}
