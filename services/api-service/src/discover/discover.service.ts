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

    // Hide blocks for UNLISTED strategies
    const result = strategies.map((s) => {
      if ((s as any).visibility === "UNLISTED") {
        return { ...s, triggers: [], conditions: [], actions: [], safety: [] };
      }
      return s;
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
    const rows: any[] = await this.prisma.$queryRaw`
            SELECT
                ps.user_id AS "userId",
                SUM(ps.realized_pnl) AS pnl,
                COUNT(DISTINCT o.id) AS "tradeCount"
            FROM pnl_snapshots ps
            LEFT JOIN orders o ON o.user_id = ps.user_id AND o.created_at >= ${since}
            WHERE ps.time >= ${since}
            GROUP BY ps.user_id
            ORDER BY pnl DESC
            LIMIT ${limit} OFFSET ${skip}
        `;

    const countResult: any[] = await this.prisma.$queryRaw`
            SELECT COUNT(DISTINCT user_id) AS cnt FROM pnl_snapshots WHERE time >= ${since}
        `;
    const total = Number(countResult[0]?.cnt ?? 0);

    const userIds = rows.map((r) => r.userId);
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
