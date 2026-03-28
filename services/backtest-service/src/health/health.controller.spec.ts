import { describe, it, expect } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController (backtest-service)", () => {
  it('returns status ok with service name "backtest-service"', () => {
    const controller = new HealthController();
    const result = controller.check();
    expect(result).toEqual({ status: "ok", service: "backtest-service" });
  });
});
