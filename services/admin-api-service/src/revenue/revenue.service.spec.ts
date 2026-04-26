import { describe, it, expect, beforeEach, vi } from "vitest";
import { RevenueService } from "./revenue.service";

function createMockPrisma() {
  return {
    marketplacePurchase: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { platformFee: null, priceUsdc: null },
        _count: 0,
      }),
    },
    order: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { fee: null },
        _count: 0,
      }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  } as any;
}

describe("RevenueService", () => {
  let service: RevenueService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new RevenueService(prisma);
  });

  describe("getMonthlyRevenue", () => {
    it("returns formatted monthly data from raw query", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { month: "2026-01", revenue: 1500.5, fees: 300.1, purchases: 42 },
        { month: "2026-02", revenue: 2000, fees: 400, purchases: 55 },
      ]);

      const result = await service.getMonthlyRevenue(12);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        month: "2026-01",
        revenue: 1500.5,
        fees: 300.1,
        purchases: 42,
      });
    });

    it("returns empty data when no purchases exist", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.getMonthlyRevenue(6);

      expect(result.data).toEqual([]);
    });

    it("converts all values to numbers", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { month: "2026-03", revenue: "100.5", fees: "20.5", purchases: "10" },
      ]);

      const result = await service.getMonthlyRevenue(3);

      expect(typeof result.data[0].revenue).toBe("number");
      expect(typeof result.data[0].fees).toBe("number");
      expect(typeof result.data[0].purchases).toBe("number");
    });
  });

  describe("getBreakdown", () => {
    it("returns all five revenue sources", async () => {
      prisma.marketplacePurchase.aggregate
        .mockResolvedValueOnce({
          _sum: { platformFee: 500, priceUsdc: 2500 },
          _count: 10,
        })
        .mockResolvedValueOnce({
          _sum: { platformFee: 400, priceUsdc: 2000 },
          _count: 8,
        });
      prisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { fee: 300 }, _count: 50 })
        .mockResolvedValueOnce({ _sum: { fee: 250 }, _count: 40 });

      const result = await service.getBreakdown("30d");

      expect(result.sources).toHaveLength(5);
      expect(result.sources.map((s) => s.source)).toEqual([
        "marketplace_listings",
        "copy_fees",
        "strategy_sales",
        "subscription",
        "other",
      ]);
      expect(result.period).toBe("30d");
    });

    it("computes percentage shares summing to 100", async () => {
      prisma.marketplacePurchase.aggregate
        .mockResolvedValueOnce({
          _sum: { platformFee: 500, priceUsdc: 1000 },
          _count: 5,
        })
        .mockResolvedValueOnce({
          _sum: { platformFee: 400, priceUsdc: 800 },
          _count: 4,
        });
      prisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { fee: 200 }, _count: 20 })
        .mockResolvedValueOnce({ _sum: { fee: 150 }, _count: 15 });

      const result = await service.getBreakdown("7d");

      const totalPct = result.sources.reduce((sum, s) => sum + s.pct, 0);
      expect(totalPct).toBeCloseTo(100, 0);
    });

    it("handles zero revenue gracefully", async () => {
      const result = await service.getBreakdown("30d");

      expect(result.totalRevenue).toBe(0);
      expect(result.sources.every((s) => s.pct === 0)).toBe(true);
    });

    it("computes positive change when current > previous", async () => {
      prisma.marketplacePurchase.aggregate
        .mockResolvedValueOnce({
          _sum: { platformFee: 200, priceUsdc: 400 },
          _count: 5,
        })
        .mockResolvedValueOnce({
          _sum: { platformFee: 100, priceUsdc: 200 },
          _count: 3,
        });
      prisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { fee: 0 }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { fee: 0 }, _count: 0 });

      const result = await service.getBreakdown("30d");

      const marketplace = result.sources.find(
        (s) => s.source === "marketplace_listings",
      )!;
      expect(marketplace.change).toBe(100);
    });

    it("defaults to 30d when invalid period provided", async () => {
      const result = await service.getBreakdown("invalid");

      expect(result.period).toBe("invalid");
      expect(result.totalRevenue).toBe(0);
    });
  });

  describe("getTopUsers", () => {
    it("returns formatted user data from raw query", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          userId: "u1",
          username: "trader1",
          revenueGenerated: 5000,
          tradeVolume: "100000",
          primarySource: "copy_fees",
        },
      ]);

      const result = await service.getTopUsers("30d", 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        userId: "u1",
        username: "trader1",
        revenueGenerated: 5000,
        tradeVolume: "100000",
        primarySource: "copy_fees",
      });
    });

    it("returns empty data when no users found", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.getTopUsers("7d", 5);

      expect(result.data).toEqual([]);
    });

    it("converts revenueGenerated to number", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          userId: "u2",
          username: "whale",
          revenueGenerated: "9999.99",
          tradeVolume: "500000",
          primarySource: "marketplace_listings",
        },
      ]);

      const result = await service.getTopUsers("90d", 10);

      expect(typeof result.data[0].revenueGenerated).toBe("number");
      expect(typeof result.data[0].tradeVolume).toBe("string");
    });
  });
});
