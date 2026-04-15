import { describe, it, expect, beforeEach, vi } from "vitest";
import { CopyService } from "./copy.service";
import { CopyEngineService } from "./copy-engine.service";
import { Prisma, type CopyConfig } from "@prisma/client";

// ─── Mock PrismaService ─────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    copyConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    copyTrade: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  } as any;
}

// ─── Mock RedisService ──────────────────────────────────────────────────────

function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    xadd: vi.fn(),
    getClient: vi.fn().mockReturnValue({
      xgroup: vi.fn(),
      xreadgroup: vi.fn(),
      xack: vi.fn(),
      incrbyfloat: vi.fn().mockResolvedValue("0.1"),
      expire: vi.fn().mockResolvedValue(1),
    }),
  } as any;
}

// ─── CopyService ────────────────────────────────────────────────────────────

describe("CopyService", () => {
  let service: CopyService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new CopyService(prisma);
  });

  describe("create", () => {
    it("creates a copy config successfully", async () => {
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

      expect(result.id).toBe("cfg-1");
      expect(prisma.copyConfig.create).toHaveBeenCalled();
    });

    it("rejects when max 10 active configs reached", async () => {
      prisma.copyConfig.count.mockResolvedValue(10);

      await expect(
        service.create("user-1", { targetWallet: "0xabc" }),
      ).rejects.toThrow("Maximum of 10 active copy configs allowed");
    });

    it("rejects duplicate wallet with non-stopped config", async () => {
      prisma.copyConfig.count.mockResolvedValue(1);
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-existing",
        status: "ACTIVE",
      });

      await expect(
        service.create("user-1", { targetWallet: "0xabc" }),
      ).rejects.toThrow(
        "You already have an active copy config for this wallet",
      );
    });

    it("allows re-creating a STOPPED config for same wallet", async () => {
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

      expect(result.id).toBe("cfg-new");
      expect(prisma.copyConfig.delete).toHaveBeenCalledWith({
        where: { id: "cfg-old" },
      });
    });
  });

  describe("list", () => {
    it("returns configs with trade counts", async () => {
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

      expect(result).toHaveLength(2);
      expect(result[0]._count.trades).toBe(5);
    });
  });

  describe("pause", () => {
    it("pauses an ACTIVE config", async () => {
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

      expect(result.status).toBe("PAUSED");
    });

    it("rejects pausing a non-ACTIVE config", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        status: "STOPPED",
      });

      await expect(service.pause("cfg-1", "user-1")).rejects.toThrow(
        "Only ACTIVE configs can be paused",
      );
    });
  });

  describe("resume", () => {
    it("resumes a PAUSED config", async () => {
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

      expect(result.status).toBe("ACTIVE");
    });

    it("rejects resuming a non-PAUSED config", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        status: "ACTIVE",
      });

      await expect(service.resume("cfg-1", "user-1")).rejects.toThrow(
        "Only PAUSED configs can be resumed",
      );
    });
  });

  describe("stop", () => {
    it("stops an active config and sets stoppedAt", async () => {
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

      expect(result.status).toBe("STOPPED");
      expect(prisma.copyConfig.update).toHaveBeenCalledWith({
        where: { id: "cfg-1" },
        data: { status: "STOPPED", stoppedAt: expect.any(Date) },
      });
    });

    it("rejects stopping an already-stopped config", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        status: "STOPPED",
      });

      await expect(service.stop("cfg-1", "user-1")).rejects.toThrow(
        "Config is already stopped",
      );
    });
  });
});

// ─── CopyEngineService ─────────────────────────────────────────────────────

