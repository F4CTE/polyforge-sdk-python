import { describe, it, expect, beforeEach, vi } from "vitest";
import { RevenueController } from "./revenue.controller";

function createMockService() {
  return {
    getMonthlyRevenue: vi.fn().mockResolvedValue({
      data: [{ month: "2026-01", revenue: 1000, fees: 200, purchases: 30 }],
    }),
    getBreakdown: vi.fn().mockResolvedValue({
      totalRevenue: 5000,
      totalChange: 12.5,
      period: "30d",
      sources: [],
    }),
    getTopUsers: vi.fn().mockResolvedValue({
      data: [
        {
          userId: "u1",
          username: "trader1",
          revenueGenerated: 2000,
          tradeVolume: "50000",
          primarySource: "marketplace_listings",
        },
      ],
    }),
  } as any;
}

describe("RevenueController", () => {
  let controller: RevenueController;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    controller = new RevenueController(service);
  });

  describe("getMonthly", () => {
    it("passes parsed months to service", async () => {
      await controller.getMonthly("6");

      expect(service.getMonthlyRevenue).toHaveBeenCalledWith(6);
    });

    it("defaults to 12 months when no param provided", async () => {
      await controller.getMonthly(undefined);

      expect(service.getMonthlyRevenue).toHaveBeenCalledWith(12);
    });

    it("returns monthly data from service", async () => {
      const result = await controller.getMonthly("12");

      expect(result.data).toHaveLength(1);
      expect(result.data[0].month).toBe("2026-01");
    });
  });

  describe("getBreakdown", () => {
    it("passes valid period to service", async () => {
      await controller.getBreakdown("7d");

      expect(service.getBreakdown).toHaveBeenCalledWith("7d");
    });

    it("defaults to 30d for invalid period", async () => {
      await controller.getBreakdown("invalid");

      expect(service.getBreakdown).toHaveBeenCalledWith("30d");
    });

    it("defaults to 30d when no period provided", async () => {
      await controller.getBreakdown(undefined);

      expect(service.getBreakdown).toHaveBeenCalledWith("30d");
    });

    it("returns breakdown data from service", async () => {
      const result = await controller.getBreakdown("30d");

      expect(result.totalRevenue).toBe(5000);
    });
  });

  describe("getTopUsers", () => {
    it("passes period and limit to service", async () => {
      await controller.getTopUsers("90d", "20");

      expect(service.getTopUsers).toHaveBeenCalledWith("90d", 20);
    });

    it("defaults to 30d and limit 10", async () => {
      await controller.getTopUsers(undefined, undefined);

      expect(service.getTopUsers).toHaveBeenCalledWith("30d", 10);
    });

    it("clamps limit to maximum 50", async () => {
      await controller.getTopUsers("30d", "100");

      expect(service.getTopUsers).toHaveBeenCalledWith("30d", 50);
    });

    it("clamps limit to minimum 1", async () => {
      await controller.getTopUsers("30d", "0");

      expect(service.getTopUsers).toHaveBeenCalledWith("30d", 1);
    });

    it("returns top users data from service", async () => {
      const result = await controller.getTopUsers("30d", "10");

      expect(result.data).toHaveLength(1);
      expect(result.data[0].username).toBe("trader1");
    });
  });
});
