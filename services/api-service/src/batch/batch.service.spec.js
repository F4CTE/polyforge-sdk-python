"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const batch_service_1 = require("./batch.service");
(0, vitest_1.describe)("BatchService", () => {
    let service;
    const PORT = 3002;
    const AUTH_TOKEN = "test-jwt-token";
    (0, vitest_1.beforeEach)(() => {
        service = new batch_service_1.BatchService();
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    function makeItem(overrides = {}) {
        return {
            id: "req-1",
            method: "GET",
            path: "/api/v1/markets",
            ...overrides,
        };
    }
    (0, vitest_1.it)("should execute items in parallel and return correlated results", async () => {
        const mockFetch = vitest_1.vi.fn().mockResolvedValue({
            status: 200,
            json: () => Promise.resolve({ data: [] }),
        });
        vitest_1.vi.stubGlobal("fetch", mockFetch);
        const items = [
            makeItem({ id: "a", path: "/api/v1/markets" }),
            makeItem({ id: "b", path: "/api/v1/portfolio" }),
        ];
        const results = await service.executeBatch(items, AUTH_TOKEN, PORT);
        (0, vitest_1.expect)(results).toHaveLength(2);
        (0, vitest_1.expect)(results[0].id).toBe("a");
        (0, vitest_1.expect)(results[0].status).toBe(200);
        (0, vitest_1.expect)(results[1].id).toBe("b");
        (0, vitest_1.expect)(results[1].status).toBe(200);
        (0, vitest_1.expect)(mockFetch).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)("should enforce max 10 items at the DTO level (service processes whatever it receives)", async () => {
        const mockFetch = vitest_1.vi.fn().mockResolvedValue({
            status: 200,
            json: () => Promise.resolve({}),
        });
        vitest_1.vi.stubGlobal("fetch", mockFetch);
        const items = Array.from({ length: 10 }, (_, i) => makeItem({ id: `req-${i}`, path: `/api/v1/markets` }));
        const results = await service.executeBatch(items, AUTH_TOKEN, PORT);
        (0, vitest_1.expect)(results).toHaveLength(10);
    });
    (0, vitest_1.it)("should forward auth token in Authorization header", async () => {
        const mockFetch = vitest_1.vi.fn().mockResolvedValue({
            status: 200,
            json: () => Promise.resolve({}),
        });
        vitest_1.vi.stubGlobal("fetch", mockFetch);
        await service.executeBatch([makeItem()], AUTH_TOKEN, PORT);
        const callHeaders = mockFetch.mock.calls[0][1].headers;
        (0, vitest_1.expect)(callHeaders.Authorization).toBe(`Bearer ${AUTH_TOKEN}`);
    });
    (0, vitest_1.it)("should send body for POST/PATCH/DELETE requests", async () => {
        const mockFetch = vitest_1.vi.fn().mockResolvedValue({
            status: 201,
            json: () => Promise.resolve({ id: "new-1" }),
        });
        vitest_1.vi.stubGlobal("fetch", mockFetch);
        const items = [
            makeItem({
                id: "create",
                method: "POST",
                path: "/api/v1/strategies",
                body: { name: "Test" },
            }),
        ];
        await service.executeBatch(items, AUTH_TOKEN, PORT);
        (0, vitest_1.expect)(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ name: "Test" }));
    });
    (0, vitest_1.it)("should not send body for GET requests", async () => {
        const mockFetch = vitest_1.vi.fn().mockResolvedValue({
            status: 200,
            json: () => Promise.resolve({}),
        });
        vitest_1.vi.stubGlobal("fetch", mockFetch);
        await service.executeBatch([makeItem({ body: { ignored: true } })], AUTH_TOKEN, PORT);
        (0, vitest_1.expect)(mockFetch.mock.calls[0][1].body).toBeUndefined();
    });
    (0, vitest_1.it)("should handle fetch failures gracefully with 502", async () => {
        const mockFetch = vitest_1.vi.fn().mockRejectedValue(new Error("Connection refused"));
        vitest_1.vi.stubGlobal("fetch", mockFetch);
        const results = await service.executeBatch([makeItem({ id: "fail" })], AUTH_TOKEN, PORT);
        (0, vitest_1.expect)(results).toHaveLength(1);
        (0, vitest_1.expect)(results[0].id).toBe("fail");
        (0, vitest_1.expect)(results[0].status).toBe(502);
        (0, vitest_1.expect)(results[0].body.error).toBe("Upstream request failed");
    });
    (0, vitest_1.it)("should handle non-JSON responses", async () => {
        const mockFetch = vitest_1.vi.fn().mockResolvedValue({
            status: 204,
            json: () => Promise.reject(new Error("No body")),
        });
        vitest_1.vi.stubGlobal("fetch", mockFetch);
        const results = await service.executeBatch([makeItem({ id: "no-body" })], AUTH_TOKEN, PORT);
        (0, vitest_1.expect)(results[0].status).toBe(204);
        (0, vitest_1.expect)(results[0].body).toBeNull();
    });
    (0, vitest_1.it)("should handle mixed success and failure responses", async () => {
        let callIdx = 0;
        const mockFetch = vitest_1.vi.fn().mockImplementation(() => {
            callIdx++;
            if (callIdx === 1) {
                return Promise.resolve({
                    status: 200,
                    json: () => Promise.resolve({ ok: true }),
                });
            }
            return Promise.reject(new Error("timeout"));
        });
        vitest_1.vi.stubGlobal("fetch", mockFetch);
        const results = await service.executeBatch([
            makeItem({ id: "ok" }),
            makeItem({ id: "fail", path: "/api/v1/markets/slow" }),
        ], AUTH_TOKEN, PORT);
        (0, vitest_1.expect)(results[0].id).toBe("ok");
        (0, vitest_1.expect)(results[0].status).toBe(200);
        (0, vitest_1.expect)(results[1].id).toBe("fail");
        (0, vitest_1.expect)(results[1].status).toBe(502);
    });
});
//# sourceMappingURL=batch.service.spec.js.map