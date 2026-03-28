import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { PolymarketWsService } from "./polymarket-ws.service";
import { GAMMA_LIMITER } from "../common/rate-limiter";

interface GammaToken {
  tokenId: string;
  outcome: string;
  price: string;
  liquidity: string;
}

interface GammaMarket {
  // Common fields
  id: string;
  slug: string;
  description?: string;
  image?: string;
  endDate?: string;
  closed: boolean;
  negRisk?: boolean;

  // Mock format
  title?: string;
  category?: string;
  seriesSlug?: string;
  volume24h?: string;
  tokens?: GammaToken[];

  // Real Polymarket format
  question?: string;
  volume24hr?: number;
  liquidity?: string | number;
  clobTokenIds?: string; // JSON array string
  outcomes?: string; // JSON array string
  outcomePrices?: string; // JSON array string
  events?: Array<{ slug?: string }>;
}

interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  markets: string[]; // market IDs grouped under this event
}

const SYNC_INTERVAL_MS = 60_000; // poll for new markets every minute

/**
 * Classify a market into a human-readable category based on slug patterns
 * and title keywords. Falls back to "Other" if no pattern matches.
 */
function classifyCategory(slug: string, title: string): string {
  const s = slug.toLowerCase();
  const t = title.toLowerCase();

  // Sports — team-based leagues
  if (/^(nba|nfl|mlb|nhl|cbb|cfb|mls|epl|ucl|liga|serie-a|ligue1|wnba)-/.test(s)) return "Sports";
  if (/^(atp|wta)-/.test(s)) return "Sports"; // Tennis
  if (/^(f1|motogp|nascar)-/.test(s)) return "Sports"; // Motorsport
  if (/^(ufc|boxing|mma|pfl)-/.test(s)) return "Sports"; // Combat
  if (/^(pga|lpga|golf)-/.test(s)) return "Sports"; // Golf
  // Esports
  if (/^(cs2|dota2|lol|valorant|rl)-/.test(s)) return "Sports";

  // Crypto
  if (/bitcoin|btc|ethereum|eth|solana|sol|crypto|token|defi/.test(s)) return "Crypto";
  if (/bitcoin|btc|ethereum|eth|solana|crypto/.test(t)) return "Crypto";

  // Politics
  if (/trump|biden|harris|election|president|congress|senate|governor|mayor|democrat|republican|gop|primary|caucus|impeach|netanyahu|zelensky|putin|parliament|minister|regime/.test(s)) return "Politics";
  if (/trump|biden|harris|election|president|congress|senate|governor|democrat|republican|netanyahu|zelensky|putin/.test(t)) return "Politics";
  if (/^us-|^uk-|^eu-/.test(s) && /policy|act|bill|vote|law|sanction|ceasefire|forces|war|peace/.test(s)) return "Politics";

  // Economics
  if (/fed-rate|interest-rate|inflation|gdp|recession|unemployment|jobs-report|cpi|ppi|fomc/.test(s)) return "Economics";
  if (/federal reserve|interest rate|inflation|gdp|recession|unemployment/.test(t)) return "Economics";

  // Finance
  if (/^(spy|qqq|djia|nasdaq|s-?p-?500|crude-oil|gold|silver|treasury|bond|stock|will-.*-hit)/.test(s)) return "Finance";
  if (/crude.oil|stock.market|s&p|nasdaq|dow.jones|treasury|bond.yield/.test(t)) return "Finance";

  // Technology
  if (/ai|openai|google|apple|meta|microsoft|tesla|spacex|neuralink|launch|ipo|antitrust|ftc/.test(s)) return "Technology";
  if (/artificial intelligence|openai|chatgpt|spacex|launch|ipo/.test(t)) return "Technology";

  return "Other";
}

