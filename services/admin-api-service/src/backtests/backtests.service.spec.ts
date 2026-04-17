import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { BacktestsService } from "./backtests.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    userId: "user-1",
    strategyId: "strat-1",
    status: "COMPLETED",
    dateRangeStart: new Date("2024-01-01"),
    dateRangeEnd: new Date("2024-03-31"),
    totalPnl: 120.5,
    winRate: 0.62,
    sharpeRatio: 1.4,
    createdAt: new Date("2024-04-01"),
    completedAt: new Date("2024-04-01T01:00:00"),
    user: { username: "alice" },
    strategy: { name: "Momentum Strategy" },
    ...overrides,
  };
}

function makePrisma() {
  return {
    backtestRun: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };
}

function makeRedis() {
  return {
    xadd: vi.fn().mockResolvedValue("stream-id"),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("BacktestsService", () => {
  let service: BacktestsService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    service = new BacktestsService(prisma as any, redis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns paginated backtest run list with correct shape", async () => {
      const runs = [makeRun(), makeRun({ id: "run-2" })];
      prisma.backtestRun.findMany.mockResolvedValue(runs as any);
      prisma.backtestRun.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });

    it("calculates pages correctly when total is not evenly divisible", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([makeRun()] as any);
      prisma.backtestRun.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.pages).toBe(3);
    });

    it("calculates pages for exact multiple", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(20);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.pages).toBe(2);
    });

    it("applies correct skip offset for page 3 with limit 5", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({ page: 3, limit: 5 });

      const call = prisma.backtestRun.findMany.mock.calls[0][0];
      expect(call.skip).toBe(10);
      expect(call.take).toBe(5);
    });

    it("applies userId filter when provided", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, userId: "user-42" });

      const call = prisma.backtestRun.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe("user-42");
    });

    it("omits userId filter when not provided", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.backtestRun.findMany.mock.calls[0][0];
      expect(call.where.userId).toBeUndefined();
    });

    it("applies status filter when provided", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, status: "RUNNING" });

      const call = prisma.backtestRun.findMany.mock.calls[0][0];
      expect(call.where.status).toBe("RUNNING");
    });

    it("omits status filter when not provided", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.backtestRun.findMany.mock.calls[0][0];
      expect(call.where.status).toBeUndefined();
    });

    it("applies both userId and status filters together", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        userId: "user-99",
        status: "FAILED",
      });

      const call = prisma.backtestRun.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe("user-99");
      expect(call.where.status).toBe("FAILED");
    });

    it("orders results by createdAt descending", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.backtestRun.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: "desc" });
    });

    it("selects user username and strategy name via nested select", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.backtestRun.findMany.mock.calls[0][0];
      expect(call.select.user).toBeDefined();
      expect(call.select.strategy).toBeDefined();
      expect(call.select.user.select.username).toBe(true);
      expect(call.select.strategy.select.name).toBe(true);
    });

    it("selects all expected scalar fields", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.backtestRun.findMany.mock.calls[0][0];
      const selected = call.select;
      expect(selected.id).toBe(true);
      expect(selected.userId).toBe(true);
      expect(selected.strategyId).toBe(true);
      expect(selected.status).toBe(true);
      expect(selected.totalPnl).toBe(true);
      expect(selected.winRate).toBe(true);
      expect(selected.sharpeRatio).toBe(true);
      expect(selected.createdAt).toBe(true);
      expect(selected.completedAt).toBe(true);
    });

    it("passes same where clause to both findMany and count", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        userId: "user-7",
        status: "COMPLETED",
      });

      const findCall = prisma.backtestRun.findMany.mock.calls[0][0];
      const countCall = prisma.backtestRun.count.mock.calls[0][0];
      expect(findCall.where).toEqual(countCall.where);
    });

    it("returns empty data array when there are no results", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.pages).toBe(0);
    });

    it("echoes page and limit in the returned object", async () => {
      prisma.backtestRun.findMany.mockResolvedValue([] as any);
      prisma.backtestRun.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 4, limit: 15 });

      expect(result.page).toBe(4);
      expect(result.limit).toBe(15);
    });

    it("propagates prisma errors", async () => {
      prisma.backtestRun.findMany.mockRejectedValue(
        new Error("DB connection lost"),
      );
      prisma.backtestRun.count.mockResolvedValue(0);

      await expect(service.findAll({ page: 1, limit: 10 })).rejects.toThrow(
        "DB connection lost",
      );
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  describe("cancel", () => {
    it("returns id and CANCELLED status on success", async () => {
      const run = makeRun({ status: "RUNNING" });
      prisma.backtestRun.findUnique.mockResolvedValue(run as any);
      prisma.backtestRun.update.mockResolvedValue({
        ...run,
        status: "CANCELLED",
      } as any);

      const result = await service.cancel("run-1");

      expect(result).toEqual({ id: "run-1", status: "CANCELLED" });
    });

    it("throws NotFoundException when run does not exist", async () => {
      prisma.backtestRun.findUnique.mockResolvedValue(null);

      await expect(service.cancel("ghost")).rejects.toThrow(NotFoundException);
    });

    it("includes code NOT_FOUND in exception", async () => {
      prisma.backtestRun.findUnique.mockResolvedValue(null);

      await expect(service.cancel("ghost")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("updates run status to CANCELLED with completedAt", async () => {
      const run = makeRun();
      prisma.backtestRun.findUnique.mockResolvedValue(run as any);
      prisma.backtestRun.update.mockResolvedValue(run as any);

      await service.cancel("run-1");

      expect(prisma.backtestRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "run-1" },
          data: expect.objectContaining({ status: "CANCELLED" }),
        }),
      );
    });

    it("publishes cancellation event to backtests stream", async () => {
      const run = makeRun();
      prisma.backtestRun.findUnique.mockResolvedValue(run as any);
      prisma.backtestRun.update.mockResolvedValue(run as any);

      await service.cancel("run-1");

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:backtests:cancel",
        expect.objectContaining({ runId: "run-1" }),
      );
    });
  });
});
