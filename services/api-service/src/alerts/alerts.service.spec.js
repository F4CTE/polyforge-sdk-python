"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const alerts_service_1 = require("./alerts.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
function makeAlert(overrides = {}) {
    return {
        id: "alert-uuid-1",
        userId: "user-uuid-1",
        tokenId: "token-uuid-1",
        direction: "above",
        price: "0.75",
        persistent: false,
        triggered: false,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        ...overrides,
    };
}
function makeCreateAlertDto(overrides = {}) {
    return {
        tokenId: "token-uuid-1",
        direction: "above",
        price: "0.75",
        persistent: false,
        ...overrides,
    };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("AlertsService", () => {
    let service;
    let db;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        service = new alerts_service_1.AlertsService(db);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── list ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("list", () => {
        (0, vitest_1.it)("returns non-triggered alerts for the user ordered by createdAt desc", async () => {
            const alerts = [
                makeAlert(),
                makeAlert({ id: "alert-uuid-2", tokenId: "token-uuid-2" }),
            ];
            db.priceAlert.findMany.mockResolvedValue(alerts);
            const result = await service.list("user-uuid-1");
            (0, vitest_1.expect)(result).toEqual(alerts);
            (0, vitest_1.expect)(db.priceAlert.findMany).toHaveBeenCalledWith({
                where: { userId: "user-uuid-1", triggered: false },
                orderBy: { createdAt: "desc" },
            });
        });
        (0, vitest_1.it)("returns an empty array when the user has no alerts", async () => {
            db.priceAlert.findMany.mockResolvedValue([]);
            const result = await service.list("user-uuid-1");
            (0, vitest_1.expect)(result).toEqual([]);
        });
    });
    // ── create ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("create", () => {
        (0, vitest_1.it)("creates and returns an alert when under the limit", async () => {
            const dto = makeCreateAlertDto();
            const alert = makeAlert();
            db.priceAlert.count.mockResolvedValue(0);
            db.priceAlert.create.mockResolvedValue(alert);
            const result = await service.create("user-uuid-1", dto);
            (0, vitest_1.expect)(result).toEqual(alert);
            (0, vitest_1.expect)(db.priceAlert.count).toHaveBeenCalledWith({
                where: { userId: "user-uuid-1", triggered: false },
            });
            (0, vitest_1.expect)(db.priceAlert.create).toHaveBeenCalledWith({
                data: {
                    userId: "user-uuid-1",
                    tokenId: dto.tokenId,
                    direction: dto.direction,
                    price: dto.price,
                    persistent: false,
                },
            });
        });
        (0, vitest_1.it)("defaults persistent to false when not provided in dto", async () => {
            const dto = makeCreateAlertDto({ persistent: undefined });
            const alert = makeAlert({ persistent: false });
            db.priceAlert.count.mockResolvedValue(5);
            db.priceAlert.create.mockResolvedValue(alert);
            await service.create("user-uuid-1", dto);
            (0, vitest_1.expect)(db.priceAlert.create).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ persistent: false }),
            }));
        });
        (0, vitest_1.it)("stores persistent: true when explicitly set", async () => {
            const dto = makeCreateAlertDto({ persistent: true });
            db.priceAlert.count.mockResolvedValue(1);
            db.priceAlert.create.mockResolvedValue(makeAlert({ persistent: true }));
            await service.create("user-uuid-1", dto);
            (0, vitest_1.expect)(db.priceAlert.create).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                data: vitest_1.expect.objectContaining({ persistent: true }),
            }));
        });
        (0, vitest_1.it)("throws ALERT_LIMIT_REACHED (422) when user already has 50 alerts", async () => {
            db.priceAlert.count.mockResolvedValue(50);
            await (0, vitest_1.expect)(service.create("user-uuid-1", makeCreateAlertDto())).rejects.toThrow(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("throws ALERT_LIMIT_REACHED with correct error code", async () => {
            db.priceAlert.count.mockResolvedValue(50);
            await (0, vitest_1.expect)(service.create("user-uuid-1", makeCreateAlertDto())).rejects.toMatchObject({
                response: { code: "ALERT_LIMIT_REACHED" },
            });
        });
        (0, vitest_1.it)("does NOT throw at exactly 49 alerts (boundary)", async () => {
            db.priceAlert.count.mockResolvedValue(49);
            db.priceAlert.create.mockResolvedValue(makeAlert());
            await (0, vitest_1.expect)(service.create("user-uuid-1", makeCreateAlertDto())).resolves.toBeDefined();
        });
        (0, vitest_1.it)("does NOT call prisma.create when the limit is reached", async () => {
            db.priceAlert.count.mockResolvedValue(50);
            await service
                .create("user-uuid-1", makeCreateAlertDto())
                .catch(() => { });
            (0, vitest_1.expect)(db.priceAlert.create).not.toHaveBeenCalled();
        });
    });
    // ── remove ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("remove", () => {
        (0, vitest_1.it)("deletes the alert when found and owned by the user", async () => {
            const alert = makeAlert({ userId: "user-uuid-1" });
            db.priceAlert.findUnique.mockResolvedValue(alert);
            db.priceAlert.delete.mockResolvedValue(alert);
            await service.remove("alert-uuid-1", "user-uuid-1");
            (0, vitest_1.expect)(db.priceAlert.delete).toHaveBeenCalledWith({
                where: { id: "alert-uuid-1" },
            });
        });
        (0, vitest_1.it)("returns void on successful deletion", async () => {
            const alert = makeAlert({ userId: "user-uuid-1" });
            db.priceAlert.findUnique.mockResolvedValue(alert);
            db.priceAlert.delete.mockResolvedValue(alert);
            const result = await service.remove("alert-uuid-1", "user-uuid-1");
            (0, vitest_1.expect)(result).toBeUndefined();
        });
        (0, vitest_1.it)("throws NotFoundException (404) when alert does not exist", async () => {
            db.priceAlert.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.remove("nonexistent-id", "user-uuid-1")).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws NOT_FOUND error code when alert does not exist", async () => {
            db.priceAlert.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.remove("nonexistent-id", "user-uuid-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
            });
        });
        (0, vitest_1.it)("throws ForbiddenException (403) when alert belongs to a different user", async () => {
            const alert = makeAlert({ userId: "other-user-id" });
            db.priceAlert.findUnique.mockResolvedValue(alert);
            await (0, vitest_1.expect)(service.remove("alert-uuid-1", "user-uuid-1")).rejects.toThrow(common_1.ForbiddenException);
        });
        (0, vitest_1.it)("throws FORBIDDEN error code when alert belongs to a different user", async () => {
            const alert = makeAlert({ userId: "other-user-id" });
            db.priceAlert.findUnique.mockResolvedValue(alert);
            await (0, vitest_1.expect)(service.remove("alert-uuid-1", "user-uuid-1")).rejects.toMatchObject({
                response: { code: "FORBIDDEN" },
            });
        });
        (0, vitest_1.it)("does NOT call delete when the alert is forbidden", async () => {
            const alert = makeAlert({ userId: "other-user-id" });
            db.priceAlert.findUnique.mockResolvedValue(alert);
            await service.remove("alert-uuid-1", "user-uuid-1").catch(() => { });
            (0, vitest_1.expect)(db.priceAlert.delete).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=alerts.service.spec.js.map