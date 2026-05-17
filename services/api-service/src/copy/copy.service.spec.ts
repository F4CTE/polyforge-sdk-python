import { describe, it, expect, beforeEach, vi } from "vitest";
import { CopyService } from "./copy.service";
import { CopyEngineService } from "./copy-engine.service";
import { Prisma, type CopyConfig } from "@prisma/client";

const LOWER_TARGET_WALLET = "0x52908400098527886e0f7030069857d2e4169ee7";
const CHECKSUM_TARGET_WALLET = "0x52908400098527886E0F7030069857D2E4169EE7";
const BAD_CHECKSUM_WALLET = "0x52908400098527886e0f7030069857d2e4169Ee7";

// ─── Mock PrismaService ─────────────────────────────────────────────────────

function createMockPrisma() {
  const mock = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        polymarketConnected: null,
        polymarketAddress: null,
      }),
    },
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
    $transaction: vi.fn((arg: any) => {
      if (typeof arg === "function") {
        const tx = {
          copyConfig: {
            create: mock.copyConfig.create,
            delete: mock.copyConfig.delete,
          },
          copyTrade: {
            deleteMany: mock.copyTrade.deleteMany,
          },
        };
        return Promise.resolve(arg(tx));
      }
      return Promise.reject(new Error("unsupported"));
    }),
  } as any;
  return mock;
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
      eval: vi.fn().mockResolvedValue("0.1"),
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
      prisma.copyConfig.findMany.mockResolvedValue([]);
      prisma.copyConfig.create.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        targetWallet: LOWER_TARGET_WALLET,
        mode: "PERCENTAGE",
        status: "ACTIVE",
      });

      const result = await service.create("user-1", {
        targetWallet: LOWER_TARGET_WALLET,
      });

      expect(result.id).toBe("cfg-1");
      expect(prisma.copyConfig.count).toHaveBeenNthCalledWith(2, {
        where: {
          targetWallet: {
            equals: CHECKSUM_TARGET_WALLET,
            mode: "insensitive",
          },
          status: { in: ["ACTIVE", "PAUSED"] },
        },
      });
      expect(prisma.copyConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetWallet: CHECKSUM_TARGET_WALLET,
        }),
      });
    });

    it("rejects when max 10 active configs reached", async () => {
      prisma.copyConfig.count.mockResolvedValue(10);

      await expect(
        service.create("user-1", { targetWallet: LOWER_TARGET_WALLET }),
      ).rejects.toThrow("Maximum of 10 active copy configs allowed");
    });

    it("accepts already-checksummed mixed-case address", async () => {
      prisma.copyConfig.count.mockResolvedValue(0);
      prisma.copyConfig.findMany.mockResolvedValue([]);
      prisma.copyConfig.create.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        targetWallet: CHECKSUM_TARGET_WALLET,
        mode: "PERCENTAGE",
        status: "ACTIVE",
      });

      const result = await service.create("user-1", {
        targetWallet: CHECKSUM_TARGET_WALLET,
      });

      expect(result.id).toBe("cfg-1");
      expect(prisma.copyConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetWallet: CHECKSUM_TARGET_WALLET,
        }),
      });
    });

    it("rejects mixed-case address with invalid EIP-55 checksum", async () => {
      await expect(
        service.create("user-1", { targetWallet: BAD_CHECKSUM_WALLET }),
      ).rejects.toThrow("Invalid Ethereum address checksum");

      expect(prisma.copyConfig.count).not.toHaveBeenCalled();
    });

    it("rejects self-copy when targetWallet matches user's own polymarketAddress", async () => {
      prisma.user.findUnique.mockResolvedValue({
        polymarketConnected: true,
        polymarketAddress: CHECKSUM_TARGET_WALLET,
      });

      await expect(
        service.create("user-1", { targetWallet: LOWER_TARGET_WALLET }),
      ).rejects.toThrow("Cannot create a copy config for your own wallet");

      // Should not have reached the config checks
      expect(prisma.copyConfig.count).not.toHaveBeenCalled();
    });

    it("rejects self-copy for legacy invalid mixed-case stored address with same bytes", async () => {
      prisma.user.findUnique.mockResolvedValue({
        polymarketConnected: true,
        polymarketAddress: BAD_CHECKSUM_WALLET,
      });

      await expect(
        service.create("user-1", { targetWallet: LOWER_TARGET_WALLET }),
      ).rejects.toThrow("Cannot create a copy config for your own wallet");

      expect(prisma.copyConfig.count).not.toHaveBeenCalled();
    });


    it("allows copy when user has a different polymarketAddress", async () => {
      prisma.user.findUnique.mockResolvedValue({
        polymarketConnected: true,
        polymarketAddress: "0x1111111111111111111111111111111111111111",
      });
      prisma.copyConfig.count.mockResolvedValue(0);
      prisma.copyConfig.findMany.mockResolvedValue([]);
      prisma.copyConfig.create.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        targetWallet: LOWER_TARGET_WALLET,
        mode: "PERCENTAGE",
        status: "ACTIVE",
      });

      const result = await service.create("user-1", {
        targetWallet: LOWER_TARGET_WALLET,
      });

      expect(result.id).toBe("cfg-1");
    });

    it("allows copy when user is disconnected (polymarketConnected is false) even with matching address", async () => {
      prisma.user.findUnique.mockResolvedValue({
        polymarketConnected: false,
        polymarketAddress: CHECKSUM_TARGET_WALLET,
      });
      prisma.copyConfig.count.mockResolvedValue(0);
      prisma.copyConfig.findMany.mockResolvedValue([]);
      prisma.copyConfig.create.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        targetWallet: LOWER_TARGET_WALLET,
        mode: "PERCENTAGE",
        status: "ACTIVE",
      });

      const result = await service.create("user-1", {
        targetWallet: LOWER_TARGET_WALLET,
      });

      expect(result.id).toBe("cfg-1");
    });

    it("allows copy when stored polymarketAddress is malformed (non-hex)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        polymarketConnected: true,
        polymarketAddress: "not-a-hex-address",
      });
      prisma.copyConfig.count.mockResolvedValue(0);
      prisma.copyConfig.findMany.mockResolvedValue([]);
      prisma.copyConfig.create.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        targetWallet: LOWER_TARGET_WALLET,
        mode: "PERCENTAGE",
        status: "ACTIVE",
      });

      const result = await service.create("user-1", {
        targetWallet: LOWER_TARGET_WALLET,
      });

      expect(result.id).toBe("cfg-1");
    });

    it("rejects when target wallet has reached global subscriber cap", async () => {
      prisma.copyConfig.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(25);

      await expect(
        service.create("user-1", { targetWallet: LOWER_TARGET_WALLET }),
      ).rejects.toMatchObject({
        response: {
          code: "TARGET_AT_CAPACITY",
        },
      });
      expect(prisma.copyConfig.findMany).not.toHaveBeenCalled();
    });

    it("rejects duplicate wallet with non-stopped config", async () => {
      prisma.copyConfig.count.mockResolvedValue(1);
      prisma.copyConfig.findMany.mockResolvedValue([
        {
          id: "cfg-existing",
          status: "ACTIVE",
        },
      ]);

      await expect(
        service.create("user-1", { targetWallet: LOWER_TARGET_WALLET }),
      ).rejects.toThrow(
        "You already have an active copy config for this wallet",
      );
      expect(prisma.copyConfig.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          targetWallet: {
            equals: CHECKSUM_TARGET_WALLET,
            mode: "insensitive",
          },
        },
      });
    });

    it("allows re-creating a STOPPED config in a transaction", async () => {
      prisma.copyConfig.count.mockResolvedValue(0);
      prisma.copyConfig.findMany.mockResolvedValue([
        {
          id: "cfg-old",
          status: "STOPPED",
        },
      ]);
      prisma.copyTrade.deleteMany.mockResolvedValue({ count: 0 });
      prisma.copyConfig.delete.mockResolvedValue({});
      prisma.copyConfig.create.mockResolvedValue({
        id: "cfg-new",
        targetWallet: LOWER_TARGET_WALLET,
        status: "ACTIVE",
      });

      const result = await service.create("user-1", {
        targetWallet: LOWER_TARGET_WALLET,
      });

      expect(result.id).toBe("cfg-new");
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.copyConfig.delete).toHaveBeenCalledWith({
        where: { id: "cfg-old" },
      });
    });

    it("cleanup and recreate is atomic — create failure rolls back deletions", async () => {
      prisma.copyConfig.count.mockResolvedValue(0);
      prisma.copyConfig.findMany.mockResolvedValue([
        { id: "cfg-old", status: "STOPPED" },
      ]);
      prisma.copyTrade.deleteMany.mockResolvedValue({ count: 0 });
      prisma.copyConfig.delete.mockResolvedValue({});

      // Simulate create failing inside the transaction
      const createError = new Error("DB write failed");
      prisma.$transaction.mockImplementationOnce(async (arg: any) => {
        if (typeof arg === "function") {
          const tx = {
            copyConfig: {
              create: vi.fn().mockRejectedValue(createError),
              delete: prisma.copyConfig.delete,
            },
            copyTrade: {
              deleteMany: prisma.copyTrade.deleteMany,
            },
          };
          return arg(tx);
        }
        throw new Error("unsupported");
      });

      await expect(
        service.create("user-1", {
          targetWallet: LOWER_TARGET_WALLET,
        }),
      ).rejects.toThrow("DB write failed");

      // Deletions were attempted (they would be rolled back by the real DB)
      expect(prisma.copyTrade.deleteMany).toHaveBeenCalledWith({
        where: { configId: "cfg-old" },
      });
      expect(prisma.copyConfig.delete).toHaveBeenCalledWith({
        where: { id: "cfg-old" },
      });
    });

    it("allows re-creating when multiple legacy STOPPED configs exist for same wallet", async () => {
      prisma.copyConfig.count.mockResolvedValue(0);
      prisma.copyConfig.findMany.mockResolvedValue([
        { id: "cfg-old-lower", status: "STOPPED" },
        { id: "cfg-old-upper", status: "STOPPED" },
      ]);
      prisma.copyTrade.deleteMany.mockResolvedValue({ count: 0 });
      prisma.copyConfig.delete.mockResolvedValue({});
      prisma.copyConfig.create.mockResolvedValue({
        id: "cfg-new",
        targetWallet: LOWER_TARGET_WALLET,
        status: "ACTIVE",
      });

      const result = await service.create("user-1", {
        targetWallet: LOWER_TARGET_WALLET,
      });

      expect(result.id).toBe("cfg-new");
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.copyTrade.deleteMany).toHaveBeenCalledTimes(2);
      expect(prisma.copyConfig.delete).toHaveBeenCalledTimes(2);
      expect(prisma.copyConfig.delete).toHaveBeenCalledWith({
        where: { id: "cfg-old-lower" },
      });
      expect(prisma.copyConfig.delete).toHaveBeenCalledWith({
        where: { id: "cfg-old-upper" },
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

    it("stops a PAUSED config", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        status: "PAUSED",
      });
      prisma.copyConfig.update.mockResolvedValue({
        id: "cfg-1",
        status: "STOPPED",
        stoppedAt: new Date(),
      });

      const result = await service.stop("cfg-1", "user-1");

      expect(result.status).toBe("STOPPED");
    });
  });

  describe("getDetail", () => {
    it("returns config with trades when owned by user", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xabc",
        status: "ACTIVE",
        trades: [{ id: "trade-1" }],
      });

      const result = await service.getDetail("cfg-1", "user-1");

      expect(result.id).toBe("cfg-1");
      expect(result.trades).toHaveLength(1);
    });

    it("throws NotFoundException when config does not exist", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue(null);

      await expect(service.getDetail("cfg-missing", "user-1")).rejects.toThrow(
        "Copy config not found",
      );
    });

    it("throws ForbiddenException when user does not own the config", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-2",
        status: "ACTIVE",
      });

      await expect(service.getDetail("cfg-1", "user-1")).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates mode and sizeValue", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        status: "ACTIVE",
      });
      prisma.copyConfig.update.mockResolvedValue({
        id: "cfg-1",
        mode: "FIXED",
        sizeValue: new Prisma.Decimal(200),
      });

      const result = await service.update("cfg-1", "user-1", {
        mode: "FIXED" as any,
        sizeValue: "200",
      });

      expect(result.mode).toBe("FIXED");
      expect(prisma.copyConfig.update).toHaveBeenCalledWith({
        where: { id: "cfg-1" },
        data: expect.objectContaining({
          mode: "FIXED",
        }),
      });
    });

    it("updates maxExposure and maxDailyLoss", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        status: "ACTIVE",
      });
      prisma.copyConfig.update.mockResolvedValue({ id: "cfg-1" });

      await service.update("cfg-1", "user-1", {
        maxExposure: "5000",
        maxDailyLoss: "200",
      });

      const updateCall = prisma.copyConfig.update.mock.calls[0][0];
      expect(updateCall.data.maxExposure).toBeDefined();
      expect(updateCall.data.maxDailyLoss).toBeDefined();
    });

    it("updates priceOffset when set to 0", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        status: "ACTIVE",
      });
      prisma.copyConfig.update.mockResolvedValue({ id: "cfg-1" });

      await service.update("cfg-1", "user-1", {
        priceOffset: "0",
      });

      const updateCall = prisma.copyConfig.update.mock.calls[0][0];
      expect(updateCall.data.priceOffset).toBeDefined();
    });

    it("throws NotFoundException when config does not exist", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.update("cfg-missing", "user-1", { mode: "FIXED" as any }),
      ).rejects.toThrow("Copy config not found");
    });

    it("throws ForbiddenException when user does not own config", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-2",
        status: "ACTIVE",
      });

      await expect(
        service.update("cfg-1", "user-1", { mode: "FIXED" as any }),
      ).rejects.toThrow();
    });
  });

  describe("getTrades", () => {
    it("returns paginated trades with meta", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        status: "ACTIVE",
      });
      prisma.copyTrade.findMany.mockResolvedValue([
        { id: "trade-1" },
        { id: "trade-2" },
      ]);
      prisma.copyTrade.count.mockResolvedValue(25);

      const result = await service.getTrades("cfg-1", "user-1", 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(2);
    });

    it("calculates correct skip for page 3", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        status: "ACTIVE",
      });
      prisma.copyTrade.findMany.mockResolvedValue([]);
      prisma.copyTrade.count.mockResolvedValue(0);

      await service.getTrades("cfg-1", "user-1", 3, 10);

      expect(prisma.copyTrade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("throws NotFoundException for non-existent config", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.getTrades("cfg-missing", "user-1", 1, 20),
      ).rejects.toThrow("Copy config not found");
    });

    it("throws ForbiddenException when user does not own config", async () => {
      prisma.copyConfig.findUnique.mockResolvedValue({
        id: "cfg-1",
        userId: "user-2",
        status: "ACTIVE",
      });

      await expect(
        service.getTrades("cfg-1", "user-1", 1, 20),
      ).rejects.toThrow();
    });
  });

  describe("create with optional fields", () => {
    it("passes sizeValue, maxExposure, maxDailyLoss, and priceOffset to create", async () => {
      prisma.copyConfig.count.mockResolvedValue(0);
      prisma.copyConfig.findMany.mockResolvedValue([]);
      prisma.copyConfig.create.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        targetWallet: LOWER_TARGET_WALLET,
        mode: "FIXED",
        status: "ACTIVE",
      });

      await service.create("user-1", {
        targetWallet: LOWER_TARGET_WALLET,
        mode: "FIXED" as any,
        sizeValue: "100",
        maxExposure: "5000",
        maxDailyLoss: "200",
        priceOffset: "5",
      });

      const createCall = prisma.copyConfig.create.mock.calls[0][0];
      expect(createCall.data.sizeValue).toBeDefined();
      expect(createCall.data.maxExposure).toBeDefined();
      expect(createCall.data.maxDailyLoss).toBeDefined();
      expect(createCall.data.priceOffset).toBeDefined();
    });

    it("rejects duplicate wallet with PAUSED config", async () => {
      prisma.copyConfig.count.mockResolvedValue(1);
      prisma.copyConfig.findMany.mockResolvedValue([
        {
          id: "cfg-existing",
          status: "PAUSED",
        },
      ]);

      await expect(
        service.create("user-1", { targetWallet: LOWER_TARGET_WALLET }),
      ).rejects.toThrow(
        "You already have an active copy config for this wallet",
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
      redis.getClient().eval.mockResolvedValue("250");
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
        walletAddress: LOWER_TARGET_WALLET,
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
        targetWallet: LOWER_TARGET_WALLET,
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
        walletAddress: LOWER_TARGET_WALLET,
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

  describe("handleWhaleTrade error handling", () => {
    it("emits COPY_TRADE_FAILED event when processCopyForConfig throws", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: LOWER_TARGET_WALLET,
        mode: "PERCENTAGE",
        sizeValue: new Prisma.Decimal(10),
        maxExposure: new Prisma.Decimal(10000),
        maxDailyLoss: new Prisma.Decimal(1000),
        priceOffset: new Prisma.Decimal(0),
        status: "ACTIVE",
      };

      prisma.copyConfig.findMany.mockResolvedValue([config]);
      // Force processCopyForConfig to throw by making daily-loss reservation fail
      redis.getClient().eval.mockRejectedValue(new Error("Redis down"));
      redis.xadd.mockResolvedValue("ok");

      await engine.handleWhaleTrade({
        walletAddress: LOWER_TARGET_WALLET,
        marketId: "mkt-1",
        tokenId: "tok-1",
        side: "BUY",
        outcome: "YES",
        notional: "5000",
        price: "0.5",
      });

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "COPY_TRADE_FAILED",
          userId: "user-1",
          configId: "cfg-1",
          error: "Copy trade failed",
        }),
      );
    });

    it("ignores events with no walletAddress", async () => {
      await engine.handleWhaleTrade({ type: "WHALE_TRADE" });

      expect(prisma.copyConfig.findMany).not.toHaveBeenCalled();
    });

    it("processes multiple configs and continues even if one fails", async () => {
      const config1 = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: LOWER_TARGET_WALLET,
        mode: "FIXED",
        sizeValue: new Prisma.Decimal(100),
        maxExposure: new Prisma.Decimal(10000),
        maxDailyLoss: new Prisma.Decimal(1000),
        priceOffset: new Prisma.Decimal(0),
        status: "ACTIVE",
      };
      const config2 = {
        id: "cfg-2",
        userId: "user-2",
        targetWallet: LOWER_TARGET_WALLET,
        mode: "FIXED",
        sizeValue: new Prisma.Decimal(50),
        maxExposure: new Prisma.Decimal(10000),
        maxDailyLoss: new Prisma.Decimal(1000),
        priceOffset: new Prisma.Decimal(0),
        status: "ACTIVE",
      };

      prisma.copyConfig.findMany.mockResolvedValue([config1, config2]);

      let callCount = 0;
      redis.getClient().eval.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error("Redis error");
        return "50";
      });
      redis.get.mockResolvedValue("0");
      prisma.copyTrade.findMany.mockResolvedValue([]);
      prisma.copyTrade.create.mockResolvedValue({ id: "trade-2" });
      prisma.copyConfig.update.mockResolvedValue({});
      redis.xadd.mockResolvedValue("ok");

      await engine.handleWhaleTrade({
        walletAddress: LOWER_TARGET_WALLET,
        marketId: "mkt-1",
        tokenId: "tok-1",
        side: "BUY",
        outcome: "YES",
        notional: "1000",
        price: "0.5",
      });

      // First config failed, but second should be attempted
      // redis.xadd should have been called for the failure notification at minimum
      expect(redis.xadd).toHaveBeenCalled();
    });
  });

  describe("processCopyForConfig edge cases", () => {
    it("skips trade when copiedSize is 0 (unknown mode)", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xwhale",
        mode: "UNKNOWN_MODE",
        sizeValue: new Prisma.Decimal(10),
        maxExposure: new Prisma.Decimal(10000),
        maxDailyLoss: new Prisma.Decimal(1000),
        priceOffset: new Prisma.Decimal(0),
        status: "ACTIVE",
      };

      redis.get.mockResolvedValue("0");
      redis.getClient().eval.mockResolvedValue("0.1");

      await engine.processCopyForConfig(
        config as unknown as CopyConfig,
        {
          walletAddress: "0xwhale",
          marketId: "mkt-1",
          tokenId: "tok-1",
          side: "BUY",
          outcome: "YES",
        },
        1000,
        0.5,
      );

      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });

    it("publishes ORDER_INTENT to stream:orders after creating trade", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xwhale",
        mode: "FIXED",
        sizeValue: new Prisma.Decimal(100),
        maxExposure: new Prisma.Decimal(50000),
        maxDailyLoss: new Prisma.Decimal(5000),
        priceOffset: new Prisma.Decimal(0),
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
          txHash: "0xtx123",
        },
        1000,
        0.5,
      );

      // xadd should be called twice: once for ORDER_INTENT, once for COPY_TRADE_EXECUTED
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({
          type: "ORDER_INTENT",
          userId: "user-1",
          source: "copy-engine",
          copyTradeId: "trade-1",
        }),
      );

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "COPY_TRADE_EXECUTED",
          userId: "user-1",
          configId: "cfg-1",
          tradeId: "trade-1",
        }),
      );
    });

    it("increments totalCopied on the config after trade", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xwhale",
        mode: "FIXED",
        sizeValue: new Prisma.Decimal(100),
        maxExposure: new Prisma.Decimal(50000),
        maxDailyLoss: new Prisma.Decimal(5000),
        priceOffset: new Prisma.Decimal(0),
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
        },
        1000,
        0.5,
      );

      expect(prisma.copyConfig.update).toHaveBeenCalledWith({
        where: { id: "cfg-1" },
        data: { totalCopied: { increment: 1 } },
      });
    });

    it("rolls back daily loss counter when limit exceeded", async () => {
      const config = {
        id: "cfg-1",
        userId: "user-1",
        targetWallet: "0xwhale",
        mode: "FIXED",
        sizeValue: new Prisma.Decimal(100),
        maxExposure: new Prisma.Decimal(10000),
        maxDailyLoss: new Prisma.Decimal(100),
        priceOffset: new Prisma.Decimal(0),
        status: "ACTIVE",
      };

      // Atomic daily-loss reservation returns value above daily loss limit
      redis.getClient().eval.mockResolvedValue("250");

      await engine.processCopyForConfig(
        config as unknown as CopyConfig,
        {
          walletAddress: "0xwhale",
          marketId: "mkt-1",
          tokenId: "tok-1",
          side: "BUY",
          outcome: "YES",
        },
        1000,
        0.5,
      );

      // Should have rolled back the script-based reservation
      const evalCalls = redis.getClient().eval.mock.calls;
      expect(evalCalls.length).toBeGreaterThanOrEqual(2);
      expect(evalCalls[1][2]).toBe("copy:cfg-1:daily_loss");
      expect(Number(evalCalls[1][3])).toBeLessThan(0);
      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });
  });
});
