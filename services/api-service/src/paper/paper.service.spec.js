"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const paper_service_1 = require("./paper.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
function makePosition(overrides = {}) {
    return {
        tokenId: "token-uuid-1",
        outcome: "YES",
        size: "100.00",
        avgPrice: "0.60",
        realizedPnl: "20.00",
        ...overrides,
    };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("PaperService", () => {
    let service;
    let db;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        service = new paper_service_1.PaperService(db);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── getSummary ────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("getSummary", () => {
        (0, vitest_1.it)("returns order count, positions array and total pnl", async () => {
            const positions = [
                makePosition(),
                makePosition({ tokenId: "token-uuid-2", realizedPnl: "5.50" }),
            ];
            db.paperOrder.count.mockResolvedValue(10);
            db.paperPosition.findMany.mockResolvedValue(positions);
            const result = await service.getSummary("user-uuid-1");
            (0, vitest_1.expect)(result.orderCount).toBe(10);
            (0, vitest_1.expect)(result.positions).toHaveLength(2);
            (0, vitest_1.expect)(result.pnl).toBe("25.50");
        });
        (0, vitest_1.it)('returns pnl "0.00" when there are no positions', async () => {
            db.paperOrder.count.mockResolvedValue(0);
            db.paperPosition.findMany.mockResolvedValue([]);
            const result = await service.getSummary("user-uuid-1");
            (0, vitest_1.expect)(result.pnl).toBe("0.00");
            (0, vitest_1.expect)(result.positions).toEqual([]);
            (0, vitest_1.expect)(result.orderCount).toBe(0);
        });
        (0, vitest_1.it)("maps position fields correctly", async () => {
            const position = makePosition({
                tokenId: "token-uuid-1",
                outcome: "NO",
                size: "50.00",
            });
            db.paperOrder.count.mockResolvedValue(2);
            db.paperPosition.findMany.mockResolvedValue([position]);
            const result = await service.getSummary("user-uuid-1");
            (0, vitest_1.expect)(result.positions[0]).toMatchObject({
                tokenId: "token-uuid-1",
                side: "NO",
                size: "50.00",
                unrealizedPnl: "0",
            });
        });
        (0, vitest_1.it)("correctly sums multiple position pnl values", async () => {
            const positions = [
                makePosition({ realizedPnl: "10.50" }),
                makePosition({ tokenId: "token-uuid-2", realizedPnl: "-3.25" }),
                makePosition({ tokenId: "token-uuid-3", realizedPnl: "5.00" }),
            ];
            db.paperOrder.count.mockResolvedValue(5);
            db.paperPosition.findMany.mockResolvedValue(positions);
            const result = await service.getSummary("user-uuid-1");
            (0, vitest_1.expect)(result.pnl).toBe("12.25");
        });
        (0, vitest_1.it)("handles null realizedPnl on a position gracefully", async () => {
            const position = makePosition({ realizedPnl: null });
            db.paperOrder.count.mockResolvedValue(1);
            db.paperPosition.findMany.mockResolvedValue([position]);
            const result = await service.getSummary("user-uuid-1");
            (0, vitest_1.expect)(result.pnl).toBe("0.00");
        });
        (0, vitest_1.it)("queries paperOrder.count and paperPosition.findMany with the given userId", async () => {
            db.paperOrder.count.mockResolvedValue(0);
            db.paperPosition.findMany.mockResolvedValue([]);
            await service.getSummary("user-uuid-42");
            (0, vitest_1.expect)(db.paperOrder.count).toHaveBeenCalledWith({
                where: { userId: "user-uuid-42" },
            });
            (0, vitest_1.expect)(db.paperPosition.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ where: { userId: "user-uuid-42" } }));
        });
        (0, vitest_1.it)("selects only the required position fields", async () => {
            db.paperOrder.count.mockResolvedValue(0);
            db.paperPosition.findMany.mockResolvedValue([]);
            await service.getSummary("user-uuid-1");
            (0, vitest_1.expect)(db.paperPosition.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                select: {
                    tokenId: true,
                    outcome: true,
                    size: true,
                    avgPrice: true,
                    realizedPnl: true,
                },
            }));
        });
    });
    // ── reset ─────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("reset", () => {
        (0, vitest_1.it)("deletes all paper orders and positions for the user", async () => {
            db.paperOrder.deleteMany.mockResolvedValue({ count: 5 });
            db.paperPosition.deleteMany.mockResolvedValue({ count: 3 });
            const result = await service.reset("user-uuid-1");
            (0, vitest_1.expect)(result).toEqual({ reset: true });
        });
        (0, vitest_1.it)("calls deleteMany on both paperOrder and paperPosition with the userId", async () => {
            db.paperOrder.deleteMany.mockResolvedValue({ count: 0 });
            db.paperPosition.deleteMany.mockResolvedValue({ count: 0 });
            await service.reset("user-uuid-1");
            (0, vitest_1.expect)(db.paperOrder.deleteMany).toHaveBeenCalledWith({
                where: { userId: "user-uuid-1" },
            });
            (0, vitest_1.expect)(db.paperPosition.deleteMany).toHaveBeenCalledWith({
                where: { userId: "user-uuid-1" },
            });
        });
        (0, vitest_1.it)("runs both deletions in parallel (Promise.all)", async () => {
            const orderDeleteSpy = vitest_1.vi.fn().mockResolvedValue({ count: 0 });
            const posDeleteSpy = vitest_1.vi.fn().mockResolvedValue({ count: 0 });
            db.paperOrder.deleteMany.mockImplementation(orderDeleteSpy);
            db.paperPosition.deleteMany.mockImplementation(posDeleteSpy);
            await service.reset("user-uuid-1");
            (0, vitest_1.expect)(orderDeleteSpy).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(posDeleteSpy).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("returns { reset: true } even when there were no records to delete", async () => {
            db.paperOrder.deleteMany.mockResolvedValue({ count: 0 });
            db.paperPosition.deleteMany.mockResolvedValue({ count: 0 });
            const result = await service.reset("user-uuid-1");
            (0, vitest_1.expect)(result).toEqual({ reset: true });
        });
    });
});
//# sourceMappingURL=paper.service.spec.js.map