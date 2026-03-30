"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const whales_service_1 = require("./whales.service");
const whale_detector_service_1 = require("./whale-detector.service");
const client_1 = require("@prisma/client");
// ─── Mock PrismaService ─────────────────────────────────────────────────────
function createMockPrisma() {
    return {
        whaleAlert: {
            findMany: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            groupBy: vitest_1.vi.fn().mockResolvedValue([]),
        },
        whaleProfile: {
            findUnique: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            upsert: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
        },
        market: {
            findUnique: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn().mockResolvedValue([]),
        },
        $transaction: vitest_1.vi.fn().mockResolvedValue([]),
        whaleFollow: {
            findUnique: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
        },
    };
}
// ─── Mock RedisService ──────────────────────────────────────────────────────
function createMockRedis() {
    return {
        get: vitest_1.vi.fn(),
        set: vitest_1.vi.fn(),
        xadd: vitest_1.vi.fn(),
        getClient: vitest_1.vi.fn().mockReturnValue({
            xgroup: vitest_1.vi.fn(),
            xreadgroup: vitest_1.vi.fn(),
            xack: vitest_1.vi.fn(),
        }),
    };
}
// ─── WhalesService ──────────────────────────────────────────────────────────
(0, vitest_1.describe)("WhalesService", () => {
    let service;
    let prisma;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        service = new whales_service_1.WhalesService(prisma);
    });
    (0, vitest_1.describe)("getFeed", () => {
        (0, vitest_1.it)("returns paginated results", async () => {
            const alerts = [
                { id: "a1", walletAddress: "0xabc", notional: new client_1.Prisma.Decimal(10000), detectedAt: new Date() },
                { id: "a2", walletAddress: "0xdef", notional: new client_1.Prisma.Decimal(8000), detectedAt: new Date() },
            ];
            prisma.whaleAlert.findMany.mockResolvedValue(alerts);
            prisma.whaleAlert.count.mockResolvedValue(2);
            const result = await service.getFeed({ page: 1, limit: 20 });
            (0, vitest_1.expect)(result.data).toHaveLength(2);
            (0, vitest_1.expect)(result.meta.total).toBe(2);
            (0, vitest_1.expect)(result.meta.page).toBe(1);
            (0, vitest_1.expect)(result.meta.totalPages).toBe(1);
        });
        (0, vitest_1.it)("applies minSize filter", async () => {
            prisma.whaleAlert.findMany.mockResolvedValue([]);
            prisma.whaleAlert.count.mockResolvedValue(0);
            await service.getFeed({ minSize: "5000", page: 1, limit: 20 });
            const whereArg = prisma.whaleAlert.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.notional).toEqual({ gte: new client_1.Prisma.Decimal("5000") });
        });
        (0, vitest_1.it)("applies marketId filter", async () => {
            prisma.whaleAlert.findMany.mockResolvedValue([]);
            prisma.whaleAlert.count.mockResolvedValue(0);
            await service.getFeed({ marketId: "mkt-1", page: 1, limit: 20 });
            const whereArg = prisma.whaleAlert.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.marketId).toBe("mkt-1");
        });
        (0, vitest_1.it)("applies walletAddress filter", async () => {
            prisma.whaleAlert.findMany.mockResolvedValue([]);
            prisma.whaleAlert.count.mockResolvedValue(0);
            await service.getFeed({ walletAddress: "0xabc", page: 1, limit: 20 });
            const whereArg = prisma.whaleAlert.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.walletAddress).toBe("0xabc");
        });
        (0, vitest_1.it)("calculates correct page offset", async () => {
            prisma.whaleAlert.findMany.mockResolvedValue([]);
            prisma.whaleAlert.count.mockResolvedValue(50);
            await service.getFeed({ page: 3, limit: 10 });
            const findManyArg = prisma.whaleAlert.findMany.mock.calls[0][0];
            (0, vitest_1.expect)(findManyArg.skip).toBe(20);
            (0, vitest_1.expect)(findManyArg.take).toBe(10);
        });
    });
    (0, vitest_1.describe)("getTopWhales", () => {
        (0, vitest_1.it)("sorts by volume by default", async () => {
            const profiles = [
                { walletAddress: "0x1", totalVolume: new client_1.Prisma.Decimal(50000), tradeCount: 10 },
                { walletAddress: "0x2", totalVolume: new client_1.Prisma.Decimal(30000), tradeCount: 5 },
            ];
            prisma.whaleProfile.findMany.mockResolvedValue(profiles);
            const result = await service.getTopWhales({});
            (0, vitest_1.expect)(result).toHaveLength(2);
            const orderBy = prisma.whaleProfile.findMany.mock.calls[0][0].orderBy;
            (0, vitest_1.expect)(orderBy).toEqual({ totalVolume: "desc" });
        });
        (0, vitest_1.it)("sorts by pnl when requested", async () => {
            prisma.whaleProfile.findMany.mockResolvedValue([]);
            await service.getTopWhales({ sortBy: "pnl" });
            const orderBy = prisma.whaleProfile.findMany.mock.calls[0][0].orderBy;
            (0, vitest_1.expect)(orderBy).toEqual({ totalPnl: "desc" });
        });
        (0, vitest_1.it)("sorts by winRate when requested", async () => {
            prisma.whaleProfile.findMany.mockResolvedValue([]);
            await service.getTopWhales({ sortBy: "winRate" });
            const orderBy = prisma.whaleProfile.findMany.mock.calls[0][0].orderBy;
            (0, vitest_1.expect)(orderBy).toEqual({ winRate: "desc" });
        });
        (0, vitest_1.it)("sorts by tradeCount when requested", async () => {
            prisma.whaleProfile.findMany.mockResolvedValue([]);
            await service.getTopWhales({ sortBy: "tradeCount" });
            const orderBy = prisma.whaleProfile.findMany.mock.calls[0][0].orderBy;
            (0, vitest_1.expect)(orderBy).toEqual({ tradeCount: "desc" });
        });
        (0, vitest_1.it)("respects limit parameter", async () => {
            prisma.whaleProfile.findMany.mockResolvedValue([]);
            await service.getTopWhales({ limit: 5 });
            const takeArg = prisma.whaleProfile.findMany.mock.calls[0][0].take;
            (0, vitest_1.expect)(takeArg).toBe(5);
        });
    });
    (0, vitest_1.describe)("toggleFollow", () => {
        (0, vitest_1.it)("creates follow when not already following", async () => {
            prisma.whaleFollow.findUnique.mockResolvedValue(null);
            prisma.whaleFollow.create.mockResolvedValue({ id: "f1" });
            const result = await service.toggleFollow("user-1", "0xabc");
            (0, vitest_1.expect)(result.followed).toBe(true);
            (0, vitest_1.expect)(prisma.whaleFollow.create).toHaveBeenCalledWith({
                data: { userId: "user-1", walletAddress: "0xabc" },
            });
        });
        (0, vitest_1.it)("deletes follow when already following", async () => {
            prisma.whaleFollow.findUnique.mockResolvedValue({
                id: "f1",
                userId: "user-1",
                walletAddress: "0xabc",
            });
            prisma.whaleFollow.delete.mockResolvedValue({});
            const result = await service.toggleFollow("user-1", "0xabc");
            (0, vitest_1.expect)(result.followed).toBe(false);
            (0, vitest_1.expect)(prisma.whaleFollow.delete).toHaveBeenCalledWith({
                where: { id: "f1" },
            });
        });
    });
    (0, vitest_1.describe)("getProfile", () => {
        (0, vitest_1.it)("returns profile and recent trades", async () => {
            const profile = {
                walletAddress: "0xabc",
                totalVolume: new client_1.Prisma.Decimal(50000),
                totalPnl: new client_1.Prisma.Decimal(5000),
                tradeCount: 25,
                winRate: new client_1.Prisma.Decimal(60),
                lastTradeAt: new Date(),
            };
            const trades = [
                { id: "t1", walletAddress: "0xabc", notional: new client_1.Prisma.Decimal(10000) },
            ];
            prisma.whaleProfile.findUnique.mockResolvedValue(profile);
            prisma.whaleAlert.findMany.mockResolvedValue(trades);
            const result = await service.getProfile("0xabc");
            (0, vitest_1.expect)(result.profile.walletAddress).toBe("0xabc");
            (0, vitest_1.expect)(result.recentTrades).toHaveLength(1);
        });
        (0, vitest_1.it)("returns default profile when wallet not found", async () => {
            prisma.whaleProfile.findUnique.mockResolvedValue(null);
            prisma.whaleAlert.findMany.mockResolvedValue([]);
            const result = await service.getProfile("0xunknown");
            (0, vitest_1.expect)(result.profile.walletAddress).toBe("0xunknown");
            (0, vitest_1.expect)(result.profile.tradeCount).toBe(0);
            (0, vitest_1.expect)(result.recentTrades).toHaveLength(0);
        });
    });
    (0, vitest_1.describe)("getFollowing", () => {
        (0, vitest_1.it)("returns followed wallets enriched with profiles", async () => {
            const follows = [
                { id: "f1", userId: "u1", walletAddress: "0xabc", createdAt: new Date() },
                { id: "f2", userId: "u1", walletAddress: "0xdef", createdAt: new Date() },
            ];
            const profiles = [
                { walletAddress: "0xabc", totalVolume: new client_1.Prisma.Decimal(50000) },
            ];
            prisma.whaleFollow.findMany.mockResolvedValue(follows);
            prisma.whaleProfile.findMany.mockResolvedValue(profiles);
            const result = await service.getFollowing("u1");
            (0, vitest_1.expect)(result).toHaveLength(2);
            (0, vitest_1.expect)(result[0].profile).toBeTruthy();
            (0, vitest_1.expect)(result[1].profile).toBeNull();
        });
    });
});
// ─── WhaleDetectorService ───────────────────────────────────────────────────
(0, vitest_1.describe)("WhaleDetectorService", () => {
    let detector;
    let prisma;
    let redis;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        redis = createMockRedis();
        detector = new whale_detector_service_1.WhaleDetectorService(prisma, redis);
    });
    (0, vitest_1.describe)("processEvent (via reflection)", () => {
        (0, vitest_1.it)("ignores events that are not ORDER_FILLED", async () => {
            // Access private method for testing
            const processEvent = detector.processEvent.bind(detector);
            await processEvent({ type: "ORDER_PLACED", size: "100", price: "100" });
            (0, vitest_1.expect)(prisma.whaleAlert.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("ignores orders below threshold", async () => {
            redis.get.mockResolvedValue("5000");
            const processEvent = detector.processEvent.bind(detector);
            await processEvent({
                type: "ORDER_FILLED",
                walletAddress: "0xabc",
                size: "10",
                price: "100",
                marketId: "mkt-1",
                tokenId: "tok-1",
                side: "BUY",
                outcome: "YES",
            });
            // 10 * 100 = 1000 < 5000 threshold
            (0, vitest_1.expect)(prisma.whaleAlert.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("creates alert and updates profile for whale orders", async () => {
            redis.get.mockResolvedValue("5000");
            prisma.whaleAlert.create.mockResolvedValue({ id: "alert-1" });
            prisma.whaleProfile.upsert.mockResolvedValue({});
            prisma.market.findUnique.mockResolvedValue({ title: "Test Market" });
            redis.xadd.mockResolvedValue("ok");
            const processEvent = detector.processEvent.bind(detector);
            await processEvent({
                type: "ORDER_FILLED",
                walletAddress: "0xwhale",
                size: "100",
                price: "100",
                marketId: "mkt-1",
                tokenId: "tok-1",
                side: "BUY",
                outcome: "YES",
            });
            // 100 * 100 = 10000 > 5000 threshold
            (0, vitest_1.expect)(prisma.whaleAlert.create).toHaveBeenCalled();
            (0, vitest_1.expect)(prisma.whaleProfile.upsert).toHaveBeenCalled();
            (0, vitest_1.expect)(redis.xadd).toHaveBeenCalledWith("stream:events", vitest_1.expect.objectContaining({ type: "WHALE_TRADE", walletAddress: "0xwhale" }));
        });
        (0, vitest_1.it)("uses default threshold when Redis config is absent", async () => {
            redis.get.mockResolvedValue(null);
            prisma.whaleAlert.create.mockResolvedValue({ id: "alert-1" });
            prisma.whaleProfile.upsert.mockResolvedValue({});
            prisma.market.findUnique.mockResolvedValue(null);
            redis.xadd.mockResolvedValue("ok");
            const processEvent = detector.processEvent.bind(detector);
            // Notional = 60 * 100 = 6000 > 5000 (default)
            await processEvent({
                type: "ORDER_FILLED",
                walletAddress: "0xwhale",
                size: "60",
                price: "100",
                marketId: "mkt-1",
                tokenId: "tok-1",
                side: "SELL",
                outcome: "NO",
            });
            (0, vitest_1.expect)(prisma.whaleAlert.create).toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)("aggregateProfiles", () => {
        (0, vitest_1.it)("recalculates profile stats from alerts using batch groupBy", async () => {
            prisma.whaleAlert.groupBy.mockResolvedValue([
                { walletAddress: "0xabc", _sum: { notional: new client_1.Prisma.Decimal(15000) }, _count: 2 },
            ]);
            prisma.market.findMany.mockResolvedValue([]);
            prisma.$transaction.mockResolvedValue([{}]);
            await detector.aggregateProfiles();
            (0, vitest_1.expect)(prisma.whaleAlert.groupBy).toHaveBeenCalled();
            (0, vitest_1.expect)(prisma.$transaction).toHaveBeenCalled();
        });
        (0, vitest_1.it)("skips profiles with no alerts", async () => {
            prisma.whaleProfile.findMany.mockResolvedValue([
                { walletAddress: "0xempty" },
            ]);
            prisma.whaleAlert.findMany.mockResolvedValue([]);
            await detector.aggregateProfiles();
            (0, vitest_1.expect)(prisma.whaleProfile.update).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=whales.service.spec.js.map