import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import type { MarketMatch } from "@prisma/client";

const DEFAULT_THRESHOLD_PCT = 3;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min per match group
const STREAM = "stream:events";

export interface VenuePrice {
  venue: string;
  tokenId: string;
  outcome: string;
  price: number;
  timestamp: number;
}

export interface PriceComparison {
  matchId: string;
  polymarketId: string;
  kalshiId: string;
  confidence: number;
  verified: boolean;
  polymarket: VenuePrice[];
  kalshi: VenuePrice[];
}

export interface ArbitrageOpportunity {
  matchId: string;
  polymarketTitle: string;
  kalshiTitle: string;
  outcome: string;
  polymarketPrice: number;
  kalshiPrice: number;
  spreadPct: number;
  direction: string;
  confidence: number;
  verified: boolean;
}

@Injectable()
export class ArbitrageService {
  private readonly logger = new Logger(ArbitrageService.name);
  private readonly alertCooldowns = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPriceComparison(matchId: string): Promise<PriceComparison | null> {
    const match = await this.prisma.marketMatch.findUnique({
      where: { id: matchId },
    });
    if (!match) return null;

    const [polyTokens, kalshiTokens] = await Promise.all([
      this.prisma.token.findMany({
        where: { marketId: match.polymarketId },
      }),
      this.prisma.token.findMany({
        where: { marketId: match.kalshiId },
      }),
    ]);

    const toPrices = async (
      tokens: { id: string; outcome: string; price: any }[],
      venue: string,
    ): Promise<VenuePrice[]> => {
      const prices: VenuePrice[] = [];
      for (const token of tokens) {
        const cached = await this.redis.get(`cache:price:${token.id}`);
        const parsed = cached ? JSON.parse(cached) : null;
        prices.push({
          venue,
          tokenId: token.id,
          outcome: token.outcome,
          price: parsed?.price ?? Number(token.price),
          timestamp: parsed?.timestamp ?? Date.now(),
        });
      }
      return prices;
    };

    return {
      matchId: match.id,
      polymarketId: match.polymarketId,
      kalshiId: match.kalshiId,
      confidence: Number(match.confidence),
      verified: match.verified,
      polymarket: await toPrices(polyTokens, "polymarket"),
      kalshi: await toPrices(kalshiTokens, "kalshi"),
    };
  }

  async findOpportunities(opts?: {
    thresholdPct?: number;
    limit?: number;
  }): Promise<ArbitrageOpportunity[]> {
    const threshold = opts?.thresholdPct ?? DEFAULT_THRESHOLD_PCT;
    const limit = opts?.limit ?? 50;

    const matches = await this.prisma.marketMatch.findMany({
      where: { confidence: { gte: 0.75 } },
      orderBy: { confidence: "desc" },
    });

    const opportunities: ArbitrageOpportunity[] = [];

    for (const match of matches) {
      const opps = await this.detectForMatch(match, threshold);
      opportunities.push(...opps);
      if (opportunities.length >= limit) break;
    }

    return opportunities
      .sort((a, b) => b.spreadPct - a.spreadPct)
      .slice(0, limit);
  }

  async detectForMatch(
    match: MarketMatch,
    thresholdPct: number,
  ): Promise<ArbitrageOpportunity[]> {
    const [polyMarket, kalshiMarket] = await Promise.all([
      this.prisma.market.findUnique({
        where: { id: match.polymarketId },
        include: { tokens: true },
      }),
      this.prisma.market.findUnique({
        where: { id: match.kalshiId },
        include: { tokens: true },
      }),
    ]);

    if (!polyMarket || !kalshiMarket) return [];

    const opportunities: ArbitrageOpportunity[] = [];

    // Match outcomes by normalized label
    for (const polyToken of polyMarket.tokens) {
      const normalizedPoly = this.normalizeOutcome(polyToken.outcome);
      const kalshiToken = kalshiMarket.tokens.find(
        (t) => this.normalizeOutcome(t.outcome) === normalizedPoly,
      );
      if (!kalshiToken) continue;

      const polyPrice = await this.getLivePrice(
        polyToken.id,
        Number(polyToken.price),
      );
      const kalshiPrice = await this.getLivePrice(
        kalshiToken.id,
        Number(kalshiToken.price),
      );

      if (polyPrice === 0 && kalshiPrice === 0) continue;

      const midpoint = (polyPrice + kalshiPrice) / 2;
      if (midpoint === 0) continue;

      const spreadPct = (Math.abs(polyPrice - kalshiPrice) / midpoint) * 100;

      if (spreadPct >= thresholdPct) {
        const direction =
          polyPrice < kalshiPrice
            ? "BUY_POLYMARKET_SELL_KALSHI"
            : "BUY_KALSHI_SELL_POLYMARKET";

        opportunities.push({
          matchId: match.id,
          polymarketTitle: polyMarket.title,
          kalshiTitle: kalshiMarket.title,
          outcome: polyToken.outcome,
          polymarketPrice: polyPrice,
          kalshiPrice: kalshiPrice,
          spreadPct: Math.round(spreadPct * 100) / 100,
          direction,
          confidence: Number(match.confidence),
          verified: match.verified,
        });
      }
    }

    return opportunities;
  }

  // ─── Alert emission ───────────────────────────────────────────────────────

  async scanAndAlert(thresholdPct?: number): Promise<number> {
    const threshold = thresholdPct ?? DEFAULT_THRESHOLD_PCT;
    const matches = await this.prisma.marketMatch.findMany({
      where: { confidence: { gte: 0.75 } },
    });

    let alertCount = 0;

    for (const match of matches) {
      const cooldownKey = match.id;
      const lastAlert = this.alertCooldowns.get(cooldownKey) ?? 0;
      if (Date.now() - lastAlert < ALERT_COOLDOWN_MS) continue;

      const opps = await this.detectForMatch(match, threshold);
      for (const opp of opps) {
        await this.emitArbitrageAlert(opp);
        alertCount++;
      }

      if (opps.length > 0) {
        this.alertCooldowns.set(cooldownKey, Date.now());
      }
    }

    return alertCount;
  }

  private async emitArbitrageAlert(opp: ArbitrageOpportunity): Promise<void> {
    try {
      await this.redis.xadd(STREAM, {
        type: "ARBITRAGE_OPPORTUNITY",
        matchId: opp.matchId,
        outcome: opp.outcome,
        polymarketPrice: String(opp.polymarketPrice),
        kalshiPrice: String(opp.kalshiPrice),
        spreadPct: String(opp.spreadPct),
        direction: opp.direction,
        polymarketTitle: opp.polymarketTitle,
        kalshiTitle: opp.kalshiTitle,
        ts: String(Date.now()),
      });
    } catch (err) {
      this.logger.error("Failed to emit arbitrage alert", err);
    }
  }

  private async getLivePrice(
    tokenId: string,
    fallbackPrice: number,
  ): Promise<number> {
    const cached = await this.redis.get(`cache:price:${tokenId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed.price;
    }
    return fallbackPrice;
  }

  private normalizeOutcome(outcome: string): string {
    return outcome
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  }
}
