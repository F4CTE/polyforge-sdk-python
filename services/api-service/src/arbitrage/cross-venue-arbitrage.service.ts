import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService, runOncePerCluster } from "@polyforge/shared-redis";

const STREAM = "stream:events";
const DEFAULT_THRESHOLD_PCT = 3;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

export interface CrossVenueOpportunity {
  matchId: string;
  polymarketId: string;
  kalshiId: string;
  polymarketTitle: string;
  kalshiTitle: string;
  category: string;
  confidence: number;
  polymarketYes: number;
  kalshiYes: number;
  spreadPct: number;
  profitPerDollar: number;
  direction: "buy_poly_sell_kalshi" | "buy_kalshi_sell_poly";
}

export interface VenueComparison {
  matchId: string;
  polymarket: {
    marketId: string;
    title: string;
    yesPrice: number;
    noPrice: number;
  };
  kalshi: {
    marketId: string;
    title: string;
    yesPrice: number;
    noPrice: number;
  };
  spreadPct: number;
  confidence: number;
  verified: boolean;
}

export interface SpreadSummary {
  matchId: string;
  polymarket: {
    marketId: string;
    title: string;
    yesBid: number;
    noAsk: number;
  };
  kalshi: { marketId: string; title: string; yesBid: number; noAsk: number };
  yesSpreadPct: number;
  noSpreadPct: number | null;
  confidence: number;
  verified: boolean;
}

@Injectable()
export class CrossVenueArbitrageService {
  private readonly logger = new Logger(CrossVenueArbitrageService.name);
  private readonly alertCooldowns = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron("*/2 * * * *")
  async scanOpportunities(): Promise<void> {
    await runOncePerCluster({
      redis: this.redis,
      key: "lock:cron:cross-venue-arbitrage:scanOpportunities",
      ttlMs: 100_000,
      job: async () => {
        try {
          const opps = await this.getOpportunities(DEFAULT_THRESHOLD_PCT);
          for (const opp of opps) {
            await this.maybeAlert(opp);
          }
          await this.persistSnapshots().catch((e) =>
            this.logger.warn("Snapshot persist failed", (e as Error).message),
          );
        } catch (err) {
          this.logger.error("Cross-venue scan failed", (err as Error).message);
        }
      },
    });
  }

  async getOpportunities(
    minSpreadPct = DEFAULT_THRESHOLD_PCT,
  ): Promise<CrossVenueOpportunity[]> {
    const matches = await this.prisma.marketMatch.findMany({
      where: { confidence: { gte: 0.6 } },
      orderBy: { confidence: "desc" },
      take: 500,
    });

    if (matches.length === 0) return [];

    const allMarketIds = [
      ...matches.map((m) => m.polymarketId),
      ...matches.map((m) => m.kalshiId),
    ];
    const markets = await this.prisma.market.findMany({
      where: { id: { in: allMarketIds }, closed: false },
      select: {
        id: true,
        title: true,
        category: true,
        tokens: { select: { id: true, outcome: true, price: true } },
      },
    });
    const marketMap = new Map(markets.map((m) => [m.id, m]));

    const tokenIds = markets.flatMap((m) => m.tokens.map((t) => t.id));
    const livePrices = await this.fetchLivePrices(tokenIds);

    const opportunities: CrossVenueOpportunity[] = [];

    for (const match of matches) {
      const poly = marketMap.get(match.polymarketId);
      const kalshi = marketMap.get(match.kalshiId);
      if (!poly || !kalshi) continue;

      const polyYes = this.getYesPrice(poly, livePrices);
      const kalshiYes = this.getYesPrice(kalshi, livePrices);
      if (polyYes === null || kalshiYes === null) continue;

      const spreadPct = Math.abs(polyYes - kalshiYes) * 100;
      if (spreadPct < minSpreadPct) continue;

      const direction =
        polyYes < kalshiYes ? "buy_poly_sell_kalshi" : "buy_kalshi_sell_poly";

      const buyPrice = Math.min(polyYes, kalshiYes);
      const profitPerUnit = Math.abs(polyYes - kalshiYes);
      const profitPerDollar =
        buyPrice > 0
          ? Math.round((profitPerUnit / buyPrice) * 100 * 100) / 100
          : 0;

      opportunities.push({
        matchId: match.id,
        polymarketId: match.polymarketId,
        kalshiId: match.kalshiId,
        polymarketTitle: poly.title,
        kalshiTitle: kalshi.title,
        category: poly.category ?? "",
        confidence: Number(match.confidence),
        polymarketYes: polyYes,
        kalshiYes: kalshiYes,
        spreadPct: Math.round(spreadPct * 100) / 100,
        profitPerDollar,
        direction,
      });
    }

    return opportunities.sort((a, b) => b.profitPerDollar - a.profitPerDollar);
  }

