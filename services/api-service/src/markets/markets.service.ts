import { Injectable, NotFoundException, OnModuleInit, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { paginate, PaginatedResponse } from "../common/dto/pagination.dto";
import { MarketQueryDto, PriceHistoryQueryDto } from "./dto/market-query.dto";

@Injectable()
export class MarketsService implements OnModuleInit {
  private readonly logger = new Logger(MarketsService.name);

  // Whitelist of allowed ORDER BY expressions - SQL injection protection
  private readonly allowedSortColumns = new Map<string, string>([
    ['endDate', 'm."endDate" ASC NULLS LAST'],
    ['closing_soon', 'm."endDate" ASC NULLS LAST'],
    ['firstSeenAt', 'm."firstSeenAt" DESC'],
    ['newest', 'm."firstSeenAt" DESC'],
    ['volume', 'm.volume24h DESC'],
    ['liquidity', 'm.volume24h DESC'], // Token-level liquidity not available on Market; use volume as proxy
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Pre-warm the Redis cache with the first page of markets on startup */
  async onModuleInit() {
    try {
      // Pre-warm Prisma connection pool + cache the default query
      await this.list({ page: 1, limit: 25, sort: 'volume' } as MarketQueryDto);
      this.logger.log("Markets cache pre-warmed (page 1, 25 items)");
    } catch {
      this.logger.warn("Markets cache pre-warm failed (non-fatal)");
    }
  }

  async list(query: MarketQueryDto): Promise<PaginatedResponse<any>> {
    // Build cache key from query params
    const cacheKey = `cache:markets:list:${JSON.stringify(query)}`;

    // Check Redis cache first (30s TTL)
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch {}
    }

    const { page, limit, search, category, closed, sort } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { seriesSlug: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (closed !== undefined) where.closed = closed;

    const orderBy: any =
      sort === "endDate" || sort === "closing_soon"
        ? { endDate: "asc" }
        : sort === "firstSeenAt" || sort === "newest"
          ? { firstSeenAt: "desc" }
          : { volume24h: "desc" }; // liquidity falls back to volume (liquidity is on Token, not Market)

    // Cache count separately with longer TTL (counts are expensive on 20K+ rows)
    const countCacheKey = `cache:markets:count:${JSON.stringify({ search, category, closed })}`;
    let total: number;
    const cachedCount = await this.redis.get(countCacheKey);
    if (cachedCount) {
      total = parseInt(cachedCount, 10);
    } else {
      // Use estimated count for unfiltered queries (pg_class is instant vs 25s COUNT(*))
      const hasFilters = search || category || closed !== undefined;
      if (!hasFilters) {
        const estimate: { reltuples: number }[] = await this.prisma.$queryRaw`
          SELECT reltuples::int FROM pg_class WHERE relname = 'markets'`;
        total = estimate[0]?.reltuples ?? 0;
        // Fall back to exact count if estimate is stale (0 or negative)
        if (total <= 0) {
          total = await this.prisma.market.count({ where });
        }
      } else {
        total = await this.prisma.market.count({ where });
      }
      await this.redis.set(countCacheKey, String(total), 600); // 10 min TTL
    }

    // Single raw SQL query — Prisma ORM adds ~5-15s overhead on resource-limited hosts
    // Validate sort parameter against whitelist to prevent SQL injection
    const orderCol = this.allowedSortColumns.get(sort) || this.allowedSortColumns.get('volume');

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (m.title ILIKE $${paramIdx} OR m.\"seriesSlug\" ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (category) {
      whereClause += ` AND LOWER(m.category) = LOWER($${paramIdx})`;
      params.push(category);
      paramIdx++;
    }
    if (closed !== undefined) {
      whereClause += ` AND m.closed = $${paramIdx}`;
      params.push(closed);
      paramIdx++;
    }

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        m.id, m.slug, m.title, m.description, m.category, m.image,
        m."seriesSlug", m."endDate", m.closed, m."negRisk",
        m.volume24h, m."firstSeenAt", m."lastUpdatedAt",
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id, 'marketId', t."marketId",
              'outcome', t.outcome, 'price', t.price, 'liquidity', t.liquidity
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) AS tokens
      FROM markets m
      LEFT JOIN tokens t ON t."marketId" = m.id
      ${whereClause}
      GROUP BY m.id
      ORDER BY ${orderCol}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, ...params, limit, skip);

    const result = paginate(rows, total, page, limit);

    // Cache for 120 seconds
    await this.redis.set(cacheKey, JSON.stringify(result), 120);

    return result;
  }

  async findOne(marketId: string): Promise<any> {
    // Check Redis cache first (60s TTL)
    const cacheKey = `cache:markets:id:${marketId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch {}
    }

    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: { tokens: true },
    });
    if (!market) {
      throw new NotFoundException({
        code: "MARKET_NOT_FOUND",
        message: "Market not found",
      });
    }

    // Cache for 60 seconds
    await this.redis.set(cacheKey, JSON.stringify(market), 60);

    return market;
  }

  async priceHistory(
    tokenId: string,
    query: PriceHistoryQueryDto,
  ): Promise<any> {
    const { resolution, from, to, limit } = query;

    // Check Redis cache first (10s TTL)
    const cacheKey = `cache:markets:pricehistory:${tokenId}:${JSON.stringify(query)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch {}
    }

    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    // Map resolution to TimescaleDB bucket interval
    const bucket =
      resolution === "1m"
        ? "1 minute"
        : resolution === "1d"
          ? "1 day"
          : "1 hour";

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

    const result = {
      tokenId,
      resolution,
      hasGaps: gapCount > 0,
      data: rows.map((r) => ({
        time: r.time,
        open: String(r.open ?? "0"),
        high: String(r.high ?? "0"),
        low: String(r.low ?? "0"),
        close: String(r.close ?? "0"),
        volume: String(r.volume ?? "0"),
      })),
    };

    // Cache for 10 seconds
    await this.redis.set(cacheKey, JSON.stringify(result), 10);

    return result;
  }

  async orderBook(tokenId: string): Promise<any> {
    const raw = await this.redis.get(`cache:book:${tokenId}`);
    if (!raw) {
      return {
        tokenId,
        bids: [],
        asks: [],
        spread: "0",
        midpoint: "0",
        timestamp: Date.now(),
      };
    }

    const book = JSON.parse(raw);
    const bestBid = book.bids?.[0]?.price ?? 0;
    const bestAsk = book.asks?.[0]?.price ?? 0;
    const spread =
      bestAsk && bestBid
        ? (parseFloat(bestAsk) - parseFloat(bestBid)).toFixed(4)
        : "0";
    const midpoint =
      bestAsk && bestBid
        ? ((parseFloat(bestAsk) + parseFloat(bestBid)) / 2).toFixed(4)
        : "0";

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
