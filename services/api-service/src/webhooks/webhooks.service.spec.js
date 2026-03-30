"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const webhooks_service_1 = require("./webhooks.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ─────────────────────────────────────────────────────────────────
let _idCounter = 0;
function uid() {
    return `wh-${++_idCounter}`;
}
function makeWebhook(overrides = {}) {
    return {
        id: uid(),
        userId: "user-1",
        url: "https://example.com/hook",
        events: ["ORDER_FILLED"],
        secret: "abc123hex",
        active: true,
        createdAt: new Date(),
        ...overrides,
    };
}
// ─── Suite ──────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("WebhooksService", () => {
    let service;
    let db;
    (0, vitest_1.beforeEach)(() => {
        _idCounter = 0;
        db = (0, mock_db_1.createMockDb)();
        service = new webhooks_service_1.WebhooksService(db);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── create ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("create", () => {
        (0, vitest_1.it)("generates an HMAC secret and returns it on creation", async () => {
            db.webhook.count.mockResolvedValue(0);
            db.webhook.create.mockImplementation(({ data }) => Promise.resolve({
                id: uid(),
                ...data,
                createdAt: new Date(),
            }));
            const result = await service.create("user-1", {
                url: "https://example.com/hook",
                events: ["ORDER_FILLED"],
            });
            (0, vitest_1.expect)(result.secret).toBeDefined();
            (0, vitest_1.expect)(result.secret.length).toBe(64); // 32 bytes = 64 hex chars
            (0, vitest_1.expect)(result.url).toBe("https://example.com/hook");
            (0, vitest_1.expect)(result.events).toEqual(["ORDER_FILLED"]);
            (0, vitest_1.expect)(result.active).toBe(true);
        });
        (0, vitest_1.it)("validates URL is passed to Prisma create", async () => {
            db.webhook.count.mockResolvedValue(0);
            db.webhook.create.mockImplementation(({ data }) => Promise.resolve({
                id: uid(),
                ...data,
                createdAt: new Date(),
            }));
            await service.create("user-1", {
                url: "https://my-api.com/callback",
                events: ["WHALE_TRADE"],
            });
            const createArg = db.webhook.create.mock.calls[0][0];
            (0, vitest_1.expect)(createArg.data.url).toBe("https://my-api.com/callback");
            (0, vitest_1.expect)(createArg.data.events).toEqual(["WHALE_TRADE"]);
            (0, vitest_1.expect)(createArg.data.userId).toBe("user-1");
        });
        (0, vitest_1.it)("rejects when user already has 10 webhooks", async () => {
            db.webhook.count.mockResolvedValue(10);
            await (0, vitest_1.expect)(service.create("user-1", {
                url: "https://example.com/hook",
                events: ["ORDER_FILLED"],
            })).rejects.toThrow(common_1.UnprocessableEntityException);
        });
    });
    // ── list ────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("list", () => {
        (0, vitest_1.it)("returns only the requesting user's webhooks", async () => {
            const webhooks = [
                makeWebhook({ userId: "user-1" }),
                makeWebhook({ userId: "user-1" }),
            ];
            db.webhook.findMany.mockResolvedValue(webhooks);
            const result = await service.list("user-1");
            (0, vitest_1.expect)(result).toHaveLength(2);
            const whereArg = db.webhook.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.userId).toBe("user-1");
        });
        (0, vitest_1.it)("does not include the secret field in list results", async () => {
            db.webhook.findMany.mockResolvedValue([]);
            await service.list("user-1");
            const selectArg = db.webhook.findMany.mock.calls[0][0].select;
            (0, vitest_1.expect)(selectArg.secret).toBeUndefined();
        });
    });
    // ── remove ──────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("remove", () => {
        (0, vitest_1.it)("deletes webhook when owned by the user", async () => {
            const webhook = makeWebhook({ userId: "user-1" });
            db.webhook.findUnique.mockResolvedValue(webhook);
            db.webhook.delete.mockResolvedValue(webhook);
            await service.remove(webhook.id, "user-1");
            (0, vitest_1.expect)(db.webhook.delete).toHaveBeenCalledWith({ where: { id: webhook.id } });
        });
        (0, vitest_1.it)("throws ForbiddenException when user does not own the webhook", async () => {
            const webhook = makeWebhook({ userId: "user-2" });
            db.webhook.findUnique.mockResolvedValue(webhook);
            await (0, vitest_1.expect)(service.remove(webhook.id, "user-1")).rejects.toThrow(common_1.ForbiddenException);
        });
        (0, vitest_1.it)("throws NotFoundException for unknown webhook id", async () => {
            db.webhook.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.remove("unknown-id", "user-1")).rejects.toThrow(common_1.NotFoundException);
        });
    });
    // ── test ────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("test", () => {
        (0, vitest_1.it)("sends a test event to the webhook URL", async () => {
            const webhook = makeWebhook({ userId: "user-1" });
            db.webhook.findUnique.mockResolvedValue(webhook);
            const mockFetch = vitest_1.vi.fn().mockResolvedValue({ ok: true, status: 200 });
            vitest_1.vi.stubGlobal("fetch", mockFetch);
            const result = await service.test(webhook.id, "user-1");
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.statusCode).toBe(200);
            (0, vitest_1.expect)(mockFetch).toHaveBeenCalled();
            const callUrl = mockFetch.mock.calls[0][0];
            (0, vitest_1.expect)(callUrl).toBe(webhook.url);
        });
        (0, vitest_1.it)("throws NotFoundException for unknown webhook", async () => {
            db.webhook.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.test("unknown", "user-1")).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException for webhook owned by another user", async () => {
            const webhook = makeWebhook({ userId: "user-2" });
            db.webhook.findUnique.mockResolvedValue(webhook);
            await (0, vitest_1.expect)(service.test(webhook.id, "user-1")).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    // ── dispatch ────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("dispatch", () => {
        (0, vitest_1.it)("finds matching webhooks by event type and delivers payload", async () => {
            const webhook = makeWebhook({ events: ["ORDER_FILLED"], active: true });
            db.webhook.findMany.mockResolvedValue([webhook]);
            const mockFetch = vitest_1.vi.fn().mockResolvedValue({ ok: true, status: 200 });
            vitest_1.vi.stubGlobal("fetch", mockFetch);
            await service.dispatch("user-1", "ORDER_FILLED", { orderId: "123" });
            // Wait for fire-and-forget promise
            await new Promise((r) => setTimeout(r, 50));
            (0, vitest_1.expect)(db.webhook.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: vitest_1.expect.objectContaining({
                    userId: "user-1",
                    active: true,
                    events: { has: "ORDER_FILLED" },
                }),
            }));
            (0, vitest_1.expect)(mockFetch).toHaveBeenCalled();
            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            (0, vitest_1.expect)(callBody.event).toBe("ORDER_FILLED");
            (0, vitest_1.expect)(callBody.data.orderId).toBe("123");
        });
        (0, vitest_1.it)("signs the payload with HMAC-SHA256", async () => {
            const webhook = makeWebhook({ secret: "test-secret-hex" });
            db.webhook.findMany.mockResolvedValue([webhook]);
            const mockFetch = vitest_1.vi.fn().mockResolvedValue({ ok: true, status: 200 });
            vitest_1.vi.stubGlobal("fetch", mockFetch);
            await service.dispatch("user-1", "ORDER_FILLED", {});
            await new Promise((r) => setTimeout(r, 50));
            const headers = mockFetch.mock.calls[0][1].headers;
            (0, vitest_1.expect)(headers["X-Polyforge-Signature"]).toBeDefined();
            (0, vitest_1.expect)(typeof headers["X-Polyforge-Signature"]).toBe("string");
            (0, vitest_1.expect)(headers["X-Polyforge-Signature"].length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)("skips inactive webhooks via the query filter", async () => {
            db.webhook.findMany.mockResolvedValue([]);
            await service.dispatch("user-1", "ORDER_FILLED", {});
            const whereArg = db.webhook.findMany.mock.calls[0][0].where;
            (0, vitest_1.expect)(whereArg.active).toBe(true);
        });
    });
});
//# sourceMappingURL=webhooks.service.spec.js.map