  async getOpportunitiesForMarket(
    marketId: string,
    minSpreadPct = DEFAULT_THRESHOLD_PCT,
  ): Promise<CrossVenueOpportunity[]> {
    const allOpps = await this.getOpportunities(minSpreadPct);
    return allOpps.filter(
      (o) => o.polymarketId === marketId || o.kalshiId === marketId,
    );
  }

  async getSpreadComparison(): Promise<SpreadSummary[]> {
    const matches = await this.prisma.marketMatch.findMany({
      where: { confidence: { gte: 0.6 } },
      orderBy: { confidence: "desc" },
      take: 200,
    });

    if (matches.length === 0) return [];

    const allMarketIds = [
      ...matches.map((m) => m.polymarketId),
      ...matches.map((m) => m.kalshiId),
    ];
    const markets = await this.prisma.market.findMany({
      where: { id: { in: allMarketIds }, closed: false },
      select: {
        id: true,
        title: true,
        tokens: { select: { id: true, outcome: true, price: true } },
      },
    });
    const marketMap = new Map(markets.map((m) => [m.id, m]));

    const tokenIds = markets.flatMap((m) => m.tokens.map((t) => t.id));
    const livePrices = await this.fetchLivePrices(tokenIds);

    const summaries: SpreadSummary[] = [];
    for (const match of matches) {
      const poly = marketMap.get(match.polymarketId);
      const kalshi = marketMap.get(match.kalshiId);
      if (!poly || !kalshi) continue;

      const polyYes = this.getYesPrice(poly, livePrices);
      const polyNo = this.getNoPrice(poly, livePrices);
      const kalshiYes = this.getYesPrice(kalshi, livePrices);
      const kalshiNo = this.getNoPrice(kalshi, livePrices);

      if (polyYes === null || kalshiYes === null) continue;

      summaries.push({
        matchId: match.id,
        polymarket: {
          marketId: poly.id,
          title: poly.title,
          yesBid: polyYes,
          noAsk: polyNo ?? 0,
        },
        kalshi: {
          marketId: kalshi.id,
          title: kalshi.title,
          yesBid: kalshiYes,
          noAsk: kalshiNo ?? 0,
        },
        yesSpreadPct:
          Math.round(Math.abs(polyYes - kalshiYes) * 100 * 100) / 100,
        noSpreadPct:
          polyNo !== null && kalshiNo !== null
            ? Math.round(Math.abs(polyNo - kalshiNo) * 100 * 100) / 100
            : null,
        confidence: Number(match.confidence),
        verified: match.verified,
      });
    }

    return summaries.sort((a, b) => b.yesSpreadPct - a.yesSpreadPct);
  }

