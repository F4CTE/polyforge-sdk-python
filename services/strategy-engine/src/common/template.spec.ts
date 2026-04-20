import { describe, it, expect } from "vitest";
import { interpolateTemplate } from "./template";

describe("interpolateTemplate", () => {
  it("replaces {{variable}} with values", () => {
    const result = interpolateTemplate("PnL: {{dailyPnl}}", { dailyPnl: 42.5 });
    expect(result).toBe("PnL: 42.5");
  });

  it("handles multiple variables", () => {
    const result = interpolateTemplate(
      "Won {{consecutiveWin}} in a row, PnL: {{dailyPnl}}",
      { consecutiveWin: 3, dailyPnl: 100 },
    );
    expect(result).toBe("Won 3 in a row, PnL: 100");
  });

  it("preserves unresolved variables", () => {
    const result = interpolateTemplate("Price: {{currentPrice}}", {});
    expect(result).toBe("Price: {{currentPrice}}");
  });

  it("handles null/undefined values by preserving placeholder", () => {
    const result = interpolateTemplate("Val: {{x}}", { x: null });
    expect(result).toBe("Val: {{x}}");
  });

  it("handles zero as a valid value", () => {
    const result = interpolateTemplate("PnL: {{dailyPnl}}", { dailyPnl: 0 });
    expect(result).toBe("PnL: 0");
  });

  it("returns original string when no placeholders exist", () => {
    const result = interpolateTemplate("Hello world", { foo: "bar" });
    expect(result).toBe("Hello world");
  });
});
