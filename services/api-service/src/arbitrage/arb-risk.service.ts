import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { ArbPositionStatus, Venue } from "@prisma/client";

export interface RiskDashboard {
  openPositions: number;
  pendingPositions: number;
  totalDeployed: number;
  netExposure: { polymarket: number; kalshi: number };
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  avgSpreadPct: number;
  positionsByStatus: Record<string, number>;
}

export interface SettlementRiskEntry {
  matchId: string;
  polymarketTitle: string;
  kalshiTitle: string;
  polymarketEndDate: Date | null;
  kalshiEndDate: Date | null;
  endDateDiffDays: number | null;
  confidence: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
}

@Injectable()
export class ArbRiskService {
  private readonly logger = new Logger(ArbRiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getDashboard(userId: string): Promise<RiskDashboard> {
    const positions = await this.prisma.arbPosition.findMany({
      where: {
        userId,
        status: {
          in: [
            ArbPositionStatus.OPEN,
            ArbPositionStatus.PENDING,
            ArbPositionStatus.PARTIAL,
          ],
        },
      },
    });

    const allPositions = await this.prisma.arbPosition.findMany({
      where: { userId },
    });

    let totalDeployed = 0;
    let polyExposure = 0;
    let kalshiExposure = 0;
    let totalRealized = 0;
    let totalUnrealized = 0;
    let spreadSum = 0;
    let openCount = 0;

    const statusCounts: Record<string, number> = {};

    for (const pos of allPositions) {
      const status = pos.status;
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;

      const realized = Number(pos.realizedPnl ?? 0);
      totalRealized += realized;

      if (
        pos.status === ArbPositionStatus.OPEN ||
        pos.status === ArbPositionStatus.PARTIAL
      ) {
        const buySize = Number(pos.buyFillSize ?? pos.buySize);
        const sellSize = Number(pos.sellFillSize ?? pos.sellSize);
        const buyPrice = Number(pos.buyFillPrice ?? pos.buyPrice);
        const sellPrice = Number(pos.sellFillPrice ?? pos.sellPrice);

        const buyCost = buySize * buyPrice;
        const sellCost = sellSize * sellPrice;
        totalDeployed += buyCost + sellCost;

        if (pos.buyVenue === Venue.POLYMARKET) {
          polyExposure += buyCost;
          kalshiExposure += sellCost;
        } else {
          kalshiExposure += buyCost;
          polyExposure += sellCost;
        }

        totalUnrealized += Number(pos.unrealizedPnl ?? 0);
        spreadSum += Number(pos.entrySpreadPct);
        openCount++;
      }
    }

    return {
      openPositions: statusCounts[ArbPositionStatus.OPEN] ?? 0,
      pendingPositions:
        (statusCounts[ArbPositionStatus.PENDING] ?? 0) +
        (statusCounts[ArbPositionStatus.PARTIAL] ?? 0),
      totalDeployed: Math.round(totalDeployed * 100) / 100,
      netExposure: {
        polymarket: Math.round(polyExposure * 100) / 100,
        kalshi: Math.round(kalshiExposure * 100) / 100,
      },
      totalRealizedPnl: Math.round(totalRealized * 100) / 100,
      totalUnrealizedPnl: Math.round(totalUnrealized * 100) / 100,
      avgSpreadPct:
        openCount > 0 ? Math.round((spreadSum / openCount) * 100) / 100 : 0,
      positionsByStatus: statusCounts,
    };
  }

  async getSettlementRisks(userId: string): Promise<SettlementRiskEntry[]> {
    const openPositions = await this.prisma.arbPosition.findMany({
      where: {
        userId,
        status: {
          in: [
            ArbPositionStatus.OPEN,
            ArbPositionStatus.PENDING,
            ArbPositionStatus.PARTIAL,
          ],
        },
      },
      select: { matchId: true },
    });

    if (openPositions.length === 0) return [];

    const matchIds = [...new Set(openPositions.map((p) => p.matchId))];

    const matches = await this.prisma.marketMatch.findMany({
      where: { id: { in: matchIds } },
    });

    const allMarketIds = [
      ...matches.map((m) => m.polymarketId),
      ...matches.map((m) => m.kalshiId),
    ];

    const markets = await this.prisma.market.findMany({
      where: { id: { in: allMarketIds } },
      select: { id: true, title: true, endDate: true, category: true },
    });

    const marketMap = new Map(markets.map((m) => [m.id, m]));

    const risks: SettlementRiskEntry[] = [];

    for (const match of matches) {
      const poly = marketMap.get(match.polymarketId);
      const kalshi = marketMap.get(match.kalshiId);

      if (!poly || !kalshi) continue;

      let endDateDiffDays: number | null = null;
      let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
      let reason = "Markets appear well-matched";

      if (poly.endDate && kalshi.endDate) {
        const diffMs = Math.abs(
          poly.endDate.getTime() - kalshi.endDate.getTime(),
        );
        endDateDiffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (endDateDiffDays > 7) {
          riskLevel = "HIGH";
          reason = `End dates differ by ${endDateDiffDays} days — resolution timing mismatch risk`;
        } else if (endDateDiffDays > 1) {
          riskLevel = "MEDIUM";
          reason = `End dates differ by ${endDateDiffDays} days — minor timing mismatch`;
        }
      } else if (!poly.endDate || !kalshi.endDate) {
        riskLevel = "MEDIUM";
        reason =
          "One venue is missing end date — cannot verify resolution alignment";
      }

      const confidence = Number(match.confidence);
      if (confidence < 0.7) {
        riskLevel = "HIGH";
        reason = `Low match confidence (${(confidence * 100).toFixed(0)}%) — markets may not represent the same event`;
      }

      risks.push({
        matchId: match.id,
        polymarketTitle: poly.title,
        kalshiTitle: kalshi.title,
        polymarketEndDate: poly.endDate,
        kalshiEndDate: kalshi.endDate,
        endDateDiffDays,
        confidence,
        riskLevel,
        reason,
      });
    }

    return risks.sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return order[a.riskLevel] - order[b.riskLevel];
    });
  }

  async refreshUnrealizedPnl(userId: string): Promise<number> {
    const openPositions = await this.prisma.arbPosition.findMany({
      where: {
        userId,
        status: ArbPositionStatus.OPEN,
      },
    });

    if (openPositions.length === 0) return 0;

    const tokenIds = openPositions.flatMap((p) => [
      p.buyTokenId,
      p.sellTokenId,
    ]);
    const livePrices = await this.fetchLivePrices(tokenIds);

    let updated = 0;
    for (const pos of openPositions) {
      const buyCurrentPrice = livePrices.get(pos.buyTokenId);
      const sellCurrentPrice = livePrices.get(pos.sellTokenId);
      if (buyCurrentPrice === undefined || sellCurrentPrice === undefined)
        continue;

      const buyEntryPrice = Number(pos.buyFillPrice ?? pos.buyPrice);
      const sellEntryPrice = Number(pos.sellFillPrice ?? pos.sellPrice);
      const buySize = Number(pos.buyFillSize ?? pos.buySize);
      const sellSize = Number(pos.sellFillSize ?? pos.sellSize);

      const buyPnl = (buyCurrentPrice - buyEntryPrice) * buySize;
      const sellPnl = (sellEntryPrice - sellCurrentPrice) * sellSize;
      const unrealizedPnl = buyPnl + sellPnl;
      const currentSpreadPct =
        Math.round(Math.abs(buyCurrentPrice - sellCurrentPrice) * 100 * 100) /
        100;

      await this.prisma.arbPosition.update({
        where: { id: pos.id },
        data: {
          unrealizedPnl,
          currentSpreadPct,
        },
      });
      updated++;
    }

    return updated;
  }

  private async fetchLivePrices(
    tokenIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (tokenIds.length === 0) return map;

    const keys = tokenIds.map((id) => `cache:price:${id}`);
    const client = this.redis.getClient();
    const raw: (string | null)[] = await client.mget(...keys);

    tokenIds.forEach((id, i) => {
      if (!raw[i]) return;
      try {
        const parsed = JSON.parse(raw[i]) as { price: string | number };
        map.set(id, parseFloat(String(parsed.price)));
      } catch {
        /* skip malformed */
      }
    });

    return map;
  }
}
