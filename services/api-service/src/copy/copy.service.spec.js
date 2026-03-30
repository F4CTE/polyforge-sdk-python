"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const copy_service_1 = require("./copy.service");
const copy_engine_service_1 = require("./copy-engine.service");
const client_1 = require("@prisma/client");
// ─── Mock PrismaService ─────────────────────────────────────────────────────
function createMockPrisma() {
    return {
        copyConfig: {
            findMany: vitest_1.vi.fn(),
            findUnique: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
        },
        copyTrade: {
            findMany: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            deleteMany: vitest_1.vi.fn(),
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
            incrbyfloat: vitest_1.vi.fn().mockResolvedValue("0.1"),
            expire: vitest_1.vi.fn().mockResolvedValue(1),
        }),
    };
}
// ─── CopyService ────────────────────────────────────────────────────────────
(0, vitest_1.describe)("CopyService", () => {
    let service;
    let prisma;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        service = new copy_service_1.CopyService(prisma);
    });
    (0, vitest_1.describe)("create", () => {
        (0, vitest_1.it)("creates a copy config successfully", async () => {
            prisma.copyConfig.count.mockResolvedValue(0);
            prisma.copyConfig.findUnique.mockResolvedValue(null);
            prisma.copyConfig.create.mockResolvedValue({
                id: "cfg-1",
                userId: "user-1",
                targetWallet: "0xabc",
                mode: "PERCENTAGE",
                status: "ACTIVE",
            });
            const result = await service.create("user-1", {
                targetWallet: "0xabc",
            });
            (0, vitest_1.expect)(result.id).toBe("cfg-1");
            (0, vitest_1.expect)(prisma.copyConfig.create).toHaveBeenCalled();
        });
        (0, vitest_1.it)("rejects when max 10 active configs reached", async () => {
            prisma.copyConfig.count.mockResolvedValue(10);
            await (0, vitest_1.expect)(service.create("user-1", { targetWallet: "0xabc" })).rejects.toThrow("Maximum of 10 active copy configs allowed");
        });
        (0, vitest_1.it)("rejects duplicate wallet with non-stopped config", async () => {
            prisma.copyConfig.count.mockResolvedValue(1);
            prisma.copyConfig.findUnique.mockResolvedValue({
                id: "cfg-existing",
                status: "ACTIVE",
            });
            await (0, vitest_1.expect)(service.create("user-1", { targetWallet: "0xabc" })).rejects.toThrow("You already have an active copy config for this wallet");
        });
        (0, vitest_1.it)("allows re-creating a STOPPED config for same wallet", async () => {
            prisma.copyConfig.count.mockResolvedValue(0);
            prisma.copyConfig.findUnique.mockResolvedValue({
                id: "cfg-old",
                status: "STOPPED",
            });
            prisma.copyTrade.deleteMany.mockResolvedValue({ count: 0 });
            prisma.copyConfig.delete.mockResolvedValue({});
            prisma.copyConfig.create.mockResolvedValue({
                id: "cfg-new",
                targetWallet: "0xabc",
                status: "ACTIVE",
            });
            const result = await service.create("user-1", {
                targetWallet: "0xabc",
            });
            (0, vitest_1.expect)(result.id).toBe("cfg-new");
            (0, vitest_1.expect)(prisma.copyConfig.delete).toHaveBeenCalledWith({
                where: { id: "cfg-old" },
            });
        });
    });
    (0, vitest_1.describe)("list", () => {
        (0, vitest_1.it)("returns configs with trade counts", async () => {
            const configs = [
                {
                    id: "cfg-1",
                    targetWallet: "0xabc",
                    status: "ACTIVE",
                    _count: { trades: 5 },
                },
                {
                    id: "cfg-2",
                    targetWallet: "0xdef",
                    status: "PAUSED",
                    _count: { trades: 12 },
                },
            ];
            prisma.copyConfig.findMany.mockResolvedValue(configs);
            const result = await service.list("user-1");
            (0, vitest_1.expect)(result).toHaveLength(2);
            (0, vitest_1.expect)(result[0]._count.trades).toBe(5);
        });
    });
    (0, vitest_1.describe)("pause", () => {
        (0, vitest_1.it)("pauses an ACTIVE config", async () => {
            prisma.copyConfig.findUnique.mockResolvedValue({
                id: "cfg-1",
                userId: "user-1",
                status: "ACTIVE",
            });
            prisma.copyConfig.update.mockResolvedValue({
                id: "cfg-1",
                status: "PAUSED",
            });
            const result = await service.pause("cfg-1", "user-1");
            (0, vitest_1.expect)(result.status).toBe("PAUSED");
        });
        (0, vitest_1.it)("rejects pausing a non-ACTIVE config", async () => {
            prisma.copyConfig.findUnique.mockResolvedValue({
                id: "cfg-1",
                userId: "user-1",
                status: "STOPPED",
            });
            await (0, vitest_1.expect)(service.pause("cfg-1", "user-1")).rejects.toThrow("Only ACTIVE configs can be paused");
        });
    });
    (0, vitest_1.describe)("resume", () => {
        (0, vitest_1.it)("resumes a PAUSED config", async () => {
            prisma.copyConfig.findUnique.mockResolvedValue({
                id: "cfg-1",
                userId: "user-1",
                status: "PAUSED",
            });
            prisma.copyConfig.update.mockResolvedValue({
                id: "cfg-1",
                status: "ACTIVE",
            });
            const result = await service.resume("cfg-1", "user-1");
            (0, vitest_1.expect)(result.status).toBe("ACTIVE");
        });
        (0, vitest_1.it)("rejects resuming a non-PAUSED config", async () => {
            prisma.copyConfig.findUnique.mockResolvedValue({
                id: "cfg-1",
                userId: "user-1",
                status: "ACTIVE",
            });
            await (0, vitest_1.expect)(service.resume("cfg-1", "user-1")).rejects.toThrow("Only PAUSED configs can be resumed");
        });
    });
    (0, vitest_1.describe)("stop", () => {
        (0, vitest_1.it)("stops an active config and sets stoppedAt", async () => {
            prisma.copyConfig.findUnique.mockResolvedValue({
                id: "cfg-1",
                userId: "user-1",
                status: "ACTIVE",
            });
            prisma.copyConfig.update.mockResolvedValue({
                id: "cfg-1",
                status: "STOPPED",
                stoppedAt: new Date(),
            });
            const result = await service.stop("cfg-1", "user-1");
            (0, vitest_1.expect)(result.status).toBe("STOPPED");
            (0, vitest_1.expect)(prisma.copyConfig.update).toHaveBeenCalledWith({
                where: { id: "cfg-1" },
                data: { status: "STOPPED", stoppedAt: vitest_1.expect.any(Date) },
            });
        });
        (0, vitest_1.it)("rejects stopping an already-stopped config", async () => {
            prisma.copyConfig.findUnique.mockResolvedValue({
                id: "cfg-1",
                userId: "user-1",
                status: "STOPPED",
            });
            await (0, vitest_1.expect)(service.stop("cfg-1", "user-1")).rejects.toThrow("Config is already stopped");
        });
    });
});
// ─── CopyEngineService ─────────────────────────────────────────────────────
(0, vitest_1.describe)("CopyEngineService", () => {
    let engine;
    let prisma;
    let redis;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        redis = createMockRedis();
        engine = new copy_engine_service_1.CopyEngineService(prisma, redis);
    });
    (0, vitest_1.describe)("calculateCopySize", () => {
        (0, vitest_1.it)("calculates PERCENTAGE mode correctly", () => {
            // 10% of 5000 = 500
            const result = engine.calculateCopySize("PERCENTAGE", 10, 5000);
            (0, vitest_1.expect)(result).toBe(500);
        });
        (0, vitest_1.it)("calculates PERCENTAGE mode with 50%", () => {
            const result = engine.calculateCopySize("PERCENTAGE", 50, 1000);
            (0, vitest_1.expect)(result).toBe(500);
        });
        (0, vitest_1.it)("returns fixed value for FIXED mode", () => {
            const result = engine.calculateCopySize("FIXED", 250, 5000);
            (0, vitest_1.expect)(result).toBe(250);
        });
        (0, vitest_1.it)("returns fixed value regardless of source size", () => {
            const result1 = engine.calculateCopySize("FIXED", 100, 500);
            const result2 = engine.calculateCopySize("FIXED", 100, 50000);
            (0, vitest_1.expect)(result1).toBe(100);
            (0, vitest_1.expect)(result2).toBe(100);
        });
        (0, vitest_1.it)("mirrors source size for MIRROR mode", () => {
            const result = engine.calculateCopySize("MIRROR", 0, 7500);
            (0, vitest_1.expect)(result).toBe(7500);
        });
        (0, vitest_1.it)("returns 0 for unknown mode", () => {
            const result = engine.calculateCopySize("UNKNOWN", 10, 5000);
            (0, vitest_1.expect)(result).toBe(0);
        });
    });
    (0, vitest_1.describe)("applyPriceOffset", () => {
        (0, vitest_1.it)("applies positive price offset", () => {
            // +5% offset on price 0.50 = 0.525
            const result = engine.applyPriceOffset(0.5, 5);
            (0, vitest_1.expect)(result).toBeCloseTo(0.525);
        });
        (0, vitest_1.it)("applies negative price offset", () => {
            // -10% offset on price 0.80 = 0.72
            const result = engine.applyPriceOffset(0.8, -10);
            (0, vitest_1.expect)(result).toBeCloseTo(0.72);
        });
        (0, vitest_1.it)("returns same price with 0 offset", () => {
            const result = engine.applyPriceOffset(0.65, 0);
            (0, vitest_1.expect)(result).toBeCloseTo(0.65);
        });
    });
    (0, vitest_1.describe)("risk filter enforcement", () => {
        (0, vitest_1.it)("skips trade when daily loss limit exceeded", async () => {
            const config = {
                id: "cfg-1",
                userId: "user-1",
                targetWallet: "0xwhale",
                mode: "PERCENTAGE",
                sizeValue: new client_1.Prisma.Decimal(10),
                maxExposure: new client_1.Prisma.Decimal(500),
                maxDailyLoss: new client_1.Prisma.Decimal(100),
                priceOffset: new client_1.Prisma.Decimal(0),
                status: "ACTIVE",
            };
            // Daily PnL is -150, which exceeds -100 limit
            redis.get.mockResolvedValue("-150");
            redis.getClient().incrbyfloat.mockResolvedValue("250");
            prisma.copyTrade.findMany.mockResolvedValue([]);
            const event = {
                walletAddress: "0xwhale",
                marketId: "mkt-1",
                tokenId: "tok-1",
                side: "BUY",
                outcome: "YES",
                notional: "5000",
                price: "0.5",
            };
            await engine.processCopyForConfig(config, event, 5000, 0.5);
            // Should NOT have created a trade
            (0, vitest_1.expect)(prisma.copyTrade.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("skips trade when max exposure exceeded", async () => {
            const config = {
                id: "cfg-1",
                userId: "user-1",
                targetWallet: "0xwhale",
                mode: "FIXED",
                sizeValue: new client_1.Prisma.Decimal(100),
                maxExposure: new client_1.Prisma.Decimal(500),
                maxDailyLoss: new client_1.Prisma.Decimal(1000),
                priceOffset: new client_1.Prisma.Decimal(0),
                status: "ACTIVE",
            };
            // Daily PnL cache returns "0" (fine), exposure cache returns "500" (at limit)
            redis.get.mockImplementation(async (key) => {
                if (key.includes(':exposure'))
                    return "500";
                return "0";
            });
            const event = {
                walletAddress: "0xwhale",
                marketId: "mkt-1",
                tokenId: "tok-1",
                side: "BUY",
                outcome: "YES",
                notional: "5000",
                price: "0.5",
            };
            await engine.processCopyForConfig(config, event, 5000, 0.5);
            // Should NOT have created a trade
            (0, vitest_1.expect)(prisma.copyTrade.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("creates trade when risk filters pass", async () => {
            const config = {
                id: "cfg-1",
                userId: "user-1",
                targetWallet: "0xwhale",
                mode: "FIXED",
                sizeValue: new client_1.Prisma.Decimal(100),
                maxExposure: new client_1.Prisma.Decimal(5000),
                maxDailyLoss: new client_1.Prisma.Decimal(1000),
                priceOffset: new client_1.Prisma.Decimal(0),
                status: "ACTIVE",
            };
            // Daily PnL is fine
            redis.get.mockResolvedValue("0");
            // Current exposure is low
            prisma.copyTrade.findMany.mockResolvedValue([
                { copiedSize: new client_1.Prisma.Decimal(50) },
            ]);
            prisma.copyTrade.create.mockResolvedValue({
                id: "trade-1",
                configId: "cfg-1",
            });
            prisma.copyConfig.update.mockResolvedValue({});
            redis.xadd.mockResolvedValue("ok");
            const event = {
                walletAddress: "0xwhale",
                marketId: "mkt-1",
                tokenId: "tok-1",
                side: "BUY",
                outcome: "YES",
                notional: "5000",
                price: "0.5",
            };
            await engine.processCopyForConfig(config, event, 5000, 0.5);
            (0, vitest_1.expect)(prisma.copyTrade.create).toHaveBeenCalledWith({
                data: vitest_1.expect.objectContaining({
                    configId: "cfg-1",
                    sourceWallet: "0xwhale",
                    copiedSize: new client_1.Prisma.Decimal(100),
                    status: "PENDING",
                }),
            });
        });
    });
    (0, vitest_1.describe)("handleWhaleTrade", () => {
        (0, vitest_1.it)("ignores events with no matching configs", async () => {
            prisma.copyConfig.findMany.mockResolvedValue([]);
            await engine.handleWhaleTrade({
                walletAddress: "0xuntracked",
                marketId: "mkt-1",
                tokenId: "tok-1",
                side: "BUY",
                outcome: "YES",
                notional: "5000",
            });
            (0, vitest_1.expect)(prisma.copyTrade.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("processes matching configs for a whale trade", async () => {
            const config = {
                id: "cfg-1",
                userId: "user-1",
                targetWallet: "0xwhale",
                mode: "PERCENTAGE",
                sizeValue: new client_1.Prisma.Decimal(10),
                maxExposure: new client_1.Prisma.Decimal(10000),
                maxDailyLoss: new client_1.Prisma.Decimal(1000),
                priceOffset: new client_1.Prisma.Decimal(0),
                status: "ACTIVE",
            };
            prisma.copyConfig.findMany.mockResolvedValue([config]);
            redis.get.mockResolvedValue("0");
            prisma.copyTrade.findMany.mockResolvedValue([]);
            prisma.copyTrade.create.mockResolvedValue({ id: "trade-1", configId: "cfg-1" });
            prisma.copyConfig.update.mockResolvedValue({});
            redis.xadd.mockResolvedValue("ok");
            await engine.handleWhaleTrade({
                walletAddress: "0xwhale",
                marketId: "mkt-1",
                tokenId: "tok-1",
                side: "BUY",
                outcome: "YES",
                notional: "5000",
                price: "0.5",
            });
            (0, vitest_1.expect)(prisma.copyTrade.create).toHaveBeenCalled();
            // 10% of 5000 = 500
            const createCall = prisma.copyTrade.create.mock.calls[0][0];
            (0, vitest_1.expect)(createCall.data.copiedSize).toEqual(new client_1.Prisma.Decimal(500));
        });
    });
    (0, vitest_1.describe)("price offset application in trades", () => {
        (0, vitest_1.it)("applies price offset when creating copy trade", async () => {
            const config = {
                id: "cfg-1",
                userId: "user-1",
                targetWallet: "0xwhale",
                mode: "MIRROR",
                sizeValue: new client_1.Prisma.Decimal(0),
                maxExposure: new client_1.Prisma.Decimal(50000),
                maxDailyLoss: new client_1.Prisma.Decimal(5000),
                priceOffset: new client_1.Prisma.Decimal(5), // +5%
                status: "ACTIVE",
            };
            redis.get.mockResolvedValue("0");
            prisma.copyTrade.findMany.mockResolvedValue([]);
            prisma.copyTrade.create.mockResolvedValue({ id: "trade-1", configId: "cfg-1" });
            prisma.copyConfig.update.mockResolvedValue({});
            redis.xadd.mockResolvedValue("ok");
            await engine.processCopyForConfig(config, {
                walletAddress: "0xwhale",
                marketId: "mkt-1",
                tokenId: "tok-1",
                side: "BUY",
                outcome: "YES",
                notional: "1000",
                price: "0.50",
            }, 1000, 0.5);
            const createCall = prisma.copyTrade.create.mock.calls[0][0];
            // 0.50 * 1.05 = 0.525
            (0, vitest_1.expect)(parseFloat(createCall.data.copiedPrice.toString())).toBeCloseTo(0.525);
        });
    });
});
//# sourceMappingURL=copy.service.spec.js.map