@Injectable()
export class GammaApiService implements OnModuleInit {
  private readonly logger = new Logger(GammaApiService.name);
  private readonly gammaUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: PolymarketWsService,
  ) {
    this.gammaUrl = process.env.GAMMA_API_URL ?? "http://localhost:3096";
  }

  async onModuleInit() {
    // Run initial sync in background so the server starts immediately
    this.syncMarkets().catch((err) =>
      this.logger.error("Initial market sync failed", err),
    );
  }

  @Interval(SYNC_INTERVAL_MS)
  async syncMarkets() {
    try {
      await this.syncAllMarkets();
      // TODO(2026-Q2): Enable once Event model is added to Prisma schema
      // await this.syncEvents();
    } catch (err) {
      this.logger.error("Failed to sync markets from Gamma API", err);
    }
  }

  /**
   * Paginate through ALL active markets from the Gamma API.
   * Fetches in pages of 100 until fewer than `limit` results are returned.
   */
  async syncAllMarkets(): Promise<void> {
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let totalSynced = 0;

    while (hasMore) {
      const markets = await this.fetchMarkets(offset, limit);
      if (markets.length < limit) hasMore = false;

      for (const market of markets) {
        // Skip neg-risk markets (binary-only filter)
        if (market.negRisk) continue;

        try {
          // Parse tokens — handle both mock format (tokens[]) and real format (clobTokenIds JSON string)
          const tokens = this.parseTokens(market);
          await this.upsertMarket(market, tokens);

          // Subscribe WebSocket to all tokens in this market
          const tokenIds = tokens.map((t) => t.tokenId);
          if (tokenIds.length > 0) this.ws.subscribeTokens(tokenIds);
          totalSynced++;
        } catch (err) {
          this.logger.warn(`Skipped market ${market.id}: ${(err as Error).message}`);
        }
      }

      offset += limit;
    }

    this.logger.log(`Synced ${totalSynced} markets from Gamma API`);
  }

  // TODO(2026-Q2): Enable syncEvents once Event model is added to Prisma schema
  // Placeholder for syncing events grouped by category/series
  // async syncEvents(): Promise<void> { ... }

  // ─── Private ─────────────────────────────────────────────────────────────

  async fetchMarkets(
    offset: number,
    limit: number,
  ): Promise<GammaMarket[]> {
    await GAMMA_LIMITER.acquire();
    const res = await fetch(
      `${this.gammaUrl}/markets?closed=false&limit=${limit}&offset=${offset}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!res.ok) throw new Error(`Gamma API returned ${res.status}`);

    const body = await res.json() as { data?: unknown[] } | unknown[];
    // Real Polymarket returns a raw array; mock wraps in { data: [] }
    const arr = Array.isArray(body) ? body : ((body as { data?: unknown[] }).data ?? []);
    return arr as GammaMarket[];
  }

  // TODO(2026-Q2): Enable fetchEvents + upsertEvent once Event model is added to Prisma schema
  // These methods will fetch events from Gamma API and upsert them into the database
  // private async fetchEvents(): Promise<GammaEvent[]> { ... }
  // private async upsertEvent(event: GammaEvent) { ... }

  /**
   * Parse tokens from either mock format (tokens[]) or real Polymarket format
   * (clobTokenIds + outcomes + outcomePrices as JSON strings).
   */
  private parseTokens(market: GammaMarket): GammaToken[] {
    // Mock format — tokens array already present
    if (market.tokens && market.tokens.length > 0) return market.tokens;

    // Real Polymarket format — parse JSON string fields
    try {
      const tokenIds: string[] = market.clobTokenIds ? JSON.parse(market.clobTokenIds) : [];
      const outcomes: string[] = market.outcomes ? JSON.parse(market.outcomes) : [];
      const prices: string[] = market.outcomePrices ? JSON.parse(market.outcomePrices) : [];

      return tokenIds.map((tokenId, i) => ({
        tokenId,
        outcome: outcomes[i] ?? `Outcome ${i + 1}`,
        price: prices[i] ?? "0",
        liquidity: String(market.liquidity ?? "0"),
      }));
    } catch {
      return [];
    }
  }

  private async upsertMarket(market: GammaMarket, tokens: GammaToken[]) {
    const title = market.title ?? market.question ?? market.slug;
    const eventSlug = market.seriesSlug ?? market.events?.[0]?.slug ?? market.slug;
    const category = classifyCategory(eventSlug, title);
    const volume = market.volume24h
      ? parseFloat(market.volume24h)
      : (typeof market.volume24hr === "number" ? market.volume24hr : 0);

    // Upsert the market record
    await this.prisma.market.upsert({
      where: { id: market.id },
      create: {
        id: market.id,
        slug: market.slug,
        title,
        description: market.description,
        category,
        image: market.image ?? null,
        seriesSlug: eventSlug,
        endDate: market.endDate ? new Date(market.endDate) : undefined,
        closed: market.closed,
        negRisk: market.negRisk ?? false,
        volume24h: volume,
      },
      update: {
        title,
        category,
        closed: market.closed,
        image: market.image ?? undefined,
        volume24h: volume,
        lastUpdatedAt: new Date(),
      },
    });

    // Batch upsert tokens in a single transaction
    if (tokens.length > 0) {
      await this.prisma.$transaction(
        tokens.map((token) =>
          this.prisma.token.upsert({
            where: { id: token.tokenId },
            create: {
              id: token.tokenId,
              marketId: market.id,
              outcome: token.outcome,
              price: parseFloat(token.price),
              liquidity: parseFloat(token.liquidity),
            },
            update: {
              price: parseFloat(token.price),
              liquidity: parseFloat(token.liquidity),
            },
          }),
        ),
      );
    }
  }
}
