import { describe, expect, it } from "vitest";
import {
  isFiniteDecimal,
  parseFiniteDecimal,
  safeDecimalToNumber,
} from "./numeric";

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

describe("parseFiniteDecimal", () => {
  it("accepts finite numbers and decimal strings", () => {
    expect(parseFiniteDecimal(0.42)).toBe(0.42);
    expect(parseFiniteDecimal("0.42")).toBe(0.42);
    expect(parseFiniteDecimal(" 10.5 ")).toBe(10.5);
  });

  it("rejects non-finite and partial decimal values", () => {
    expect(parseFiniteDecimal(Number.NaN)).toBeNull();
    expect(parseFiniteDecimal(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseFiniteDecimal("Infinity")).toBeNull();
    expect(parseFiniteDecimal("0.5abc")).toBeNull();
    expect(parseFiniteDecimal("")).toBeNull();
    expect(parseFiniteDecimal(null)).toBeNull();
  });
});
