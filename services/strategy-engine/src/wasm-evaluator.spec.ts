import { describe, it, expect, vi } from "vitest";

vi.mock("node:module", () => ({
  createRequire: vi.fn().mockReturnValue(
    vi.fn().mockReturnValue({
      evaluateTick: vi.fn().mockReturnValue({
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

  describe("wasmEvaluateTick", () => {
    it("delegates to the WASM engine and returns expected result shape", () => {
      const result = wasmEvaluateTick(
        [{ type: "stop_loss" }],
        [{ type: "every_tick" }],
        [{ type: "win_streak" }],
        [{ type: "buy_yes" }],
        ctx,
      );

      expect(result).toBeDefined();
      expect(result.safety_passed).toBe(true);
      expect(result.safety_reason).toBeNull();
      expect(result.triggered).toBe(true);
      expect(result.conditions_met).toBe(true);
      expect(result.actions).toHaveLength(1);
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
