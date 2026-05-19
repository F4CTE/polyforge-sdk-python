import { Injectable } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { ResolutionStatus } from "@prisma/client";

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPortfolio(userId: string): Promise<any> {
    // Positions: no `closed` field — use resolutionStatus
    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        resolutionStatus: {
          in: [ResolutionStatus.UNRESOLVED, ResolutionStatus.RESOLVING],
        },
      },
    });

    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;

    // Fetch market titles for all positions in one query
    const marketIds = [...new Set(positions.map((p) => p.marketId))];
    const markets = marketIds.length
      ? await this.prisma.market.findMany({
          where: { id: { in: marketIds } },
          select: { id: true, title: true, category: true },
        })
      : [];
    const marketMap = new Map(markets.map((m) => [m.id, m]));
    const marketTitleMap = new Map(markets.map((m) => [m.id, m.title]));

    // Batch fetch all prices in one Redis MGET instead of sequential GETs
    const priceKeys = positions.map((p) => `cache:price:${p.tokenId}`);
    const priceValues =
      priceKeys.length > 0
        ? await this.redis.getClient().mget(...priceKeys)
        : [];
    const priceMap = new Map<string, number>();
    positions.forEach((pos, i) => {
      const raw = priceValues[i];
      const priceData = raw ? (JSON.parse(raw) as { price?: string }) : null;
      priceMap.set(
        pos.tokenId,
        priceData ? parseFloat(priceData.price ?? "0") : 0,
      );
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
        marketCategory: marketMap.get(pos.marketId)?.category ?? null,
      };
    });

    return {
      positions: enriched,
      totalUnrealizedPnl: totalUnrealizedPnl.toFixed(6),
      totalRealizedPnl: totalRealizedPnl.toFixed(6),
    };
  }

  async exportCsv(
    userId: string,
  ): Promise<{ csv: string; truncated: boolean }> {
    const BATCH_SIZE = 1000;
    const MAX_EXPORT_ROWS = 10_000;
    const header =
      "Market ID,Outcome,Size,Avg Price,Unrealized P&L,Realized P&L,Status,Updated\n";
    const rows: string[] = [];
    let cursor: { updatedAt: Date; id: string } | undefined;
    let truncated = false;

    while (true) {
      const batch = await this.prisma.position.findMany({
        where: { userId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: BATCH_SIZE,
        ...(cursor
          ? { cursor: { updatedAt: cursor.updatedAt, id: cursor.id }, skip: 1 }
          : {}),
      });

      if (batch.length === 0) break;

      for (const p of batch) {
        if (rows.length >= MAX_EXPORT_ROWS) {
          truncated = true;
          break;
        }
        rows.push(
          [
            `"${p.marketId}"`,
            p.outcome ?? "",
            p.size != null ? String(p.size) : "",
            p.avgPrice != null ? String(p.avgPrice) : "",
            p.unrealizedPnl != null ? String(p.unrealizedPnl) : "",
            p.realizedPnl != null ? String(p.realizedPnl) : "",
            p.resolutionStatus ?? "",
            p.updatedAt.toISOString(),
          ].join(","),
        );
      }

      if (truncated) break;

      const last = batch[batch.length - 1];
      cursor = { updatedAt: last.updatedAt, id: last.id };

      if (batch.length < BATCH_SIZE) break;
    }

    return { csv: header + rows.join("\n"), truncated };
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

      type PnlSnapshot = { time: Date; pnl: string | null };
      // Use DATE_TRUNC as fallback when TimescaleDB time_bucket is unavailable
      const snapshots: PnlSnapshot[] = strategyId
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
        (acc, s) => acc + parseFloat(s.pnl ?? "0"),
        0,
      );

      return {
        snapshots: snapshots.map((s) => ({
          time: s.time,
          pnl: s.pnl ?? "0",
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
