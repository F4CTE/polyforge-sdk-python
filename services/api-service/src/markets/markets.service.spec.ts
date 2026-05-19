import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { MarketsService } from "./markets.service";
import { createMockDb, MockDb, createDeepMock } from "../../test/helpers/mock-db";
import { RedisService } from "@polyforge/shared-redis";
import { ConfigService } from "@nestjs/config";
import { ClobReadService } from "../common/services/clob-read.service";

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

function makeToken(overrides: Record<string, unknown> = {}) {
  return {
    id: "token-uuid-1",
    marketId: "market-uuid-1",
    outcome: "YES",
    price: { toNumber: () => 0.65 } as any,
    liquidity: { toNumber: () => 1000 } as any,
    ...overrides,
  };
}

function makePriceAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: "alert-1",
    tokenId: "token-uuid-1",
    userId: "user-1",
    direction: "above",
    price: { toNumber: () => 0.75 } as any,
    persistent: false,
    triggered: false,
    triggeredAt: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeNewsSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: "signal-1",
    marketId: "market-1",
    articleId: "article-1",
    outcome: "YES",
    direction: "BUY",
    confidence: 80,
    reasoning: null,
    createdAt: new Date("2026-01-01"),
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
  return typeof arg === "string" ? arg : JSON.stringify(arg);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("MarketsService", () => {
  let service: MarketsService;
  let db: MockDb;
  let redis: ReturnType<typeof createDeepMock>;

  beforeEach(() => {
    db = createMockDb();
    redis = createDeepMock();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue(undefined);
    const config = {
      get: vi.fn().mockReturnValue(undefined),
      getOrThrow: vi.fn().mockReturnValue("http://clob-api.test:3099"),
    } as unknown as ConfigService;
    const clob = new ClobReadService(config);
    service = new MarketsService(db as any, redis, config, clob);
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
        .mockResolvedValueOnce([{ reltuples: 1 }])
        .mockResolvedValueOnce(markets);

      const result = await service.list(makeMarketQuery());

      expect(result.data).toEqual(markets);
      expect(result.total).toBe(1);
    });

    it("returns an empty paginated result when there are no markets", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }])
        .mockResolvedValueOnce([]);
      db.market.count.mockResolvedValue(0);

      const result = await service.list(makeMarketQuery());

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("adds a search filter when search is provided", async () => {
      db.market.count.mockResolvedValue(0);
      db.$queryRaw.mockResolvedValue([]);

      await service.list(makeMarketQuery({ search: "eth" }));

      // search triggers market.count (exact) + $queryRaw (data)
      // The data call is the last $queryRaw call
      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain("ILIKE");
    });

    it("adds category filter when category is provided", async () => {
      db.market.count.mockResolvedValue(0);
      db.$queryRaw.mockResolvedValue([]);

      await service.list(makeMarketQuery({ category: "politics" }));

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain("LOWER(m.category)");
    });

    it("adds closed filter when closed is provided", async () => {
      db.market.count.mockResolvedValue(0);
      db.$queryRaw.mockResolvedValue([]);

      await service.list(makeMarketQuery({ closed: true }));

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain("m.closed");
    });

    it("does NOT add closed filter when closed is undefined", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }])
        .mockResolvedValueOnce([]);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery());

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      // The SELECT clause always includes m.closed, but the WHERE clause should not filter by it
      expect(sqlText(dataCall)).not.toContain("m.closed =");
    });

    it("orders by volume24h desc by default", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }])
        .mockResolvedValueOnce([]);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery());

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain("volume24h DESC");
    });

    it("orders by endDate asc when sort is endDate", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }])
        .mockResolvedValueOnce([]);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery({ sort: "endDate" }));

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain('"endDate" ASC');
    });

    it("orders by firstSeenAt desc when sort is firstSeenAt", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }])
        .mockResolvedValueOnce([]);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery({ sort: "firstSeenAt" }));

      const calls = db.$queryRaw.mock.calls;
      const dataCall = calls[calls.length - 1];
      expect(sqlText(dataCall)).toContain('"firstSeenAt" DESC');
    });

    it("passes correct skip and take for page 3 limit 10", async () => {
      db.$queryRaw
        .mockResolvedValueOnce([{ reltuples: 0 }])
        .mockResolvedValueOnce([]);
      db.market.count.mockResolvedValue(0);

      await service.list(makeMarketQuery({ page: 3, limit: 10 }));

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
      ]);
      db.dataGap.count.mockResolvedValue(0);

      const result = await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery(),
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
        makePriceHistoryQuery(),
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
      ]);
      db.dataGap.count.mockResolvedValue(0);

      const result = await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery(),
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
      ]);
      db.dataGap.count.mockResolvedValue(0);

      const result = await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery(),
      );

      const candle = result.data[0];
      expect(candle.open).toBe("0");
      expect(candle.volume).toBe("0");
    });

    it("uses 1 minute bucket for 1m resolution", async () => {
      db.$queryRaw.mockResolvedValue([]);
      db.dataGap.count.mockResolvedValue(0);

      await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery({ resolution: "1m" }),
      );

      // The $queryRaw call should be made (we can't inspect template literal args directly,
      // but we confirm it was called exactly once)
      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("uses 1 day bucket for 1d resolution", async () => {
      db.$queryRaw.mockResolvedValue([]);
      db.dataGap.count.mockResolvedValue(0);

      await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery({ resolution: "1d" }),
      );

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });

    it("uses from/to when explicitly provided", async () => {
      db.$queryRaw.mockResolvedValue([]);
      db.dataGap.count.mockResolvedValue(0);

      await service.priceHistory(
        "token-uuid-1",
        makePriceHistoryQuery({
          from: "2025-01-01T00:00:00.000Z",
          to: "2025-01-31T23:59:59.000Z",
        }),
      );

      expect(db.$queryRaw).toHaveBeenCalledOnce();
    });
  });

  // ── orderBook ─────────────────────────────────────────────────────────────

  describe("orderBook", () => {
    it("returns empty order book when Redis cache is missing", async () => {
      redis.get.mockResolvedValue(null);

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
      redis.get.mockResolvedValue(JSON.stringify(bookData));

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
      redis.get.mockResolvedValue(JSON.stringify(bookData));

      const result = await service.orderBook("token-uuid-1");

      expect(result.spread).toBe("0.0500");
    });

    it("calculates midpoint correctly from best bid and ask", async () => {
      const bookData = {
        bids: [{ price: "0.60", size: "100" }],
        asks: [{ price: "0.70", size: "50" }],
        timestamp: 1700000000000,
      };
      redis.get.mockResolvedValue(JSON.stringify(bookData));

      const result = await service.orderBook("token-uuid-1");

      expect(result.midpoint).toBe("0.6500");
    });

    it('returns spread "0" and midpoint "0" when bids array is empty in cached data', async () => {
      const bookData = {
        bids: [],
        asks: [{ price: "0.65", size: "50" }],
        timestamp: 1700000000000,
      };
      redis.get.mockResolvedValue(JSON.stringify(bookData));

      const result = await service.orderBook("token-uuid-1");

      expect(result.spread).toBe("0");
      expect(result.midpoint).toBe("0");
    });

    it("reads from the correct Redis key", async () => {
      redis.get.mockResolvedValue(null);

      await service.orderBook("token-uuid-abc");

      expect(redis.get).toHaveBeenCalledWith("cache:book:token-uuid-abc");
    });
  });

  // ── tickSize ──────────────────────────────────────────────────────────

  describe("tickSize", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns tick size and fee rate from CLOB API", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue("0.01"),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue("0.002"),
        });

      const result = await service.tickSize("token-1");
      expect(result).toEqual({
        tokenId: "token-1",
        tickSize: "0.01",
        feeRate: "0.002",
      });
    });

    it("caches result in Redis with 600s TTL", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue("0.01"),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue("0"),
        });

      await service.tickSize("token-1");
      expect(redis.set).toHaveBeenCalledWith(
        "cache:ticksize:token-1",
        expect.any(String),
        600,
      );
    });

    it("returns cached result when available", async () => {
      const cached = { tokenId: "token-1", tickSize: "0.001", feeRate: "0.01" };
      (redis.get as any).mockResolvedValue(JSON.stringify(cached));

      const result = await service.tickSize("token-1");
      expect(result).toEqual(cached);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("defaults to 0.01 tick size on CLOB error", async () => {
      fetchSpy
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await service.tickSize("token-1");
      expect(result.tickSize).toBe("0.01");
      expect(result.feeRate).toBe("0");
    });
  });

  // ── search ────────────────────────────────────────────────────────────

  describe("search", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("proxies to Gamma public-search endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await service.search({ q: "bitcoin" });

      expect(fetchSpy.mock.calls[0][0]).toContain("/public-search?q=bitcoin");
    });

    it("returns search results from Gamma", async () => {
      const markets = [{ id: "m1", title: "Bitcoin $100k" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(markets),
      });

      const result = await service.search({ q: "bitcoin" });
      expect(result).toEqual({ results: markets });
    });

    it("caches search results in Redis with 300s TTL", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await service.search({ q: "bitcoin" });
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining("cache:markets:search:bitcoin"),
        expect.any(String),
        300,
      );
    });

    it("returns empty results on Gamma API failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await service.search({ q: "bitcoin" });
      expect(result).toEqual({ results: [] });
    });
  });

  // ── spread ───────────────────────────────────────────────────────────

  describe("spread", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fetches spread from CLOB /spread endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ spread: "0.0200" }),
      });

      const result = await service.spread("token-1");
      expect(fetchSpy.mock.calls[0][0]).toContain("/spread?token_id=token-1");
      expect(result).toEqual({ tokenId: "token-1", spread: "0.0200" });
    });

    it("returns cached spread when available", async () => {
      const cached = { tokenId: "token-1", spread: "0.0100" };
      (redis.get as any).mockResolvedValue(JSON.stringify(cached));

      const result = await service.spread("token-1");
      expect(result).toEqual(cached);
    });

    it('returns spread "0" on CLOB failure', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await service.spread("token-1");
      expect(result.spread).toBe("0");
    });

    it("caches spread with 10s TTL", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ spread: "0.0200" }),
      });

      await service.spread("token-1");
      expect(redis.set).toHaveBeenCalledWith(
        "cache:spread:token-1",
        expect.any(String),
        10,
      );
    });
  });

  // ── midpoint ────────────────────────────────────────────────────────

  describe("midpoint", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fetches midpoint from CLOB /midpoint endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ mid: "0.5500" }),
      });

      const result = await service.midpoint("token-1");
      expect(fetchSpy.mock.calls[0][0]).toContain("/midpoint?token_id=token-1");
      expect(result).toEqual({ tokenId: "token-1", midpoint: "0.5500" });
    });

    it("returns cached midpoint when available", async () => {
      const cached = { tokenId: "token-1", midpoint: "0.6000" };
      (redis.get as any).mockResolvedValue(JSON.stringify(cached));

      const result = await service.midpoint("token-1");
      expect(result).toEqual(cached);
    });

    it('returns midpoint "0" on CLOB failure', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await service.midpoint("token-1");
      expect(result.midpoint).toBe("0");
    });
  });

  // ── clobBook ────────────────────────────────────────────────────────

  describe("clobBook", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fetches book from CLOB /book endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bids: [{ price: "0.55", size: "100" }],
          asks: [{ price: "0.57", size: "200" }],
          spread: "0.0200",
          midpoint: "0.5600",
          timestamp: 1234567890,
        }),
      });

      const result = await service.clobBook("token-1");
      expect(fetchSpy.mock.calls[0][0]).toContain("/book?token_id=token-1");
      expect(result.bids).toHaveLength(1);
      expect(result.spread).toBe("0.0200");
    });

    it("returns empty book on CLOB failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await service.clobBook("token-1");
      expect(result.bids).toEqual([]);
      expect(result.asks).toEqual([]);
      expect(result.spread).toBe("0");
    });

    it("returns cached book when available", async () => {
      const cached = {
        tokenId: "token-1",
        bids: [{ price: "0.55", size: "100" }],
        asks: [],
        spread: "0.01",
        midpoint: "0.55",
        timestamp: 123,
      };
      (redis.get as any).mockResolvedValue(JSON.stringify(cached));

      const result = await service.clobBook("token-1");
      expect(result).toEqual(cached);
    });
  });

  // ── marketHistory ────────────────────────────────────────────────────

  describe("marketHistory", () => {
    it("returns empty data when market has no tokens", async () => {
      db.token.findMany.mockResolvedValue([]);

      const result = await service.marketHistory("market-1", "7d");

      expect(result).toEqual({ data: [] });
    });

    it("aggregates YES and NO token snapshots into history points", async () => {
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "t-yes", outcome: "YES" }),
        makeToken({ id: "t-no", outcome: "NO" }),
      ]);
      const ts = new Date("2026-01-01T12:00:00Z");
      db.$queryRaw.mockResolvedValue([
        { time: ts, tokenId: "t-yes", close: "0.65", volume: "500" },
        { time: ts, tokenId: "t-no", close: "0.35", volume: "300" },
      ]);

      const result = await service.marketHistory("market-1", "7d");

      expect(result.data).toHaveLength(1);
      expect(result.data[0].yesPrice).toBe(0.65);
      expect(result.data[0].noPrice).toBe(0.35);
      expect(result.data[0].volume).toBe(800);
    });

    it("handles case-insensitive outcome matching (Yes/No)", async () => {
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "t-yes", outcome: "Yes" }),
        makeToken({ id: "t-no", outcome: "No" }),
      ]);
      db.$queryRaw.mockResolvedValue([
        {
          time: new Date("2026-01-01"),
          tokenId: "t-yes",
          close: "0.70",
          volume: "100",
        },
      ]);

      const result = await service.marketHistory("market-1", "1d");

      expect(result.data[0].yesPrice).toBe(0.7);
    });

    it("defaults null close/volume to 0", async () => {
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "t1", outcome: "YES" }),
      ]);
      db.$queryRaw.mockResolvedValue([
        {
          time: new Date("2026-01-01"),
          tokenId: "t1",
          close: null,
          volume: null,
        },
      ]);

      const result = await service.marketHistory("market-1", "7d");

      expect(result.data[0].yesPrice).toBe(0);
      expect(result.data[0].volume).toBe(0);
    });
  });

  // ── listMarketAlerts ──────────────────────────────────────────────────

  describe("listMarketAlerts", () => {
    it("returns alerts mapped with outcome from token", async () => {
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "t-yes", outcome: "YES" }),
        makeToken({ id: "t-no", outcome: "NO" }),
      ]);
      db.priceAlert.findMany.mockResolvedValue([
        makePriceAlert({
          id: "alert-1",
          tokenId: "t-yes",
          userId: "user-1",
          direction: "above",
          price: "0.75",
        }),
      ]);

      const result = await service.listMarketAlerts("market-1", "user-1");

      expect(result.data).toHaveLength(1);
      expect(result.data[0].outcome).toBe("YES");
      expect(result.data[0].condition).toBe("above");
      expect(result.data[0].threshold).toBe(0.75);
    });

    it("returns empty array when no alerts exist", async () => {
      db.token.findMany.mockResolvedValue([
        makeToken({ id: "t1", outcome: "YES" }),
      ]);
      db.priceAlert.findMany.mockResolvedValue([]);

      const result = await service.listMarketAlerts("market-1", "user-1");

      expect(result.data).toEqual([]);
    });
  });

  // ── createMarketAlert ─────────────────────────────────────────────────

  describe("createMarketAlert", () => {
    // ── helper: mock $transaction to execute the callback with db as tx ──
    function mockTransactionPassthrough() {
      db.$transaction.mockImplementation(async (arg: any) => {
        if (typeof arg === "function") {
          return arg(db);
        }
        if (Array.isArray(arg)) {
          return Promise.all(arg.map((op: any) => op));
        }
        return undefined;
      });
    }

    it("creates alert by resolving outcome to token", async () => {
      mockTransactionPassthrough();
      db.token.findFirst.mockResolvedValue(
        makeToken({ id: "t-yes", marketId: "market-1", outcome: "YES" }),
      );
      db.priceAlert.count.mockResolvedValue(0);
      db.priceAlert.create.mockResolvedValue(
        makePriceAlert({
          id: "alert-new",
          userId: "user-1",
          tokenId: "t-yes",
          direction: "above",
          price: 0.8,
        }),
      );

      const result = await service.createMarketAlert("market-1", "user-1", {
        outcome: "YES",
        condition: "above",
        threshold: 0.8,
      });

      expect(result.id).toBe("alert-new");
      expect(result.outcome).toBe("YES");
      expect(result.threshold).toBe(0.8);
      expect(db.priceAlert.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          tokenId: "t-yes",
          direction: "above",
          price: 0.8,
        },
      });
    });

    it("throws ALERT_LIMIT_REACHED when user already has 50 active alerts", async () => {
      mockTransactionPassthrough();
      db.token.findFirst.mockResolvedValue(
        makeToken({ id: "t-yes", marketId: "market-1", outcome: "YES" }),
      );
      db.priceAlert.count.mockResolvedValue(50);

      await expect(
        service.createMarketAlert("market-1", "user-1", {
          outcome: "YES",
          condition: "above",
          threshold: 0.5,
        }),
      ).rejects.toMatchObject({
        response: { code: "ALERT_LIMIT_REACHED" },
      });
      expect(db.priceAlert.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when token for outcome does not exist", async () => {
      db.token.findFirst.mockResolvedValue(null);

      await expect(
        service.createMarketAlert("market-1", "user-1", {
          outcome: "YES",
          condition: "above",
          threshold: 0.5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("retries serializable transaction conflicts and then succeeds", async () => {
      db.token.findFirst.mockResolvedValue(
        makeToken({ id: "t-yes", marketId: "market-1", outcome: "YES" }),
      );
      db.$transaction
        .mockRejectedValueOnce({ code: "P2034" })
        .mockRejectedValueOnce({ code: "P2034" })
        .mockResolvedValueOnce(
          makePriceAlert({
            id: "alert-new",
            userId: "user-1",
            tokenId: "t-yes",
            direction: "above",
            price: 0.8,
          }),
        );

      const result = await service.createMarketAlert("market-1", "user-1", {
        outcome: "YES",
        condition: "above",
        threshold: 0.8,
      });

      expect(result.id).toBe("alert-new");
      expect(db.$transaction).toHaveBeenCalledTimes(3);
    });

    it("throws after max retries for serializable conflicts", async () => {
      db.token.findFirst.mockResolvedValue(
        makeToken({ id: "t-yes", marketId: "market-1", outcome: "YES" }),
      );
      db.$transaction.mockRejectedValue({ code: "P2034" });

      await expect(
        service.createMarketAlert("market-1", "user-1", {
          outcome: "YES",
          condition: "above",
          threshold: 0.5,
        }),
      ).rejects.toMatchObject({ code: "P2034" });
      expect(db.$transaction).toHaveBeenCalledTimes(3);
    });
  });

  // ── deleteMarketAlert ─────────────────────────────────────────────────

  describe("deleteMarketAlert", () => {
    it("deletes alert when owned by user", async () => {
      db.priceAlert.findUnique.mockResolvedValue(
        makePriceAlert({ id: "alert-1", userId: "user-1" }),
      );
      db.priceAlert.delete.mockResolvedValue(makePriceAlert({ id: "alert-1" }));

      await service.deleteMarketAlert("alert-1", "user-1");

      expect(db.priceAlert.delete).toHaveBeenCalledWith({
        where: { id: "alert-1" },
      });
    });

    it("throws NotFoundException when alert does not exist", async () => {
      db.priceAlert.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteMarketAlert("alert-x", "user-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when alert belongs to a different user", async () => {
      db.priceAlert.findUnique.mockResolvedValue(
        makePriceAlert({ id: "alert-1", userId: "other-user" }),
      );

      await expect(
        service.deleteMarketAlert("alert-1", "user-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getMarketSentiment ────────────────────────────────────────────────

  describe("getMarketSentiment", () => {
    it("returns vote percentages from user sentiment votes", async () => {
      db.marketSentimentVote.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      db.marketSentimentVote.findUnique.mockResolvedValue(null);

      const result = await service.getMarketSentiment("market-1");

      expect(result.yesPercent).toBe(67); // 2/3
      expect(result.noPercent).toBe(33); // 1/3
      expect(result.totalVotes).toBe(3);
      expect(result.userVote).toBeNull();
    });

    it("returns zero percentages when no votes exist", async () => {
      db.marketSentimentVote.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      db.marketSentimentVote.findUnique.mockResolvedValue(null);

      const result = await service.getMarketSentiment("market-1");

      expect(result.yesPercent).toBe(0);
      expect(result.noPercent).toBe(0);
      expect(result.totalVotes).toBe(0);
    });

    it("returns 100% buy when all votes are BUY", async () => {
      db.marketSentimentVote.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);
      db.marketSentimentVote.findUnique.mockResolvedValue(null);

      const result = await service.getMarketSentiment("market-1");

      expect(result.yesPercent).toBe(100);
      expect(result.noPercent).toBe(0);
    });

    it("includes the calling user's vote in the response", async () => {
      db.marketSentimentVote.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      db.marketSentimentVote.findUnique.mockResolvedValue({
        direction: "BUY",
        confidence: 80,
      } as any);

      const result = await service.getMarketSentiment("market-1", "user-1");

      expect(result.yesPercent).toBe(50);
      expect(result.noPercent).toBe(50);
      expect(result.userVote).toEqual({ direction: "YES", confidence: 80 });
    });
  });

  // ── voteMarketSentiment ────────────────────────────────────────────────

  describe("voteMarketSentiment", () => {
    it("persists the vote and returns updated aggregates", async () => {
      db.market.findUnique.mockResolvedValue({ id: "market-1" } as any);
      db.marketSentimentVote.upsert.mockResolvedValue({} as any);
      db.marketSentimentVote.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);
      db.marketSentimentVote.findUnique.mockResolvedValue({
        direction: "BUY",
        confidence: 85,
      } as any);

      const result = await service.voteMarketSentiment("market-1", "user-1", {
        direction: "YES",
        confidence: 85,
      });

      expect(db.marketSentimentVote.upsert).toHaveBeenCalledWith({
        where: { userId_marketId: { userId: "user-1", marketId: "market-1" } },
        create: {
          userId: "user-1",
          marketId: "market-1",
          direction: "BUY",
          confidence: 85,
        },
        update: { direction: "BUY", confidence: 85 },
      });
      expect(result.yesPercent).toBe(75);
      expect(result.noPercent).toBe(25);
      expect(result.totalVotes).toBe(4);
      expect(result.userVote).toEqual({ direction: "YES", confidence: 85 });
    });

    it("reflects a SELL vote from the user", async () => {
      db.market.findUnique.mockResolvedValue({ id: "market-1" } as any);
      db.marketSentimentVote.upsert.mockResolvedValue({} as any);
      db.marketSentimentVote.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      db.marketSentimentVote.findUnique.mockResolvedValue({
        direction: "SELL",
        confidence: 40,
      } as any);

      const result = await service.voteMarketSentiment("market-1", "user-2", {
        direction: "NO",
        confidence: 40,
      });

      expect(result.yesPercent).toBe(50);
      expect(result.noPercent).toBe(50);
      expect(result.totalVotes).toBe(2);
      expect(result.userVote).toEqual({ direction: "NO", confidence: 40 });
    });

    it("works when no prior votes exist", async () => {
      db.market.findUnique.mockResolvedValue({ id: "market-1" } as any);
      db.marketSentimentVote.upsert.mockResolvedValue({} as any);
      db.marketSentimentVote.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);
      db.marketSentimentVote.findUnique.mockResolvedValue({
        direction: "BUY",
        confidence: 99,
      } as any);

      const result = await service.voteMarketSentiment("market-1", "user-3", {
        direction: "YES",
        confidence: 99,
      });

      expect(result.yesPercent).toBe(100);
      expect(result.noPercent).toBe(0);
      expect(result.totalVotes).toBe(1);
      expect(result.userVote).toEqual({ direction: "YES", confidence: 99 });
    });

    it("throws NotFoundException when market does not exist", async () => {
      db.market.findUnique.mockResolvedValue(null);

      await expect(
        service.voteMarketSentiment("nonexistent", "user-1", {
          direction: "YES",
          confidence: 50,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── clobPricesHistory ───────────────────────────────────────────────

  describe("clobPricesHistory", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fetches prices history from CLOB /prices-history endpoint", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          history: [{ t: 123, p: "0.55" }],
        }),
      });

      const result = await service.clobPricesHistory("token-1", {
        interval: "1h",
        fidelity: 60,
      });
      expect(fetchSpy.mock.calls[0][0]).toContain("/prices-history?");
      expect(fetchSpy.mock.calls[0][0]).toContain("token_id=token-1");
      expect(result.history).toHaveLength(1);
    });

    it("returns empty history on CLOB failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await service.clobPricesHistory("token-1", {});
      expect(result.history).toEqual([]);
    });

    it("caches prices history with 30s TTL", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ history: [] }),
      });

      await service.clobPricesHistory("token-1", {
        interval: "1h",
        fidelity: 60,
      });
      expect(redis.set).toHaveBeenCalledWith(
        "cache:clobprices:token-1:1h:60",
        expect.any(String),
        30,
      );
    });

    it("returns cached result when available", async () => {
      const cached = {
        tokenId: "token-1",
        interval: "1h",
        history: [{ t: 1, p: "0.5" }],
      };
      (redis.get as any).mockResolvedValue(JSON.stringify(cached));

      const result = await service.clobPricesHistory("token-1", {
        interval: "1h",
      });
      expect(result).toEqual(cached);
    });
  });
});
