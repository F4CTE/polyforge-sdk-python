import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPortfolio(userId: string): Promise<any> {
    // Positions: no `closed` field — use resolutionStatus
    const positions = await this.prisma.position.findMany({
      where: { userId, resolutionStatus: "UNRESOLVED" as any },
    });

    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;

    // Fetch market titles for all positions in one query
    const marketIds = [...new Set(positions.map((p) => p.marketId))];
    const markets = marketIds.length
      ? await this.prisma.market.findMany({
          where: { id: { in: marketIds } },
          select: { id: true, title: true },
        })
      : [];
    const marketTitleMap = new Map(markets.map((m) => [m.id, m.title]));

    // Batch fetch all prices in one Redis MGET instead of sequential GETs
    const priceKeys = positions.map((p) => `cache:price:${p.tokenId}`);
    const priceValues = priceKeys.length > 0
      ? await this.redis.getClient().mget(...priceKeys)
      : [];
    const priceMap = new Map<string, number>();
    positions.forEach((pos, i) => {
      const raw = priceValues[i];
      priceMap.set(pos.tokenId, raw ? parseFloat(JSON.parse(raw).price ?? "0") : 0);
    });

    const enriched = positions.map((pos) => {
        const currentPrice = priceMap.get(pos.tokenId) ?? 0;
        const avgEntry = parseFloat(String(pos.avgPrice ?? "0"));
        const size = parseFloat(String(pos.size ?? "0"));
        const unrealizedPnl = (currentPrice - avgEntry) * size;
        totalUnrealizedPnl += unrealizedPnl;
        totalRealizedPnl += parseFloat(String(pos.realizedPnl ?? "0"));

        return {
          id: pos.id,
          marketId: pos.marketId,
          tokenId: pos.tokenId,
          marketTitle: marketTitleMap.get(pos.marketId) ?? "",
          side: pos.outcome,
          size: String(pos.size),
          avgEntryPrice: String(pos.avgPrice),
          currentPrice: currentPrice.toFixed(6),
          unrealizedPnl: unrealizedPnl.toFixed(6),
          resolutionStatus: pos.resolutionStatus,
        };
      });

    return {
      positions: enriched,
      totalUnrealizedPnl: totalUnrealizedPnl.toFixed(6),
      totalRealizedPnl: totalRealizedPnl.toFixed(6),
    };
  }

  async getPnl(
    userId: string,
    period: string,
    strategyId?: string,
  ): Promise<any> {
    const emptyResult = { snapshots: [], totalPnl: "0.00", winRate: "0" };

    try {
      const since =
        period === "7d"
          ? new Date(Date.now() - 7 * 86400_000)
          : period === "90d"
            ? new Date(Date.now() - 90 * 86400_000)
            : period === "allTime"
              ? new Date(0)
              : new Date(Date.now() - 30 * 86400_000);

      // Use DATE_TRUNC as fallback when TimescaleDB time_bucket is unavailable
      const snapshots: any[] = strategyId
        ? await this.prisma.$queryRaw`
                  SELECT
                      DATE_TRUNC('day', time) AS time,
                      pnl
                  FROM pnl_snapshots
                  WHERE "userId" = ${userId}
                    AND "strategyId" = ${strategyId}
                    AND time >= ${since}
                  ORDER BY time ASC
                `
        : await this.prisma.$queryRaw`
                  SELECT
                      DATE_TRUNC('day', time) AS time,
                      pnl
                  FROM pnl_snapshots
                  WHERE "userId" = ${userId}
                    AND "strategyId" IS NULL
                    AND time >= ${since}
                  ORDER BY time ASC
                `;

      if (!snapshots || snapshots.length === 0) return emptyResult;

      const totalPnl = snapshots.reduce(
        (acc, s) => acc + parseFloat(String(s.pnl ?? 0)),
        0,
      );

      return {
        snapshots: snapshots.map((s) => ({
          time: s.time,
          pnl: String(s.pnl ?? "0"),
        })),
        totalPnl: totalPnl.toFixed(2),
        winRate: "0",
      };
    } catch {
      // Table missing, TimescaleDB not available, or no data — return zeros
      return emptyResult;
    }
  }
}
