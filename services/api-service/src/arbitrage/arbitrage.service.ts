import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";

export interface ArbitrageOpportunity {
  marketId: string;
  marketTitle: string;
  category: string;
  endDate: string | null;
  yesTokenId: string;
  noTokenId: string;
  yesPrice: string;
  noPrice: string;
  sum: string;
  marginPct: string;
  /** Cost in USDC to buy 1 share of each outcome */
  costPerUnit: string;
  /** Guaranteed profit in USDC per unit on resolution */
  profitPerUnit: string;
}

const MIN_MARGIN_PCT = 0.5; // only show opps with >0.5% margin (covers CLOB fees)
const MAX_MARKETS = 1000;

@Injectable()
export class ArbitrageService {
  private readonly logger = new Logger(ArbitrageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getOpportunities(
    minMargin = MIN_MARGIN_PCT,
  ): Promise<ArbitrageOpportunity[]> {
    // 1. Fetch open binary markets with their token pairs
    const markets = await this.prisma.market.findMany({
      where: { closed: false },
      select: {
        id: true,
        title: true,
        category: true,
        endDate: true,
        tokens: {
          select: { id: true, outcome: true, price: true },
        },
      },
      orderBy: { volume24h: "desc" },
      take: MAX_MARKETS,
    });

    // Keep only binary markets (exactly one YES + one NO token)
    const binary = markets.filter(
      (m) =>
        m.tokens.length === 2 &&
        m.tokens.some((t) => t.outcome.toUpperCase() === "YES") &&
        m.tokens.some((t) => t.outcome.toUpperCase() === "NO"),
    );

    if (binary.length === 0) return [];

    // 2. Batch-read live prices from Redis (10 s cache, set by market-data-service)
    const tokenIds = binary.flatMap((m) => m.tokens.map((t) => t.id));

    const priceKeys = tokenIds.map((id) => `cache:price:${id}`);
    const client = this.redis.getClient();
    const rawPrices: (string | null)[] = await client.mget(...priceKeys);

    const priceMap = new Map<string, number>();
    tokenIds.forEach((id, i) => {
      const raw = rawPrices[i];
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { price: string | number };
        priceMap.set(id, parseFloat(String(parsed.price)));
      } catch {
        // ignore parse errors — fall back to DB price below
      }
    });

    // 3. Score each market
    const opportunities: ArbitrageOpportunity[] = [];

    for (const market of binary) {
      const yes = market.tokens.find((t) => t.outcome.toUpperCase() === "YES")!;
      const no = market.tokens.find((t) => t.outcome.toUpperCase() === "NO")!;

      // Prefer live Redis price, fall back to last DB snapshot
      const yesPrice = priceMap.get(yes.id) ?? parseFloat(String(yes.price));
      const noPrice = priceMap.get(no.id) ?? parseFloat(String(no.price));

      if (isNaN(yesPrice) || isNaN(noPrice)) continue;
      if (yesPrice <= 0 || noPrice <= 0) continue;

      const sum = yesPrice + noPrice;
      const marginPct = (1 - sum) * 100;

      if (marginPct < minMargin) continue;

      opportunities.push({
        marketId: market.id,
        marketTitle: market.title,
        category: market.category ?? "",
        endDate: market.endDate?.toISOString() ?? null,
        yesTokenId: yes.id,
        noTokenId: no.id,
        yesPrice: yesPrice.toFixed(6),
        noPrice: noPrice.toFixed(6),
        sum: sum.toFixed(6),
        marginPct: marginPct.toFixed(2),
        costPerUnit: sum.toFixed(4),
        profitPerUnit: (1 - sum).toFixed(4),
      });
    }

    // Sort best opportunities first
    return opportunities.sort(
      (a, b) => parseFloat(b.marginPct) - parseFloat(a.marginPct),
    );
  }
}
