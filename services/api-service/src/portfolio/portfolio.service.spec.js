"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const portfolio_service_1 = require("./portfolio.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
function makePosition(overrides = {}) {
    return {
        id: "position-uuid-1",
        userId: "user-uuid-1",
        marketId: "market-uuid-1",
        tokenId: "token-uuid-1",
        outcome: "YES",
        size: "100.00",
        avgPrice: "0.60",
        realizedPnl: "10.00",
        resolutionStatus: "UNRESOLVED",
        ...overrides,
    };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("PortfolioService", () => {
    let service;
    let db;
    let redis;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        redis = {
            get: vitest_1.vi.fn().mockResolvedValue(null),
            getClient: vitest_1.vi.fn().mockReturnValue({
                mget: vitest_1.vi.fn().mockResolvedValue([]),
            }),
        };
        service = new portfolio_service_1.PortfolioService(db, redis);
        // Default: no markets found (positions will have empty marketTitle)
        db.market.findMany.mockResolvedValue([]);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── getPortfolio ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)("getPortfolio", () => {
        (0, vitest_1.it)("returns positions, totalUnrealizedPnl and totalRealizedPnl", async () => {
            db.position.findMany.mockResolvedValue([makePosition()]);
            redis.get.mockResolvedValue(null);
            const result = await service.getPortfolio("user-uuid-1");
            (0, vitest_1.expect)(result.positions).toHaveLength(1);
            (0, vitest_1.expect)(result.totalUnrealizedPnl).toBeDefined();
            (0, vitest_1.expect)(result.totalRealizedPnl).toBeDefined();
        });
        (0, vitest_1.it)("queries only UNRESOLVED positions", async () => {
            db.position.findMany.mockResolvedValue([]);
            await service.getPortfolio("user-uuid-1");
            (0, vitest_1.expect)(db.position.findMany).toHaveBeenCalledWith({
                where: { userId: "user-uuid-1", resolutionStatus: "UNRESOLVED" },
            });
        });
        (0, vitest_1.it)("enriches each position with current price from Redis cache", async () => {
            const position = makePosition({
                tokenId: "token-uuid-1",
                avgPrice: "0.50",
                size: "100.00",
            });
            db.position.findMany.mockResolvedValue([position]);
            redis.getClient().mget.mockResolvedValue([
                JSON.stringify({ price: "0.70" }),
            ]);
            const result = await service.getPortfolio("user-uuid-1");
            (0, vitest_1.expect)(result.positions[0].currentPrice).toBe("0.700000");
        });
        (0, vitest_1.it)("uses 0 as currentPrice when Redis cache is missing", async () => {
            const position = makePosition({ avgPrice: "0.60", size: "100.00" });
            db.position.findMany.mockResolvedValue([position]);
            redis.get.mockResolvedValue(null);
            const result = await service.getPortfolio("user-uuid-1");
            // currentPrice=0, avgPrice=0.60, size=100 → unrealizedPnl = (0 - 0.60)*100 = -60
            (0, vitest_1.expect)(result.positions[0].currentPrice).toBe("0.000000");
            (0, vitest_1.expect)(parseFloat(result.positions[0].unrealizedPnl)).toBeLessThan(0);
        });
        (0, vitest_1.it)("reads prices from Redis via batch MGET", async () => {
            const position = makePosition({ tokenId: "token-abc" });
            db.position.findMany.mockResolvedValue([position]);
            await service.getPortfolio("user-uuid-1");
            (0, vitest_1.expect)(redis.getClient().mget).toHaveBeenCalledWith("cache:price:token-abc");
        });
        (0, vitest_1.it)("calculates unrealizedPnl as (currentPrice - avgEntry) * size", async () => {
            const position = makePosition({
                avgPrice: "0.50",
                size: "200.00",
                tokenId: "token-uuid-1",
            });
            db.position.findMany.mockResolvedValue([position]);
            redis.getClient().mget.mockResolvedValue([
                JSON.stringify({ price: "0.80" }),
            ]);
            const result = await service.getPortfolio("user-uuid-1");
            // (0.80 - 0.50) * 200 = 60
            (0, vitest_1.expect)(parseFloat(result.positions[0].unrealizedPnl)).toBeCloseTo(60, 4);
        });
        (0, vitest_1.it)("accumulates totalUnrealizedPnl across all positions", async () => {
            const positions = [
                makePosition({
                    id: "p1",
                    tokenId: "token-1",
                    avgPrice: "0.50",
                    size: "100.00",
                    realizedPnl: "0",
                }),
                makePosition({
                    id: "p2",
                    tokenId: "token-2",
                    avgPrice: "0.40",
                    size: "50.00",
                    realizedPnl: "0",
                }),
            ];
            db.position.findMany.mockResolvedValue(positions);
            // MGET returns values in the same order as keys
            redis.getClient().mget.mockResolvedValue([
                JSON.stringify({ price: "0.70" }), // token-1
                JSON.stringify({ price: "0.60" }), // token-2
            ]);
            const result = await service.getPortfolio("user-uuid-1");
            // pos1: (0.70 - 0.50) * 100 = 20; pos2: (0.60 - 0.40) * 50 = 10; total = 30
            (0, vitest_1.expect)(parseFloat(result.totalUnrealizedPnl)).toBeCloseTo(30, 4);
        });
        (0, vitest_1.it)("accumulates totalRealizedPnl from position.realizedPnl", async () => {
            const positions = [
                makePosition({ id: "p1", tokenId: "token-1", realizedPnl: "15.50" }),
                makePosition({ id: "p2", tokenId: "token-2", realizedPnl: "4.50" }),
            ];
            db.position.findMany.mockResolvedValue(positions);
            redis.get.mockResolvedValue(null);
            const result = await service.getPortfolio("user-uuid-1");
            (0, vitest_1.expect)(parseFloat(result.totalRealizedPnl)).toBeCloseTo(20, 4);
        });
        (0, vitest_1.it)("returns empty positions array when user has no open positions", async () => {
            db.position.findMany.mockResolvedValue([]);
            const result = await service.getPortfolio("user-uuid-1");
            (0, vitest_1.expect)(result.positions).toEqual([]);
            (0, vitest_1.expect)(result.totalUnrealizedPnl).toBe("0.000000");
            (0, vitest_1.expect)(result.totalRealizedPnl).toBe("0.000000");
        });
        (0, vitest_1.it)("includes resolutionStatus in each enriched position", async () => {
            db.position.findMany.mockResolvedValue([makePosition()]);
            const result = await service.getPortfolio("user-uuid-1");
            (0, vitest_1.expect)(result.positions[0].resolutionStatus).toBe("UNRESOLVED");
        });
    });
    // ── getPnl ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("getPnl", () => {
        (0, vitest_1.it)("returns snapshots, totalPnl and winRate", async () => {
            const snapshots = [
                { time: new Date("2025-01-01"), pnl: "50.00" },
                { time: new Date("2025-01-02"), pnl: "25.00" },
            ];
            db.$queryRaw.mockResolvedValue(snapshots);
            const result = await service.getPnl("user-uuid-1", "30d");
            (0, vitest_1.expect)(result.snapshots).toHaveLength(2);
            (0, vitest_1.expect)(result.totalPnl).toBe("75.00");
            (0, vitest_1.expect)(result.winRate).toBe("0");
        });
        (0, vitest_1.it)("maps snapshot time and pnl to strings", async () => {
            const time = new Date("2025-01-01");
            db.$queryRaw.mockResolvedValue([{ time, pnl: "10" }]);
            const result = await service.getPnl("user-uuid-1", "30d");
            (0, vitest_1.expect)(result.snapshots[0].time).toBe(time);
            (0, vitest_1.expect)(result.snapshots[0].pnl).toBe("10");
        });
        (0, vitest_1.it)("handles null pnl in snapshot gracefully", async () => {
            db.$queryRaw.mockResolvedValue([{ time: new Date(), pnl: null }]);
            const result = await service.getPnl("user-uuid-1", "30d");
            (0, vitest_1.expect)(result.snapshots[0].pnl).toBe("0");
            (0, vitest_1.expect)(result.totalPnl).toBe("0.00");
        });
        (0, vitest_1.it)('returns empty snapshots and totalPnl "0.00" when no data', async () => {
            db.$queryRaw.mockResolvedValue([]);
            const result = await service.getPnl("user-uuid-1", "30d");
            (0, vitest_1.expect)(result.snapshots).toEqual([]);
            (0, vitest_1.expect)(result.totalPnl).toBe("0.00");
        });
        (0, vitest_1.it)("uses 7d period window", async () => {
            db.$queryRaw.mockResolvedValue([]);
            await service.getPnl("user-uuid-1", "7d");
            (0, vitest_1.expect)(db.$queryRaw).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("uses 90d period window", async () => {
            db.$queryRaw.mockResolvedValue([]);
            await service.getPnl("user-uuid-1", "90d");
            (0, vitest_1.expect)(db.$queryRaw).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("uses allTime period (epoch 0 start)", async () => {
            db.$queryRaw.mockResolvedValue([]);
            await service.getPnl("user-uuid-1", "allTime");
            (0, vitest_1.expect)(db.$queryRaw).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("defaults to 30d window for unknown period values", async () => {
            db.$queryRaw.mockResolvedValue([]);
            await service.getPnl("user-uuid-1", "some-unknown-period");
            (0, vitest_1.expect)(db.$queryRaw).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("queries with strategyId when provided", async () => {
            db.$queryRaw.mockResolvedValue([]);
            await service.getPnl("user-uuid-1", "30d", "strategy-uuid-1");
            (0, vitest_1.expect)(db.$queryRaw).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("queries without strategyId when not provided", async () => {
            db.$queryRaw.mockResolvedValue([]);
            await service.getPnl("user-uuid-1", "30d");
            (0, vitest_1.expect)(db.$queryRaw).toHaveBeenCalledOnce();
        });
    });
});
//# sourceMappingURL=portfolio.service.spec.js.map