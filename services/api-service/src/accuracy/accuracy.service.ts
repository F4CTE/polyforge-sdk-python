import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { ResolutionStatus } from "@prisma/client";
import { paginate, PaginatedResponse } from "../common/dto/pagination.dto";

export interface AccuracyLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  pnl: string;
  winRate: string;
  tradeCount: number;
}

export interface AccuracyLeaderboardQuery {
  period?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AccuracyService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyAccuracy(userId: string): Promise<any> {
    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        resolutionStatus: ResolutionStatus.RESOLVED,
      },
    });

    if (positions.length === 0) {
      return {
        brierScore: null,
        totalPredictions: 0,
        correctPredictions: 0,
        winRate: "0",
        calibration: [],
        byCategory: {},
      };
    }

    const marketIds = [...new Set(positions.map((p) => p.marketId))];
    const markets = await this.prisma.market.findMany({
      where: { id: { in: marketIds } },
      select: { id: true, category: true },
    });
    const categoryMap = new Map(
      markets.map((m) => [m.id, m.category ?? "Other"]),
    );

    let totalBrier = 0;
    let correct = 0;
    const byCategory: Record<
      string,
      { total: number; correct: number; brierSum: number }
    > = {};
    const buckets: Record<string, { total: number; correct: number }> = {};

    for (const pos of positions) {
      const p = Math.min(
        0.99,
        Math.max(0.01, parseFloat(String(pos.avgPrice ?? 0.5))),
      );
      const won = parseFloat(String(pos.realizedPnl ?? 0)) > 0;
      const outcome = won ? 1 : 0;
      const brier = Math.pow(p - outcome, 2);
      totalBrier += brier;
      if (won) correct++;

      const cat = categoryMap.get(pos.marketId) ?? "Other";
      if (!byCategory[cat])
        byCategory[cat] = { total: 0, correct: 0, brierSum: 0 };
      byCategory[cat].total++;
      byCategory[cat].brierSum += brier;
      if (won) byCategory[cat].correct++;

      const bucketIdx = Math.min(Math.floor(p * 10), 9);
      const lo = bucketIdx * 10;
      const bucketKey = `${lo}-${lo + 10}%`;
      if (!buckets[bucketKey]) buckets[bucketKey] = { total: 0, correct: 0 };
      buckets[bucketKey].total++;
      if (won) buckets[bucketKey].correct++;
    }

    const brierScore = totalBrier / positions.length;

    const calibration = Object.entries(buckets)
      .map(([bucket, { total, correct: c }]) => ({
        bucket,
        count: total,
        actualRate: total > 0 ? parseFloat((c / total).toFixed(4)) : 0,
        expectedRate: (parseInt(bucket) + 5) / 100,
      }))
      .sort((a, b) => a.expectedRate - b.expectedRate);

    const byCategoryFormatted = Object.fromEntries(
      Object.entries(byCategory).map(
        ([cat, { total, correct: c, brierSum }]) => [
          cat,
          {
            brierScore: parseFloat((brierSum / total).toFixed(4)),
            count: total,
            correctPredictions: c,
          },
        ],
      ),
    );

    return {
      brierScore: parseFloat(brierScore.toFixed(4)),
      totalPredictions: positions.length,
      correctPredictions: correct,
      winRate: ((correct / positions.length) * 100).toFixed(1),
      calibration,
      byCategory: byCategoryFormatted,
    };
  }

  async getLeaderboard(
    query: AccuracyLeaderboardQuery,
  ): Promise<PaginatedResponse<AccuracyLeaderboardEntry>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const period = query.period ?? "30d";
    const since =
      period === "7d"
        ? new Date(Date.now() - 7 * 86400_000)
        : period === "30d"
          ? new Date(Date.now() - 30 * 86400_000)
          : new Date(0);

    const start = (page - 1) * limit;
    const grouped = await this.prisma.$queryRaw<
      Array<{
        total: number;
        userId: string | null;
        tradeCount: number | null;
        pnl: unknown | null;
        winRate: unknown | null;
      }>
    >`
      WITH leaderboard AS MATERIALIZED (
        SELECT
          "userId",
          COUNT(*)::int AS "tradeCount",
          COALESCE(SUM("realizedPnl"), 0) AS pnl,
          ROUND(
            (
              COUNT(*) FILTER (WHERE "realizedPnl" > 0)::decimal
              / NULLIF(COUNT(*), 0)::decimal
            ) * 100,
            1
          ) AS "winRate"
        FROM "positions"
        WHERE "resolutionStatus" = 'RESOLVED'::"ResolutionStatus"
          AND "updatedAt" >= ${since}
        GROUP BY "userId"
      ),
      total_count AS (
        SELECT COUNT(*)::int AS total FROM leaderboard
      ),
      page_rows AS (
        SELECT *
        FROM leaderboard
        ORDER BY "winRate" DESC, "tradeCount" DESC, "userId" ASC
        OFFSET ${start}
        LIMIT ${limit}
      )
      SELECT
        t.total,
        p."userId",
        p."tradeCount",
        p.pnl,
        p."winRate"
      FROM total_count t
      LEFT JOIN page_rows p ON TRUE
      ORDER BY p."winRate" DESC NULLS LAST, p."tradeCount" DESC NULLS LAST, p."userId" ASC NULLS LAST
    `;

    const total = grouped[0]?.total ?? 0;
    if (total === 0) {
      return paginate([], 0, page, limit);
    }

    const pagedRows = grouped.filter(
      (row): row is typeof row & { userId: string } => row.userId !== null,
    );
    const userIds = pagedRows.map((row) => row.userId);

    let userMap = new Map<
      string,
      { username: string; displayName: string | null; avatarUrl: string | null }
    >();
    if (userIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      });
      userMap = new Map(users.map((u) => [u.id, u]));
    }

    const entries: AccuracyLeaderboardEntry[] = pagedRows.map((row, i) => {
      const tradeCount = Number(row.tradeCount ?? 0);
      const pnl = Number(row.pnl ?? 0);
      const winRate = Number(row.winRate ?? 0);

      return {
        rank: start + i + 1,
        userId: row.userId,
        username: userMap.get(row.userId)?.username ?? "",
        displayName: userMap.get(row.userId)?.displayName ?? null,
        avatarUrl: userMap.get(row.userId)?.avatarUrl ?? null,
        pnl: String(pnl),
        winRate: Number.isFinite(winRate) ? winRate.toFixed(1) : "0.0",
        tradeCount,
      };
    });

    return paginate(entries, total, page, limit);
  }
}
