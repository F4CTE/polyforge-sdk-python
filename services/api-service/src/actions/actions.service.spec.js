"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const actions_service_1 = require("./actions.service");
(0, vitest_1.describe)("ActionsService", () => {
    let service;
    (0, vitest_1.beforeEach)(() => {
        service = new actions_service_1.ActionsService();
    });
    (0, vitest_1.it)("should return a valid actions schema with version", () => {
        const result = service.getActions();
        (0, vitest_1.expect)(result.version).toBe("1.0");
        (0, vitest_1.expect)(Array.isArray(result.actions)).toBe(true);
    });
    (0, vitest_1.it)("should include at least 30 actions covering all key endpoints", () => {
        const result = service.getActions();
        (0, vitest_1.expect)(result.actions.length).toBeGreaterThanOrEqual(30);
    });
    (0, vitest_1.it)("should cover all major categories", () => {
        const result = service.getActions();
        const categories = new Set(result.actions.map((a) => a.category));
        const required = [
            "markets",
            "strategies",
            "orders",
            "portfolio",
            "alerts",
            "backtests",
            "whales",
            "copy",
            "news",
            "scores",
            "discover",
            "paper",
        ];
        for (const cat of required) {
            (0, vitest_1.expect)(categories.has(cat)).toBe(true);
        }
    });
    (0, vitest_1.it)("every action should have name, description, method, path, scope, category", () => {
        const result = service.getActions();
        for (const action of result.actions) {
            (0, vitest_1.expect)(action.name).toBeTruthy();
            (0, vitest_1.expect)(action.description).toBeTruthy();
            (0, vitest_1.expect)(["GET", "POST", "PATCH", "DELETE"]).toContain(action.method);
            (0, vitest_1.expect)(action.path).toMatch(/^\/api\/v1\//);
            (0, vitest_1.expect)(["READ", "WRITE", "TRADE"]).toContain(action.scope);
            (0, vitest_1.expect)(action.category).toBeTruthy();
        }
    });
    (0, vitest_1.it)("actions with path parameters should have corresponding parameter definitions", () => {
        const result = service.getActions();
        const actionsWithPathParams = result.actions.filter((a) => a.path.includes(":"));
        for (const action of actionsWithPathParams) {
            const pathParamNames = action.path.match(/:(\w+)/g)?.map((p) => p.slice(1)) ?? [];
            for (const paramName of pathParamNames) {
                const param = action.parameters?.find((p) => p.name === paramName);
                (0, vitest_1.expect)(param).toBeDefined();
                (0, vitest_1.expect)(param?.required).toBe(true);
                (0, vitest_1.expect)(param?.in).toBe("path");
            }
        }
    });
    (0, vitest_1.it)("should include the batch_execute action", () => {
        const result = service.getActions();
        const batch = result.actions.find((a) => a.name === "batch_execute");
        (0, vitest_1.expect)(batch).toBeDefined();
        (0, vitest_1.expect)(batch?.method).toBe("POST");
        (0, vitest_1.expect)(batch?.path).toBe("/api/v1/batch");
    });
    (0, vitest_1.it)("action names should be unique", () => {
        const result = service.getActions();
        const names = result.actions.map((a) => a.name);
        (0, vitest_1.expect)(new Set(names).size).toBe(names.length);
    });
    (0, vitest_1.it)("required parameters should be flagged correctly", () => {
        const result = service.getActions();
        const createStrategy = result.actions.find((a) => a.name === "create_strategy");
        (0, vitest_1.expect)(createStrategy).toBeDefined();
        const nameParam = createStrategy?.parameters?.find((p) => p.name === "name");
        (0, vitest_1.expect)(nameParam?.required).toBe(true);
    });
});
//# sourceMappingURL=actions.service.spec.js.map