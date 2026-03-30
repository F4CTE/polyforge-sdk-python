"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const backtests_service_1 = require("./backtests.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
function makeRun(overrides = {}) {
    return {
        id: "run-uuid-1",
        userId: "user-uuid-1",
        strategyId: "strategy-uuid-1",
        dateRangeStart: new Date("2024-01-01"),
        dateRangeEnd: new Date("2024-12-31"),
        status: "QUEUED",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        ...overrides,
    };
}
function makeQuery(overrides = {}) {
    return {
        page: 1,
        limit: 20,
        ...overrides,
    };
}
function makeCreateDto(overrides = {}) {
    return {
        strategyId: "strategy-uuid-1",
        dateRangeStart: "2024-01-01T00:00:00.000Z",
        dateRangeEnd: "2024-12-31T00:00:00.000Z",
        quickMode: false,
        ...overrides,
    };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("BacktestsService", () => {
    let service;
    let db;
    let redis;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        redis = {
            xadd: vitest_1.vi.fn().mockResolvedValue("stream-entry-id"),
            get: vitest_1.vi.fn(),
            set: vitest_1.vi.fn(),
            del: vitest_1.vi.fn(),
        };
        service = new backtests_service_1.BacktestsService(db, redis);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── list ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("list", () => {
        (0, vitest_1.it)("returns a paginated response with runs", async () => {
            const runs = [makeRun(), makeRun({ id: "run-uuid-2" })];
            db.backtestRun.findMany.mockResolvedValue(runs);
            db.backtestRun.count.mockResolvedValue(2);
            const result = await service.list("user-uuid-1", makeQuery());
            (0, vitest_1.expect)(result.data).toEqual(runs);
            (0, vitest_1.expect)(result.total).toBe(2);
            (0, vitest_1.expect)(result.page).toBe(1);
            (0, vitest_1.expect)(result.limit).toBe(20);
        });
        (0, vitest_1.it)("passes correct skip/take to findMany", async () => {
            db.backtestRun.findMany.mockResolvedValue([]);
            db.backtestRun.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeQuery({ page: 3, limit: 10 }));
            (0, vitest_1.expect)(db.backtestRun.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ skip: 20, take: 10 }));
        });
        (0, vitest_1.it)("filters by strategyId when provided", async () => {
            db.backtestRun.findMany.mockResolvedValue([]);
            db.backtestRun.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeQuery({ strategyId: "strategy-abc" }));
            (0, vitest_1.expect)(db.backtestRun.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: vitest_1.expect.objectContaining({ strategyId: "strategy-abc" }),
            }));
        });
        (0, vitest_1.it)("filters by status when provided", async () => {
            db.backtestRun.findMany.mockResolvedValue([]);
            db.backtestRun.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeQuery({ status: "COMPLETED" }));
            (0, vitest_1.expect)(db.backtestRun.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: vitest_1.expect.objectContaining({ status: "COMPLETED" }),
            }));
        });
        (0, vitest_1.it)("does NOT include strategyId filter when not provided", async () => {
            db.backtestRun.findMany.mockResolvedValue([]);
            db.backtestRun.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeQuery());
            const whereArg = db.backtestRun.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg).not.toHaveProperty("strategyId");
        });
        (0, vitest_1.it)("orders by createdAt desc", async () => {
            db.backtestRun.findMany.mockResolvedValue([]);
            db.backtestRun.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeQuery());
            (0, vitest_1.expect)(db.backtestRun.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ orderBy: { createdAt: "desc" } }));
        });
        (0, vitest_1.it)("always scopes the query to the requesting userId", async () => {
            db.backtestRun.findMany.mockResolvedValue([]);
            db.backtestRun.count.mockResolvedValue(0);
            await service.list("user-uuid-99", makeQuery());
            const whereArg = db.backtestRun.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg).toHaveProperty("userId", "user-uuid-99");
        });
        (0, vitest_1.it)("calculates totalPages and hasNext correctly", async () => {
            db.backtestRun.findMany.mockResolvedValue([makeRun()]);
            db.backtestRun.count.mockResolvedValue(25);
            const result = await service.list("user-uuid-1", makeQuery({ page: 1, limit: 20 }));
            (0, vitest_1.expect)(result.totalPages).toBe(2);
            (0, vitest_1.expect)(result.hasNext).toBe(true);
        });
    });
    // ── create ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("create", () => {
        (0, vitest_1.it)("returns a stub result immediately when quickMode is true", async () => {
            const result = await service.create("user-uuid-1", makeCreateDto({ quickMode: true }));
            (0, vitest_1.expect)(result).toEqual({
                totalOrders: 0,
                filledOrders: 0,
                totalPnl: "0.00",
                winRate: "0.00",
                hasDataGaps: false,
            });
        });
        (0, vitest_1.it)("does NOT persist or publish to Redis in quickMode", async () => {
            await service.create("user-uuid-1", makeCreateDto({ quickMode: true }));
            (0, vitest_1.expect)(db.backtestRun.create).not.toHaveBeenCalled();
            (0, vitest_1.expect)(redis.xadd).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("creates a QUEUED run and publishes to Redis stream when not quickMode", async () => {
            const run = makeRun({ id: "run-uuid-new", status: "QUEUED" });
            db.backtestRun.create.mockResolvedValue(run);
            const result = await service.create("user-uuid-1", makeCreateDto());
            (0, vitest_1.expect)(result).toEqual({ runId: "run-uuid-new", status: "QUEUED" });
            (0, vitest_1.expect)(db.backtestRun.create).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(redis.xadd).toHaveBeenCalledWith("stream:backtests", vitest_1.expect.objectContaining({
                runId: "run-uuid-new",
                userId: "user-uuid-1",
                strategyId: "strategy-uuid-1",
            }));
        });
        (0, vitest_1.it)("creates the run with status QUEUED", async () => {
            const run = makeRun();
            db.backtestRun.create.mockResolvedValue(run);
            await service.create("user-uuid-1", makeCreateDto());
            (0, vitest_1.expect)(db.backtestRun.create).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({
                    status: "QUEUED",
                    userId: "user-uuid-1",
                }),
            }));
        });
        (0, vitest_1.it)("defaults strategyId to empty string when not provided", async () => {
            const run = makeRun({ strategyId: "" });
            db.backtestRun.create.mockResolvedValue(run);
            await service.create("user-uuid-1", makeCreateDto({ strategyId: undefined }));
            (0, vitest_1.expect)(db.backtestRun.create).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ strategyId: "" }),
            }));
        });
        (0, vitest_1.it)("parses dateRangeStart and dateRangeEnd when provided", async () => {
            const run = makeRun();
            db.backtestRun.create.mockResolvedValue(run);
            await service.create("user-uuid-1", makeCreateDto({
                dateRangeStart: "2024-03-01T00:00:00.000Z",
                dateRangeEnd: "2024-09-30T00:00:00.000Z",
            }));
            const dataArg = db.backtestRun.create.mock.calls[0][0]?.data;
            (0, vitest_1.expect)(dataArg.dateRangeStart).toEqual(new Date("2024-03-01T00:00:00.000Z"));
            (0, vitest_1.expect)(dataArg.dateRangeEnd).toEqual(new Date("2024-09-30T00:00:00.000Z"));
        });
        (0, vitest_1.it)("uses epoch start and current date when dateRange not provided", async () => {
            const run = makeRun();
            db.backtestRun.create.mockResolvedValue(run);
            const before = Date.now();
            await service.create("user-uuid-1", makeCreateDto({
                dateRangeStart: undefined,
                dateRangeEnd: undefined,
            }));
            const after = Date.now();
            const dataArg = db.backtestRun.create.mock.calls[0][0]?.data;
            (0, vitest_1.expect)(dataArg.dateRangeStart).toEqual(new Date(0));
            (0, vitest_1.expect)(dataArg.dateRangeEnd.getTime()).toBeGreaterThanOrEqual(before);
            (0, vitest_1.expect)(dataArg.dateRangeEnd.getTime()).toBeLessThanOrEqual(after);
        });
        (0, vitest_1.it)("includes a ts field in the Redis stream payload", async () => {
            const run = makeRun();
            db.backtestRun.create.mockResolvedValue(run);
            await service.create("user-uuid-1", makeCreateDto());
            const streamPayload = redis.xadd.mock
                .calls[0][1];
            (0, vitest_1.expect)(streamPayload).toHaveProperty("ts");
        });
    });
    // ── findOne ───────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("findOne", () => {
        (0, vitest_1.it)("returns the run when found and owned by the user", async () => {
            const run = makeRun({ userId: "user-uuid-1" });
            db.backtestRun.findUnique.mockResolvedValue(run);
            const result = await service.findOne("run-uuid-1", "user-uuid-1");
            (0, vitest_1.expect)(result).toEqual(run);
        });
        (0, vitest_1.it)("throws NotFoundException (404) when the run does not exist", async () => {
            db.backtestRun.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.findOne("nonexistent-id", "user-uuid-1")).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws NOT_FOUND error code when the run does not exist", async () => {
            db.backtestRun.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.findOne("nonexistent-id", "user-uuid-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
            });
        });
        (0, vitest_1.it)("throws NotFoundException (404) when the run belongs to a different user", async () => {
            const run = makeRun({ userId: "other-user-id" });
            db.backtestRun.findUnique.mockResolvedValue(run);
            await (0, vitest_1.expect)(service.findOne("run-uuid-1", "user-uuid-1")).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("looks up the run by id", async () => {
            const run = makeRun({ userId: "user-uuid-1" });
            db.backtestRun.findUnique.mockResolvedValue(run);
            await service.findOne("run-uuid-1", "user-uuid-1");
            (0, vitest_1.expect)(db.backtestRun.findUnique).toHaveBeenCalledWith({
                where: { id: "run-uuid-1" },
            });
        });
    });
});
//# sourceMappingURL=backtests.service.spec.js.map