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

    const positions = await this.prisma.position.findMany({
      where: {
        resolutionStatus: ResolutionStatus.RESOLVED,
        updatedAt: { gte: since },
      },
      select: {
        userId: true,
        realizedPnl: true,
      },
    });

    const userStats: Record<
      string,
      { total: number; wins: number; pnl: number }
    > = {};

    for (const pos of positions) {
      if (!userStats[pos.userId]) {
        userStats[pos.userId] = { total: 0, wins: 0, pnl: 0 };
      }
      userStats[pos.userId].total++;
      const parsedPnl = parseFloat(String(pos.realizedPnl ?? 0));
      userStats[pos.userId].pnl += parsedPnl;
      if (parsedPnl > 0) {
        userStats[pos.userId].wins++;
      }
    }

    const userIds = Object.keys(userStats);

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

    const entries: AccuracyLeaderboardEntry[] = Object.entries(userStats)
      .map(([userId, stats]) => ({
        rank: 0,
        userId,
        username: userMap.get(userId)?.username ?? "",
        displayName: userMap.get(userId)?.displayName ?? null,
        avatarUrl: userMap.get(userId)?.avatarUrl ?? null,
        pnl: String(stats.pnl),
        winRate:
          stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : "0",
        tradeCount: stats.total,
      }))
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));

    const total = entries.length;
    const start = (page - 1) * limit;
    const pageEntries = entries.slice(start, start + limit);
    pageEntries.forEach((entry, i) => {
      entry.rank = start + i + 1;
    });

    return paginate(pageEntries, total, page, limit);
  }
}
