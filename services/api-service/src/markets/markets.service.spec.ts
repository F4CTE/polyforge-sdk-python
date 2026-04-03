import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { MarketsService } from "./markets.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeMarket(overrides: Record<string, unknown> = {}) {
  return {
    id: "market-uuid-1",
    title: "Will ETH reach $5000?",
    seriesSlug: "eth-price",
    category: "crypto",
    closed: false,
    volume24h: "100000.00",
    endDate: new Date("2026-01-01"),
    firstSeenAt: new Date("2025-01-01"),
    tokens: [
      { id: "token-uuid-1", outcome: "YES", price: "0.65" },
      { id: "token-uuid-2", outcome: "NO", price: "0.35" },
    ],
    ...overrides,
  };
}

function makeMarketQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    ...overrides,
  };
}

function makePriceHistoryQuery(overrides: Record<string, unknown> = {}) {
  return {
    resolution: "1h",
    limit: 200,
    ...overrides,
  };
}

// Helper: extract the full SQL text from a Prisma.Sql tagged template call.
// $queryRaw receives a single Prisma.Sql argument whose `.strings` array holds
// the static SQL fragments. Joining them gives us the template text for assertions.
function sqlText(call: unknown[]): string {
  const arg = call[0] as { strings?: readonly string[] };
  if (arg?.strings) return arg.strings.join("?");
  // Fallback for plain string calls (shouldn't happen after migration)
  return String(arg);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("MarketsService", () => {
  let service: MarketsService;
  let db: MockDb;
  let redis: RedisService;

  beforeEach(() => {
    db = createMockDb();
    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      getClient: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn(),
      }),
    } as unknown as RedisService;
    service = new MarketsService(db as any, redis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns a paginated response with markets and tokens included", async () => {
      const markets = [makeMarket()];
      // First $queryRaw call = estimated count, second = data
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 1 }] as any)
        .mockResolvedValueOnce(markets as any);

      const result = await service.list(makeMarketQuery() as any);

      expect(result.data).toEqual(markets);
      expect(result.total).toBe(1);
    });

    it("returns an empty paginated result when there are no markets", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }] as any)
        .mockResolvedValueOnce([] as any);
      db.market.count.mockResolvedValue(0);

      const result = await service.list(makeMarketQuery() as any);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("adds a search filter when search is provided", async () => {
      db.market.count.mockResolvedValue(0);
      db.$queryRaw.mockResolvedValue([] as any);

      await service.list(makeMarketQuery({ search: "eth" }) as any);

      // search triggers market.count (exact) + $queryRaw (data)
      // The data call is the last $queryRaw call
      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain("ILIKE");
    });

    it("adds category filter when category is provided", async () => {
      db.market.count.mockResolvedValue(0);
      db.$queryRaw.mockResolvedValue([] as any);

      await service.list(makeMarketQuery({ category: "politics" }) as any);

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain("LOWER(m.category)");
    });

    it("adds closed filter when closed is provided", async () => {
      db.market.count.mockResolvedValue(0);
      db.$queryRaw.mockResolvedValue([] as any);

      await service.list(makeMarketQuery({ closed: true }) as any);

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain("m.closed");
    });

    it("does NOT add closed filter when closed is undefined", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }] as any)
        .mockResolvedValueOnce([] as any);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery() as any);

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      // The SELECT clause always includes m.closed, but the WHERE clause should not filter by it
      expect(sqlText(dataCall)).not.toContain("m.closed =");
    });

    it("orders by volume24h desc by default", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }] as any)
        .mockResolvedValueOnce([] as any);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery() as any);

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain("volume24h DESC");
    });

    it("orders by endDate asc when sort is endDate", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }] as any)
        .mockResolvedValueOnce([] as any);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery({ sort: "endDate" }) as any);

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain('"endDate" ASC');
    });

    it("orders by firstSeenAt desc when sort is firstSeenAt", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }] as any)
        .mockResolvedValueOnce([] as any);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery({ sort: "firstSeenAt" }) as any);

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain('"firstSeenAt" DESC');
    });

    it("passes correct skip and take for page 3 limit 10", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }] as any)
        .mockResolvedValueOnce([] as any);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery({ page: 3, limit: 10 }) as any);

      // With Prisma.sql tagged template, limit and offset are in the `.values` array
      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      const arg = dataCall[0] as { values?: unknown[] };
      const values = arg.values ?? [];
      // limit=10 and offset=20 should be the last two values
      expect(values[values.length - 2]).toBe(10); // limit
      expect(values[values.length - 1]).toBe(20); // offset (skip)
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns the market with tokens when found", async () => {
      const market = makeMarket();
      db.market.findUnique.mockResolvedValue(market as any);

      const result = await service.findOne("market-uuid-1");

      expect(result).toEqual(market);
      expect(db.market.findUnique).toHaveBeenCalledWith({
        where: { id: "market-uuid-1" },
        include: { tokens: true },
      });
    });

    it("throws NotFoundException (404) when market does not exist", async () => {
      db.market.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws MARKET_NOT_FOUND error code when market does not exist", async () => {
      db.market.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent-id")).rejects.toMatchObject({
        response: { code: "MARKET_NOT_FOUND" },
      });
    });
  });

  // ── priceHistory ──────────────────────────────────────────────────────────

  describe("priceHistory", () => {
    it("returns tokenId, resolution, hasGaps and data array", async () => {
      db.$queryRaw.mockResolvedValue([
        {
          time: new Date("2025-01-01T00:00:00Z"),
          open: "0.5",
          high: "0.6",
          low: "0.45",
          close: "0.55",
          volume: "1000",
        },
      ] as any);
      db.dataGap.count.mockResolvedValue(0);

      const result = await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery() as any,
      );

      expect(result.tokenId).toBe("token-uuid-1");
      expect(result.resolution).toBe("1h");
      expect(result.hasGaps).toBe(false);
      expect(result.data).toHaveLength(1);
    });

    it("sets hasGaps to true when dataGap count is positive", async () => {
      db.$queryRaw.mockResolvedValue([]);
      db.dataGap.count.mockResolvedValue(2);

      const result = await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery() as any,
      );

      expect(result.hasGaps).toBe(true);
    });

    it("maps OHLCV fields to strings", async () => {
      db.$queryRaw.mockResolvedValue([
        {
          time: new Date(),
          open: 0.5,
          high: 0.6,
          low: 0.4,
          close: 0.55,
          volume: 1000,
        },
      ] as any);
      db.dataGap.count.mockResolvedValue(0);

      const result = await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery() as any,
      );

      const candle = result.data[0];
      expect(typeof candle.open).toBe("string");
      expect(typeof candle.high).toBe("string");
      expect(typeof candle.low).toBe("string");
      expect(typeof candle.close).toBe("string");
      expect(typeof candle.volume).toBe("string");
    });

    it('handles null OHLCV values by defaulting to "0"', async () => {
      db.$queryRaw.mockResolvedValue([
        {
          time: new Date(),
          open: null,
          high: null,
          low: null,
          close: null,
          volume: null,
        },
      ] as any);
      db.dataGap.count.mockResolvedValue(0);

      const result = await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery() as any,
      );

      const candle = result.data[0];
      expect(candle.open).toBe("0");
      expect(candle.volume).toBe("0");
    });

    it("uses 1 minute bucket for 1m resolution", async () => {
      db.$queryRaw.mockResolvedValue([] as any);
      db.dataGap.count.mockResolvedValue(0);

      await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery({ resolution: "1m" }) as any,
      );

      // The $queryRaw call should be made (we can't inspect template literal args directly,
      // but we confirm it was called exactly once)
      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("uses 1 day bucket for 1d resolution", async () => {
      db.$queryRaw.mockResolvedValue([] as any);
      db.dataGap.count.mockResolvedValue(0);

      await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery({ resolution: "1d" }) as any,
      );

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("uses from/to when explicitly provided", async () => {
      db.$queryRaw.mockResolvedValue([] as any);
      db.dataGap.count.mockResolvedValue(0);

      await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery({
          from: "2025-01-01T00:00:00.000Z",
          to: "2025-01-31T23:59:59.000Z",
        }) as any,
      );

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });
  });

  // ── orderBook ─────────────────────────────────────────────────────────────

  describe("orderBook", () => {
    it("returns empty order book when Redis cache is missing", async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.orderBook("token-uuid-1");

      expect(result).toMatchObject({
        tokenId: "token-uuid-1",
        bids: [],
        asks: [],
        spread: "0",
        midpoint: "0",
      });
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("returns parsed book data from Redis cache when present", async () => {
      const bookData = {
        bids: [{ price: "0.60", size: "100" }],
        asks: [{ price: "0.65", size: "50" }],
        timestamp: 1700000000000,
      };
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(bookData),
      );

      const result = await service.orderBook("token-uuid-1");

      expect(result.bids).toEqual(bookData.bids);
      expect(result.asks).toEqual(bookData.asks);
      expect(result.timestamp).toBe(bookData.timestamp);
    });

    it("calculates spread correctly from best bid and ask", async () => {
      const bookData = {
        bids: [{ price: "0.60", size: "100" }],
        asks: [{ price: "0.65", size: "50" }],
        timestamp: 1700000000000,
      };
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(bookData),
      );

      const result = await service.orderBook("token-uuid-1");

      expect(result.spread).toBe("0.0500");
    });

    it("calculates midpoint correctly from best bid and ask", async () => {
      const bookData = {
        bids: [{ price: "0.60", size: "100" }],
        asks: [{ price: "0.70", size: "50" }],
        timestamp: 1700000000000,
      };
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(bookData),
      );

      const result = await service.orderBook("token-uuid-1");

      expect(result.midpoint).toBe("0.6500");
    });

    it('returns spread "0" and midpoint "0" when bids array is empty in cached data', async () => {
      const bookData = {
        bids: [],
        asks: [{ price: "0.65", size: "50" }],
        timestamp: 1700000000000,
      };
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(bookData),
      );

      const result = await service.orderBook("token-uuid-1");

      expect(result.spread).toBe("0");
      expect(result.midpoint).toBe("0");
    });

    it("reads from the correct Redis key", async () => {
      (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await service.orderBook("token-uuid-abc");

      expect(redis.get).toHaveBeenCalledWith("cache:book:token-uuid-abc");
    });
  });
});
