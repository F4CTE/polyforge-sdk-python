import { describe, it, expect } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController (bot-service)", () => {
  it('returns status ok with service name "bot-service"', () => {
    const controller = new HealthController();
    const result = controller.check();
    expect(result).toEqual({ status: "ok", service: "bot-service" });
  });
});
