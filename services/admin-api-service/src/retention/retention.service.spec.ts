import { describe, it, expect, beforeEach, vi } from "vitest";
import { RetentionService } from "./retention.service";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    user: {
      count: vi.fn().mockResolvedValue(0),
    },
    userLoginHistory: {
      deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
    notificationHistory: {
      deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
    },
    paperOrder: {
      deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    strategyEvent: {
      deleteMany: vi.fn().mockResolvedValue({ count: 20 }),
    },
    eventLog: {
      deleteMany: vi.fn().mockResolvedValue({ count: 7 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  } as any;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("RetentionService", () => {
  let service: RetentionService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new RetentionService(prisma);
  });

  // ── Purge Jobs ──────────────────────────────────────────────────────

  describe("runRetentionJobs", () => {
    it("executes all purge jobs", async () => {
      await service.runRetentionJobs();

      expect(prisma.userLoginHistory.deleteMany).toHaveBeenCalledOnce();
      expect(prisma.notificationHistory.deleteMany).toHaveBeenCalledOnce();
      expect(prisma.paperOrder.deleteMany).toHaveBeenCalledOnce();
      expect(prisma.strategyEvent.deleteMany).toHaveBeenCalledOnce();
      // eventLog.deleteMany called twice (non-fill + fill)
      expect(prisma.eventLog.deleteMany).toHaveBeenCalledTimes(2);
    });

    it("uses 90-day cutoff for login history", async () => {
      await service.runRetentionJobs();

      const call = prisma.userLoginHistory.deleteMany.mock.calls[0][0];
      const cutoff = call.where.createdAt.lt;
      const daysDiff = (Date.now() - cutoff.getTime()) / 86400_000;
      expect(daysDiff).toBeCloseTo(90, 0);
    });

    it("uses 7-day cutoff for strategy events", async () => {
      await service.runRetentionJobs();

      const call = prisma.strategyEvent.deleteMany.mock.calls[0][0];
      const cutoff = call.where.createdAt.lt;
      const daysDiff = (Date.now() - cutoff.getTime()) / 86400_000;
      expect(daysDiff).toBeCloseTo(7, 0);
    });

    it("applies different cutoffs for fill vs non-fill event logs", async () => {
      await service.runRetentionJobs();

      const calls = prisma.eventLog.deleteMany.mock.calls;
      // First call: non-fill events (30 days)
      expect(calls[0][0].where.eventType.notIn).toContain("ORDER_FILLED");
      // Second call: fill events (365 days)
      expect(calls[1][0].where.eventType.in).toContain("ORDER_FILLED");
    });

    it("continues even if one purge job fails", async () => {
      prisma.userLoginHistory.deleteMany.mockRejectedValueOnce(
        new Error("DB connection error"),
      );

      // Should not throw — uses Promise.allSettled
      await expect(service.runRetentionJobs()).resolves.toBeUndefined();

      // Other jobs should still have been called
      expect(prisma.notificationHistory.deleteMany).toHaveBeenCalled();
    });
  });

  // ── getOverview ──────────────────────────────────────────────────────

  describe("getOverview", () => {
    it("returns all required fields", async () => {
      prisma.user.count
        .mockResolvedValueOnce(50) // dau
        .mockResolvedValueOnce(200) // wau
        .mockResolvedValueOnce(500) // mau
        .mockResolvedValueOnce(5) // newUsersToday
        .mockResolvedValueOnce(30) // newUsersWeek
        .mockResolvedValueOnce(400); // previousMau

      const result = await service.getOverview();

      expect(result).toEqual(
        expect.objectContaining({
          dau: 50,
          wau: 200,
          mau: 500,
          newUsersToday: 5,
          newUsersWeek: 30,
        }),
      );
      expect(result.dauWauRatio).toBeCloseTo(0.25);
      expect(result.wauMauRatio).toBeCloseTo(0.4);
      expect(typeof result.churnRate).toBe("number");
    });

    it("computes DAU/WAU ratio correctly", async () => {
      prisma.user.count
        .mockResolvedValueOnce(100) // dau
        .mockResolvedValueOnce(200) // wau
        .mockResolvedValueOnce(400) // mau
        .mockResolvedValueOnce(10) // newUsersToday
        .mockResolvedValueOnce(50) // newUsersWeek
        .mockResolvedValueOnce(300); // previousMau

      const result = await service.getOverview();

      expect(result.dauWauRatio).toBeCloseTo(0.5);
      expect(result.wauMauRatio).toBeCloseTo(0.5);
    });

    it("handles zero WAU/MAU without division error", async () => {
      prisma.user.count.mockResolvedValue(0);

      const result = await service.getOverview();

      expect(result.dauWauRatio).toBe(0);
      expect(result.wauMauRatio).toBe(0);
      expect(result.churnRate).toBe(0);
    });

    it("queries only non-deleted users", async () => {
      prisma.user.count.mockResolvedValue(0);

      await service.getOverview();

      for (const call of prisma.user.count.mock.calls) {
        expect(call[0].where.deleted).toBe(false);
      }
    });
  });

  // ── getTrend ──────────────────────────────────────────────────────

  describe("getTrend", () => {
    it("returns formatted trend data", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { date: "2026-04-20", dau: 100, new_users: 20 },
        { date: "2026-04-21", dau: 110, new_users: 15 },
      ]);

      const result = await service.getTrend(30);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        date: "2026-04-20",
        dau: 100,
        newUsers: 20,
        returningUsers: 80,
      });
      expect(result.data[1]).toEqual({
        date: "2026-04-21",
        dau: 110,
        newUsers: 15,
        returningUsers: 95,
      });
    });

    it("computes returningUsers as dau minus newUsers", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { date: "2026-04-20", dau: 50, new_users: 50 },
      ]);

      const result = await service.getTrend(7);

      expect(result.data[0].returningUsers).toBe(0);
    });

    it("clamps returningUsers to zero when newUsers exceeds dau", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { date: "2026-04-20", dau: 5, new_users: 10 },
      ]);

      const result = await service.getTrend(7);

      expect(result.data[0].returningUsers).toBe(0);
    });

    it("returns empty array when no data exists", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.getTrend(14);

      expect(result.data).toEqual([]);
    });
  });

  // ── getCohorts ──────────────────────────────────────────────────────

  describe("getCohorts", () => {
    it("returns cohort data with retention arrays", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { cohort: "2026-01", size: 100 },
        { cohort: "2026-02", size: 80 },
      ]);
      prisma.user.count.mockResolvedValue(50);

      const result = await service.getCohorts(6);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].cohort).toBe("2026-01");
      expect(result.data[0].size).toBe(100);
      expect(result.data[0].retention).toHaveLength(6);
    });

    it("computes retention percentage correctly", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { cohort: "2026-01", size: 200 },
      ]);
      prisma.user.count.mockResolvedValue(100);

      const result = await service.getCohorts(6);

      expect(result.data[0].retention[0]).toBe(50);
    });

    it("handles zero-size cohorts safely", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ cohort: "2026-03", size: 0 }]);

      const result = await service.getCohorts(3);

      expect(result.data[0].retention.every((r: number) => r === 0)).toBe(true);
    });

    it("returns empty data when no cohorts exist", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.getCohorts(6);

      expect(result.data).toEqual([]);
    });
  });
});
