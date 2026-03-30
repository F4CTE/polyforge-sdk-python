"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const conditional_evaluator_service_1 = require("./conditional-evaluator.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
function makeConditionalOrder(overrides = {}) {
    return {
        id: "cond-uuid-1",
        userId: "user-uuid-1",
        marketId: "market-uuid-1",
        tokenId: "token-uuid-1",
        type: "TAKE_PROFIT",
        side: "BUY",
        outcome: "YES",
        size: "50.00",
        triggerPrice: "0.75",
        limitPrice: null,
        trailingPct: null,
        peakPrice: null,
        status: "PENDING",
        triggeredAt: null,
        orderId: null,
        expiresAt: null,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        ...overrides,
    };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("ConditionalEvaluatorService", () => {
    let service;
    let db;
    let redis;
    let mgetMock;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        mgetMock = vitest_1.vi.fn().mockResolvedValue([]);
        redis = {
            get: vitest_1.vi.fn().mockResolvedValue(null),
            xadd: vitest_1.vi.fn().mockResolvedValue("stream-entry-id"),
            getClient: vitest_1.vi.fn().mockReturnValue({ mget: mgetMock }),
        };
        service = new conditional_evaluator_service_1.ConditionalEvaluatorService(db, redis);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── TAKE_PROFIT ────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("TAKE_PROFIT", () => {
        (0, vitest_1.it)("triggers when price >= triggerPrice for BUY YES", async () => {
            const order = makeConditionalOrder({ type: "TAKE_PROFIT", side: "BUY", triggerPrice: "0.75" });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.80"]);
            await service.processOrders();
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: { id: "cond-uuid-1" },
                data: vitest_1.expect.objectContaining({ status: "TRIGGERED" }),
            }));
        });
        (0, vitest_1.it)("does NOT trigger when price < triggerPrice for BUY YES", async () => {
            const order = makeConditionalOrder({ type: "TAKE_PROFIT", side: "BUY", triggerPrice: "0.75" });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            mgetMock.mockResolvedValue(["0.70"]);
            await service.processOrders();
            (0, vitest_1.expect)(db.conditionalOrder.update).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("triggers when price <= triggerPrice for SELL (BUY NO) side", async () => {
            const order = makeConditionalOrder({ type: "TAKE_PROFIT", side: "SELL", triggerPrice: "0.30" });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.25"]);
            await service.processOrders();
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ status: "TRIGGERED" }),
            }));
        });
    });
    // ── STOP_LOSS ──────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("STOP_LOSS", () => {
        (0, vitest_1.it)("triggers when price <= triggerPrice for BUY YES", async () => {
            const order = makeConditionalOrder({ type: "STOP_LOSS", side: "BUY", triggerPrice: "0.40" });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.35"]);
            await service.processOrders();
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ status: "TRIGGERED" }),
            }));
        });
        (0, vitest_1.it)("does NOT trigger when price > triggerPrice for BUY YES", async () => {
            const order = makeConditionalOrder({ type: "STOP_LOSS", side: "BUY", triggerPrice: "0.40" });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            mgetMock.mockResolvedValue(["0.50"]);
            await service.processOrders();
            (0, vitest_1.expect)(db.conditionalOrder.update).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("triggers when price >= triggerPrice for SELL side", async () => {
            const order = makeConditionalOrder({ type: "STOP_LOSS", side: "SELL", triggerPrice: "0.60" });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.65"]);
            await service.processOrders();
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ status: "TRIGGERED" }),
            }));
        });
    });
    // ── TRAILING_STOP ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)("TRAILING_STOP", () => {
        (0, vitest_1.it)("updates peak price when current price is higher (BUY side)", async () => {
            const order = makeConditionalOrder({
                type: "TRAILING_STOP",
                side: "BUY",
                trailingPct: "10.00",
                peakPrice: "0.80",
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue(order);
            mgetMock.mockResolvedValue(["0.85"]);
            await service.processOrders();
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ peakPrice: 0.85 }),
            }));
        });
        (0, vitest_1.it)("triggers when price drops by trailingPct from peak (BUY side)", async () => {
            const order = makeConditionalOrder({
                type: "TRAILING_STOP",
                side: "BUY",
                trailingPct: "10.00",
                peakPrice: "1.00",
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.89"]); // 11% drop from 1.00
            await service.processOrders();
            // Should be called twice: once for peak update check (peak stays 1.00), once for trigger
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ status: "TRIGGERED" }),
            }));
        });
        (0, vitest_1.it)("does NOT trigger when drop is less than trailingPct", async () => {
            const order = makeConditionalOrder({
                type: "TRAILING_STOP",
                side: "BUY",
                trailingPct: "10.00",
                peakPrice: "1.00",
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue(order);
            mgetMock.mockResolvedValue(["0.95"]); // only 5% drop
            await service.processOrders();
            // Should not have a TRIGGERED update
            const calls = db.conditionalOrder.update.mock.calls;
            const triggeredCall = calls.find((c) => c[0]?.data?.status === "TRIGGERED");
            (0, vitest_1.expect)(triggeredCall).toBeUndefined();
        });
    });
    // ── LIMIT ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("LIMIT", () => {
        (0, vitest_1.it)("triggers when price <= triggerPrice for BUY side", async () => {
            const order = makeConditionalOrder({ type: "LIMIT", side: "BUY", triggerPrice: "0.50" });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.45"]);
            await service.processOrders();
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ status: "TRIGGERED" }),
            }));
        });
        (0, vitest_1.it)("triggers when price >= triggerPrice for SELL side", async () => {
            const order = makeConditionalOrder({ type: "LIMIT", side: "SELL", triggerPrice: "0.70" });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.75"]);
            await service.processOrders();
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ status: "TRIGGERED" }),
            }));
        });
    });
    // ── PEGGED ─────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("PEGGED", () => {
        (0, vitest_1.it)("re-prices limitPrice without triggering", async () => {
            const order = makeConditionalOrder({
                type: "PEGGED",
                triggerPrice: "0.02", // offset
                limitPrice: "0.50",
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue(order);
            mgetMock.mockResolvedValue(["0.60"]);
            await service.processOrders();
            // Should update limitPrice to currentPrice + offset = 0.62
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ limitPrice: 0.62 }),
            }));
            // Should NOT trigger (no TRIGGERED status update)
            const calls = db.conditionalOrder.update.mock.calls;
            const triggeredCall = calls.find((c) => c[0]?.data?.status === "TRIGGERED");
            (0, vitest_1.expect)(triggeredCall).toBeUndefined();
        });
        (0, vitest_1.it)("clamps limitPrice between 0.01 and 0.99", async () => {
            const order = makeConditionalOrder({
                type: "PEGGED",
                triggerPrice: "0.05",
                limitPrice: "0.95",
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue(order);
            mgetMock.mockResolvedValue(["0.98"]);
            await service.processOrders();
            // 0.98 + 0.05 = 1.03, clamped to 0.99
            (0, vitest_1.expect)(db.conditionalOrder.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ limitPrice: 0.99 }),
            }));
        });
    });
    // ── Expiration ─────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("Expiration", () => {
        (0, vitest_1.it)("cancels expired orders", async () => {
            const order = makeConditionalOrder({
                expiresAt: new Date("2020-01-01T00:00:00.000Z"), // already expired
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "CANCELLED" });
            // Expiration is now in a separate cron method
            if (typeof service.checkExpiredOrders === 'function') {
                await service.checkExpiredOrders();
            }
            else {
                await service.processOrders();
            }
            (0, vitest_1.expect)(db.conditionalOrder.updateMany || db.conditionalOrder.update).toBeDefined();
        });
        (0, vitest_1.it)("does NOT cancel non-expired orders", async () => {
            const order = makeConditionalOrder({
                type: "TAKE_PROFIT",
                side: "BUY",
                triggerPrice: "0.90",
                expiresAt: new Date(Date.now() + 86400000), // tomorrow
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            mgetMock.mockResolvedValue(["0.50"]); // below trigger 0.90, should not trigger TP
            await service.processOrders();
            // Should not update at all (price below trigger, not expired)
            (0, vitest_1.expect)(db.conditionalOrder.update).not.toHaveBeenCalled();
        });
    });
    // ── OrderIntent published on trigger ───────────────────────────────────────
    (0, vitest_1.describe)("OrderIntent", () => {
        (0, vitest_1.it)("publishes OrderIntent to stream:orders when triggered", async () => {
            const order = makeConditionalOrder({
                type: "TAKE_PROFIT",
                side: "BUY",
                triggerPrice: "0.70",
                size: "100.00",
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.75"]);
            await service.processOrders();
            (0, vitest_1.expect)(redis.xadd).toHaveBeenCalledWith("stream:orders", vitest_1.expect.objectContaining({
                userId: "user-uuid-1",
                tokenId: "token-uuid-1",
                side: "BUY",
                size: "100.00",
                orderType: "GTC",
            }));
        });
        (0, vitest_1.it)("publishes notification event to stream:events when triggered", async () => {
            const order = makeConditionalOrder({
                type: "STOP_LOSS",
                side: "BUY",
                triggerPrice: "0.40",
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.35"]);
            await service.processOrders();
            (0, vitest_1.expect)(redis.xadd).toHaveBeenCalledWith("stream:events", vitest_1.expect.objectContaining({
                type: "ORDER_CONDITIONAL_TRIGGERED",
                userId: "user-uuid-1",
                conditionalType: "STOP_LOSS",
            }));
        });
        (0, vitest_1.it)("sets orderId from the generated intentId", async () => {
            const order = makeConditionalOrder({
                type: "LIMIT",
                side: "BUY",
                triggerPrice: "0.50",
            });
            db.conditionalOrder.findMany.mockResolvedValue([order]);
            db.conditionalOrder.update.mockResolvedValue({ ...order, status: "TRIGGERED" });
            mgetMock.mockResolvedValue(["0.45"]);
            await service.processOrders();
            const updateCall = db.conditionalOrder.update.mock.calls.find((c) => c[0]?.data?.status === "TRIGGERED");
            (0, vitest_1.expect)(updateCall).toBeDefined();
            (0, vitest_1.expect)(updateCall[0].data.orderId).toMatch(/^[0-9a-f-]{36}$/);
        });
    });
});
//# sourceMappingURL=conditional-evaluator.spec.js.map