import { describe, expect, it } from "vitest";
import {
  isFiniteDecimal,
  parseFiniteDecimal,
  safeDecimalToNumber,
  validateStopLossTakeProfitPct,
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

describe("validateStopLossTakeProfitPct", () => {
  it("returns the parsed number for valid pct values", () => {
    expect(validateStopLossTakeProfitPct("0.1", "set_stop_loss")).toBe(0.1);
    expect(validateStopLossTakeProfitPct(0.05, "take_profit")).toBe(0.05);
    expect(validateStopLossTakeProfitPct("0.2", "set_stop_loss")).toBe(0.2);
    expect(validateStopLossTakeProfitPct(0.5, "take_profit")).toBe(0.5);
    expect(validateStopLossTakeProfitPct(0.999, "set_stop_loss")).toBe(0.999);
  });

  it("rejects pct <= 0", () => {
    expect(() =>
      validateStopLossTakeProfitPct(0, "set_stop_loss"),
    ).toThrow("Invalid set_stop_loss pct: 0");
    expect(() =>
      validateStopLossTakeProfitPct("-0.1", "set_stop_loss"),
    ).toThrow("must be > 0 and < 1");
    expect(() =>
      validateStopLossTakeProfitPct(-1, "take_profit"),
    ).toThrow("must be > 0 and < 1");
  });

  it("rejects pct >= 1", () => {
    expect(() =>
      validateStopLossTakeProfitPct(1, "take_profit"),
    ).toThrow("Invalid take_profit pct: 1");
    expect(() =>
      validateStopLossTakeProfitPct("1.0", "set_stop_loss"),
    ).toThrow("must be > 0 and < 1");
    expect(() =>
      validateStopLossTakeProfitPct(1.5, "take_profit"),
    ).toThrow("must be > 0 and < 1");
  });

  it("rejects non-numeric values", () => {
    expect(() =>
      validateStopLossTakeProfitPct("abc", "set_stop_loss"),
    ).toThrow("must be a finite decimal");
    expect(() =>
      validateStopLossTakeProfitPct(null, "take_profit"),
    ).toThrow("must be a finite decimal");
    expect(() =>
      validateStopLossTakeProfitPct(undefined, "set_stop_loss"),
    ).toThrow("must be a finite decimal");
    expect(() =>
      validateStopLossTakeProfitPct(Number.NaN, "take_profit"),
    ).toThrow("must be a finite decimal");
  });

  it("rejects Infinity", () => {
    expect(() =>
      validateStopLossTakeProfitPct(Number.POSITIVE_INFINITY, "set_stop_loss"),
    ).toThrow("must be a finite decimal");
  });

  it("rejects empty string", () => {
    expect(() =>
      validateStopLossTakeProfitPct("", "take_profit"),
    ).toThrow("must be a finite decimal");
  });

  it("includes block type in error message", () => {
    expect(() =>
      validateStopLossTakeProfitPct(0, "set_stop_loss"),
    ).toThrow(/set_stop_loss/);
    expect(() =>
      validateStopLossTakeProfitPct(2, "take_profit"),
    ).toThrow(/take_profit/);
  });
});
