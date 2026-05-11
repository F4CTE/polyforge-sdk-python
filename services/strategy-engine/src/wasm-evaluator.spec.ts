import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEvaluateTick } = vi.hoisted(() => ({
  mockEvaluateTick: vi.fn().mockReturnValue({
    safety_passed: true,
    safety_reason: null,
    triggered: true,
    conditions_met: true,
    actions: [
      {
        action_type: "buy_yes",
        side: "BUY",
        outcome: "YES",
        size: 10,
        price: 0.5,
      },
    ],
  }),
}));

vi.mock("node:module", () => ({
  createRequire: vi.fn().mockReturnValue(
    vi.fn().mockReturnValue({
      evaluateTick: mockEvaluateTick,
    }),
  ),
}));

import { wasmEvaluateTick, isWasmAvailable } from "./wasm-evaluator";

describe("wasmEvaluator", () => {
  const ctx = {
    current_price: 100,
    best_bid: 99,
    best_ask: 101,
    spread: 2,
    volume_24h: 5000,
    daily_pnl: 0,
    total_exposure: 0,
    open_positions: 0,
    consecutive_losses: 0,
    orders_today: 0,
    variables: {},
  };

  beforeEach(() => {
    mockEvaluateTick.mockClear();
  });

  describe("wasmEvaluateTick", () => {
    const safety = [{ type: "stop_loss" }];
    const triggers = [{ type: "every_tick" }];
    const conditions = [{ type: "win_streak" }];
    const actions = [{ type: "buy_yes" }];

    it("delegates to the WASM engine and returns expected result shape", () => {
      const result = wasmEvaluateTick(
        safety,
        triggers,
        conditions,
        actions,
        ctx,
      );

      expect(result).toBeDefined();
      expect(result.safety_passed).toBe(true);
      expect(result.safety_reason).toBeNull();
      expect(result.triggered).toBe(true);
      expect(result.conditions_met).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it("forwards all arguments to evaluateTick in the correct order", () => {
      wasmEvaluateTick(safety, triggers, conditions, actions, ctx);

      expect(mockEvaluateTick).toHaveBeenCalledTimes(1);
      expect(mockEvaluateTick).toHaveBeenCalledWith(
        safety,
        triggers,
        conditions,
        actions,
        ctx,
      );
    });

    it("forwards context with all fields intact to evaluateTick", () => {
      const fullCtx = {
        ...ctx,
        current_price: 42,
        variables: { foo: 1 },
      };

      wasmEvaluateTick([], [], [], [], fullCtx);

      expect(mockEvaluateTick).toHaveBeenCalledWith([], [], [], [], fullCtx);
    });

    it("handles empty safety and condition arrays", () => {
      const result = wasmEvaluateTick(
        [],
        [{ type: "every_tick" }],
        [],
        [{ type: "buy_yes" }],
        ctx,
      );

      expect(result).toBeDefined();
      expect(result.safety_passed).toBe(true);
    });

    it("delegates empty arrays properly", () => {
      const result = wasmEvaluateTick([], [], [], [], ctx);

      expect(result).toBeDefined();
      expect(result.safety_passed).toBe(true);
      expect(result.triggered).toBe(true);
      expect(result.conditions_met).toBe(true);
    });
  });

  describe("isWasmAvailable", () => {
    it("always returns true", () => {
      expect(isWasmAvailable()).toBe(true);
    });
  });
});
