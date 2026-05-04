import { describe, expect, it } from "vitest";
import { isFiniteDecimal, safeDecimalToNumber } from "./numeric";

describe("safeDecimalToNumber", () => {
  it("returns a finite number for decimal-like input", () => {
    expect(safeDecimalToNumber("12.50")).toBe(12.5);
  });

  it("rejects NaN and empty numeric input", () => {
    expect(isFiniteDecimal("NaN")).toBe(false);
    expect(isFiniteDecimal("")).toBe(false);
    expect(safeDecimalToNumber("NaN", 0)).toBe(0);
  });
});
