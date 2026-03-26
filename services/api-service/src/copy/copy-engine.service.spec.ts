import { describe, it, expect, beforeEach, vi } from "vitest";
import { CopyEngineService } from "./copy-engine.service";

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
    },
  } as any;
}

function createMockRedis() {
  return {
    xadd: vi.fn().mockResolvedValue("stream-id"),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    getClient: vi.fn().mockReturnValue({
      xgroup: vi.fn().mockResolvedValue("OK"),
      incrbyfloat: vi.fn().mockResolvedValue("100"),
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
        walletAddress: "0xabc",
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
        walletAddress: "0xabc",
        notional: "1000",
        price: "0.5",
        marketId: "m1",
        tokenId: "t1",
        side: "BUY",
        outcome: "YES",
      });

      expect(prisma.copyTrade.create).toHaveBeenCalledOnce();
    });
  });
});
