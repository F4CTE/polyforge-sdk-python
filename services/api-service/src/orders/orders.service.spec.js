"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
function makeUser(overrides = {}) {
    return {
        id: "user-uuid-1",
        polymarketConnected: true,
        ...overrides,
    };
}
function makePosition(overrides = {}) {
    return {
        id: "position-uuid-1",
        userId: "user-uuid-1",
        marketId: "market-uuid-1",
        tokenId: "token-uuid-1",
        outcome: "YES",
        size: "50.00",
        avgPrice: "0.60",
        realizedPnl: "0.00",
        resolutionStatus: "UNRESOLVED",
        ...overrides,
    };
}
function makeOrder(overrides = {}) {
    return {
        id: "order-uuid-1",
        intentId: "intent-uuid-1",
        userId: "user-uuid-1",
        marketId: "market-uuid-1",
        tokenId: "token-uuid-1",
        side: "SELL",
        status: "PENDING",
        outcome: "YES",
        size: "50.00",
        price: "0.01",
        orderType: "FOK",
        strategyId: null,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        ...overrides,
    };
}
function makeOrderQuery(overrides = {}) {
    return {
        page: 1,
        limit: 20,
        ...overrides,
    };
}
function makeClosePositionDto(overrides = {}) {
    return {
        tokenId: "token-uuid-1",
        ...overrides,
    };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("OrdersService", () => {
    let service;
    let db;
    let redis;
    let config;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        redis = {
            xadd: vitest_1.vi.fn().mockResolvedValue("stream-entry-id"),
        };
        config = {
            get: vitest_1.vi.fn().mockReturnValue(undefined),
        };
        service = new orders_service_1.OrdersService(db, redis, config);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── list ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("list", () => {
        (0, vitest_1.it)("returns a paginated list of orders for the user", async () => {
            const orders = [makeOrder()];
            db.order.findMany.mockResolvedValue(orders);
            db.order.count.mockResolvedValue(1);
            const result = await service.list("user-uuid-1", makeOrderQuery());
            (0, vitest_1.expect)(result.data).toEqual(orders);
            (0, vitest_1.expect)(result.total).toBe(1);
            (0, vitest_1.expect)(result.page).toBe(1);
        });
        (0, vitest_1.it)("scopes query to the requesting userId", async () => {
            db.order.findMany.mockResolvedValue([]);
            db.order.count.mockResolvedValue(0);
            await service.list("user-uuid-99", makeOrderQuery());
            const whereArg = db.order.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg).toHaveProperty("userId", "user-uuid-99");
        });
        (0, vitest_1.it)("adds status filter when provided", async () => {
            db.order.findMany.mockResolvedValue([]);
            db.order.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeOrderQuery({ status: "FILLED" }));
            const whereArg = db.order.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg).toHaveProperty("status", "FILLED");
        });
        (0, vitest_1.it)("adds strategyId filter when provided", async () => {
            db.order.findMany.mockResolvedValue([]);
            db.order.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeOrderQuery({ strategyId: "strategy-abc" }));
            const whereArg = db.order.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg).toHaveProperty("strategyId", "strategy-abc");
        });
        (0, vitest_1.it)("adds createdAt.gte filter when from is provided", async () => {
            db.order.findMany.mockResolvedValue([]);
            db.order.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeOrderQuery({ from: "2025-01-01T00:00:00.000Z" }));
            const whereArg = db.order.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg.createdAt).toMatchObject({
                gte: new Date("2025-01-01T00:00:00.000Z"),
            });
        });
        (0, vitest_1.it)("adds createdAt.lte filter when to is provided", async () => {
            db.order.findMany.mockResolvedValue([]);
            db.order.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeOrderQuery({ to: "2025-12-31T23:59:59.000Z" }));
            const whereArg = db.order.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg.createdAt).toMatchObject({
                lte: new Date("2025-12-31T23:59:59.000Z"),
            });
        });
        (0, vitest_1.it)("adds both gte and lte when both from and to are provided", async () => {
            db.order.findMany.mockResolvedValue([]);
            db.order.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeOrderQuery({
                from: "2025-01-01T00:00:00.000Z",
                to: "2025-06-30T00:00:00.000Z",
            }));
            const whereArg = db.order.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg.createdAt.gte).toBeDefined();
            (0, vitest_1.expect)(whereArg.createdAt.lte).toBeDefined();
        });
        (0, vitest_1.it)("does NOT add createdAt filter when neither from nor to is provided", async () => {
            db.order.findMany.mockResolvedValue([]);
            db.order.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeOrderQuery());
            const whereArg = db.order.findMany.mock.calls[0][0]?.where;
            (0, vitest_1.expect)(whereArg).not.toHaveProperty("createdAt");
        });
        (0, vitest_1.it)("orders by createdAt desc", async () => {
            db.order.findMany.mockResolvedValue([]);
            db.order.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeOrderQuery());
            (0, vitest_1.expect)(db.order.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ orderBy: { createdAt: "desc" } }));
        });
        (0, vitest_1.it)("calculates correct skip for page 2 limit 10", async () => {
            db.order.findMany.mockResolvedValue([]);
            db.order.count.mockResolvedValue(0);
            await service.list("user-uuid-1", makeOrderQuery({ page: 2, limit: 10 }));
            (0, vitest_1.expect)(db.order.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ skip: 10, take: 10 }));
        });
    });
    // ── closePosition ─────────────────────────────────────────────────────────
    (0, vitest_1.describe)("closePosition", () => {
        (0, vitest_1.it)("publishes to Redis stream and creates a PENDING order", async () => {
            db.user.findUnique.mockResolvedValue(makeUser({ polymarketConnected: true }));
            db.position.findFirst.mockResolvedValue(makePosition());
            db.order.create.mockResolvedValue(makeOrder());
            const result = await service.closePosition("user-uuid-1", makeClosePositionDto());
            (0, vitest_1.expect)(result.status).toBe("PENDING");
            (0, vitest_1.expect)(result.orderId).toBe("order-uuid-1");
            (0, vitest_1.expect)(result.intentId).toBeDefined();
        });
        (0, vitest_1.it)("throws NOT_CONNECTED (422) when user is not connected to Polymarket", async () => {
            db.user.findUnique.mockResolvedValue(makeUser({ polymarketConnected: false }));
            await (0, vitest_1.expect)(service.closePosition("user-uuid-1", makeClosePositionDto())).rejects.toThrow(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("throws NOT_CONNECTED error code when user is not connected", async () => {
            db.user.findUnique.mockResolvedValue(makeUser({ polymarketConnected: false }));
            await (0, vitest_1.expect)(service.closePosition("user-uuid-1", makeClosePositionDto())).rejects.toMatchObject({
                response: { code: "NOT_CONNECTED" },
            });
        });
        (0, vitest_1.it)("throws NOT_CONNECTED when user record is null", async () => {
            db.user.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.closePosition("user-uuid-1", makeClosePositionDto())).rejects.toThrow(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("throws POSITION_NOT_FOUND (404) when there is no open position for the token", async () => {
            db.user.findUnique.mockResolvedValue(makeUser());
            db.position.findFirst.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.closePosition("user-uuid-1", makeClosePositionDto())).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws POSITION_NOT_FOUND error code when position is missing", async () => {
            db.user.findUnique.mockResolvedValue(makeUser());
            db.position.findFirst.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.closePosition("user-uuid-1", makeClosePositionDto())).rejects.toMatchObject({
                response: { code: "POSITION_NOT_FOUND" },
            });
        });
        (0, vitest_1.it)("publishes close intent to stream:orders", async () => {
            db.user.findUnique.mockResolvedValue(makeUser());
            db.position.findFirst.mockResolvedValue(makePosition());
            db.order.create.mockResolvedValue(makeOrder());
            await service.closePosition("user-uuid-1", makeClosePositionDto());
            (0, vitest_1.expect)(redis.xadd).toHaveBeenCalledWith("stream:orders", vitest_1.expect.objectContaining({
                userId: "user-uuid-1",
                tokenId: "token-uuid-1",
                side: "SELL",
                orderType: "FOK",
            }));
        });
        (0, vitest_1.it)("uses position size when dto.size is not provided", async () => {
            const position = makePosition({ size: "100.00" });
            db.user.findUnique.mockResolvedValue(makeUser());
            db.position.findFirst.mockResolvedValue(position);
            db.order.create.mockResolvedValue(makeOrder());
            await service.closePosition("user-uuid-1", makeClosePositionDto());
            const streamPayload = redis.xadd.mock
                .calls[0][1];
            (0, vitest_1.expect)(streamPayload.size).toBe("100.00");
        });
        (0, vitest_1.it)("uses dto.size when explicitly provided", async () => {
            db.user.findUnique.mockResolvedValue(makeUser());
            db.position.findFirst.mockResolvedValue(makePosition());
            db.order.create.mockResolvedValue(makeOrder());
            await service.closePosition("user-uuid-1", makeClosePositionDto({ size: "25.00" }));
            const streamPayload = redis.xadd.mock
                .calls[0][1];
            (0, vitest_1.expect)(streamPayload.size).toBe("25.00");
        });
        (0, vitest_1.it)("creates the order with status PENDING and orderType FOK", async () => {
            db.user.findUnique.mockResolvedValue(makeUser());
            db.position.findFirst.mockResolvedValue(makePosition());
            db.order.create.mockResolvedValue(makeOrder());
            await service.closePosition("user-uuid-1", makeClosePositionDto());
            (0, vitest_1.expect)(db.order.create).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({
                    status: "PENDING",
                    orderType: "FOK",
                    side: "SELL",
                }),
            }));
        });
        (0, vitest_1.it)("looks up open position with UNRESOLVED resolutionStatus", async () => {
            db.user.findUnique.mockResolvedValue(makeUser());
            db.position.findFirst.mockResolvedValue(makePosition());
            db.order.create.mockResolvedValue(makeOrder());
            await service.closePosition("user-uuid-1", makeClosePositionDto());
            (0, vitest_1.expect)(db.position.findFirst).toHaveBeenCalledWith({
                where: {
                    userId: "user-uuid-1",
                    tokenId: "token-uuid-1",
                    resolutionStatus: "UNRESOLVED",
                },
            });
        });
        (0, vitest_1.it)("generates a unique intentId for each call", async () => {
            db.user.findUnique.mockResolvedValue(makeUser());
            db.position.findFirst.mockResolvedValue(makePosition());
            db.order.create.mockResolvedValue(makeOrder());
            const result1 = await service.closePosition("user-uuid-1", makeClosePositionDto());
            db.order.create.mockResolvedValue(makeOrder({ id: "order-uuid-2", intentId: "intent-uuid-2" }));
            const result2 = await service.closePosition("user-uuid-1", makeClosePositionDto());
            // intentIds are generated as UUIDs — both should be UUID-like strings
            (0, vitest_1.expect)(result1.intentId).toMatch(/^[0-9a-f-]{36}$/);
            (0, vitest_1.expect)(result2.intentId).toMatch(/^[0-9a-f-]{36}$/);
        });
    });
});
//# sourceMappingURL=orders.service.spec.js.map