describe("CopyEngineService", () => {
  let engine: CopyEngineService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    engine = new CopyEngineService(prisma, redis);
  });

  describe("calculateCopySize", () => {
    it("calculates PERCENTAGE mode correctly", () => {
      // 10% of 5000 = 500
      const result = engine.calculateCopySize("PERCENTAGE", 10, 5000);
      expect(result).toBe(500);
    });

    it("calculates PERCENTAGE mode with 50%", () => {
      const result = engine.calculateCopySize("PERCENTAGE", 50, 1000);
      expect(result).toBe(500);
    });

    it("returns fixed value for FIXED mode", () => {
      const result = engine.calculateCopySize("FIXED", 250, 5000);
      expect(result).toBe(250);
    });

    it("returns fixed value regardless of source size", () => {
      const result1 = engine.calculateCopySize("FIXED", 100, 500);
      const result2 = engine.calculateCopySize("FIXED", 100, 50000);
      expect(result1).toBe(100);
      expect(result2).toBe(100);
    });

    it("mirrors source size for MIRROR mode", () => {
      const result = engine.calculateCopySize("MIRROR", 0, 7500);
      expect(result).toBe(7500);
    });

    it("returns 0 for unknown mode", () => {
      const result = engine.calculateCopySize("UNKNOWN", 10, 5000);
      expect(result).toBe(0);
    });
  });

  describe("applyPriceOffset", () => {
    it("applies positive price offset", () => {
      // +5% offset on price 0.50 = 0.525
      const result = engine.applyPriceOffset(0.5, 5);
      expect(result).toBeCloseTo(0.525);
    });

    it("applies negative price offset", () => {
      // -10% offset on price 0.80 = 0.72
      const result = engine.applyPriceOffset(0.8, -10);
      expect(result).toBeCloseTo(0.72);
    });

    it("returns same price with 0 offset", () => {
      const result = engine.applyPriceOffset(0.65, 0);
      expect(result).toBeCloseTo(0.65);
    });
  });

  describe("risk filter enforcement", () => {
    it("skips trade when daily loss limit exceeded", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xwhale",
        mode: "PERCENTAGE",
        sizeValue: new Prisma.Decimal(10),
        maxExposure: new Prisma.Decimal(500),
        maxDailyLoss: new Prisma.Decimal(100),
        priceOffset: new Prisma.Decimal(0),
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

      await engine.processCopyForConfig(
        config as unknown as CopyConfig,
        event,
        5000,
        0.5,
      );

      // Should NOT have created a trade
      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });

    it("skips trade when max exposure exceeded", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xwhale",
        mode: "FIXED",
        sizeValue: new Prisma.Decimal(100),
        maxExposure: new Prisma.Decimal(500),
        maxDailyLoss: new Prisma.Decimal(1000),
        priceOffset: new Prisma.Decimal(0),
        status: "ACTIVE",
      };

      // Daily PnL cache returns "0" (fine), exposure cache returns "500" (at limit)
      redis.get.mockImplementation(async (key: string) => {
        if (key.includes(":exposure")) return "500";
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

      await engine.processCopyForConfig(
        config as unknown as CopyConfig,
        event,
        5000,
        0.5,
      );

      // Should NOT have created a trade
      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });

    it("creates trade when risk filters pass", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xwhale",
        mode: "FIXED",
        sizeValue: new Prisma.Decimal(100),
        maxExposure: new Prisma.Decimal(5000),
        maxDailyLoss: new Prisma.Decimal(1000),
        priceOffset: new Prisma.Decimal(0),
        status: "ACTIVE",
      };

      // Daily PnL is fine
      redis.get.mockResolvedValue("0");

      // Current exposure is low
      prisma.copyTrade.findMany.mockResolvedValue([
        { copiedSize: new Prisma.Decimal(50) },
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

      await engine.processCopyForConfig(
        config as unknown as CopyConfig,
        event,
        5000,
        0.5,
      );

      expect(prisma.copyTrade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          configId: "cfg-1",
          sourceWallet: "0xwhale",
          copiedSize: new Prisma.Decimal(100),
          status: "PENDING",
        }),
      });
    });
  });

  describe("handleWhaleTrade", () => {
    it("ignores events with no matching configs", async () => {
      prisma.copyConfig.findMany.mockResolvedValue([]);

      await engine.handleWhaleTrade({
        walletAddress: "0xuntracked",
        marketId: "mkt-1",
        tokenId: "tok-1",
        side: "BUY",
        outcome: "YES",
        notional: "5000",
      });

      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });

    it("processes matching configs for a whale trade", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xwhale",
        mode: "PERCENTAGE",
        sizeValue: new Prisma.Decimal(10),
        maxExposure: new Prisma.Decimal(10000),
        maxDailyLoss: new Prisma.Decimal(1000),
        priceOffset: new Prisma.Decimal(0),
        status: "ACTIVE",
      };

      prisma.copyConfig.findMany.mockResolvedValue([config]);
      redis.get.mockResolvedValue("0");
      prisma.copyTrade.findMany.mockResolvedValue([]);
      prisma.copyTrade.create.mockResolvedValue({
        id: "trade-1",
        configId: "cfg-1",
      });
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

      expect(prisma.copyTrade.create).toHaveBeenCalled();
      // 10% of 5000 = 500
      const createCall = prisma.copyTrade.create.mock.calls[0][0];
      expect(createCall.data.copiedSize).toEqual(new Prisma.Decimal(500));
    });
  });

  describe("price offset application in trades", () => {
    it("applies price offset when creating copy trade", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xwhale",
        mode: "MIRROR",
        sizeValue: new Prisma.Decimal(0),
        maxExposure: new Prisma.Decimal(50000),
        maxDailyLoss: new Prisma.Decimal(5000),
        priceOffset: new Prisma.Decimal(5), // +5%
        status: "ACTIVE",
      };

      redis.get.mockResolvedValue("0");
      prisma.copyTrade.findMany.mockResolvedValue([]);
      prisma.copyTrade.create.mockResolvedValue({
        id: "trade-1",
        configId: "cfg-1",
      });
      prisma.copyConfig.update.mockResolvedValue({});
      redis.xadd.mockResolvedValue("ok");

      await engine.processCopyForConfig(
        config as unknown as CopyConfig,
        {
          walletAddress: "0xwhale",
          marketId: "mkt-1",
          tokenId: "tok-1",
          side: "BUY",
          outcome: "YES",
          notional: "1000",
          price: "0.50",
        },
        1000,
        0.5,
      );

      const createCall = prisma.copyTrade.create.mock.calls[0][0];
      // 0.50 * 1.05 = 0.525
      expect(parseFloat(createCall.data.copiedPrice.toString())).toBeCloseTo(
        0.525,
      );
    });
  });
});
