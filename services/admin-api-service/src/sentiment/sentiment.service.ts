import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";

@Injectable()
export class SentimentService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(limit = 20) {
    const since = new Date(Date.now() - 7 * 86400_000);

    const rows: any[] = await this.prisma.$queryRaw`
      SELECT
        ns."marketId",
        m.title AS "marketTitle",
        COUNT(*)::int AS "signalCount",
        SUM(CASE WHEN ns.direction = 'BUY' THEN 1 ELSE 0 END)::int AS "bullishCount",
        SUM(CASE WHEN ns.direction = 'SELL' THEN 1 ELSE 0 END)::int AS "bearishCount",
        MAX(ns."createdAt") AS "lastUpdated"
      FROM news_signals ns
      JOIN markets m ON m.id = ns."marketId"
      WHERE ns."createdAt" >= ${since}
      GROUP BY ns."marketId", m.title
      ORDER BY "signalCount" DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => {
      const total = r.signalCount || 1;
      const score = ((r.bullishCount - r.bearishCount) / total) * 100;
      return {
        marketId: r.marketId,
        marketTitle: r.marketTitle,
        score: parseFloat(score.toFixed(1)),
        label: score > 10 ? "BULLISH" : score < -10 ? "BEARISH" : "NEUTRAL",
        signalCount: r.signalCount,
        bullishCount: r.bullishCount,
        bearishCount: r.bearishCount,
        lastUpdated: r.lastUpdated,
      };
    });
  }
}
