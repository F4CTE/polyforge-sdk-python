import { describe, it, expect, beforeEach, vi } from "vitest";
import { RetentionService } from "./retention.service";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
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
});
