import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { deriveServiceKey } from "@polyforge/shared-auth";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  SportsCategory,
  SPORTS_SERIES_TICKERS,
  SPORTS_CATEGORY_LABELS,
} from "@polyforge/shared-types";
import { paginate, PaginatedResponse } from "../common/dto/pagination.dto";
import {
  SportsMarketsQueryDto,
  SportsEventsQueryDto,
  MilestonesQueryDto,
  ComboCollectionsQueryDto,
} from "./dto/sports-query.dto";

@Injectable()
export class SportsService {
  private readonly logger = new Logger(SportsService.name);
  private readonly orderServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.orderServiceUrl =
      this.config.get<string>("ORDER_SERVICE_URL") ??
      "http://order-service:3007";
  }

  private getInternalAuthHeaders(): { Authorization: string } {
    const token = this.jwtService.sign(
      { sub: "api-service", jti: randomUUID() },
      {
        secret: deriveServiceKey(
          this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"),
          "api-service",
        ),
        audience: "order-service",
        issuer: "api-service",
        expiresIn: "30s",
        algorithm: "HS256",
      },
    );
    return { Authorization: `Bearer ${token}` };
  }

  async getCategories(): Promise<
    Array<{
      category: SportsCategory;
      label: string;
      seriesTickers: string[];
      marketCount: number;
    }>
  > {
    const cacheKey = "cache:sports:categories";
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const allSeriesTickers = Object.values(SPORTS_SERIES_TICKERS).flat();

    type CountRow = { category: string; count: bigint };
    const counts: CountRow[] = await this.prisma.$queryRaw`
      SELECT category, COUNT(*)::bigint AS count
      FROM markets
      WHERE venue = 'KALSHI'
        AND closed = false
        AND category IS NOT NULL
        AND (
          category = ANY(${allSeriesTickers})
          OR "seriesSlug" = ANY(${allSeriesTickers})
        )
      GROUP BY category
    `;

    const countMap = new Map(
      counts.map((c) => [c.category.toUpperCase(), Number(c.count)]),
    );

    const result = Object.values(SportsCategory)
      .map((cat) => {
        const tickers = SPORTS_SERIES_TICKERS[cat];
        const marketCount = tickers.reduce(
          (sum, t) => sum + (countMap.get(t) ?? 0),
          0,
        );
        return {
          category: cat,
          label: SPORTS_CATEGORY_LABELS[cat],
          seriesTickers: tickers,
          marketCount,
        };
      })
      .filter((c) => c.marketCount > 0 || c.category !== SportsCategory.OTHER);

    await this.redis.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async listMarkets(
    query: SportsMarketsQueryDto,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const {
      page,
      limit,
      category,
      search,
      seriesTicker,
      eventTicker,
      liveOnly,
      sort,
    } = query;
    const skip = (page - 1) * limit;

    const allSportsTickers = Object.values(SPORTS_SERIES_TICKERS).flat();
    const targetTickers = category
      ? (SPORTS_SERIES_TICKERS[category as SportsCategory] ?? [category])
      : allSportsTickers;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`m.venue = 'KALSHI'`,
      Prisma.sql`m.closed = ${liveOnly ? false : ((query as any).closed ?? false)}`,
    ];

    if (targetTickers.length > 0) {
      conditions.push(
        Prisma.sql`(m.category = ANY(${targetTickers}) OR m."seriesSlug" = ANY(${targetTickers}))`,
      );
    }

    if (seriesTicker) {
      conditions.push(Prisma.sql`m."seriesSlug" = ${seriesTicker}`);
    }
    if (eventTicker) {
      conditions.push(Prisma.sql`m."eventId" = ${eventTicker}`);
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(Prisma.sql`m.title ILIKE ${pattern}`);
    }
    if (liveOnly) {
      conditions.push(Prisma.sql`m."endDate" > NOW()`);
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

    const orderCol =
      sort === "closing_soon"
        ? Prisma.raw('m."endDate" ASC NULLS LAST')
        : sort === "newest"
          ? Prisma.raw('m."firstSeenAt" DESC')
          : Prisma.raw("m.volume24h DESC");

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`
        SELECT
          m.id, m.slug, m.title, m.description, m.category, m.image,
          m."seriesSlug", m."eventId", m."endDate", m.closed,
          m.volume24h, m."firstSeenAt",
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id, 'outcome', t.outcome, 'price', t.price
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
      ),
      this.prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM markets m ${whereClause}`,
      ),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return paginate(rows, total, page, limit);
  }

  async listEvents(
    query: SportsEventsQueryDto,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const { page, limit, category, seriesTicker } = query;
    const skip = (page - 1) * limit;

    const allSportsTickers = Object.values(SPORTS_SERIES_TICKERS).flat();
    const targetTickers = category
      ? (SPORTS_SERIES_TICKERS[category as SportsCategory] ?? [category])
      : seriesTicker
        ? [seriesTicker]
        : allSportsTickers;

    const conditions: Prisma.Sql[] = [];
    if (targetTickers.length > 0) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM markets m
          WHERE m."eventId" = e.id
            AND m.venue = 'KALSHI'
            AND (m.category = ANY(${targetTickers}) OR m."seriesSlug" = ANY(${targetTickers}))
        )`,
      );
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
        : Prisma.empty;

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`
        SELECT
          e.id AS "eventTicker",
          e.title,
          e.description,
          e."startDate" AS "startTime",
          e."endDate" AS "endTime",
          (SELECT COUNT(*)::int FROM markets m WHERE m."eventId" = e.id AND m.venue = 'KALSHI') AS "marketCount"
        FROM events e
        ${whereClause}
        ORDER BY e."endDate" ASC NULLS LAST
        LIMIT ${limit} OFFSET ${skip}
      `,
      ),
      this.prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM events e ${whereClause}`,
      ),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return paginate(rows, total, page, limit);
  }

  async getEventDetail(eventTicker: string): Promise<{
    event: Record<string, unknown>;
    markets: Record<string, unknown>[];
  }> {
    const cacheKey = `cache:sports:event:${eventTicker}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventTicker },
    });

    const markets = event
      ? await this.prisma.market.findMany({
          where: { eventId: eventTicker, venue: "KALSHI" },
          include: { tokens: true },
          orderBy: { volume24h: "desc" },
        })
      : [];

    const result = {
      event: event ?? { id: eventTicker, title: "Unknown Event" },
      markets,
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 60);
    return result;
  }

  async getMilestones(
    query: MilestonesQueryDto,
  ): Promise<{ milestones: unknown[]; cursor: string | null }> {
    const cacheKey = `cache:sports:milestones:${JSON.stringify(query)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    try {
      const params = new URLSearchParams();
      if (query.eventTicker) params.set("event_ticker", query.eventTicker);
      if (query.status) params.set("status", query.status);
      params.set("limit", String(query.limit));

      const res = await fetch(
        `${this.orderServiceUrl}/internal/kalshi/sports/milestones?${params}`,
        {
          headers: this.getInternalAuthHeaders(),
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        this.logger.warn(`Milestones proxy returned ${res.status}`);
        return { milestones: [], cursor: null };
      }

      const data = (await res.json()) as {
        milestones: unknown[];
        cursor: string;
      };
      await this.redis.set(cacheKey, JSON.stringify(data), 30);
      return data;
    } catch (err) {
      this.logger.warn(`Milestones proxy error: ${err}`);
      return { milestones: [], cursor: null };
    }
  }

  async getLiveData(
    milestoneId: string,
  ): Promise<{ liveData: unknown | null }> {
    const cacheKey = `cache:sports:livedata:${milestoneId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    try {
      const res = await fetch(
        `${this.orderServiceUrl}/internal/kalshi/sports/live-data/${encodeURIComponent(milestoneId)}`,
        {
          headers: this.getInternalAuthHeaders(),
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        this.logger.warn(`Live data proxy returned ${res.status}`);
        return { liveData: null };
      }

      const data = (await res.json()) as { liveData: unknown };
      await this.redis.set(cacheKey, JSON.stringify(data), 10);
      return data;
    } catch (err) {
      this.logger.warn(`Live data proxy error: ${err}`);
      return { liveData: null };
    }
  }

  async getComboCollection(collectionTicker: string): Promise<unknown | null> {
    const cacheKey = `cache:sports:combos:${collectionTicker}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    try {
      const res = await fetch(
        `${this.orderServiceUrl}/internal/kalshi/sports/combos/${encodeURIComponent(collectionTicker)}`,
        {
          headers: this.getInternalAuthHeaders(),
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        this.logger.warn(`Combo collection proxy returned ${res.status}`);
        if (res.status === 404) {
          return null;
        }
        throw new HttpException(
          "Upstream service error",
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data = await res.json();
      await this.redis.set(cacheKey, JSON.stringify(data), 60);
      return data;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.warn(`Combo collection proxy error: ${err}`);
      throw new HttpException(
        "Upstream service unavailable",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async listComboCollections(
    query: ComboCollectionsQueryDto,
  ): Promise<{ collections: unknown[]; cursor: string | null }> {
    const cacheKey = `cache:sports:combos:${JSON.stringify(query)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    try {
      const params = new URLSearchParams();
      if (query.seriesTicker) params.set("series_ticker", query.seriesTicker);
      params.set("limit", String(query.limit));

      const res = await fetch(
        `${this.orderServiceUrl}/internal/kalshi/sports/combos?${params}`,
        {
          headers: this.getInternalAuthHeaders(),
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        this.logger.warn(`Combo collections proxy returned ${res.status}`);
        return { collections: [], cursor: null };
      }

      const data = (await res.json()) as {
        collections: unknown[];
        cursor: string;
      };
      await this.redis.set(cacheKey, JSON.stringify(data), 60);
      return data;
    } catch (err) {
      this.logger.warn(`Combo collections proxy error: ${err}`);
      return { collections: [], cursor: null };
    }
  }

  async lookupComboTicker(
    collectionTicker: string,
    selectedMarkets: Array<{
      marketTicker: string;
      eventTicker: string;
      side: "yes" | "no";
    }>,
  ): Promise<{ eventTicker: string; marketTicker: string } | null> {
    try {
      const res = await fetch(
        `${this.orderServiceUrl}/internal/kalshi/sports/combos/lookup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.getInternalAuthHeaders(),
          },
          body: JSON.stringify({ collectionTicker, selectedMarkets }),
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        this.logger.warn(`Combo lookup proxy returned ${res.status}`);
        return null;
      }

      return (await res.json()) as {
        eventTicker: string;
        marketTicker: string;
      };
    } catch (err) {
      this.logger.warn(`Combo lookup proxy error: ${err}`);
      return null;
    }
  }
}
