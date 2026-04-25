import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";
import { paginate, PaginatedResponse } from "../common/dto/pagination.dto";
import {
  MarketQueryDto,
  PriceHistoryQueryDto,
  ClobPriceHistoryQueryDto,
} from "./dto/market-query.dto";
import { ClobReadService } from "../common/services/clob-read.service";

@Injectable()
export class MarketsService implements OnModuleInit {
  private readonly logger = new Logger(MarketsService.name);
  private readonly gammaUrl: string;

  // Whitelist of allowed ORDER BY expressions - SQL injection protection
  private readonly allowedSortColumns = new Map<string, string>([
    ["endDate", 'm."endDate" ASC NULLS LAST'],
    ["closing_soon", 'm."endDate" ASC NULLS LAST'],
    ["firstSeenAt", 'm."firstSeenAt" DESC'],
    ["newest", 'm."firstSeenAt" DESC'],
    ["volume", "m.volume24h DESC"],
    ["liquidity", "m.volume24h DESC"], // Token-level liquidity not available on Market; use volume as proxy
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly clob: ClobReadService,
  ) {
    this.gammaUrl =
      this.config.get<string>("GAMMA_API_URL") ?? "http://localhost:3096";
  }

  /** Pre-warm the Redis cache with the first page of markets on startup */
  async onModuleInit() {
    try {
      // Pre-warm Prisma connection pool + cache the default query
      await this.list({ page: 1, limit: 25, sort: "volume" } as MarketQueryDto);
      this.logger.log("Markets cache pre-warmed (page 1, 25 items)");
    } catch {
      this.logger.warn("Markets cache pre-warm failed (non-fatal)");
    }
  }

  async list(
    query: MarketQueryDto,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    // Build cache key from query params
    const cacheKey = `cache:markets:list:${JSON.stringify(query)}`;

    // Check Redis cache first (30s TTL)
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const { page, limit, search, category, closed, sort } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { seriesSlug: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) where.category = { equals: category, mode: "insensitive" };
    if (closed !== undefined) where.closed = closed;

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const orderCol = Prisma.raw(
      (this.allowedSortColumns.get(sort ?? "volume") ||
        this.allowedSortColumns.get("volume"))!,
    );

    // Build dynamic WHERE conditions using Prisma.sql for safe parameterization
    const conditions: Prisma.Sql[] = [];
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        Prisma.sql`(m.title ILIKE ${pattern} OR m."seriesSlug" ILIKE ${pattern})`,
      );
    }
    if (category) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      conditions.push(Prisma.sql`LOWER(m.category) = LOWER(${category})`);
    }
    if (closed !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      conditions.push(Prisma.sql`m.closed = ${closed}`);
    }

    // Prisma namespace resolution issue — these calls are safe
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let whereClause: Prisma.Sql = Prisma.empty;
    if (conditions.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const joined = Prisma.join(conditions, " AND ");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      whereClause = Prisma.sql`WHERE ${joined}`;
    }

    const rows: Record<string, unknown>[] = await this.prisma.$queryRaw(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      Prisma.sql`
      SELECT
        m.id, m.slug, m.title, m.description, m.category, m.image,
        m."seriesSlug", m."endDate", m.closed, m."negRisk",
        m.volume24h, m."firstSeenAt", m."lastUpdatedAt",
        (SELECT COUNT(*)::int FROM strategies s2 WHERE s2."marketId" = m.id) AS "strategyCount",
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
      LIMIT ${limit} OFFSET ${skip}
    `,
    );

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
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
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
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
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

    type PriceRow = {
      time: Date;
      open: string | null;
      high: string | null;
      low: string | null;
      close: string | null;
      volume: string | null;
    };
    const rows: PriceRow[] = await this.prisma.$queryRaw`
            SELECT
                time_bucket(${bucket}::interval, time) AS time,
                first(open, time) AS open,
                max(high) AS high,
                min(low) AS low,
                last(close, time) AS close,
                sum(volume) AS volume
            FROM price_snapshots
            WHERE "tokenId" = ${tokenId}
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

  async orderBook(tokenId: string): Promise<{
    tokenId: string;
    bids: unknown[];
    asks: unknown[];
    spread: string;
    midpoint: string;
    timestamp: number;
  }> {
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

    const book = JSON.parse(raw) as {
      bids?: Array<{ price?: string }>;
      asks?: Array<{ price?: string }>;
      timestamp?: number;
    };
    const bestBid = book.bids?.[0]?.price ?? 0;
    const bestAsk = book.asks?.[0]?.price ?? 0;
    const spread =
      bestAsk && bestBid
        ? (parseFloat(String(bestAsk)) - parseFloat(String(bestBid))).toFixed(4)
        : "0";
    const midpoint =
      bestAsk && bestBid
        ? (
            (parseFloat(String(bestAsk)) + parseFloat(String(bestBid))) /
            2
          ).toFixed(4)
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

  async tickSize(
    tokenId: string,
  ): Promise<{ tokenId: string; tickSize: string; feeRate: string }> {
    const cacheKey = `cache:ticksize:${tokenId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const [tickSize, feeRate] = await Promise.all([
      this.clob.getTickSize(tokenId),
      this.clob.getFeeRate(tokenId),
    ]);

    const result = { tokenId, tickSize, feeRate };
    await this.redis.set(cacheKey, JSON.stringify(result), 600);

    return result;
  }

  async spread(tokenId: string): Promise<{ tokenId: string; spread: string }> {
    const cacheKey = `cache:spread:${tokenId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const data = await this.clob.getSpread(tokenId);
    const result = { tokenId, spread: data.spread };
    await this.redis.set(cacheKey, JSON.stringify(result), 10);
    return result;
  }

  async midpoint(
    tokenId: string,
  ): Promise<{ tokenId: string; midpoint: string }> {
    const cacheKey = `cache:midpoint:${tokenId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const data = await this.clob.getMidpoint(tokenId);
    const result = { tokenId, midpoint: data.mid };
    await this.redis.set(cacheKey, JSON.stringify(result), 10);
    return result;
  }

  async clobBook(tokenId: string): Promise<{
    tokenId: string;
    bids: unknown[];
    asks: unknown[];
    spread: string;
    midpoint: string;
    timestamp: number;
  }> {
    const cacheKey = `cache:clobbook:${tokenId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const data = await this.clob.getBook(tokenId);

    const result = {
      tokenId,
      bids: data.bids,
      asks: data.asks,
      spread: data.spread,
      midpoint: data.midpoint,
      timestamp: data.timestamp,
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 5);
    return result;
  }

  async clobPricesHistory(
    tokenId: string,
    query: ClobPriceHistoryQueryDto,
  ): Promise<{ tokenId: string; interval: string; history: unknown[] }> {
    const { interval = "1h", fidelity = 60 } = query;
    const cacheKey = `cache:clobprices:${tokenId}:${interval}:${fidelity}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const data = await this.clob.getPricesHistory(tokenId, interval, fidelity);
    const result = {
      tokenId,
      interval,
      history: data.history,
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 30);
    return result;
  }

  async marketHistory(
    marketId: string,
    period: string,
  ): Promise<{
    data: Array<{
      timestamp: string;
      yesPrice: number;
      noPrice: number;
      volume: number;
    }>;
  }> {
    const tokens = await this.prisma.token.findMany({
      where: { marketId },
      select: { id: true, outcome: true },
    });

    if (tokens.length === 0) {
      return { data: [] };
    }

    const periodMs: Record<string, number> = {
      "1d": 86400_000,
      "7d": 7 * 86400_000,
      "30d": 30 * 86400_000,
      "90d": 90 * 86400_000,
    };
    const ms = periodMs[period] ?? periodMs["7d"];
    const fromDate = new Date(Date.now() - ms);

    const yesToken = tokens.find(
      (t) => t.outcome === "Yes" || t.outcome === "YES",
    );
    const noToken = tokens.find(
      (t) => t.outcome === "No" || t.outcome === "NO",
    );
    const tokenIds = tokens.map((t) => t.id);

    type SnapshotRow = {
      time: Date;
      tokenId: string;
      close: string | null;
      volume: string | null;
    };
    const rows: SnapshotRow[] = await this.prisma.$queryRaw`
      SELECT
        time_bucket('1 hour'::interval, time) AS time,
        "tokenId",
        last(close, time) AS close,
        sum(volume) AS volume
      FROM price_snapshots
      WHERE "tokenId" = ANY(${tokenIds})
        AND time >= ${fromDate}
      GROUP BY 1, 2
      ORDER BY 1 ASC
      LIMIT 2000
    `;

    const timeMap = new Map<
      string,
      { yesPrice: number; noPrice: number; volume: number }
    >();
    for (const row of rows) {
      const ts = row.time.toISOString();
      const entry = timeMap.get(ts) ?? { yesPrice: 0, noPrice: 0, volume: 0 };
      const price = parseFloat(row.close ?? "0");
      const vol = parseFloat(row.volume ?? "0");

      if (yesToken && row.tokenId === yesToken.id) entry.yesPrice = price;
      else if (noToken && row.tokenId === noToken.id) entry.noPrice = price;
      entry.volume += vol;
      timeMap.set(ts, entry);
    }

    return {
      data: Array.from(timeMap.entries()).map(([ts, v]) => ({
        timestamp: ts,
        ...v,
      })),
    };
  }

  async listMarketAlerts(
    marketId: string,
    userId: string,
  ): Promise<{
    data: Array<{
      id: string;
      marketId: string;
      outcome: string;
      condition: string;
      threshold: number;
      triggered: boolean;
      createdAt: Date;
    }>;
  }> {
    const tokenIds = await this.prisma.token.findMany({
      where: { marketId },
      select: { id: true, outcome: true },
    });
    const tokenIdList = tokenIds.map((t) => t.id);
    const tokenOutcomeMap = new Map(tokenIds.map((t) => [t.id, t.outcome]));

    const alerts = await this.prisma.priceAlert.findMany({
      where: { userId, tokenId: { in: tokenIdList } },
      orderBy: { createdAt: "desc" },
    });

    return {
      data: alerts.map((a) => ({
        id: a.id,
        marketId,
        outcome: tokenOutcomeMap.get(a.tokenId) ?? "YES",
        condition: a.direction,
        threshold: parseFloat(String(a.price)),
        triggered: a.triggered,
        createdAt: a.createdAt,
      })),
    };
  }

  async createMarketAlert(
    marketId: string,
    userId: string,
    dto: { outcome: string; condition: string; threshold: number },
  ): Promise<{
    id: string;
    marketId: string;
    outcome: string;
    condition: string;
    threshold: number;
    triggered: boolean;
    createdAt: Date;
  }> {
    const token = await this.prisma.token.findFirst({
      where: {
        marketId,
        outcome: { equals: dto.outcome, mode: "insensitive" },
      },
    });
    if (!token) {
      throw new NotFoundException({
        code: "TOKEN_NOT_FOUND",
        message: `No ${dto.outcome} token for this market`,
      });
    }

    const alert = await this.prisma.priceAlert.create({
      data: {
        userId,
        tokenId: token.id,
        direction: dto.condition,
        price: dto.threshold,
      },
    });

    return {
      id: alert.id,
      marketId,
      outcome: dto.outcome,
      condition: dto.condition,
      threshold: dto.threshold,
      triggered: false,
      createdAt: alert.createdAt,
    };
  }

  async deleteMarketAlert(alertId: string, userId: string): Promise<void> {
    const alert = await this.prisma.priceAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Alert not found",
      });
    if (alert.userId !== userId)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Alert not found",
      });
    await this.prisma.priceAlert.delete({ where: { id: alertId } });
  }

  async getMarketSentiment(
    marketId: string,
    userId?: string,
  ): Promise<{
    yesPercent: number;
    noPercent: number;
    totalVotes: number;
    userVote: { direction: string; confidence: number } | null;
  }> {
    const signals = await this.prisma.newsSignal.findMany({
      where: {
        marketId,
        createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
      },
      select: { direction: true, confidence: true },
    });

    const buys = signals.filter((s) => s.direction === "BUY");
    const sells = signals.filter((s) => s.direction === "SELL");
    const total = signals.length || 1;

    return {
      yesPercent: Math.round((buys.length / total) * 100),
      noPercent: Math.round((sells.length / total) * 100),
      totalVotes: signals.length,
      userVote: null,
    };
  }

  async search(query: {
    q: string;
    limit?: number;
  }): Promise<{ results: unknown[] }> {
    const cacheKey = `cache:markets:search:${query.q}:${query.limit ?? 20}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const url = `${this.gammaUrl}/public-search?q=${encodeURIComponent(query.q)}&limit=${query.limit ?? 20}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!res.ok) {
      this.logger.warn(`Gamma public-search returned ${res.status}`);
      return { results: [] };
    }

    const body = (await res.json()) as unknown[];
    const result = { results: Array.isArray(body) ? body : [] };
    await this.redis.set(cacheKey, JSON.stringify(result), 300);

    return result;
  }
}
