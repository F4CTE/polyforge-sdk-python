import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { paginate, PaginatedResponse } from "../common/dto/pagination.dto";

export interface DiscoverQueryDto {
  sort?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface LeaderboardQueryDto {
  period?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class DiscoverService {
  constructor(private readonly prisma: PrismaService) {}

  async discover(
    userId: string,
    query: DiscoverQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {
      visibility: { in: ["PUBLIC", "UNLISTED"] },
      status: { not: "ARCHIVED" },
    };

    const orderBy =
      query.sort === "newest"
        ? { createdAt: "desc" as const }
        : query.sort === "top_pnl"
          ? { likeCount: "desc" as const } // approximate
          : query.sort === "most_forked"
            ? { forkCount: "desc" as const }
            : { likeCount: "desc" as const }; // popular default

    const [strategies, total] = await Promise.all([
      this.prisma.strategy.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
      }),
      this.prisma.strategy.count({ where }),
    ]);

    // Remap `user` → `author` for the frontend and hide blocks for UNLISTED
    const result = strategies.map((s) => {
      const { user, ...rest } = s as any;
      const mapped = { ...rest, author: user };
      if (mapped.visibility === "UNLISTED") {
        return {
          ...mapped,
          triggers: [],
          conditions: [],
          actions: [],
          safety: [],
        };
      }
      return mapped;
    });

    return paginate(result, total, page, limit);
  }

  async leaderboard(
    query: LeaderboardQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    // Map period to date range
    const period = query.period ?? "30d";
    const since =
      period === "7d"
        ? new Date(Date.now() - 7 * 86400_000)
        : period === "30d"
          ? new Date(Date.now() - 30 * 86400_000)
          : new Date(0); // allTime

    // Sum realized P&L from pnl_snapshots table grouped by user
    // Use Prisma ORM instead of raw SQL to avoid PgBouncer/build issues
    const snapshots = await this.prisma.pnlSnapshot.groupBy({
      by: ['userId'],
      where: { time: { gte: since } },
      _sum: { realizedPnl: true },
      orderBy: { _sum: { realizedPnl: 'desc' } },
      take: limit,
      skip,
    });

    const total = await this.prisma.pnlSnapshot.groupBy({
      by: ['userId'],
      where: { time: { gte: since } },
    }).then(r => r.length);

    const rows = snapshots.map(s => ({
      userId: s.userId,
      pnl: s._sum.realizedPnl?.toString() ?? '0',
      tradeCount: 0, // Will be enriched below
    }));

    // Enrich with trade counts
    const userIds = rows.map((r) => r.userId);
    if (userIds.length > 0) {
      const tradeCounts = await this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, createdAt: { gte: since } },
        _count: true,
      });
      const tradeMap = Object.fromEntries(tradeCounts.map(t => [t.userId, t._count]));
      rows.forEach(r => { r.tradeCount = tradeMap[r.userId] ?? 0; });
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const data = rows.map((r, i) => ({
      rank: skip + i + 1,
      userId: r.userId,
      username: userMap[r.userId]?.username ?? "",
      displayName: userMap[r.userId]?.displayName ?? "",
      avatarUrl: userMap[r.userId]?.avatarUrl ?? null,
      pnl: String(r.pnl ?? "0"),
      winRate: "0",
      tradeCount: Number(r.tradeCount ?? 0),
    }));

    return paginate(data, total, page, limit);
  }
}
