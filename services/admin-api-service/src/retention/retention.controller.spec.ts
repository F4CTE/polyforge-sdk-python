import { describe, it, expect, beforeEach, vi } from "vitest";
import { RetentionController } from "./retention.controller";

function createMockService() {
  return {
    getOverview: vi.fn().mockResolvedValue({
      dau: 50,
      wau: 200,
      mau: 500,
      dauWauRatio: 0.25,
      wauMauRatio: 0.4,
      newUsersToday: 5,
      newUsersWeek: 30,
      churnRate: 0.03,
    }),
    getCohorts: vi.fn().mockResolvedValue({
      data: [
        { cohort: "2026-01", size: 100, retention: [100, 80, 60, 40, 20, 10] },
      ],
    }),
    getTrend: vi.fn().mockResolvedValue({
      data: [
        { date: "2026-04-20", dau: 100, newUsers: 20, returningUsers: 80 },
      ],
    }),
  } as any;
}

describe("RetentionController", () => {
  let controller: RetentionController;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    controller = new RetentionController(service);
  });

  describe("getOverview", () => {
    it("delegates to service.getOverview()", async () => {
      const result = await controller.getOverview();

      expect(service.getOverview).toHaveBeenCalledOnce();
      expect(result.dau).toBe(50);
    });
  });

  describe("getCohorts", () => {
    it("passes parsed months to service", async () => {
      await controller.getCohorts("6");

      expect(service.getCohorts).toHaveBeenCalledWith(6);
    });

    it("defaults to 6 months when no param provided", async () => {
      await controller.getCohorts(undefined);

      expect(service.getCohorts).toHaveBeenCalledWith(6);
    });
  });

  describe("getTrend", () => {
    it("passes parsed days to service", async () => {
      await controller.getTrend("30");

      expect(service.getTrend).toHaveBeenCalledWith(30);
    });

    it("defaults to 30 days when no param provided", async () => {
      await controller.getTrend(undefined);

      expect(service.getTrend).toHaveBeenCalledWith(30);
    });
  });
});
