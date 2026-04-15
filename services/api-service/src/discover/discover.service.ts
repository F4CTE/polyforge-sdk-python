import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { paginate, PaginatedResponse } from "../common/dto/pagination.dto";
import { ResolutionStatus } from "@prisma/client";

export interface DiscoverQueryDto {
  sort?: string;
  category?: string;
  search?: string;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async discover(
    userId: string,
    query: DiscoverQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      visibility: { in: ["PUBLIC", "UNLISTED"] },
      status: { not: "ARCHIVED" },
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
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
              traderScore: { select: { score: true } },
            },
          },
        },
      }),
      this.prisma.strategy.count({ where }),
    ]);

    // Remap `user` → `author` for the frontend and hide blocks for UNLISTED
    const result = strategies.map((s) => {
      const { user, ...rest } = s;
      const { traderScore, ...userRest } = user ?? {};
      const mapped = {
        ...rest,
        author: { ...userRest, score: traderScore?.score ?? null },
      };
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

    // Check Redis cache first (60s TTL)
    const cacheKey = `cache:leaderboard:${period}:${page}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (cached) return JSON.parse(cached);

    // Sum realized P&L from pnl_snapshots table grouped by user
    // Use Prisma ORM instead of raw SQL to avoid PgBouncer/build issues
    // Run paginated snapshot query and total count in parallel
    const [snapshots, totalGroups] = await Promise.all([
      this.prisma.pnlSnapshot.groupBy({
        by: ["userId"],
        where: { time: { gte: since } },
        _sum: { realizedPnl: true },
        orderBy: { _sum: { realizedPnl: "desc" } },
        take: limit,
        skip,
      }),
      this.prisma.pnlSnapshot
        .groupBy({
          by: ["userId"],
          where: { time: { gte: since } },
        })
        .then((r) => r.length),
    ]);

    const total = totalGroups;

    const rows = snapshots.map((s) => ({
      userId: s.userId,
      pnl: s._sum.realizedPnl != null ? String(s._sum.realizedPnl) : "0",
      tradeCount: 0,
    }));

    // Enrich with trade counts and user profiles in parallel
    const userIds = rows.map((r) => r.userId);
    type UserInfo = {
      id: string;
      username: string | null;
      displayName: string | null;
      avatarUrl: string | null;
    };
    let userMap: Record<string, UserInfo> = {};
    const winRateMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const [tradeCounts, users, resolvedPositions] = await Promise.all([
        this.prisma.order.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds }, createdAt: { gte: since } },
          _count: true,
        }),
        this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        }),
        this.prisma.position.findMany({
          where: {
            userId: { in: userIds },
            resolutionStatus: "RESOLVED" as ResolutionStatus,
          },
          select: { userId: true, realizedPnl: true },
        }),
      ]);
      const tradeMap = Object.fromEntries(
        tradeCounts.map((t) => [t.userId, t._count]),
      );
      rows.forEach((r) => {
        r.tradeCount = tradeMap[r.userId] ?? 0;
      });
      userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      const posMap: Record<string, { total: number; wins: number }> = {};
      for (const p of resolvedPositions) {
        if (!posMap[p.userId]) posMap[p.userId] = { total: 0, wins: 0 };
        posMap[p.userId].total++;
        if (parseFloat(String(p.realizedPnl)) > 0) posMap[p.userId].wins++;
      }
      for (const [uid, stats] of Object.entries(posMap)) {
        winRateMap[uid] =
          stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : "0";
      }
    }

    const data = rows.map((r, i) => ({
      rank: skip + i + 1,
      userId: r.userId,
      username: userMap[r.userId]?.username ?? "",
      displayName: userMap[r.userId]?.displayName ?? "",
      avatarUrl: userMap[r.userId]?.avatarUrl ?? null,
      pnl: String(r.pnl ?? "0"),
      winRate: winRateMap[r.userId] ?? "0",
      tradeCount: Number(r.tradeCount ?? 0),
    }));

    const result = paginate(data, total, page, limit);
    // Cache for 60 seconds
    await this.redis.set(cacheKey, JSON.stringify(result), 60);
    return result;
  }
}
