import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { BacktestsService } from "./backtests.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import { RedisService, BetaLimitsConfigService } from "@polyforge/shared-redis";

// ─── Factories ────────────────────────────────────────────────────────────────

// Dates within the 90-day beta backtest window, relative to now
const RANGE_START = new Date(Date.now() - 30 * 86400_000).toISOString(); // 30 days ago
const RANGE_END = new Date(Date.now() - 1 * 86400_000).toISOString(); // yesterday

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-uuid-1",
    userId: "user-uuid-1",
    strategyId: "strategy-uuid-1",
    dateRangeStart: new Date(RANGE_START),
    dateRangeEnd: new Date(RANGE_END),
    status: "QUEUED",
    createdAt: new Date(),
    ...overrides,
  };
}

function makeQuery(overrides: Record<string, unknown> = {}) {
  return {
    page: 1,
    limit: 20,
    ...overrides,
  };
}

function makeCreateDto(overrides: Record<string, unknown> = {}) {
  return {
    strategyId: "strategy-uuid-1",
    dateRangeStart: RANGE_START,
    dateRangeEnd: RANGE_END,
    quickMode: false,
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("BacktestsService", () => {
  let service: BacktestsService;
  let db: MockDb;
  let redis: RedisService;

  beforeEach(() => {
    db = createMockDb();
    redis = {
      xadd: vi.fn().mockResolvedValue("stream-entry-id"),
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    } as unknown as RedisService;
    const betaLimits = {
      getAllLimits: vi.fn(),
      getLimit: vi.fn(),
      setLimits: vi.fn(),
    } as unknown as BetaLimitsConfigService;
    service = new BacktestsService(db as any, redis, betaLimits);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns a paginated response with runs", async () => {
      const runs = [makeRun(), makeRun({ id: "run-uuid-2" })];
      db.backtestRun.findMany.mockResolvedValue(runs as any);
      db.backtestRun.count.mockResolvedValue(2);

      const result = await service.list("user-uuid-1", makeQuery());

      // Service maps runs to add strategyName and remove strategy relation
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: runs[0].id,
        userId: runs[0].userId,
        strategyId: runs[0].strategyId,
        status: runs[0].status,
        strategyName: null,
      });
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("passes correct skip/take to findMany", async () => {
      db.backtestRun.findMany.mockResolvedValue([]);
      db.backtestRun.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeQuery({ page: 3, limit: 10 }));

      expect(db.backtestRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("filters by strategyId when provided", async () => {
      db.backtestRun.findMany.mockResolvedValue([]);
      db.backtestRun.count.mockResolvedValue(0);

      await service.list(
        "user-uuid-1",
        makeQuery({ strategyId: "strategy-abc" }),
      );

      expect(db.backtestRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ strategyId: "strategy-abc" }),
        }),
      );
    });

    it("filters by status when provided", async () => {
      db.backtestRun.findMany.mockResolvedValue([]);
      db.backtestRun.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeQuery({ status: "COMPLETED" }));

      expect(db.backtestRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "COMPLETED" }),
        }),
      );
    });

    it("does NOT include strategyId filter when not provided", async () => {
      db.backtestRun.findMany.mockResolvedValue([]);
      db.backtestRun.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeQuery());

      const whereArg = db.backtestRun.findMany.mock.calls[0][0]?.where;
      expect(whereArg).not.toHaveProperty("strategyId");
    });

    it("orders by createdAt desc", async () => {
      db.backtestRun.findMany.mockResolvedValue([]);
      db.backtestRun.count.mockResolvedValue(0);

      await service.list("user-uuid-1", makeQuery());

      expect(db.backtestRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });

    it("always scopes the query to the requesting userId", async () => {
      db.backtestRun.findMany.mockResolvedValue([]);
      db.backtestRun.count.mockResolvedValue(0);

      await service.list("user-uuid-99", makeQuery());

      const whereArg = db.backtestRun.findMany.mock.calls[0][0]?.where;
      expect(whereArg).toHaveProperty("userId", "user-uuid-99");
    });

    it("calculates totalPages and hasNext correctly", async () => {
      db.backtestRun.findMany.mockResolvedValue([makeRun() as any]);
      db.backtestRun.count.mockResolvedValue(25);

      const result = await service.list(
        "user-uuid-1",
        makeQuery({ page: 1, limit: 20 }),
      );

      expect(result.totalPages).toBe(2);
      expect(result.hasNext).toBe(true);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("returns a stub result immediately when quickMode is true", async () => {
      const result = await service.create(
        "user-uuid-1",
        makeCreateDto({ quickMode: true }),
      );

      expect(result).toEqual({
        totalOrders: 0,
        filledOrders: 0,
        totalPnl: "0.00",
        winRate: "0.00",
        hasDataGaps: false,
      });
    });

    it("does NOT persist or publish to Redis in quickMode", async () => {
      await service.create("user-uuid-1", makeCreateDto({ quickMode: true }));

      expect(db.backtestRun.create).not.toHaveBeenCalled();
      expect(redis.xadd).not.toHaveBeenCalled();
    });

    it("creates a QUEUED run and publishes to Redis stream when not quickMode", async () => {
      const run = makeRun({ id: "run-uuid-new", status: "QUEUED" });
      db.backtestRun.create.mockResolvedValue(run as any);

      const result = await service.create("user-uuid-1", makeCreateDto());

      expect(result).toEqual({ runId: "run-uuid-new", status: "QUEUED" });
      expect(db.backtestRun.create).toHaveBeenCalledOnce();
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:backtests",
        expect.objectContaining({
          runId: "run-uuid-new",
          userId: "user-uuid-1",
          strategyId: "strategy-uuid-1",
        }),
      );
    });

    it("creates the run with status QUEUED", async () => {
      const run = makeRun();
      db.backtestRun.create.mockResolvedValue(run as any);

      await service.create("user-uuid-1", makeCreateDto());

      expect(db.backtestRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "QUEUED",
            userId: "user-uuid-1",
          }),
        }),
      );
    });

    it("defaults strategyId to empty string when not provided", async () => {
      const run = makeRun({ strategyId: "" });
      db.backtestRun.create.mockResolvedValue(run as any);

      await service.create(
        "user-uuid-1",
        makeCreateDto({ strategyId: undefined }),
      );

      expect(db.backtestRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ strategyId: "" }),
        }),
      );
    });

    it("parses dateRangeStart and dateRangeEnd when provided", async () => {
      const run = makeRun();
      db.backtestRun.create.mockResolvedValue(run as any);

      // Use dates within the 90-day beta window
      const start = new Date(Date.now() - 60 * 86400_000).toISOString();
      const end = new Date(Date.now() - 1 * 86400_000).toISOString();

      await service.create(
        "user-uuid-1",
        makeCreateDto({ dateRangeStart: start, dateRangeEnd: end }),
      );

      const dataArg = db.backtestRun.create.mock.calls[0][0]?.data;
      expect(dataArg.dateRangeStart).toEqual(new Date(start));
      expect(dataArg.dateRangeEnd).toEqual(new Date(end));
    });

    it("uses epoch start and current date when dateRange not provided", async () => {
      const run = makeRun();
      db.backtestRun.create.mockResolvedValue(run as any);

      const before = Date.now();
      await service.create(
        "user-uuid-1",
        makeCreateDto({
          dateRangeStart: undefined,
          dateRangeEnd: undefined,
        }),
      );
      const after = Date.now();

      const dataArg = db.backtestRun.create.mock.calls[0][0]?.data;
      expect(dataArg.dateRangeStart).toEqual(new Date(0));
      expect((dataArg.dateRangeEnd as Date).getTime()).toBeGreaterThanOrEqual(
        before,
      );
      expect((dataArg.dateRangeEnd as Date).getTime()).toBeLessThanOrEqual(
        after,
      );
    });

    it("includes a ts field in the Redis stream payload", async () => {
      const run = makeRun();
      db.backtestRun.create.mockResolvedValue(run as any);

      await service.create("user-uuid-1", makeCreateDto());

      const streamPayload = (redis.xadd as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      expect(streamPayload).toHaveProperty("ts");
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns the run when found and owned by the user", async () => {
      const run = makeRun({ userId: "user-uuid-1" });
      db.backtestRun.findUnique.mockResolvedValue(run as any);

      const result = await service.findOne("run-uuid-1", "user-uuid-1");

      expect(result).toEqual(run);
    });

    it("throws NotFoundException (404) when the run does not exist", async () => {
      db.backtestRun.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne("nonexistent-id", "user-uuid-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NOT_FOUND error code when the run does not exist", async () => {
      db.backtestRun.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne("nonexistent-id", "user-uuid-1"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("throws NotFoundException (404) when the run belongs to a different user", async () => {
      const run = makeRun({ userId: "other-user-id" });
      db.backtestRun.findUnique.mockResolvedValue(run as any);

      await expect(
        service.findOne("run-uuid-1", "user-uuid-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("looks up the run by id", async () => {
      const run = makeRun({ userId: "user-uuid-1" });
      db.backtestRun.findUnique.mockResolvedValue(run as any);

      await service.findOne("run-uuid-1", "user-uuid-1");

      expect(db.backtestRun.findUnique).toHaveBeenCalledWith({
        where: { id: "run-uuid-1" },
      });
    });
  });
});
