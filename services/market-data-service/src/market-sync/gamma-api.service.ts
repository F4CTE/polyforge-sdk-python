import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '@polyforge/shared-db';
import { PolymarketWsService } from './polymarket-ws.service';

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
    seriesSlug?: string;
    endDate?: string;
    closed: boolean;
    negRisk?: boolean;
    volume24h?: string;
    tokens: GammaToken[];
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
        this.gammaUrl = process.env.GAMMA_API_URL ?? 'http://localhost:3096';
    }

    async onModuleInit() {
        await this.syncMarkets();
    }

    @Interval(SYNC_INTERVAL_MS)
    async syncMarkets() {
        try {
            const markets = await this.fetchActiveMarkets();

            for (const market of markets) {
                // Skip neg-risk markets (binary-only filter)
                if (market.negRisk) continue;

                await this.upsertMarket(market);

                // Subscribe WebSocket to all tokens in this market
                const tokenIds = market.tokens.map(t => t.tokenId);
                this.ws.subscribeTokens(tokenIds);
            }

            this.logger.log(`Synced ${markets.length} markets from Gamma API`);
        } catch (err) {
            this.logger.error('Failed to sync markets from Gamma API', err);
        }
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private async fetchActiveMarkets(): Promise<GammaMarket[]> {
        const res = await fetch(`${this.gammaUrl}/markets?closed=false&limit=100`, {
            signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) throw new Error(`Gamma API returned ${res.status}`);

        const body = await res.json() as { data: GammaMarket[] };
        return body.data;
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
                seriesSlug: market.seriesSlug,
                endDate: market.endDate ? new Date(market.endDate) : undefined,
                closed: market.closed,
                negRisk: market.negRisk ?? false,
                volume24h: parseFloat(market.volume24h ?? '0'),
            },
            update: {
                closed: market.closed,
                volume24h: parseFloat(market.volume24h ?? '0'),
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
