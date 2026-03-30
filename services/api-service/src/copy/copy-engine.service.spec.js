"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const copy_engine_service_1 = require("./copy-engine.service");
// ─── Mocks ──────────────────────────────────────────────────────────────────
function createMockPrisma() {
    return {
        copyConfig: {
            findMany: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
        },
        copyTrade: {
            create: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
        },
    };
}
function createMockRedis() {
    return {
        xadd: vitest_1.vi.fn().mockResolvedValue("stream-id"),
        get: vitest_1.vi.fn().mockResolvedValue(null),
        set: vitest_1.vi.fn().mockResolvedValue("OK"),
        getClient: vitest_1.vi.fn().mockReturnValue({
            xgroup: vitest_1.vi.fn().mockResolvedValue("OK"),
            incrbyfloat: vitest_1.vi.fn().mockResolvedValue("100"),
            expire: vitest_1.vi.fn().mockResolvedValue(1),
        }),
    };
}
// ─── Suite ──────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("CopyEngineService", () => {
    let service;
    let prisma;
    let redis;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        redis = createMockRedis();
        service = new copy_engine_service_1.CopyEngineService(prisma, redis);
    });
    // ── calculateCopySize ───────────────────────────────────────────────────
    (0, vitest_1.describe)("calculateCopySize", () => {
        (0, vitest_1.it)("returns percentage of source size for PERCENTAGE mode", () => {
            const result = service.calculateCopySize("PERCENTAGE", 50, 100);
            (0, vitest_1.expect)(result).toBe(50);
        });
        (0, vitest_1.it)("returns fixed value regardless of source size for FIXED mode", () => {
            const result = service.calculateCopySize("FIXED", 25, 100);
            (0, vitest_1.expect)(result).toBe(25);
        });
        (0, vitest_1.it)("mirrors source size for MIRROR mode", () => {
            const result = service.calculateCopySize("MIRROR", 0, 100);
            (0, vitest_1.expect)(result).toBe(100);
        });
        (0, vitest_1.it)("returns 0 for unknown mode", () => {
            const result = service.calculateCopySize("UNKNOWN", 50, 100);
            (0, vitest_1.expect)(result).toBe(0);
        });
    });
    // ── applyPriceOffset ──────────────────────────────────────────────────
    (0, vitest_1.describe)("applyPriceOffset", () => {
        (0, vitest_1.it)("applies positive percentage offset", () => {
            const result = service.applyPriceOffset(0.5, 10);
            (0, vitest_1.expect)(result).toBeCloseTo(0.55);
        });
        (0, vitest_1.it)("applies negative percentage offset", () => {
            const result = service.applyPriceOffset(0.5, -10);
            (0, vitest_1.expect)(result).toBeCloseTo(0.45);
        });
        (0, vitest_1.it)("returns original price for zero offset", () => {
            const result = service.applyPriceOffset(0.75, 0);
            (0, vitest_1.expect)(result).toBe(0.75);
        });
    });
    // ── handleWhaleTrade ──────────────────────────────────────────────────
    (0, vitest_1.describe)("handleWhaleTrade", () => {
        (0, vitest_1.it)("skips when no wallet address is provided", async () => {
            await service.handleWhaleTrade({ type: "WHALE_TRADE" });
            (0, vitest_1.expect)(prisma.copyConfig.findMany).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("skips when no active copy configs target the wallet", async () => {
            prisma.copyConfig.findMany.mockResolvedValue([]);
            await service.handleWhaleTrade({
                type: "WHALE_TRADE",
                walletAddress: "0xabc",
            });
            (0, vitest_1.expect)(prisma.copyTrade.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("processes matching copy configs", async () => {
            const config = {
                id: "cfg1",
                userId: "user1",
                mode: "MIRROR",
                sizeValue: "0",
                maxDailyLoss: "10000",
                maxExposure: "50000",
                priceOffset: "0",
                totalCopied: 0,
            };
            prisma.copyConfig.findMany.mockResolvedValue([config]);
            prisma.copyTrade.findMany.mockResolvedValue([]); // no current exposure
            prisma.copyTrade.create.mockResolvedValue({ id: "trade1" });
            prisma.copyConfig.update.mockResolvedValue({});
            await service.handleWhaleTrade({
                type: "WHALE_TRADE",
                walletAddress: "0xabc",
                notional: "1000",
                price: "0.5",
                marketId: "m1",
                tokenId: "t1",
                side: "BUY",
                outcome: "YES",
            });
            (0, vitest_1.expect)(prisma.copyTrade.create).toHaveBeenCalledOnce();
        });
    });
});
//# sourceMappingURL=copy-engine.service.spec.js.map