import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { MarketQueryDto, PriceHistoryQueryDto } from './dto/market-query.dto';

@Injectable()
export class MarketsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) {}

    async list(query: MarketQueryDto): Promise<PaginatedResponse<any>> {
        const { page, limit, search, category, closed, sort } = query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { seriesSlug: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (category) where.category = category;
        if (closed !== undefined) where.closed = closed;

        const orderBy: any = sort === 'endDate' ? { endDate: 'asc' }
            : sort === 'firstSeenAt' ? { firstSeenAt: 'desc' }
            : { volume24h: 'desc' };

        const [markets, total] = await Promise.all([
            this.prisma.market.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: { tokens: true },
            }),
            this.prisma.market.count({ where }),
        ]);

        return paginate(markets, total, page, limit);
    }

    async findOne(marketId: string): Promise<any> {
        const market = await this.prisma.market.findUnique({
            where: { id: marketId },
            include: { tokens: true },
        });
        if (!market) {
            throw new NotFoundException({ code: 'MARKET_NOT_FOUND', message: 'Market not found' });
        }
        return market;
    }

    async priceHistory(tokenId: string, query: PriceHistoryQueryDto): Promise<any> {
        const { resolution, from, to, limit } = query;

        const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();

        // Map resolution to TimescaleDB bucket interval
        const bucket = resolution === '1m' ? '1 minute'
            : resolution === '1d' ? '1 day'
            : '1 hour';

        const rows: any[] = await this.prisma.$queryRaw`
            SELECT
                time_bucket(${bucket}::interval, time) AS time,
                first(open, time) AS open,
                max(high) AS high,
                min(low) AS low,
                last(close, time) AS close,
                sum(volume) AS volume
            FROM price_snapshots
            WHERE token_id = ${tokenId}
              AND time >= ${fromDate}
              AND time <= ${toDate}
            GROUP BY 1
            ORDER BY 1 ASC
            LIMIT ${limit}
        `;

        // Check for data gaps in range
        const gapCount = await this.prisma.dataGap.count({
            where: { tokenId, gapStart: { gte: fromDate }, gapEnd: { lte: toDate } },
        });

        return {
            tokenId,
            resolution,
            hasGaps: gapCount > 0,
            data: rows.map(r => ({
                time: r.time,
                open: String(r.open ?? '0'),
                high: String(r.high ?? '0'),
                low: String(r.low ?? '0'),
                close: String(r.close ?? '0'),
                volume: String(r.volume ?? '0'),
            })),
        };
    }

    async orderBook(tokenId: string): Promise<any> {
        const raw = await this.redis.get(`cache:book:${tokenId}`);
        if (!raw) {
            return { tokenId, bids: [], asks: [], spread: '0', midpoint: '0', timestamp: Date.now() };
        }

        const book = JSON.parse(raw);
        const bestBid = book.bids?.[0]?.price ?? 0;
        const bestAsk = book.asks?.[0]?.price ?? 0;
        const spread = bestAsk && bestBid ? (parseFloat(bestAsk) - parseFloat(bestBid)).toFixed(4) : '0';
        const midpoint = bestAsk && bestBid
            ? ((parseFloat(bestAsk) + parseFloat(bestBid)) / 2).toFixed(4)
            : '0';

        return {
            tokenId,
            bids: book.bids ?? [],
            asks: book.asks ?? [],
            spread,
            midpoint,
            timestamp: book.timestamp ?? Date.now(),
        };
    }
}
