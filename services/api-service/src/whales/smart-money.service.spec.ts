import { describe, it, expect, beforeEach, vi } from "vitest";
import { SmartMoneyService } from "./smart-money.service";
import { Prisma } from "@prisma/client";

function createMockPrisma() {
  return {
    whaleProfile: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    whaleAlert: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    market: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  } as any;
}

function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    getClient: vi.fn().mockReturnValue({
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    }),
  } as any;
}

describe("SmartMoneyService", () => {
  let service: SmartMoneyService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    service = new SmartMoneyService(prisma, redis);
  });

  describe("computeSharpe", () => {
    it("returns 0 for fewer than 2 returns", () => {
      expect(service.computeSharpe([5])).toBe(0);
      expect(service.computeSharpe([])).toBe(0);
    });

    it("returns capped positive value for zero variance with positive mean", () => {
      expect(service.computeSharpe([10, 10, 10])).toBe(3.0);
    });

    it("returns 0 for zero variance with non-positive mean", () => {
      expect(service.computeSharpe([-5, -5, -5])).toBe(0);
    });

    it("computes correct Sharpe ratio for varied returns", () => {
      const returns = [10, 5, -2, 8, 3];
      const mean = 4.8;
      const variance =
        returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
      const expected = mean / Math.sqrt(variance);
      expect(service.computeSharpe(returns)).toBeCloseTo(expected, 4);
    });

    it("handles negative average returns", () => {
      const returns = [-10, -5, -8, -3, -12];
      const result = service.computeSharpe(returns);
      expect(result).toBeLessThan(0);
    });
  });

  describe("computeCompositeScore", () => {
    it("returns a score between 0 and 100", () => {
      const score = service.computeCompositeScore(5000, 65, 1.5, 50);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("returns 0 for all-zero inputs", () => {
      const score = service.computeCompositeScore(0, 0, 0, 0);
      expect(score).toBe(0);
    });

    it("scores a profitable wallet higher than an unprofitable one", () => {
      const good = service.computeCompositeScore(10000, 70, 2.0, 100);
      const bad = service.computeCompositeScore(100, 30, -0.5, 10);
      expect(good).toBeGreaterThan(bad);
    });

    it("weights PnL at 35%", () => {
      const highPnl = service.computeCompositeScore(50000, 50, 1.0, 20);
      const lowPnl = service.computeCompositeScore(10, 50, 1.0, 20);
      expect(highPnl).toBeGreaterThan(lowPnl);
    });

    it("weights win rate at 30%", () => {
      const highWr = service.computeCompositeScore(1000, 90, 1.0, 20);
      const lowWr = service.computeCompositeScore(1000, 30, 1.0, 20);
      expect(highWr).toBeGreaterThan(lowWr);
    });

    it("does not exceed 100", () => {
      const score = service.computeCompositeScore(1000000, 100, 5.0, 10000);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("clamps negative Sharpe contribution to 0", () => {
      const score = service.computeCompositeScore(1000, 50, -3.0, 20);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getLeaderboard", () => {
    it("returns ranked profiles sorted by smart money score", async () => {
      const mockProfiles = [
        {
          walletAddress: "0xABC",
          smartMoneyScore: new Prisma.Decimal(85),
          totalPnl: new Prisma.Decimal(5000),
          winRate: new Prisma.Decimal(72),
          sharpeRatio: new Prisma.Decimal(1.8),
          tradeCount: 50,
          winCount: 36,
          totalVolume: new Prisma.Decimal(100000),
          lastTradeAt: new Date("2026-04-18"),
        },
        {
          walletAddress: "0xDEF",
          smartMoneyScore: new Prisma.Decimal(60),
          totalPnl: new Prisma.Decimal(2000),
          winRate: new Prisma.Decimal(55),
          sharpeRatio: new Prisma.Decimal(0.9),
          tradeCount: 30,
          winCount: 16,
          totalVolume: new Prisma.Decimal(50000),
          lastTradeAt: new Date("2026-04-15"),
        },
      ];

      prisma.whaleProfile.findMany.mockResolvedValue(mockProfiles);

      const result = await service.getLeaderboard(20, "all");

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].walletAddress).toBe("0xABC");
      expect(result[1].rank).toBe(2);
      expect(result[1].walletAddress).toBe("0xDEF");
    });

    it("filters by period using lastTradeAt", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([]);

      await service.getLeaderboard(20, "7d");

      const callArgs = prisma.whaleProfile.findMany.mock.calls[0][0];
      expect(callArgs.where.lastTradeAt).toBeDefined();
      expect(callArgs.where.lastTradeAt.gte).toBeInstanceOf(Date);
    });

    it("respects limit parameter", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([]);

      await service.getLeaderboard(5);

      const callArgs = prisma.whaleProfile.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(5);
    });
  });

  describe("computeScores", () => {
    it("skips if no profiles have enough trades", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([]);

      await service.computeScores();

      expect(prisma.market.findMany).not.toHaveBeenCalled();
    });

    it("computes scores for wallets with resolved market data", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([
        { walletAddress: "0x123" },
      ]);

      prisma.market.findMany.mockResolvedValue([
        {
          id: "market-1",
          tokens: [
            { outcome: "YES", price: new Prisma.Decimal(1.0) },
            { outcome: "NO", price: new Prisma.Decimal(0.0) },
          ],
        },
      ]);

      prisma.whaleAlert.findMany.mockResolvedValue([
        {
          walletAddress: "0x123",
          marketId: "market-1",
          side: "BUY",
          outcome: "YES",
          size: new Prisma.Decimal(100),
          price: new Prisma.Decimal(0.6),
        },
        {
          walletAddress: "0x123",
          marketId: "market-1",
          side: "BUY",
          outcome: "YES",
          size: new Prisma.Decimal(50),
          price: new Prisma.Decimal(0.7),
        },
        {
          walletAddress: "0x123",
          marketId: "market-1",
          side: "BUY",
          outcome: "YES",
          size: new Prisma.Decimal(75),
          price: new Prisma.Decimal(0.55),
        },
      ]);

      await service.computeScores();

      expect(prisma.$transaction).toHaveBeenCalled();
      const txArgs = prisma.$transaction.mock.calls[0][0];
      expect(txArgs.length).toBe(1);
    });

    it("skips wallets with fewer than 3 resolved trades", async () => {
      prisma.whaleProfile.findMany.mockResolvedValue([
        { walletAddress: "0x123" },
      ]);

      prisma.market.findMany.mockResolvedValue([
        {
          id: "market-1",
          tokens: [
            { outcome: "YES", price: new Prisma.Decimal(1.0) },
            { outcome: "NO", price: new Prisma.Decimal(0.0) },
          ],
        },
      ]);

      prisma.whaleAlert.findMany.mockResolvedValue([
        {
          walletAddress: "0x123",
          marketId: "market-1",
          side: "BUY",
          outcome: "YES",
          size: new Prisma.Decimal(100),
          price: new Prisma.Decimal(0.6),
        },
      ]);

      await service.computeScores();

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
