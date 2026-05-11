import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { CopyEngineService } from "./copy-engine.service";

const LOWER_TARGET_WALLET = "0x52908400098527886e0f7030069857d2e4169ee7";
const CHECKSUM_TARGET_WALLET = "0x52908400098527886E0F7030069857D2E4169EE7";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    copyConfig: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    copyTrade: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

function createMockRedis() {
  return {
    xadd: vi.fn().mockResolvedValue("stream-id"),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    getClient: vi.fn().mockReturnValue({
      xgroup: vi.fn().mockResolvedValue("OK"),
      eval: vi.fn().mockResolvedValue("100"),
      expire: vi.fn().mockResolvedValue(1),
    }),
  } as any;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("CopyEngineService", () => {
  let service: CopyEngineService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    service = new CopyEngineService(prisma, redis);
  });

  // ── calculateCopySize ───────────────────────────────────────────────────

  describe("calculateCopySize", () => {
    it("returns percentage of source size for PERCENTAGE mode", () => {
      const result = service.calculateCopySize("PERCENTAGE", 50, 100);

      expect(result).toBe(50);
    });

    it("returns fixed value regardless of source size for FIXED mode", () => {
      const result = service.calculateCopySize("FIXED", 25, 100);

      expect(result).toBe(25);
    });

    it("mirrors source size for MIRROR mode", () => {
      const result = service.calculateCopySize("MIRROR", 0, 100);

      expect(result).toBe(100);
    });

    it("returns 0 for unknown mode", () => {
      const result = service.calculateCopySize("UNKNOWN", 50, 100);

      expect(result).toBe(0);
    });
  });

  // ── applyPriceOffset ──────────────────────────────────────────────────

  describe("applyPriceOffset", () => {
    it("applies positive percentage offset", () => {
      const result = service.applyPriceOffset(0.5, 10);

      expect(result).toBeCloseTo(0.55);
    });

    it("applies negative percentage offset", () => {
      const result = service.applyPriceOffset(0.5, -10);

      expect(result).toBeCloseTo(0.45);
    });

    it("returns original price for zero offset", () => {
      const result = service.applyPriceOffset(0.75, 0);

      expect(result).toBe(0.75);
    });
  });

  // ── handleWhaleTrade ──────────────────────────────────────────────────

  describe("handleWhaleTrade", () => {
    it("skips when no wallet address is provided", async () => {
      await service.handleWhaleTrade({ type: "WHALE_TRADE" });

      expect(prisma.copyConfig.findMany).not.toHaveBeenCalled();
    });

    it("skips when no active copy configs target the wallet", async () => {
      prisma.copyConfig.findMany.mockResolvedValue([]);

      await service.handleWhaleTrade({
        type: "WHALE_TRADE",
        walletAddress: LOWER_TARGET_WALLET,
      });

      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });

    it("processes matching copy configs", async () => {
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
        walletAddress: LOWER_TARGET_WALLET,
        notional: "1000",
        price: "0.5",
        marketId: "m1",
        tokenId: "t1",
        side: "BUY",
        outcome: "YES",
      });

      expect(prisma.copyTrade.create).toHaveBeenCalledOnce();
      expect(prisma.copyConfig.findMany).toHaveBeenCalledWith({
        where: {
          targetWallet: {
            equals: CHECKSUM_TARGET_WALLET,
            mode: "insensitive",
          },
          status: "ACTIVE",
        },
      });
    });

    it("emits COPY_TRADE_FAILED when processCopyForConfig throws", async () => {
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
      redis.getClient().eval.mockRejectedValue(new Error("Redis down"));

      await service.handleWhaleTrade({
        type: "WHALE_TRADE",
        walletAddress: LOWER_TARGET_WALLET,
        notional: "1000",
        price: "0.5",
        marketId: "m1",
        tokenId: "t1",
        side: "BUY",
        outcome: "YES",
      });

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "COPY_TRADE_FAILED",
          userId: "user1",
          configId: "cfg1",
          error: "Copy trade failed",
        }),
      );
    });

    it("continues processing remaining configs when one fails", async () => {
      const config1 = {
        id: "cfg1",
        userId: "user1",
        mode: "MIRROR",
        sizeValue: "0",
        maxDailyLoss: "10000",
        maxExposure: "50000",
        priceOffset: "0",
      };
      const config2 = {
        id: "cfg2",
        userId: "user2",
        mode: "MIRROR",
        sizeValue: "0",
        maxDailyLoss: "10000",
        maxExposure: "50000",
        priceOffset: "0",
      };
      prisma.copyConfig.findMany.mockResolvedValue([config1, config2]);

      let callCount = 0;
      redis.getClient().eval.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error("Redis fail");
        return "100";
      });
      prisma.copyTrade.findMany.mockResolvedValue([]);
      prisma.copyTrade.create.mockResolvedValue({ id: "trade-2" });
      prisma.copyConfig.update.mockResolvedValue({});

      await service.handleWhaleTrade({
        type: "WHALE_TRADE",
        walletAddress: LOWER_TARGET_WALLET,
        notional: "1000",
        price: "0.5",
        marketId: "m1",
        tokenId: "t1",
        side: "BUY",
        outcome: "YES",
      });

      // Should have emitted failure for first config and attempted second
      expect(redis.xadd).toHaveBeenCalled();
    });

    it("skips invalid whale trade numerics before copying", async () => {
      const config = {
        id: "cfg1",
        userId: "user1",
        mode: "MIRROR",
        sizeValue: "0",
        maxDailyLoss: "10000",
        maxExposure: "50000",
        priceOffset: "0",
      };
      prisma.copyConfig.findMany.mockResolvedValue([config]);

      await service.handleWhaleTrade({
        type: "WHALE_TRADE",
        walletAddress: LOWER_TARGET_WALLET,
        notional: "NaN",
        price: "0.5",
      });

      expect(redis.getClient().eval).not.toHaveBeenCalled();
      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });
  });

  describe("processCopyForConfig", () => {
    it("fails closed before Redis daily-loss reservation when maxDailyLoss is NaN", async () => {
      const config = {
        id: "cfg1",
        userId: "user1",
        mode: "MIRROR",
        sizeValue: "0",
        maxDailyLoss: "NaN",
        maxExposure: "50000",
        priceOffset: "0",
      };

      await service.processCopyForConfig(
        config as any,
        { walletAddress: "0xabc", side: "BUY", outcome: "YES" },
        100,
        0.5,
      );

      expect(redis.getClient().eval).not.toHaveBeenCalled();
      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });

    it("reserves daily loss and TTL in one Redis script", async () => {
      const config = {
        id: "cfg1",
        userId: "user1",
        mode: "UNKNOWN",
        sizeValue: "100",
        maxDailyLoss: "10000",
        maxExposure: "50000",
        priceOffset: "0",
      };

      redis.getClient().eval.mockResolvedValue("50");
      redis.get.mockResolvedValue("0");
      prisma.copyTrade.findMany.mockResolvedValue([]);

      await service.processCopyForConfig(
        config as any,
        { walletAddress: "0xabc", side: "BUY", outcome: "YES" },
        100,
        0.5,
      );

      expect(redis.getClient().eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("INCRBYFLOAT"'),
        1,
        "copy:cfg1:daily_loss",
        "50",
        "86400",
      );
      expect(redis.getClient().expire).not.toHaveBeenCalled();
    });
  });

  // ── parseFields ──────────────────────────────────────────────────────

  describe("parseFields", () => {
    it("converts flat array of key-value pairs into an object", () => {
      // parseFields is private, but we can test it indirectly or access it
      const fields = ["type", "WHALE_TRADE", "walletAddress", "0xabc"];
      // Access private method via bracket notation for testing
      const result = (service as any).parseFields(fields);

      expect(result).toEqual({
        type: "WHALE_TRADE",
        walletAddress: "0xabc",
      });
    });

    it("handles empty fields array", () => {
      const result = (service as any).parseFields([]);
      expect(result).toEqual({});
    });
  });

  // ── ensureGroup ──────────────────────────────────────────────────────

  describe("ensureGroup", () => {
    it("creates consumer group on stream", async () => {
      await (service as any).ensureGroup();

      expect(redis.getClient().xgroup).toHaveBeenCalledWith(
        "CREATE",
        "stream:events",
        "copy-engine",
        "$",
        "MKSTREAM",
      );
    });

    it("ignores BUSYGROUP error (group already exists)", async () => {
      redis
        .getClient()
        .xgroup.mockRejectedValue(
          new Error("BUSYGROUP Consumer Group name already exists"),
        );

      await expect((service as any).ensureGroup()).resolves.toBeUndefined();
    });

    it("rethrows non-BUSYGROUP errors", async () => {
      redis
        .getClient()
        .xgroup.mockRejectedValue(new Error("Connection refused"));

      await expect((service as any).ensureGroup()).rejects.toThrow(
        "Connection refused",
      );
    });
  });

  // ── onModuleInit / onModuleDestroy ──────────────────────────────────

  describe("lifecycle hooks", () => {
    it("onModuleDestroy sets running to false", async () => {
      // We just want to verify it doesn't throw and sets running = false
      (service as any).running = false;
      (service as any).loopPromise = Promise.resolve();

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  // ── getDailyPnl (private, tested via processCopyForConfig) ──────────

  describe("getDailyPnl (private)", () => {
    it("returns cached value from Redis when available", async () => {
      redis.get.mockResolvedValue("42.5");

      const result = await (service as any).getDailyPnl("cfg1");

      expect(result).toBe(42.5);
    });

    it("returns NaN-safe fallback when cached value is not a number", async () => {
      redis.get.mockResolvedValue("not-a-number");
      prisma.copyTrade.findMany.mockResolvedValue([]);

      const result = await (service as any).getDailyPnl("cfg1");

      // Falls through to DB calculation since parsed is NaN
      expect(result).toBe(0);
    });

    it("calculates from DB trades when cache is empty", async () => {
      redis.get.mockResolvedValue(null);
      prisma.copyTrade.findMany.mockResolvedValue([
        { pnl: "10.5" },
        { pnl: "5.5" },
      ]);

      const result = await (service as any).getDailyPnl("cfg1");

      expect(result).toBe(16);
      expect(redis.set).toHaveBeenCalledWith("copy:cfg1:daily_pnl", "16", 300);
    });
  });

  // ── getCurrentExposure (private) ────────────────────────────────────

  describe("getCurrentExposure (private)", () => {
    it("returns cached exposure from Redis when available", async () => {
      redis.get.mockResolvedValue("250");

      const result = await (service as any).getCurrentExposure("cfg1");

      expect(result).toBe(250);
    });

    it("computes exposure from DB and caches when Redis is empty", async () => {
      redis.get.mockResolvedValue(null);
      prisma.copyTrade.findMany.mockResolvedValue([
        { copiedSize: "100" },
        { copiedSize: "50" },
      ]);

      const result = await (service as any).getCurrentExposure("cfg1");

      expect(result).toBe(150);
      expect(redis.set).toHaveBeenCalledWith("copy:cfg1:exposure", "150", 30);
    });
  });

  // ── processCopyForConfig additional cases ───────────────────────────

  describe("processCopyForConfig", () => {
    it("skips trade when daily loss limit exceeded (rollback)", async () => {
      const config = {
        id: "cfg1",
        userId: "user1",
        mode: "FIXED",
        sizeValue: "100",
        maxDailyLoss: "50",
        maxExposure: "50000",
        priceOffset: "0",
      };

      redis.getClient().eval.mockResolvedValue("250"); // Exceeds 50

      await service.processCopyForConfig(
        config as any,
        {
          walletAddress: "0xabc",
          marketId: "m1",
          tokenId: "t1",
          side: "BUY",
          outcome: "YES",
        },
        1000,
        0.5,
      );

      const calls = redis.getClient().eval.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(calls[1][2]).toBe("copy:cfg1:daily_loss");
      expect(calls[1][3]).toBe("-500");
      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });

    it("skips trade when max exposure is reached", async () => {
      const config = {
        id: "cfg1",
        userId: "user1",
        mode: "FIXED",
        sizeValue: "100",
        maxDailyLoss: "10000",
        maxExposure: "100",
        priceOffset: "0",
      };

      redis.getClient().eval.mockResolvedValue("50"); // Daily loss OK
      redis.get.mockResolvedValue("100"); // Exposure at limit

      await service.processCopyForConfig(
        config as any,
        {
          walletAddress: "0xabc",
          marketId: "m1",
          tokenId: "t1",
          side: "BUY",
          outcome: "YES",
        },
        1000,
        0.5,
      );

      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });

    it("skips trade when copiedSize is 0 (unknown mode)", async () => {
      const config = {
        id: "cfg1",
        userId: "user1",
        mode: "UNKNOWN",
        sizeValue: "100",
        maxDailyLoss: "10000",
        maxExposure: "50000",
        priceOffset: "0",
      };

      redis.getClient().eval.mockResolvedValue("50");
      redis.get.mockResolvedValue("0");

      await service.processCopyForConfig(
        config as any,
        {
          walletAddress: "0xabc",
          marketId: "m1",
          tokenId: "t1",
          side: "BUY",
          outcome: "YES",
        },
        1000,
        0.5,
      );

      expect(prisma.copyTrade.create).not.toHaveBeenCalled();
    });

    it("applies price offset and publishes ORDER_INTENT + COPY_TRADE_EXECUTED", async () => {
      const config = {
        id: "cfg1",
        userId: "user1",
        mode: "FIXED",
        sizeValue: "100",
        maxDailyLoss: "10000",
        maxExposure: "50000",
        priceOffset: "5",
      };

      redis.getClient().eval.mockResolvedValue("50");
      redis.get.mockResolvedValue("0");
      prisma.copyTrade.findMany.mockResolvedValue([]);
      prisma.copyTrade.create.mockResolvedValue({ id: "trade-1" });
      prisma.copyConfig.update.mockResolvedValue({});

      await service.processCopyForConfig(
        config as any,
        {
          walletAddress: "0xabc",
          marketId: "m1",
          tokenId: "t1",
          side: "BUY",
          outcome: "YES",
          txHash: "0xtx123",
        },
        1000,
        0.5,
      );

      expect(prisma.copyTrade.create).toHaveBeenCalledOnce();
      // Verify price offset: 0.5 * 1.05 = 0.525
      const createCall = prisma.copyTrade.create.mock.calls[0][0];
      expect(parseFloat(createCall.data.copiedPrice.toString())).toBeCloseTo(
        0.525,
      );

      // Verify ORDER_INTENT published
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:orders",
        expect.objectContaining({
          type: "ORDER_INTENT",
          userId: "user1",
          source: "copy-engine",
          copyTradeId: "trade-1",
        }),
      );

      // Verify COPY_TRADE_EXECUTED published
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "COPY_TRADE_EXECUTED",
          userId: "user1",
          configId: "cfg1",
          tradeId: "trade-1",
        }),
      );

      // Verify totalCopied incremented
      expect(prisma.copyConfig.update).toHaveBeenCalledWith({
        where: { id: "cfg1" },
        data: { totalCopied: { increment: 1 } },
      });
    });

    it("marks copy trade failed and rolls back reservation when order stream publish fails", async () => {
      const config = {
        id: "cfg1",
        userId: "user1",
        mode: "FIXED",
        sizeValue: "100",
        maxDailyLoss: "10000",
        maxExposure: "50000",
        priceOffset: "0",
      };
      const err = new Error("stream down");

      redis.getClient().eval.mockResolvedValue("50");
      redis.get.mockResolvedValue("0");
      prisma.copyTrade.findMany.mockResolvedValue([]);
      prisma.copyTrade.create.mockResolvedValue({ id: "trade-1" });
      redis.xadd.mockRejectedValueOnce(err);

      await expect(
        service.processCopyForConfig(
          config as any,
          {
            walletAddress: "0xabc",
            marketId: "m1",
            tokenId: "t1",
            side: "BUY",
            outcome: "YES",
          },
          1000,
          0.5,
        ),
      ).rejects.toThrow("stream down");

      expect(prisma.copyTrade.update).toHaveBeenCalledWith({
        where: { id: "trade-1" },
        data: { status: "FAILED" },
      });
      const calls = redis.getClient().eval.mock.calls;
      expect(calls.at(-1)?.[3]).toBe("-500");
      expect(redis.del).toHaveBeenCalledWith("copy:cfg1:exposure");
      expect(prisma.copyConfig.update).not.toHaveBeenCalled();
    });
  });

  // ── reconcileCopyTrade ─────────────────────────────────────────────────

  describe("reconcileCopyTrade", () => {
    it("updates copy trade with fill price and PnL on ORDER_FILLED", async () => {
      prisma.copyTrade.findUnique.mockResolvedValue({
        id: "ct-1",
        configId: "cfg-1",
        side: "BUY",
        copiedPrice: new Prisma.Decimal("0.60"),
        sourcePrice: new Prisma.Decimal("0.60"),
        copiedSize: new Prisma.Decimal("100"),
        config: { userId: "user-1" },
      });
      prisma.copyTrade.update.mockResolvedValue({});
      prisma.copyConfig.update.mockResolvedValue({});

      await service.reconcileCopyTrade({
        type: "ORDER_FILLED",
        copyTradeId: "ct-1",
        fillPrice: "0.65",
        orderId: "order-1",
      });

      expect(prisma.copyTrade.update).toHaveBeenCalledWith({
        where: { id: "ct-1" },
        data: expect.objectContaining({
          status: "CONFIRMED",
          orderId: "order-1",
        }),
      });

      // PnL = (0.65 - 0.60) * 100 = 5.0
      const updateCall = prisma.copyTrade.update.mock.calls[0][0];
      expect(parseFloat(updateCall.data.pnl.toString())).toBeCloseTo(5.0, 2);

      // Verify config PnL updated
      expect(prisma.copyConfig.update).toHaveBeenCalledWith({
        where: { id: "cfg-1" },
        data: { totalPnl: { increment: expect.any(Number) } },
      });

      // Verify exposure cache cleared
      expect(redis.del).toHaveBeenCalledWith("copy:cfg-1:exposure");
    });

    it("skips reconciliation if copy trade not found", async () => {
      prisma.copyTrade.findUnique.mockResolvedValue(null);

      await service.reconcileCopyTrade({
        type: "ORDER_FILLED",
        copyTradeId: "non-existent",
        fillPrice: "0.65",
      });

      expect(prisma.copyTrade.update).not.toHaveBeenCalled();
    });

    it("skips reconciliation if no copyTradeId", async () => {
      await service.reconcileCopyTrade({
        type: "ORDER_FILLED",
      });

      expect(prisma.copyTrade.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── handleCopyTradeCancelled ───────────────────────────────────────────

  describe("handleCopyTradeCancelled", () => {
    it("marks copy trade as cancelled", async () => {
      prisma.copyTrade.findUnique.mockResolvedValue({
        id: "ct-2",
        configId: "cfg-2",
        status: "PENDING",
      });
      prisma.copyTrade.update.mockResolvedValue({});

      await service.handleCopyTradeCancelled({
        type: "ORDER_CANCELLED",
        copyTradeId: "ct-2",
      });

      expect(prisma.copyTrade.update).toHaveBeenCalledWith({
        where: { id: "ct-2" },
        data: { status: "CANCELLED" },
      });
      expect(redis.del).toHaveBeenCalledWith("copy:cfg-2:exposure");
    });

    it("does not overwrite confirmed trades", async () => {
      prisma.copyTrade.findUnique.mockResolvedValue({
        id: "ct-3",
        configId: "cfg-3",
        status: "CONFIRMED",
      });

      await service.handleCopyTradeCancelled({
        type: "ORDER_CANCELLED",
        copyTradeId: "ct-3",
      });

      expect(prisma.copyTrade.update).not.toHaveBeenCalled();
    });
  });
});
