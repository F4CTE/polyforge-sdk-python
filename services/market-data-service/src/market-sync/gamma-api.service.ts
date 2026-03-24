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
  id: string;
  slug: string;
  title: string;
  description?: string;
  category?: string;
  image?: string;
  seriesSlug?: string;
  endDate?: string;
  closed: boolean;
  negRisk?: boolean;
  volume24h?: string;
  tokens: GammaToken[];
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
    await this.syncMarkets();
  }

  @Interval(SYNC_INTERVAL_MS)
  async syncMarkets() {
    try {
      await this.syncAllMarkets();
      await this.syncEvents();
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

        await this.upsertMarket(market);

        // Subscribe WebSocket to all tokens in this market
        const tokenIds = market.tokens.map((t) => t.tokenId);
        this.ws.subscribeTokens(tokenIds);
        totalSynced++;
      }

      offset += limit;
    }

    this.logger.log(`Synced ${totalSynced} markets from Gamma API`);
  }

  /**
   * Fetch events from the Gamma API. Events group multiple markets together.
   */
  async syncEvents(): Promise<void> {
    try {
      const events = await this.fetchEvents();

      for (const event of events) {
        await this.upsertEvent(event);
      }

      this.logger.log(`Synced ${events.length} events from Gamma API`);
    } catch (err) {
      this.logger.error("Failed to sync events from Gamma API", err);
    }
  }

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

    const body = (await res.json()) as { data: GammaMarket[] };
    return body.data;
  }

  private async fetchEvents(): Promise<GammaEvent[]> {
    const res = await fetch(`${this.gammaUrl}/events`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`Gamma events API returned ${res.status}`);

    const body = (await res.json()) as { data: GammaEvent[] };
    return body.data;
  }

  private async upsertEvent(event: GammaEvent) {
    await this.prisma.event.upsert({
      where: { id: event.id },
      create: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        startDate: event.startDate ? new Date(event.startDate) : undefined,
        endDate: event.endDate ? new Date(event.endDate) : undefined,
      },
      update: {
        title: event.title,
        description: event.description,
        endDate: event.endDate ? new Date(event.endDate) : undefined,
        lastUpdatedAt: new Date(),
      },
    });
  }

  private async upsertMarket(market: GammaMarket) {
    // Upsert the market record
    await this.prisma.market.upsert({
      where: { id: market.id },
      create: {
        id: market.id,
        slug: market.slug,
        title: market.title,
        description: market.description,
        category: market.category,
        image: market.image ?? null,
        seriesSlug: market.seriesSlug,
        endDate: market.endDate ? new Date(market.endDate) : undefined,
        closed: market.closed,
        negRisk: market.negRisk ?? false,
        volume24h: parseFloat(market.volume24h ?? "0"),
      },
      update: {
        closed: market.closed,
        image: market.image ?? undefined,
        volume24h: parseFloat(market.volume24h ?? "0"),
        lastUpdatedAt: new Date(),
      },
    });

    // Upsert tokens
    for (const token of market.tokens) {
      await this.prisma.token.upsert({
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
      });
    }
  }
}
