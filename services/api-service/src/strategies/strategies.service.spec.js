"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const client_1 = require(".prisma/client");
const strategies_service_1 = require("./strategies.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
let _idCounter = 0;
function uid() {
    return `id-${++_idCounter}`;
}
function makeStrategy(overrides = {}) {
    return {
        id: uid(),
        userId: "user-1",
        name: "My Strategy",
        description: "A test strategy",
        visibility: "PUBLIC",
        execMode: "TICK",
        tickMs: 1000,
        triggers: [],
        conditions: [],
        actions: [],
        safety: [],
        tags: [],
        status: client_1.StrategyStatus.IDLE,
        version: 1,
        template: false,
        forkedFromId: null,
        likeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}
function makeComment(overrides = {}) {
    return {
        id: uid(),
        strategyId: "strat-1",
        userId: "user-1",
        content: "A comment",
        deleted: false,
        createdAt: new Date(),
        user: { id: "user-1", username: "alice", displayName: "Alice" },
        ...overrides,
    };
}
function makeReport(overrides = {}) {
    return {
        id: uid(),
        reporterId: "user-1",
        targetType: "STRATEGY",
        targetId: "strat-1",
        strategyId: "strat-1",
        reason: "SPAM",
        description: null,
        createdAt: new Date(),
        ...overrides,
    };
}
function makeQuery(overrides = {}) {
    return {
        page: 1,
        limit: 20,
        sort: "createdAt",
        ...overrides,
    };
}
function makePaginationDto(overrides = {}) {
    return { page: 1, limit: 20, ...overrides };
}
/** Build a mock Response-like object for engine calls */
function mockEngineResponse(ok, status, body = {}) {
    return {
        ok,
        status,
        json: vitest_1.vi.fn().mockResolvedValue(body),
    };
}
// ─── Suite ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("StrategiesService", () => {
    let service;
    let db;
    let config;
    let client;
    let llm;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        // Make $transaction execute its callback with the mock db (for like/unlike)
        db.$transaction.mockImplementation(async (fn) => {
            if (typeof fn === 'function')
                return fn(db);
            return Promise.all(fn); // array of promises
        });
        config = {
            get: vitest_1.vi.fn().mockReturnValue("http://strategy-engine:3006"),
        };
        client = {
            post: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
            get: vitest_1.vi.fn(),
        };
        llm = {
            analyze: vitest_1.vi.fn(),
        };
        // Wire db into PrismaService shape (PrismaService extends PrismaClient)
        service = new strategies_service_1.StrategiesService(db, config, client, llm);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── list ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("list", () => {
        (0, vitest_1.it)("returns paginated strategies for the user", async () => {
            const strategies = [makeStrategy(), makeStrategy()];
            db.strategy.findMany.mockResolvedValue(strategies);
            db.strategy.count.mockResolvedValue(2);
            const result = await service.list("user-1", makeQuery());
            (0, vitest_1.expect)(result.data).toHaveLength(2);
            (0, vitest_1.expect)(result.total).toBe(2);
            (0, vitest_1.expect)(result.page).toBe(1);
            (0, vitest_1.expect)(result.limit).toBe(20);
            (0, vitest_1.expect)(result.totalPages).toBe(1);
            (0, vitest_1.expect)(result.hasNext).toBe(false);
        });
        (0, vitest_1.it)("applies status filter when provided", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.list("user-1", makeQuery({ status: "RUNNING" }));
            const whereArg = db.strategy.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.status).toBe("RUNNING");
        });
        (0, vitest_1.it)("excludes ARCHIVED strategies when no status filter", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.list("user-1", makeQuery());
            const whereArg = db.strategy.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.status).toEqual({ not: client_1.StrategyStatus.ARCHIVED });
        });
        (0, vitest_1.it)("calculates skip from page and limit", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(100);
            await service.list("user-1", makeQuery({ page: 3, limit: 10 }));
            const callArg = db.strategy.findMany.mock.calls[0][0];
            (0, vitest_1.expect)(callArg.skip).toBe(20);
            (0, vitest_1.expect)(callArg.take).toBe(10);
        });
        (0, vitest_1.it)("uses default sort by createdAt desc", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.list("user-1", makeQuery({ sort: undefined }));
            const callArg = db.strategy.findMany.mock.calls[0][0];
            (0, vitest_1.expect)(callArg.orderBy).toEqual({ createdAt: "desc" });
        });
        (0, vitest_1.it)("sets hasNext when more pages exist", async () => {
            const strategies = Array.from({ length: 10 }, () => makeStrategy());
            db.strategy.findMany.mockResolvedValue(strategies);
            db.strategy.count.mockResolvedValue(25);
            const result = await service.list("user-1", makeQuery({ page: 1, limit: 10 }));
            (0, vitest_1.expect)(result.hasNext).toBe(true);
            (0, vitest_1.expect)(result.totalPages).toBe(3);
        });
    });
    // ── create ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("create", () => {
        (0, vitest_1.it)("creates and returns a new strategy", async () => {
            const dto = { name: "Alpha" };
            const created = makeStrategy({ name: "Alpha" });
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(created);
            const result = await service.create("user-1", dto);
            (0, vitest_1.expect)(result).toEqual(created);
            (0, vitest_1.expect)(db.strategy.create).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("passes correct defaults to prisma.create", async () => {
            const dto = { name: "Beta" };
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.create("user-1", dto);
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.status).toBe(client_1.StrategyStatus.IDLE);
            (0, vitest_1.expect)(dataArg.version).toBe(1);
            (0, vitest_1.expect)(dataArg.template).toBe(false);
            (0, vitest_1.expect)(dataArg.visibility).toBe("PRIVATE");
            (0, vitest_1.expect)(dataArg.execMode).toBe("TICK");
            (0, vitest_1.expect)(dataArg.tickMs).toBe(1000);
        });
        (0, vitest_1.it)("uses dto values when provided", async () => {
            const dto = {
                name: "Gamma",
                description: "desc",
                visibility: "PUBLIC",
                execMode: "EVENT",
                tickMs: 500,
                triggers: [{ type: "MARKET_MOVE", config: {} }],
                tags: ["tag1"],
            };
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.create("user-1", dto);
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.name).toBe("Gamma");
            (0, vitest_1.expect)(dataArg.description).toBe("desc");
            (0, vitest_1.expect)(dataArg.visibility).toBe("PUBLIC");
            (0, vitest_1.expect)(dataArg.execMode).toBe("EVENT");
            (0, vitest_1.expect)(dataArg.tickMs).toBe(500);
            (0, vitest_1.expect)(dataArg.tags).toEqual(["tag1"]);
        });
        (0, vitest_1.it)("throws STRATEGY_LIMIT_REACHED when user has 50 strategies", async () => {
            db.strategy.count.mockResolvedValue(50);
            await (0, vitest_1.expect)(service.create("user-1", { name: "Over limit" })).rejects.toMatchObject({
                response: { code: "STRATEGY_LIMIT_REACHED" },
                status: 422,
            });
            (0, vitest_1.expect)(db.strategy.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("throws STRATEGY_LIMIT_REACHED at exactly 50 (boundary)", async () => {
            db.strategy.count.mockResolvedValue(50);
            await (0, vitest_1.expect)(service.create("user-1", { name: "Limit" })).rejects.toBeInstanceOf(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("allows creation when count is 49", async () => {
            db.strategy.count.mockResolvedValue(49);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await (0, vitest_1.expect)(service.create("user-1", { name: "Under limit" })).resolves.toBeDefined();
        });
    });
    // ── findOne ───────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("findOne", () => {
        (0, vitest_1.it)("returns the strategy when found and accessible", async () => {
            const strategy = makeStrategy({ userId: "user-1", visibility: "PUBLIC" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            const result = await service.findOne(strategy.id, "user-1");
            (0, vitest_1.expect)(result).toEqual({ ...strategy, childCount: 0 });
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.findOne("missing-id", "user-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
                status: 404,
            });
        });
        (0, vitest_1.it)("throws NotFoundException when strategy is ARCHIVED", async () => {
            const strategy = makeStrategy({ status: client_1.StrategyStatus.ARCHIVED });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.findOne(strategy.id, "user-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
                status: 404,
            });
        });
        (0, vitest_1.it)("throws ForbiddenException when PRIVATE strategy is accessed by non-owner", async () => {
            const strategy = makeStrategy({
                userId: "owner-id",
                visibility: "PRIVATE",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.findOne(strategy.id, "other-user")).rejects.toMatchObject({
                response: { code: "FORBIDDEN" },
                status: 403,
            });
        });
        (0, vitest_1.it)("allows owner to access their own PRIVATE strategy", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                visibility: "PRIVATE",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            await (0, vitest_1.expect)(service.findOne(strategy.id, "user-1")).resolves.toEqual({ ...strategy, childCount: 0 });
        });
        (0, vitest_1.it)("allows any user to view a PUBLIC strategy", async () => {
            const strategy = makeStrategy({
                userId: "owner-id",
                visibility: "PUBLIC",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            await (0, vitest_1.expect)(service.findOne(strategy.id, "any-user")).resolves.toEqual({ ...strategy, childCount: 0 });
        });
        (0, vitest_1.it)("allows any user to view an UNLISTED strategy", async () => {
            const strategy = makeStrategy({
                userId: "owner-id",
                visibility: "UNLISTED",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            await (0, vitest_1.expect)(service.findOne(strategy.id, "random-user")).resolves.toEqual({ ...strategy, childCount: 0 });
        });
    });
    // ── update ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("update", () => {
        (0, vitest_1.it)("updates and returns the strategy", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            const updated = { ...strategy, name: "Updated Name", version: 2 };
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.update.mockResolvedValue(updated);
            const result = await service.update(strategy.id, "user-1", {
                name: "Updated Name",
            });
            (0, vitest_1.expect)(result.name).toBe("Updated Name");
            (0, vitest_1.expect)(db.strategy.update).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.update("missing", "user-1", {})).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when user does not own the strategy", async () => {
            const strategy = makeStrategy({ userId: "other-user" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.update(strategy.id, "user-1", {})).rejects.toMatchObject({
                response: { code: "FORBIDDEN" },
                status: 403,
            });
        });
        (0, vitest_1.it)("throws STRATEGY_IS_RUNNING when editing blocks on a running strategy", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            const dto = {
                triggers: [{ type: "PRICE", config: {} }],
            };
            await (0, vitest_1.expect)(service.update(strategy.id, "user-1", dto)).rejects.toMatchObject({
                response: { code: "STRATEGY_IS_RUNNING" },
                status: 422,
            });
        });
        (0, vitest_1.it)("throws STRATEGY_IS_RUNNING when editing conditions on a running strategy", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.update(strategy.id, "user-1", { conditions: [] })).rejects.toBeInstanceOf(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("throws STRATEGY_IS_RUNNING when editing actions on a running strategy", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.update(strategy.id, "user-1", { actions: [] })).rejects.toBeInstanceOf(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("throws STRATEGY_IS_RUNNING when editing safety on a running strategy", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.update(strategy.id, "user-1", { safety: [] })).rejects.toBeInstanceOf(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("allows non-block updates while strategy is RUNNING", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            const updated = { ...strategy, name: "New Name" };
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.update.mockResolvedValue(updated);
            await (0, vitest_1.expect)(service.update(strategy.id, "user-1", { name: "New Name" })).resolves.toBeDefined();
        });
        (0, vitest_1.it)("increments version on update", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.update.mockResolvedValue({ ...strategy, version: 2 });
            await service.update(strategy.id, "user-1", { name: "v2" });
            const dataArg = db.strategy.update.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.version).toEqual({ increment: 1 });
        });
        (0, vitest_1.it)("only sends defined fields to prisma.update", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.update.mockResolvedValue(strategy);
            await service.update(strategy.id, "user-1", { name: "Only name" });
            const dataArg = db.strategy.update.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.name).toBe("Only name");
            // Description was not in dto, should not appear
            (0, vitest_1.expect)("description" in dataArg).toBe(false);
        });
    });
    // ── remove ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("remove", () => {
        (0, vitest_1.it)("soft-deletes by setting status to ARCHIVED", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.update.mockResolvedValue({
                ...strategy,
                status: client_1.StrategyStatus.ARCHIVED,
            });
            await service.remove(strategy.id, "user-1");
            (0, vitest_1.expect)(db.strategy.update).toHaveBeenCalledWith({
                where: { id: strategy.id },
                data: { status: client_1.StrategyStatus.ARCHIVED },
            });
        });
        (0, vitest_1.it)("returns undefined (void)", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.update.mockResolvedValue(strategy);
            const result = await service.remove(strategy.id, "user-1");
            (0, vitest_1.expect)(result).toBeUndefined();
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.remove("missing", "user-1")).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when user is not the owner", async () => {
            const strategy = makeStrategy({ userId: "other-user" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.remove(strategy.id, "user-1")).rejects.toMatchObject({
                response: { code: "FORBIDDEN" },
                status: 403,
            });
        });
        (0, vitest_1.it)("throws STRATEGY_IS_RUNNING when strategy is currently running", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.remove(strategy.id, "user-1")).rejects.toMatchObject({
                response: { code: "STRATEGY_IS_RUNNING" },
                status: 422,
            });
        });
    });
    // ── start ─────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("start", () => {
        (0, vitest_1.it)("calls engine and returns RUNNING status for paper mode", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            vitest_1.vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));
            const result = await service.start(strategy.id, "user-1", {
                mode: "paper",
            });
            (0, vitest_1.expect)(result.status).toBe("RUNNING");
            (0, vitest_1.expect)(result.startedAt).toBeDefined();
        });
        (0, vitest_1.it)("sets PAPER status in DB via atomic updateMany for paper mode", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            vitest_1.vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));
            await service.start(strategy.id, "user-1", {
                mode: "paper",
            });
            (0, vitest_1.expect)(db.strategy.updateMany).toHaveBeenCalledWith({
                where: { id: strategy.id, userId: "user-1", status: client_1.StrategyStatus.IDLE },
                data: { status: client_1.StrategyStatus.PAPER },
            });
        });
        (0, vitest_1.it)("calls engine and returns RUNNING status for live mode when polymarketConnected", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            db.user.findUnique.mockResolvedValue({
                polymarketConnected: true,
            });
            vitest_1.vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));
            const result = await service.start(strategy.id, "user-1", {
                mode: "live",
            });
            (0, vitest_1.expect)(result.status).toBe("RUNNING");
        });
        (0, vitest_1.it)("sets RUNNING status via updateMany for live mode", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            db.user.findUnique.mockResolvedValue({
                polymarketConnected: true,
            });
            vitest_1.vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));
            await service.start(strategy.id, "user-1", {
                mode: "live",
            });
            (0, vitest_1.expect)(db.strategy.updateMany).toHaveBeenCalledWith({
                where: { id: strategy.id, userId: "user-1", status: client_1.StrategyStatus.IDLE },
                data: { status: client_1.StrategyStatus.RUNNING },
            });
        });
        (0, vitest_1.it)("throws ALREADY_RUNNING when strategy is already running", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.start(strategy.id, "user-1", {
                mode: "paper",
            })).rejects.toMatchObject({
                response: { code: "ALREADY_RUNNING" },
            });
        });
        (0, vitest_1.it)("throws NOT_CONNECTED for live mode when polymarketConnected is false", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            db.user.findUnique.mockResolvedValue({
                polymarketConnected: false,
            });
            db.strategy.update.mockResolvedValue(strategy); // rollback
            await (0, vitest_1.expect)(service.start(strategy.id, "user-1", {
                mode: "live",
            })).rejects.toMatchObject({
                response: { code: "NOT_CONNECTED" },
                status: 422,
            });
        });
        (0, vitest_1.it)("throws NOT_CONNECTED for live mode when user record is null", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            db.user.findUnique.mockResolvedValue(null);
            db.strategy.update.mockResolvedValue(strategy); // rollback
            await (0, vitest_1.expect)(service.start(strategy.id, "user-1", {
                mode: "live",
            })).rejects.toMatchObject({
                response: { code: "NOT_CONNECTED" },
                status: 422,
            });
        });
        (0, vitest_1.it)("throws ENGINE_ERROR when engine returns non-ok and non-204", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            db.strategy.update.mockResolvedValue(strategy); // rollback
            vitest_1.vi.mocked(client.post).mockResolvedValue(mockEngineResponse(false, 500, {
                code: "ENGINE_ERROR",
                message: "Internal error",
            }));
            await (0, vitest_1.expect)(service.start(strategy.id, "user-1", {
                mode: "paper",
            })).rejects.toMatchObject({
                response: { code: "ENGINE_ERROR" },
                status: 422,
            });
        });
        (0, vitest_1.it)("uses code from engine error body when available", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            db.strategy.update.mockResolvedValue(strategy); // rollback
            vitest_1.vi.mocked(client.post).mockResolvedValue(mockEngineResponse(false, 503, {
                code: "STRATEGY_TIMEOUT",
                message: "timeout",
            }));
            await (0, vitest_1.expect)(service.start(strategy.id, "user-1", {
                mode: "paper",
            })).rejects.toMatchObject({
                response: { code: "STRATEGY_TIMEOUT" },
            });
        });
        (0, vitest_1.it)("succeeds when engine returns 204", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            vitest_1.vi.mocked(client.post).mockResolvedValue(mockEngineResponse(false, 204));
            await (0, vitest_1.expect)(service.start(strategy.id, "user-1", {
                mode: "paper",
            })).resolves.toBeDefined();
        });
        (0, vitest_1.it)("throws NotFoundException when strategy not found", async () => {
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.start("bad-id", "user-1", {
                mode: "paper",
            })).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when user does not own the strategy", async () => {
            const strategy = makeStrategy({
                userId: "other-user",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.start(strategy.id, "user-1", {
                mode: "paper",
            })).rejects.toBeInstanceOf(common_1.ForbiddenException);
        });
    });
    // ── stop ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("stop", () => {
        (0, vitest_1.it)("calls engine DELETE and sets strategy to IDLE", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            db.strategy.findMany.mockResolvedValue([]); // no children
            vitest_1.vi.mocked(client.delete).mockResolvedValue(mockEngineResponse(true, 200));
            const result = await service.stop(strategy.id, "user-1");
            (0, vitest_1.expect)(result.status).toBe("IDLE");
            (0, vitest_1.expect)(result.stoppedAt).toBeDefined();
            (0, vitest_1.expect)(client.delete).toHaveBeenCalledWith("http://strategy-engine:3006", "strategy-engine", `/internal/strategies/${strategy.id}`);
            (0, vitest_1.expect)(db.strategy.updateMany).toHaveBeenCalledWith({
                where: { id: strategy.id, userId: "user-1", status: { in: [client_1.StrategyStatus.RUNNING, client_1.StrategyStatus.PAPER] } },
                data: { status: client_1.StrategyStatus.IDLE },
            });
        });
        (0, vitest_1.it)("still sets IDLE when engine returns non-ok (graceful degradation)", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            db.strategy.findMany.mockResolvedValue([]); // no children
            vitest_1.vi.mocked(client.delete).mockResolvedValue(mockEngineResponse(false, 503));
            const result = await service.stop(strategy.id, "user-1");
            (0, vitest_1.expect)(result.status).toBe("IDLE");
            (0, vitest_1.expect)(db.strategy.updateMany).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.stop("bad-id", "user-1")).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when user does not own the strategy", async () => {
            const strategy = makeStrategy({ userId: "other-user" });
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.stop(strategy.id, "user-1")).rejects.toBeInstanceOf(common_1.ForbiddenException);
        });
    });
    // ── pause ─────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("pause", () => {
        (0, vitest_1.it)("calls engine pause endpoint and returns PAUSED status", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            vitest_1.vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));
            const result = await service.pause(strategy.id, "user-1");
            (0, vitest_1.expect)(result.status).toBe("PAUSED");
            (0, vitest_1.expect)(client.post).toHaveBeenCalledWith("http://strategy-engine:3006", "strategy-engine", `/internal/strategies/${strategy.id}/pause`);
            (0, vitest_1.expect)(db.strategy.updateMany).toHaveBeenCalledWith({
                where: { id: strategy.id, userId: "user-1", status: { in: [client_1.StrategyStatus.RUNNING, client_1.StrategyStatus.PAPER] } },
                data: { status: client_1.StrategyStatus.PAUSED },
            });
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.pause("bad-id", "user-1")).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when user does not own the strategy", async () => {
            const strategy = makeStrategy({ userId: "other-user" });
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.pause(strategy.id, "user-1")).rejects.toBeInstanceOf(common_1.ForbiddenException);
        });
    });
    // ── resume ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("resume", () => {
        (0, vitest_1.it)("calls engine resume endpoint and returns RUNNING status", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.PAUSED,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            vitest_1.vi.mocked(client.post).mockResolvedValue(mockEngineResponse(true, 200));
            const result = await service.resume(strategy.id, "user-1");
            (0, vitest_1.expect)(result.status).toBe("RUNNING");
            (0, vitest_1.expect)(client.post).toHaveBeenCalledWith("http://strategy-engine:3006", "strategy-engine", `/internal/strategies/${strategy.id}/resume`);
            (0, vitest_1.expect)(db.strategy.updateMany).toHaveBeenCalledWith({
                where: { id: strategy.id, userId: "user-1", status: client_1.StrategyStatus.PAUSED },
                data: { status: client_1.StrategyStatus.RUNNING },
            });
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.resume("bad-id", "user-1")).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when user does not own the strategy", async () => {
            const strategy = makeStrategy({ userId: "other-user" });
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.resume(strategy.id, "user-1")).rejects.toBeInstanceOf(common_1.ForbiddenException);
        });
    });
    // ── fork ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("fork", () => {
        (0, vitest_1.it)("creates a forked copy of the strategy", async () => {
            const original = makeStrategy({
                id: "orig-1",
                userId: "owner-id",
                name: "Original",
                visibility: "PUBLIC",
            });
            const forked = makeStrategy({
                userId: "user-1",
                name: "Fork of Original",
                forkedFromId: "orig-1",
                visibility: "PRIVATE",
            });
            db.strategy.findUnique.mockResolvedValue(original);
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(forked);
            const result = await service.fork("orig-1", "user-1");
            (0, vitest_1.expect)(result.name).toBe("Fork of Original");
            (0, vitest_1.expect)(result.forkedFromId).toBe("orig-1");
        });
        (0, vitest_1.it)("sets forked strategy to IDLE with version 1 and template false", async () => {
            const original = makeStrategy({
                id: "orig-1",
                userId: "owner-id",
                visibility: "PUBLIC",
            });
            db.strategy.findUnique.mockResolvedValue(original);
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.fork("orig-1", "user-1");
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.status).toBe(client_1.StrategyStatus.IDLE);
            (0, vitest_1.expect)(dataArg.version).toBe(1);
            (0, vitest_1.expect)(dataArg.template).toBe(false);
            (0, vitest_1.expect)(dataArg.visibility).toBe("PRIVATE");
            (0, vitest_1.expect)(dataArg.forkedFromId).toBe("orig-1");
        });
        (0, vitest_1.it)('prefixes forked name with "Fork of "', async () => {
            const original = makeStrategy({
                id: "orig-1",
                name: "Great Strategy",
                visibility: "PUBLIC",
            });
            db.strategy.findUnique.mockResolvedValue(original);
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.fork("orig-1", "user-1");
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.name).toBe("Fork of Great Strategy");
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.fork("missing", "user-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
                status: 404,
            });
        });
        (0, vitest_1.it)("throws NotFoundException when strategy is ARCHIVED", async () => {
            const strategy = makeStrategy({ status: client_1.StrategyStatus.ARCHIVED });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.fork(strategy.id, "user-1")).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when forking a PRIVATE strategy not owned by user", async () => {
            const strategy = makeStrategy({
                userId: "owner-id",
                visibility: "PRIVATE",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.fork(strategy.id, "other-user")).rejects.toMatchObject({
                response: { code: "FORBIDDEN" },
                status: 403,
            });
        });
        (0, vitest_1.it)("allows owner to fork their own PRIVATE strategy", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                visibility: "PRIVATE",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await (0, vitest_1.expect)(service.fork(strategy.id, "user-1")).resolves.toBeDefined();
        });
        (0, vitest_1.it)("throws STRATEGY_LIMIT_REACHED when user already has 50 strategies", async () => {
            const strategy = makeStrategy({
                userId: "owner-id",
                visibility: "PUBLIC",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(50);
            await (0, vitest_1.expect)(service.fork(strategy.id, "user-1")).rejects.toMatchObject({
                response: { code: "STRATEGY_LIMIT_REACHED" },
                status: 422,
            });
        });
    });
    // ── like ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("like", () => {
        (0, vitest_1.it)("likes a strategy and returns liked=true with incremented count", async () => {
            const strategy = makeStrategy({ visibility: "PUBLIC", likeCount: 5 });
            db.strategy.findUnique.mockResolvedValueOnce(strategy);
            db.strategyLike.findUnique.mockResolvedValue(null); // not yet liked
            db.strategyLike.create.mockResolvedValue({});
            // $transaction callback calls tx.strategy.update which returns the select
            db.strategy.update.mockResolvedValue({ likeCount: 6 });
            const result = await service.like(strategy.id, "user-1");
            (0, vitest_1.expect)(result.liked).toBe(true);
            (0, vitest_1.expect)(result.likeCount).toBe(6);
        });
        (0, vitest_1.it)("unlikes a strategy and returns liked=false with decremented count", async () => {
            const strategy = makeStrategy({ visibility: "PUBLIC", likeCount: 5 });
            db.strategy.findUnique.mockResolvedValueOnce(strategy);
            db.strategyLike.findUnique.mockResolvedValue({
                userId: "user-1",
                strategyId: strategy.id,
            });
            db.strategyLike.delete.mockResolvedValue({});
            db.strategy.update.mockResolvedValue({ likeCount: 4 });
            const result = await service.like(strategy.id, "user-1");
            (0, vitest_1.expect)(result.liked).toBe(false);
            (0, vitest_1.expect)(result.likeCount).toBe(4);
        });
        (0, vitest_1.it)("calls strategyLike.delete when toggling off", async () => {
            const strategy = makeStrategy({ visibility: "PUBLIC" });
            db.strategy.findUnique.mockResolvedValueOnce(strategy);
            db.strategyLike.findUnique.mockResolvedValue({
                userId: "user-1",
                strategyId: strategy.id,
            });
            db.strategyLike.delete.mockResolvedValue({});
            db.strategy.update.mockResolvedValue(strategy);
            await service.like(strategy.id, "user-1");
            (0, vitest_1.expect)(db.strategyLike.delete).toHaveBeenCalledWith({
                where: {
                    userId_strategyId: { userId: "user-1", strategyId: strategy.id },
                },
            });
        });
        (0, vitest_1.it)("calls strategyLike.create when liking", async () => {
            const strategy = makeStrategy({ visibility: "PUBLIC" });
            db.strategy.findUnique.mockResolvedValueOnce(strategy);
            db.strategyLike.findUnique.mockResolvedValue(null);
            db.strategyLike.create.mockResolvedValue({});
            db.strategy.update.mockResolvedValue(strategy);
            await service.like(strategy.id, "user-1");
            (0, vitest_1.expect)(db.strategyLike.create).toHaveBeenCalledWith({
                data: { userId: "user-1", strategyId: strategy.id },
            });
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.like("missing", "user-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
                status: 404,
            });
        });
        (0, vitest_1.it)("throws NotFoundException when strategy is PRIVATE", async () => {
            const strategy = makeStrategy({ visibility: "PRIVATE" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.like(strategy.id, "user-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
                status: 404,
            });
        });
        (0, vitest_1.it)("returns the likeCount from the update result", async () => {
            const strategy = makeStrategy({ visibility: "PUBLIC", likeCount: 10 });
            db.strategy.findUnique.mockResolvedValueOnce(strategy);
            db.strategyLike.findUnique.mockResolvedValue(null);
            db.strategyLike.create.mockResolvedValue({});
            db.strategy.update.mockResolvedValue({ likeCount: 11 });
            const result = await service.like(strategy.id, "user-1");
            (0, vitest_1.expect)(result.likeCount).toBe(11);
        });
    });
    // ── listComments ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)("listComments", () => {
        (0, vitest_1.it)("returns paginated non-deleted comments", async () => {
            const comments = [makeComment(), makeComment()];
            db.strategyComment.findMany.mockResolvedValue(comments);
            db.strategyComment.count.mockResolvedValue(2);
            const result = await service.listComments("strat-1", makePaginationDto());
            (0, vitest_1.expect)(result.data).toHaveLength(2);
            (0, vitest_1.expect)(result.total).toBe(2);
        });
        (0, vitest_1.it)("queries only non-deleted comments", async () => {
            db.strategyComment.findMany.mockResolvedValue([]);
            db.strategyComment.count.mockResolvedValue(0);
            await service.listComments("strat-1", makePaginationDto());
            const whereArg = db.strategyComment.findMany.mock.calls[0][0]
                .where;
            (0, vitest_1.expect)(whereArg.deleted).toBe(false);
            (0, vitest_1.expect)(whereArg.strategyId).toBe("strat-1");
        });
        (0, vitest_1.it)("includes user data in response", async () => {
            db.strategyComment.findMany.mockResolvedValue([]);
            db.strategyComment.count.mockResolvedValue(0);
            await service.listComments("strat-1", makePaginationDto());
            const includeArg = db.strategyComment.findMany.mock.calls[0][0]
                .include;
            (0, vitest_1.expect)(includeArg.user).toBeDefined();
        });
        (0, vitest_1.it)("applies pagination correctly", async () => {
            db.strategyComment.findMany.mockResolvedValue([]);
            db.strategyComment.count.mockResolvedValue(50);
            await service.listComments("strat-1", makePaginationDto({ page: 2, limit: 10 }));
            const callArg = db.strategyComment.findMany.mock.calls[0][0];
            (0, vitest_1.expect)(callArg.skip).toBe(10);
            (0, vitest_1.expect)(callArg.take).toBe(10);
        });
    });
    // ── addComment ────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("addComment", () => {
        (0, vitest_1.it)("creates and returns a new comment", async () => {
            const strategy = makeStrategy({ userId: "user-1", visibility: "PUBLIC" });
            const comment = makeComment({ content: "Great strategy!" });
            // findOne calls strategy.findUnique + strategy.count (for childCount)
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            db.strategyComment.create.mockResolvedValue(comment);
            const result = await service.addComment(strategy.id, "user-1", {
                content: "Great strategy!",
            });
            (0, vitest_1.expect)(result.content).toBe("Great strategy!");
        });
        (0, vitest_1.it)("creates comment with correct data", async () => {
            const strategy = makeStrategy({ userId: "user-1", visibility: "PUBLIC" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            db.strategyComment.create.mockResolvedValue(makeComment());
            await service.addComment(strategy.id, "user-1", {
                content: "Hello",
            });
            (0, vitest_1.expect)(db.strategyComment.create).toHaveBeenCalledWith({
                data: { strategyId: strategy.id, userId: "user-1", content: "Hello" },
                include: {
                    user: { select: { id: true, username: true, displayName: true } },
                },
            });
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.addComment("bad-id", "user-1", {
                content: "x",
            })).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when commenting on a PRIVATE strategy not owned", async () => {
            const strategy = makeStrategy({
                userId: "other-user",
                visibility: "PRIVATE",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.addComment(strategy.id, "user-1", {
                content: "x",
            })).rejects.toBeInstanceOf(common_1.ForbiddenException);
        });
    });
    // ── deleteComment ─────────────────────────────────────────────────────────
    (0, vitest_1.describe)("deleteComment", () => {
        (0, vitest_1.it)("soft-deletes the comment by setting deleted=true", async () => {
            const comment = makeComment({ strategyId: "strat-1", userId: "user-1" });
            db.strategyComment.findUnique.mockResolvedValue(comment);
            db.strategyComment.update.mockResolvedValue({
                ...comment,
                deleted: true,
            });
            await service.deleteComment("strat-1", comment.id, "user-1");
            (0, vitest_1.expect)(db.strategyComment.update).toHaveBeenCalledWith({
                where: { id: comment.id },
                data: { deleted: true },
            });
        });
        (0, vitest_1.it)("returns undefined (void)", async () => {
            const comment = makeComment({ strategyId: "strat-1", userId: "user-1" });
            db.strategyComment.findUnique.mockResolvedValue(comment);
            db.strategyComment.update.mockResolvedValue(comment);
            const result = await service.deleteComment("strat-1", comment.id, "user-1");
            (0, vitest_1.expect)(result).toBeUndefined();
        });
        (0, vitest_1.it)("throws NotFoundException when comment does not exist", async () => {
            db.strategyComment.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.deleteComment("strat-1", "bad-id", "user-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
                status: 404,
            });
        });
        (0, vitest_1.it)("throws NotFoundException when comment belongs to a different strategy", async () => {
            const comment = makeComment({
                strategyId: "other-strat",
                userId: "user-1",
            });
            db.strategyComment.findUnique.mockResolvedValue(comment);
            await (0, vitest_1.expect)(service.deleteComment("strat-1", comment.id, "user-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
                status: 404,
            });
        });
        (0, vitest_1.it)("throws ForbiddenException when user is not the comment author", async () => {
            const comment = makeComment({
                strategyId: "strat-1",
                userId: "comment-owner",
            });
            db.strategyComment.findUnique.mockResolvedValue(comment);
            await (0, vitest_1.expect)(service.deleteComment("strat-1", comment.id, "other-user")).rejects.toMatchObject({
                response: { code: "FORBIDDEN" },
                status: 403,
            });
        });
    });
    // ── report ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("report", () => {
        (0, vitest_1.it)("creates a report and returns reportId", async () => {
            const strategy = makeStrategy({ userId: "owner", visibility: "PUBLIC" });
            const report = makeReport({ id: "report-abc" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            db.report.create.mockResolvedValue(report);
            const result = await service.report(strategy.id, "user-1", {
                reason: "SPAM",
            });
            (0, vitest_1.expect)(result.reportId).toBe("report-abc");
        });
        (0, vitest_1.it)("creates report with correct fields", async () => {
            const strategy = makeStrategy({
                id: "strat-1",
                userId: "owner",
                visibility: "PUBLIC",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            db.report.create.mockResolvedValue(makeReport());
            await service.report("strat-1", "reporter-1", {
                reason: "MISLEADING",
                description: "False claims",
            });
            (0, vitest_1.expect)(db.report.create).toHaveBeenCalledWith({
                data: {
                    reporterId: "reporter-1",
                    targetType: "STRATEGY",
                    targetId: "strat-1",
                    strategyId: "strat-1",
                    reason: "MISLEADING",
                    description: "False claims",
                },
            });
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.report("bad-id", "user-1", {
                reason: "SPAM",
            })).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when reporting a PRIVATE strategy not visible to reporter", async () => {
            const strategy = makeStrategy({ userId: "owner", visibility: "PRIVATE" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.report(strategy.id, "other-user", {
                reason: "SPAM",
            })).rejects.toBeInstanceOf(common_1.ForbiddenException);
        });
        (0, vitest_1.it)("allows reporting with no description (optional field)", async () => {
            const strategy = makeStrategy({ visibility: "PUBLIC" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            db.report.create.mockResolvedValue(makeReport());
            await (0, vitest_1.expect)(service.report(strategy.id, "user-1", {
                reason: "OTHER",
            })).resolves.toBeDefined();
        });
    });
    // ── listTemplates ─────────────────────────────────────────────────────────
    (0, vitest_1.describe)("listTemplates", () => {
        (0, vitest_1.it)("returns only template strategies", async () => {
            const templates = [
                makeStrategy({ template: true }),
                makeStrategy({ template: true }),
            ];
            db.strategy.findMany.mockResolvedValue(templates);
            db.strategy.count.mockResolvedValue(2);
            const result = await service.listTemplates(makePaginationDto());
            (0, vitest_1.expect)(result.data).toHaveLength(2);
            (0, vitest_1.expect)(result.total).toBe(2);
        });
        (0, vitest_1.it)("queries with template=true and excludes ARCHIVED", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.listTemplates(makePaginationDto());
            const whereArg = db.strategy.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.template).toBe(true);
            (0, vitest_1.expect)(whereArg.status).toEqual({ not: client_1.StrategyStatus.ARCHIVED });
        });
        (0, vitest_1.it)("applies pagination correctly", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(30);
            await service.listTemplates(makePaginationDto({ page: 2, limit: 5 }));
            const callArg = db.strategy.findMany.mock.calls[0][0];
            (0, vitest_1.expect)(callArg.skip).toBe(5);
            (0, vitest_1.expect)(callArg.take).toBe(5);
        });
        (0, vitest_1.it)("orders by createdAt desc", async () => {
            db.strategy.findMany.mockResolvedValue([]);
            db.strategy.count.mockResolvedValue(0);
            await service.listTemplates(makePaginationDto());
            const callArg = db.strategy.findMany.mock.calls[0][0];
            (0, vitest_1.expect)(callArg.orderBy).toEqual({ createdAt: "desc" });
        });
        (0, vitest_1.it)("sets hasNext correctly when more templates exist", async () => {
            db.strategy.findMany.mockResolvedValue(Array.from({ length: 10 }, () => makeStrategy({ template: true })));
            db.strategy.count.mockResolvedValue(15);
            const result = await service.listTemplates(makePaginationDto({ page: 1, limit: 10 }));
            (0, vitest_1.expect)(result.hasNext).toBe(true);
            (0, vitest_1.expect)(result.totalPages).toBe(2);
        });
    });
    // ── canvas persistence ─────────────────────────────────────────────────
    (0, vitest_1.describe)("canvas persistence", () => {
        (0, vitest_1.it)("create strategy with canvas positions saves correctly", async () => {
            const canvas = {
                blocks: [
                    { id: "b1", x: 80, y: 80 },
                    { id: "b2", x: 420, y: 80 },
                ],
                connections: [{ id: "c1", fromBlockId: "b1", toBlockId: "b2" }],
            };
            const dto = {
                name: "Canvas Strat",
                canvas,
            };
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy({ name: "Canvas Strat", canvas }));
            const result = await service.create("user-1", dto);
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.canvas).toEqual(canvas);
            (0, vitest_1.expect)(result.canvas).toEqual(canvas);
        });
        (0, vitest_1.it)("update strategy canvas positions updates correctly", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            const newCanvas = {
                blocks: [{ id: "b1", x: 200, y: 300 }],
                connections: [],
            };
            db.strategy.update.mockResolvedValue(makeStrategy({ ...strategy, canvas: newCanvas }));
            const result = await service.update(strategy.id, "user-1", {
                canvas: newCanvas,
            });
            const dataArg = db.strategy.update.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.canvas).toEqual(newCanvas);
            (0, vitest_1.expect)(result.canvas).toEqual(newCanvas);
        });
        (0, vitest_1.it)("strategy without canvas loads with null/undefined canvas (backward compat)", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                visibility: "PUBLIC",
            });
            // Simulate old strategy without canvas field
            delete strategy.canvas;
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            const result = await service.findOne(strategy.id, "user-1");
            (0, vitest_1.expect)(result.canvas).toBeUndefined();
        });
    });
    // ── exportStrategy ─────────────────────────────────────────────────────
    (0, vitest_1.describe)("exportStrategy", () => {
        (0, vitest_1.it)("returns correct .polyforge format for owner", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                name: "My Momentum Strategy",
                description: "Test desc",
                execMode: "TICK",
                tickMs: 5000,
                visibility: "PRIVATE",
                tags: ["momentum"],
                triggers: [{ type: "PRICE_CROSSES_UP", config: { threshold: "0.6" } }],
                conditions: [{ type: "PRICE_IN_RANGE", config: { min: "0.3", max: "0.8" } }],
                actions: [{ type: "BUY_YES", config: { size: "50" } }],
                safety: [{ type: "STOP_IF_DAILY_LOSS", config: { maxLoss: "50" } }],
                canvas: { positions: { "b1": { x: 100, y: 100 } }, connections: [] },
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            const result = await service.exportStrategy(strategy.id, "user-1");
            (0, vitest_1.expect)(result.payload).toHaveProperty("polyforge", "1.0");
            (0, vitest_1.expect)(result.payload).toHaveProperty("exportedAt");
            (0, vitest_1.expect)(result.payload.strategy.name).toBe("My Momentum Strategy");
            (0, vitest_1.expect)(result.payload.strategy.blocks.triggers).toHaveLength(1);
            (0, vitest_1.expect)(result.payload.strategy.blocks.safety).toHaveLength(1);
            (0, vitest_1.expect)(result.payload.strategy.blocks.conditions).toHaveLength(1);
            (0, vitest_1.expect)(result.payload.strategy.blocks.actions).toHaveLength(1);
            (0, vitest_1.expect)(result.payload.strategy.canvas).toBeDefined();
            (0, vitest_1.expect)(result.filename).toBe("my-momentum-strategy.polyforge");
        });
        (0, vitest_1.it)("throws NOT_FOUND for archived strategy", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.ARCHIVED,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.exportStrategy(strategy.id, "user-1")).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws FORBIDDEN for private strategy when not owner", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                visibility: "PRIVATE",
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.exportStrategy(strategy.id, "other-user")).rejects.toBeInstanceOf(common_1.ForbiddenException);
        });
        (0, vitest_1.it)("allows export of public strategy by non-owner (without canvas)", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                visibility: "PUBLIC",
                canvas: { positions: { "b1": { x: 100, y: 100 } }, connections: [] },
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            const result = await service.exportStrategy(strategy.id, "other-user");
            (0, vitest_1.expect)(result.payload.strategy.name).toBe("My Strategy");
            (0, vitest_1.expect)(result.payload.strategy.canvas).toBeUndefined();
        });
        (0, vitest_1.it)("allows export of unlisted strategy by non-owner (without canvas)", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                visibility: "UNLISTED",
                canvas: { positions: {}, connections: [] },
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            const result = await service.exportStrategy(strategy.id, "other-user");
            (0, vitest_1.expect)(result.payload.strategy.canvas).toBeUndefined();
        });
        (0, vitest_1.it)("throws NOT_FOUND when strategy does not exist", async () => {
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.exportStrategy("nonexistent", "user-1")).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
    });
    // ── importStrategy ─────────────────────────────────────────────────────
    (0, vitest_1.describe)("importStrategy", () => {
        (0, vitest_1.it)("creates a new strategy from import data", async () => {
            const importDto = {
                polyforge: "1.0",
                exportedAt: "2026-03-22T12:00:00Z",
                strategy: {
                    name: "Imported Strategy",
                    description: "Imported desc",
                    execMode: "TICK",
                    tickMs: 5000,
                    visibility: "PUBLIC",
                    tags: ["tag1"],
                    blocks: {
                        safety: [{ type: "STOP_IF_DAILY_LOSS", config: { maxLoss: "50" } }],
                        triggers: [{ type: "PRICE_CROSSES_UP", config: { threshold: "0.6" } }],
                        conditions: [],
                        actions: [{ type: "BUY_YES", config: { size: "50" } }],
                    },
                    canvas: { positions: {}, connections: [] },
                },
            };
            const created = makeStrategy({ name: "Imported Strategy" });
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(created);
            const result = await service.importStrategy(importDto, "user-2");
            (0, vitest_1.expect)(result).toEqual(created);
            (0, vitest_1.expect)(db.strategy.create).toHaveBeenCalledOnce();
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.userId).toBe("user-2");
            (0, vitest_1.expect)(dataArg.name).toBe("Imported Strategy");
            (0, vitest_1.expect)(dataArg.visibility).toBe("PRIVATE");
            (0, vitest_1.expect)(dataArg.status).toBe(client_1.StrategyStatus.IDLE);
            (0, vitest_1.expect)(dataArg.version).toBe(1);
            (0, vitest_1.expect)(dataArg.template).toBe(false);
        });
        (0, vitest_1.it)("strips original ID and generates new one (no id in data)", async () => {
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "Test Import",
                    blocks: {
                        triggers: [{ type: "PRICE_CROSSES_UP", config: {} }],
                    },
                },
            };
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.importStrategy(importDto, "user-1");
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.id).toBeUndefined();
        });
        (0, vitest_1.it)("always sets visibility to PRIVATE regardless of import data", async () => {
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "Public Strat",
                    visibility: "PUBLIC",
                    blocks: {},
                },
            };
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.importStrategy(importDto, "user-1");
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.visibility).toBe("PRIVATE");
        });
        (0, vitest_1.it)("sets owner to the authenticated user", async () => {
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "Someone Else's Strategy",
                    blocks: {},
                },
            };
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.importStrategy(importDto, "user-42");
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.userId).toBe("user-42");
        });
        (0, vitest_1.it)("throws STRATEGY_LIMIT_REACHED when at max strategies", async () => {
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "Over limit",
                    blocks: {},
                },
            };
            db.strategy.count.mockResolvedValue(50);
            await (0, vitest_1.expect)(service.importStrategy(importDto, "user-1")).rejects.toMatchObject({
                response: { code: "STRATEGY_LIMIT_REACHED" },
                status: 422,
            });
            (0, vitest_1.expect)(db.strategy.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("handles missing blocks gracefully", async () => {
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "No blocks",
                },
            };
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.importStrategy(importDto, "user-1");
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.triggers).toEqual([]);
            (0, vitest_1.expect)(dataArg.conditions).toEqual([]);
            (0, vitest_1.expect)(dataArg.actions).toEqual([]);
            (0, vitest_1.expect)(dataArg.safety).toEqual([]);
        });
        (0, vitest_1.it)("uses default execMode and tickMs when not provided", async () => {
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "Defaults",
                    blocks: {},
                },
            };
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.importStrategy(importDto, "user-1");
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.execMode).toBe("TICK");
            (0, vitest_1.expect)(dataArg.tickMs).toBe(1000);
        });
        (0, vitest_1.it)("rejects import with unknown block type", async () => {
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "Bad Blocks",
                    blocks: {
                        triggers: [{ type: "TOTALLY_FAKE_BLOCK", config: {} }],
                    },
                },
            };
            db.strategy.count.mockResolvedValue(0);
            await (0, vitest_1.expect)(service.importStrategy(importDto, "user-1")).rejects.toMatchObject({
                response: { code: "IMPORT_UNKNOWN_BLOCK_TYPE" },
                status: 422,
            });
        });
        (0, vitest_1.it)("rejects import exceeding 100 total blocks", async () => {
            const triggers = Array.from({ length: 101 }, (_, i) => ({
                type: "PRICE_ABOVE",
                config: { threshold: String(i) },
            }));
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "Too Many Blocks",
                    blocks: { triggers },
                },
            };
            db.strategy.count.mockResolvedValue(0);
            await (0, vitest_1.expect)(service.importStrategy(importDto, "user-1")).rejects.toMatchObject({
                response: { code: "IMPORT_TOO_MANY_BLOCKS" },
                status: 422,
            });
        });
        (0, vitest_1.it)("rejects import with expression exceeding 200 chars", async () => {
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "Long Expression",
                    variables: [{ name: "v1", expression: "x+".repeat(150) + "x" }],
                    blocks: {},
                },
            };
            db.strategy.count.mockResolvedValue(0);
            await (0, vitest_1.expect)(service.importStrategy(importDto, "user-1")).rejects.toMatchObject({
                response: { code: "IMPORT_EXPRESSION_TOO_LONG" },
                status: 422,
            });
        });
        (0, vitest_1.it)("strips HTML from imported name and description", async () => {
            const importDto = {
                polyforge: "1.0",
                strategy: {
                    name: "<script>alert('xss')</script>Clean Name",
                    description: "<b>Bold</b> description",
                    blocks: {},
                },
            };
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockResolvedValue(makeStrategy());
            await service.importStrategy(importDto, "user-1");
            const dataArg = db.strategy.create.mock.calls[0][0].data;
            (0, vitest_1.expect)(dataArg.name).toBe("alert('xss')Clean Name");
            (0, vitest_1.expect)(dataArg.description).toBe("Bold description");
        });
    });
    // ── stop — conflict case ────────────────────────────────────────────────────
    (0, vitest_1.describe)("stop — conflict case", () => {
        (0, vitest_1.it)("throws ConflictException when strategy is owned but not in a running state", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.stop(strategy.id, "user-1")).rejects.toBeInstanceOf(common_1.ConflictException);
        });
        (0, vitest_1.it)("stops running children before stopping the parent", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 1 });
            db.strategy.findMany.mockResolvedValue([
                { id: "child-1" },
                { id: "child-2" },
            ]);
            vitest_1.vi.mocked(client.delete).mockResolvedValue(mockEngineResponse(true, 200));
            await service.stop(strategy.id, "user-1");
            // Should have called delete for both children + parent
            (0, vitest_1.expect)(client.delete).toHaveBeenCalledTimes(3);
        });
    });
    // ── pause — conflict case ───────────────────────────────────────────────────
    (0, vitest_1.describe)("pause — conflict case", () => {
        (0, vitest_1.it)("throws ConflictException when strategy is owned but not in RUNNING/PAPER state", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.pause(strategy.id, "user-1")).rejects.toBeInstanceOf(common_1.ConflictException);
        });
    });
    // ── resume — conflict case ──────────────────────────────────────────────────
    (0, vitest_1.describe)("resume — conflict case", () => {
        (0, vitest_1.it)("throws ConflictException when strategy is owned but not in PAUSED state", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.RUNNING,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.resume(strategy.id, "user-1")).rejects.toBeInstanceOf(common_1.ConflictException);
        });
    });
    // ── start — ARCHIVED fallback case ─────────────────────────────────────────
    (0, vitest_1.describe)("start — ARCHIVED fallback case", () => {
        (0, vitest_1.it)("throws NotFoundException when strategy is ARCHIVED", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.ARCHIVED,
            });
            db.strategy.updateMany.mockResolvedValue({ count: 0 });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.start(strategy.id, "user-1", { mode: "paper" })).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
    });
    // ── listChildren ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)("listChildren", () => {
        (0, vitest_1.it)("returns children of a strategy", async () => {
            const strategy = makeStrategy({ userId: "user-1" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.findMany.mockResolvedValue([
                { id: "child-1", name: "Child 1", status: "IDLE" },
                { id: "child-2", name: "Child 2", status: "RUNNING" },
            ]);
            const result = await service.listChildren(strategy.id, "user-1");
            (0, vitest_1.expect)(result.children).toHaveLength(2);
            (0, vitest_1.expect)(result.children[0].id).toBe("child-1");
        });
        (0, vitest_1.it)("throws NotFoundException when strategy does not exist", async () => {
            db.strategy.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.listChildren("missing", "user-1")).rejects.toBeInstanceOf(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when user does not own the strategy", async () => {
            const strategy = makeStrategy({ userId: "other-user" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            await (0, vitest_1.expect)(service.listChildren(strategy.id, "user-1")).rejects.toBeInstanceOf(common_1.ForbiddenException);
        });
    });
    // ── addComment — HTML stripping ─────────────────────────────────────────────
    (0, vitest_1.describe)("addComment — XSS stripping", () => {
        (0, vitest_1.it)("strips HTML tags from comment content", async () => {
            const strategy = makeStrategy({ userId: "user-1", visibility: "PUBLIC" });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.count.mockResolvedValue(0);
            db.strategyComment.create.mockResolvedValue(makeComment({ content: "Clean text" }));
            await service.addComment(strategy.id, "user-1", {
                content: "<script>alert('xss')</script>Clean text",
            });
            (0, vitest_1.expect)(db.strategyComment.create).toHaveBeenCalledWith({
                data: {
                    strategyId: strategy.id,
                    userId: "user-1",
                    content: "alert('xss')Clean text",
                },
                include: {
                    user: { select: { id: true, username: true, displayName: true } },
                },
            });
        });
    });
    // ── remove — detach children ──────────────────────────────────────────────
    (0, vitest_1.describe)("remove — child detachment", () => {
        (0, vitest_1.it)("detaches children by setting parentStrategyId to null before archiving", async () => {
            const strategy = makeStrategy({
                userId: "user-1",
                status: client_1.StrategyStatus.IDLE,
            });
            db.strategy.findUnique.mockResolvedValue(strategy);
            db.strategy.updateMany.mockResolvedValue({ count: 2 });
            db.strategy.update.mockResolvedValue({
                ...strategy,
                status: client_1.StrategyStatus.ARCHIVED,
            });
            await service.remove(strategy.id, "user-1");
            // updateMany should be called to detach children
            (0, vitest_1.expect)(db.strategy.updateMany).toHaveBeenCalledWith({
                where: { parentStrategyId: strategy.id },
                data: { parentStrategyId: null },
            });
        });
    });
    // ── createFromDescription ─────────────────────────────────────────────────
    (0, vitest_1.describe)("createFromDescription", () => {
        (0, vitest_1.it)("calls LLM with block types in the prompt", async () => {
            const llmResponse = JSON.stringify({
                name: "AI Strategy",
                description: "Test",
                execMode: "TICK",
                safety: [],
                triggers: [{ type: "PRICE_ABOVE", config: { price: 0.5 } }],
                conditions: [],
                actions: [{ type: "BUY_YES", config: { size: "10" } }],
            });
            llm.analyze.mockResolvedValue(llmResponse);
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockImplementation(({ data }) => Promise.resolve({ id: "new-id", ...data, createdAt: new Date(), updatedAt: new Date() }));
            await service.createFromDescription("user-1", {
                description: "Buy YES when price goes above 0.5",
            });
            const prompt = llm.analyze.mock.calls[0][0];
            (0, vitest_1.expect)(prompt).toContain("PRICE_ABOVE");
            (0, vitest_1.expect)(prompt).toContain("BUY_YES");
            (0, vitest_1.expect)(prompt).toContain("DAILY_LOSS_LIMIT");
        });
        (0, vitest_1.it)("parses valid LLM JSON response and creates a strategy", async () => {
            const llmResponse = JSON.stringify({
                name: "Momentum Bot",
                description: "Buys on dips",
                execMode: "TICK",
                safety: [{ type: "DAILY_LOSS_LIMIT", config: { limit: 50 } }],
                triggers: [{ type: "PRICE_BELOW", config: { price: 0.3 } }],
                conditions: [{ type: "MIN_LIQUIDITY", config: { min: 5000 } }],
                actions: [{ type: "BUY_YES", config: { size: "25" } }],
            });
            llm.analyze.mockResolvedValue(llmResponse);
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockImplementation(({ data }) => Promise.resolve({ id: "new-id", ...data, createdAt: new Date(), updatedAt: new Date() }));
            const result = await service.createFromDescription("user-1", {
                description: "Buy YES on any market where price drops below 0.30",
            });
            (0, vitest_1.expect)(result.name).toBe("Momentum Bot");
            (0, vitest_1.expect)(db.strategy.create).toHaveBeenCalled();
        });
        (0, vitest_1.it)("rejects invalid block types from LLM", async () => {
            const llmResponse = JSON.stringify({
                name: "Bad Strategy",
                triggers: [{ type: "INVALID_BLOCK_TYPE", config: {} }],
                conditions: [],
                actions: [],
                safety: [],
            });
            llm.analyze.mockResolvedValue(llmResponse);
            await (0, vitest_1.expect)(service.createFromDescription("user-1", {
                description: "Do something invalid",
            })).rejects.toThrow(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("handles LLM failure gracefully", async () => {
            llm.analyze.mockRejectedValue(new Error("All LLM providers failed"));
            await (0, vitest_1.expect)(service.createFromDescription("user-1", {
                description: "Create a basic strategy",
            })).rejects.toThrow();
        });
        (0, vitest_1.it)("handles non-JSON LLM response", async () => {
            llm.analyze.mockResolvedValue("This is not valid JSON at all");
            await (0, vitest_1.expect)(service.createFromDescription("user-1", {
                description: "Create something",
            })).rejects.toThrow(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("handles markdown-wrapped JSON response from LLM", async () => {
            const json = JSON.stringify({
                name: "Wrapped Strategy",
                triggers: [{ type: "TICK", config: {} }],
                conditions: [],
                actions: [{ type: "BUY_YES", config: { size: "10" } }],
                safety: [],
            });
            llm.analyze.mockResolvedValue("```json\n" + json + "\n```");
            db.strategy.count.mockResolvedValue(0);
            db.strategy.create.mockImplementation(({ data }) => Promise.resolve({ id: "new-id", ...data, createdAt: new Date(), updatedAt: new Date() }));
            const result = await service.createFromDescription("user-1", {
                description: "Simple tick strategy",
            });
            (0, vitest_1.expect)(result.name).toBe("Wrapped Strategy");
        });
    });
});
//# sourceMappingURL=strategies.service.spec.js.map