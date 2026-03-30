"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const whale_detector_service_1 = require("./whale-detector.service");
const client_1 = require("@prisma/client");
// ─── Mocks ──────────────────────────────────────────────────────────────────
function createMockPrisma() {
    return {
        whaleAlert: {
            create: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            groupBy: vitest_1.vi.fn().mockResolvedValue([]),
        },
        whaleProfile: {
            upsert: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
        },
        market: {
            findUnique: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn().mockResolvedValue([]),
        },
        $transaction: vitest_1.vi.fn().mockResolvedValue([]),
    };
}
function createMockRedis() {
    return {
        get: vitest_1.vi.fn().mockResolvedValue(null),
        xadd: vitest_1.vi.fn().mockResolvedValue("stream-id"),
        getClient: vitest_1.vi.fn().mockReturnValue({
            xgroup: vitest_1.vi.fn().mockResolvedValue("OK"),
            xack: vitest_1.vi.fn().mockResolvedValue(1),
        }),
    };
}
// ─── Suite ──────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("WhaleDetectorService", () => {
    let service;
    let prisma;
    let redis;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        redis = createMockRedis();
        service = new whale_detector_service_1.WhaleDetectorService(prisma, redis);
    });
    // ── processEvent (via reflection) ─────────────────────────────────────
    (0, vitest_1.describe)("processEvent", () => {
        const processEvent = (svc, event) => svc["processEvent"](event);
        (0, vitest_1.it)("ignores non-ORDER_FILLED events", async () => {
            await processEvent(service, { type: "ORDER_CREATED", size: "10000", price: "1" });
            (0, vitest_1.expect)(prisma.whaleAlert.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("ignores trades below the default threshold ($5000)", async () => {
            await processEvent(service, {
                type: "ORDER_FILLED",
                size: "100",
                price: "0.5",
                walletAddress: "0xabc",
            });
            (0, vitest_1.expect)(prisma.whaleAlert.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("creates a whale alert when notional exceeds threshold", async () => {
            prisma.whaleAlert.create.mockResolvedValue({ id: "alert1" });
            prisma.whaleProfile.upsert.mockResolvedValue({});
            prisma.market.findUnique.mockResolvedValue({ title: "Test Market" });
            await processEvent(service, {
                type: "ORDER_FILLED",
                size: "10000",
                price: "1.0",
                walletAddress: "0xwhale",
                marketId: "m1",
                tokenId: "t1",
                side: "BUY",
                outcome: "YES",
            });
            (0, vitest_1.expect)(prisma.whaleAlert.create).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(prisma.whaleProfile.upsert).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: { walletAddress: "0xwhale" },
            }));
        });
        (0, vitest_1.it)("emits WHALE_TRADE event to stream", async () => {
            prisma.whaleAlert.create.mockResolvedValue({ id: "alert1" });
            prisma.whaleProfile.upsert.mockResolvedValue({});
            prisma.market.findUnique.mockResolvedValue({ title: "Test Market" });
            await processEvent(service, {
                type: "ORDER_FILLED",
                size: "20000",
                price: "0.5",
                walletAddress: "0xwhale",
                marketId: "m1",
                side: "SELL",
                outcome: "NO",
            });
            (0, vitest_1.expect)(redis.xadd).toHaveBeenCalledWith("stream:events", vitest_1.expect.objectContaining({
                type: "WHALE_TRADE",
                walletAddress: "0xwhale",
            }));
        });
        (0, vitest_1.it)("skips events without wallet address", async () => {
            await processEvent(service, {
                type: "ORDER_FILLED",
                size: "100000",
                price: "1.0",
            });
            (0, vitest_1.expect)(prisma.whaleAlert.create).not.toHaveBeenCalled();
        });
    });
    // ── aggregateProfiles ─────────────────────────────────────────────────
    (0, vitest_1.describe)("aggregateProfiles", () => {
        (0, vitest_1.it)("recalculates volume and trade count for each profile", async () => {
            // The new implementation uses groupBy + $transaction instead of N+1 queries
            prisma.whaleAlert.groupBy.mockResolvedValue([
                { walletAddress: "0xwhale1", _sum: { notional: new client_1.Prisma.Decimal(3000) }, _count: 2 },
            ]);
            prisma.market.findMany.mockResolvedValue([]);
            prisma.$transaction.mockResolvedValue([{}]);
            await service.aggregateProfiles();
            (0, vitest_1.expect)(prisma.whaleAlert.groupBy).toHaveBeenCalled();
            (0, vitest_1.expect)(prisma.$transaction).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=whale-detector.service.spec.js.map