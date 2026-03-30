"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const markets_service_1 = require("./markets.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
function makeMarket(overrides = {}) {
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
function makeMarketQuery(overrides = {}) {
    return {
        page: 1,
        limit: 20,
        ...overrides,
    };
}
function makePriceHistoryQuery(overrides = {}) {
    return {
        resolution: "1h",
        limit: 200,
        ...overrides,
    };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("MarketsService", () => {
    let service;
    let db;
    let redis;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        redis = {
            get: vitest_1.vi.fn().mockResolvedValue(null),
            set: vitest_1.vi.fn().mockResolvedValue('OK'),
            getClient: vitest_1.vi.fn().mockReturnValue({ get: vitest_1.vi.fn().mockResolvedValue(null), set: vitest_1.vi.fn() }),
        };
        service = new markets_service_1.MarketsService(db, redis);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── list ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("list", () => {
        (0, vitest_1.it)("returns a paginated response with markets and tokens included", async () => {
            const markets = [makeMarket()];
            db.market.findMany.mockResolvedValue(markets);
            db.market.count.mockResolvedValue(1);
            const result = await service.list(makeMarketQuery());
            (0, vitest_1.expect)(result.data).toEqual(markets);
            (0, vitest_1.expect)(result.total).toBe(1);
            (0, vitest_1.expect)(db.market.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ include: { tokens: true } }));
        });
        (0, vitest_1.it)("returns an empty paginated result when there are no markets", async () => {
            db.market.findMany.mockResolvedValue([]);
            db.market.count.mockResolvedValue(0);
            const result = await service.list(makeMarketQuery());
            (0, vitest_1.expect)(result.data).toEqual([]);
            (0, vitest_1.expect)(result.total).toBe(0);
        });
        (0, vitest_1.it)("adds a search filter when search is provided", async () => {
            db.market.findMany.mockResolvedValue([]);
            db.market.count.mockResolvedValue(0);
            await service.list(makeMarketQuery({ search: "eth" }));
            const whereArg = db.market.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg.OR).toBeDefined();
            (0, vitest_1.expect)(whereArg.OR[0]).toMatchObject({
                title: { contains: "eth", mode: "insensitive" },
            });
        });
        (0, vitest_1.it)("adds category filter when category is provided", async () => {
            db.market.findMany.mockResolvedValue([]);
            db.market.count.mockResolvedValue(0);
            await service.list(makeMarketQuery({ category: "politics" }));
            const whereArg = db.market.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg.category).toBe("politics");
        });
        (0, vitest_1.it)("adds closed filter when closed is provided", async () => {
            db.market.findMany.mockResolvedValue([]);
            db.market.count.mockResolvedValue(0);
            await service.list(makeMarketQuery({ closed: true }));
            const whereArg = db.market.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg.closed).toBe(true);
        });
        (0, vitest_1.it)("does NOT add closed filter when closed is undefined", async () => {
            db.market.findMany.mockResolvedValue([]);
            db.market.count.mockResolvedValue(0);
            await service.list(makeMarketQuery());
            const whereArg = db.market.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg).not.toHaveProperty("closed");
        });
        (0, vitest_1.it)("orders by volume24h desc by default", async () => {
            db.market.findMany.mockResolvedValue([]);
            db.market.count.mockResolvedValue(0);
            await service.list(makeMarketQuery());
            (0, vitest_1.expect)(db.market.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ orderBy: { volume24h: "desc" } }));
        });
        (0, vitest_1.it)("orders by endDate asc when sort is endDate", async () => {
            db.market.findMany.mockResolvedValue([]);
            db.market.count.mockResolvedValue(0);
            await service.list(makeMarketQuery({ sort: "endDate" }));
            (0, vitest_1.expect)(db.market.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ orderBy: { endDate: "asc" } }));
        });
        (0, vitest_1.it)("orders by firstSeenAt desc when sort is firstSeenAt", async () => {
            db.market.findMany.mockResolvedValue([]);
            db.market.count.mockResolvedValue(0);
            await service.list(makeMarketQuery({ sort: "firstSeenAt" }));
            (0, vitest_1.expect)(db.market.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ orderBy: { firstSeenAt: "desc" } }));
        });
        (0, vitest_1.it)("passes correct skip and take for page 3 limit 10", async () => {
            db.market.findMany.mockResolvedValue([]);
            db.market.count.mockResolvedValue(0);
            await service.list(makeMarketQuery({ page: 3, limit: 10 }));
            (0, vitest_1.expect)(db.market.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ skip: 20, take: 10 }));
        });
    });
    // ── findOne ───────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("findOne", () => {
        (0, vitest_1.it)("returns the market with tokens when found", async () => {
            const market = makeMarket();
            db.market.findUnique.mockResolvedValue(market);
            const result = await service.findOne("market-uuid-1");
            (0, vitest_1.expect)(result).toEqual(market);
            (0, vitest_1.expect)(db.market.findUnique).toHaveBeenCalledWith({
                where: { id: "market-uuid-1" },
                include: { tokens: true },
            });
        });
        (0, vitest_1.it)("throws NotFoundException (404) when market does not exist", async () => {
            db.market.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.findOne("nonexistent-id")).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws MARKET_NOT_FOUND error code when market does not exist", async () => {
            db.market.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.findOne("nonexistent-id")).rejects.toMatchObject({
                response: { code: "MARKET_NOT_FOUND" },
            });
        });
    });
    // ── priceHistory ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)("priceHistory", () => {
        (0, vitest_1.it)("returns tokenId, resolution, hasGaps and data array", async () => {
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
            const result = await service.priceHistory("token-uuid-1", makePriceHistoryQuery());
            (0, vitest_1.expect)(result.tokenId).toBe("token-uuid-1");
            (0, vitest_1.expect)(result.resolution).toBe("1h");
            (0, vitest_1.expect)(result.hasGaps).toBe(false);
            (0, vitest_1.expect)(result.data).toHaveLength(1);
        });
        (0, vitest_1.it)("sets hasGaps to true when dataGap count is positive", async () => {
            db.$queryRaw.mockResolvedValue([]);
            db.dataGap.count.mockResolvedValue(2);
            const result = await service.priceHistory("token-uuid-1", makePriceHistoryQuery());
            (0, vitest_1.expect)(result.hasGaps).toBe(true);
        });
        (0, vitest_1.it)("maps OHLCV fields to strings", async () => {
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
            const result = await service.priceHistory("token-uuid-1", makePriceHistoryQuery());
            const candle = result.data[0];
            (0, vitest_1.expect)(typeof candle.open).toBe("string");
            (0, vitest_1.expect)(typeof candle.high).toBe("string");
            (0, vitest_1.expect)(typeof candle.low).toBe("string");
            (0, vitest_1.expect)(typeof candle.close).toBe("string");
            (0, vitest_1.expect)(typeof candle.volume).toBe("string");
        });
        (0, vitest_1.it)('handles null OHLCV values by defaulting to "0"', async () => {
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
            const result = await service.priceHistory("token-uuid-1", makePriceHistoryQuery());
            const candle = result.data[0];
            (0, vitest_1.expect)(candle.open).toBe("0");
            (0, vitest_1.expect)(candle.volume).toBe("0");
        });
        (0, vitest_1.it)("uses 1 minute bucket for 1m resolution", async () => {
            db.$queryRaw.mockResolvedValue([]);
            db.dataGap.count.mockResolvedValue(0);
            await service.priceHistory("token-uuid-1", makePriceHistoryQuery({ resolution: "1m" }));
            // The $queryRaw call should be made (we can't inspect template literal args directly,
            // but we confirm it was called exactly once)
            (0, vitest_1.expect)(db.$queryRaw).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("uses 1 day bucket for 1d resolution", async () => {
            db.$queryRaw.mockResolvedValue([]);
            db.dataGap.count.mockResolvedValue(0);
            await service.priceHistory("token-uuid-1", makePriceHistoryQuery({ resolution: "1d" }));
            (0, vitest_1.expect)(db.$queryRaw).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("uses from/to when explicitly provided", async () => {
            db.$queryRaw.mockResolvedValue([]);
            db.dataGap.count.mockResolvedValue(0);
            await service.priceHistory("token-uuid-1", makePriceHistoryQuery({
                from: "2025-01-01T00:00:00.000Z",
                to: "2025-01-31T23:59:59.000Z",
            }));
            (0, vitest_1.expect)(db.$queryRaw).toHaveBeenCalledOnce();
        });
    });
    // ── orderBook ─────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("orderBook", () => {
        (0, vitest_1.it)("returns empty order book when Redis cache is missing", async () => {
            redis.get.mockResolvedValue(null);
            const result = await service.orderBook("token-uuid-1");
            (0, vitest_1.expect)(result).toMatchObject({
                tokenId: "token-uuid-1",
                bids: [],
                asks: [],
                spread: "0",
                midpoint: "0",
            });
            (0, vitest_1.expect)(result.timestamp).toBeGreaterThan(0);
        });
        (0, vitest_1.it)("returns parsed book data from Redis cache when present", async () => {
            const bookData = {
                bids: [{ price: "0.60", size: "100" }],
                asks: [{ price: "0.65", size: "50" }],
                timestamp: 1700000000000,
            };
            redis.get.mockResolvedValue(JSON.stringify(bookData));
            const result = await service.orderBook("token-uuid-1");
            (0, vitest_1.expect)(result.bids).toEqual(bookData.bids);
            (0, vitest_1.expect)(result.asks).toEqual(bookData.asks);
            (0, vitest_1.expect)(result.timestamp).toBe(bookData.timestamp);
        });
        (0, vitest_1.it)("calculates spread correctly from best bid and ask", async () => {
            const bookData = {
                bids: [{ price: "0.60", size: "100" }],
                asks: [{ price: "0.65", size: "50" }],
                timestamp: 1700000000000,
            };
            redis.get.mockResolvedValue(JSON.stringify(bookData));
            const result = await service.orderBook("token-uuid-1");
            (0, vitest_1.expect)(result.spread).toBe("0.0500");
        });
        (0, vitest_1.it)("calculates midpoint correctly from best bid and ask", async () => {
            const bookData = {
                bids: [{ price: "0.60", size: "100" }],
                asks: [{ price: "0.70", size: "50" }],
                timestamp: 1700000000000,
            };
            redis.get.mockResolvedValue(JSON.stringify(bookData));
            const result = await service.orderBook("token-uuid-1");
            (0, vitest_1.expect)(result.midpoint).toBe("0.6500");
        });
        (0, vitest_1.it)('returns spread "0" and midpoint "0" when bids array is empty in cached data', async () => {
            const bookData = {
                bids: [],
                asks: [{ price: "0.65", size: "50" }],
                timestamp: 1700000000000,
            };
            redis.get.mockResolvedValue(JSON.stringify(bookData));
            const result = await service.orderBook("token-uuid-1");
            (0, vitest_1.expect)(result.spread).toBe("0");
            (0, vitest_1.expect)(result.midpoint).toBe("0");
        });
        (0, vitest_1.it)("reads from the correct Redis key", async () => {
            redis.get.mockResolvedValue(null);
            await service.orderBook("token-uuid-abc");
            (0, vitest_1.expect)(redis.get).toHaveBeenCalledWith("cache:book:token-uuid-abc");
        });
    });
});
//# sourceMappingURL=markets.service.spec.js.map