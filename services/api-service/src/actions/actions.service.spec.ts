import { describe, it, expect, beforeEach } from "vitest";
import { ActionsService, ActionsSchema } from "./actions.service";

describe("ActionsService", () => {
  let service: ActionsService;

  beforeEach(() => {
    service = new ActionsService();
  });

  it("should return a valid actions schema with version", () => {
    const result = service.getActions();
    expect(result.version).toBe("1.0");
    expect(Array.isArray(result.actions)).toBe(true);
  });

  it("should include at least 30 actions covering all key endpoints", () => {
    const result = service.getActions();
    expect(result.actions.length).toBeGreaterThanOrEqual(30);
  });

  it("should cover all major categories", () => {
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
      expect(categories.has(cat)).toBe(true);
    }
  });

  it("every action should have name, description, method, path, scope, category", () => {
    const result = service.getActions();
    for (const action of result.actions) {
      expect(action.name).toBeTruthy();
      expect(action.description).toBeTruthy();
      expect(["GET", "POST", "PATCH", "DELETE"]).toContain(action.method);
      expect(action.path).toMatch(/^\/api\/v1\//);
      expect(["READ", "WRITE", "TRADE"]).toContain(action.scope);
      expect(action.category).toBeTruthy();
    }
  });

  it("actions with path parameters should have corresponding parameter definitions", () => {
    const result = service.getActions();
    const actionsWithPathParams = result.actions.filter((a) => a.path.includes(":"));
    for (const action of actionsWithPathParams) {
      const pathParamNames = action.path.match(/:(\w+)/g)?.map((p) => p.slice(1)) ?? [];
      for (const paramName of pathParamNames) {
        const param = action.parameters?.find((p) => p.name === paramName);
        expect(param).toBeDefined();
        expect(param?.required).toBe(true);
        expect(param?.in).toBe("path");
      }
    }
  });

  it("should include the batch_execute action", () => {
    const result = service.getActions();
    const batch = result.actions.find((a) => a.name === "batch_execute");
    expect(batch).toBeDefined();
    expect(batch?.method).toBe("POST");
    expect(batch?.path).toBe("/api/v1/batch");
  });

  it("action names should be unique", () => {
    const result = service.getActions();
    const names = result.actions.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("required parameters should be flagged correctly", () => {
    const result = service.getActions();
    const createStrategy = result.actions.find((a) => a.name === "create_strategy");
    expect(createStrategy).toBeDefined();
    const nameParam = createStrategy?.parameters?.find((p) => p.name === "name");
    expect(nameParam?.required).toBe(true);
  });
});