  async getHistory(opts: {
    matchId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where = opts.matchId ? { matchId: opts.matchId } : {};
    const [snapshots, total] = await Promise.all([
      this.prisma.arbitrageSnapshot.findMany({
        where,
        orderBy: { scannedAt: "desc" },
        take: opts.limit ?? 100,
        skip: opts.offset ?? 0,
      }),
      this.prisma.arbitrageSnapshot.count({ where }),
    ]);
    return { snapshots, total };
  }

  async persistSnapshots(): Promise<number> {
    const opps = await this.getOpportunities(1);
    if (opps.length === 0) return 0;

    const data = opps.map((o) => ({
      matchId: o.matchId,
      spreadPct: o.spreadPct,
      direction: o.direction,
      polyYes: o.polymarketYes,
      kalshiYes: o.kalshiYes,
      confidence: o.confidence,
    }));

    const result = await this.prisma.arbitrageSnapshot.createMany({ data });
    return result.count;
  }

  async getComparison(matchId: string): Promise<VenueComparison | null> {
    const match = await this.prisma.marketMatch.findUnique({
      where: { id: matchId },
    });
    if (!match) return null;

    const [poly, kalshi] = await Promise.all([
      this.prisma.market.findUnique({
        where: { id: match.polymarketId },
        select: {
          id: true,
          title: true,
          tokens: { select: { id: true, outcome: true, price: true } },
        },
      }),
      this.prisma.market.findUnique({
        where: { id: match.kalshiId },
        select: {
          id: true,
          title: true,
          tokens: { select: { id: true, outcome: true, price: true } },
        },
      }),
    ]);

    if (!poly || !kalshi) return null;

    const tokenIds = [
      ...poly.tokens.map((t) => t.id),
      ...kalshi.tokens.map((t) => t.id),
    ];
    const livePrices = await this.fetchLivePrices(tokenIds);

    const polyYes = this.getYesPrice(poly, livePrices) ?? 0;
    const polyNo = this.getNoPrice(poly, livePrices) ?? 0;
    const kalshiYes = this.getYesPrice(kalshi, livePrices) ?? 0;
    const kalshiNo = this.getNoPrice(kalshi, livePrices) ?? 0;

    return {
      matchId: match.id,
      polymarket: {
        marketId: poly.id,
        title: poly.title,
        yesPrice: polyYes,
        noPrice: polyNo,
      },
      kalshi: {
        marketId: kalshi.id,
        title: kalshi.title,
        yesPrice: kalshiYes,
        noPrice: kalshiNo,
      },
      spreadPct: Math.round(Math.abs(polyYes - kalshiYes) * 100 * 100) / 100,
      confidence: Number(match.confidence),
      verified: match.verified,
    };
  }

  private async maybeAlert(opp: CrossVenueOpportunity): Promise<void> {
    const now = Date.now();
    const lastAlert = this.alertCooldowns.get(opp.matchId) ?? 0;
    if (now - lastAlert < ALERT_COOLDOWN_MS) return;

    this.alertCooldowns.set(opp.matchId, now);

    await this.redis.xadd(STREAM, {
      type: "ARBITRAGE_CROSS_VENUE",
      matchId: opp.matchId,
      polymarketId: opp.polymarketId,
      kalshiId: opp.kalshiId,
      spreadPct: String(opp.spreadPct),
      direction: opp.direction,
      ts: String(now),
    });

    this.logger.log(
      `Cross-venue arb alert: ${opp.polymarketTitle} spread=${opp.spreadPct}% ${opp.direction}`,
    );
  }

  private getYesPrice(
    market: { tokens: { id: string; outcome: string; price: any }[] },
    livePrices: Map<string, number>,
  ): number | null {
    const token = market.tokens.find((t) => t.outcome.toUpperCase() === "YES");
    if (!token) return null;
    return livePrices.get(token.id) ?? parseFloat(String(token.price));
  }

  private getNoPrice(
    market: { tokens: { id: string; outcome: string; price: any }[] },
    livePrices: Map<string, number>,
  ): number | null {
    const token = market.tokens.find((t) => t.outcome.toUpperCase() === "NO");
    if (!token) return null;
    return livePrices.get(token.id) ?? parseFloat(String(token.price));
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
        /* ignore */
      }
    });

    return map;
  }
}
