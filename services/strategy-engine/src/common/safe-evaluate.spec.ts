import { describe, expect, it } from "vitest";
import { safeEvaluate } from "./safe-evaluate";

describe("safeEvaluate", () => {
  it("evaluates allowlisted numeric expressions", () => {
    expect(
      safeEvaluate("max(price, 0.5) + round(size)", { price: 0.7, size: 2.1 }),
    ).toBe(2.7);
  });

  it("returns NaN for mathjs namespace escape helpers", () => {
    expect(Number.isNaN(safeEvaluate("parse('2+2')", {}))).toBe(true);
    expect(Number.isNaN(safeEvaluate("chain(2).add(2).done()", {}))).toBe(true);
    expect(Number.isNaN(safeEvaluate("derivative('x^2', 'x')", {}))).toBe(true);
    expect(Number.isNaN(safeEvaluate("expression.parse('2+2')", {}))).toBe(
      true,
    );
  });

  it("returns NaN for invalid and non-finite expressions", () => {
    expect(Number.isNaN(safeEvaluate("???", {}))).toBe(true);
    expect(Number.isNaN(safeEvaluate("1 / 0", {}))).toBe(true);
  });

  it("rejects unsupported AST nodes", () => {
    expect(Number.isNaN(safeEvaluate("[1, 2, 3]", {}))).toBe(true);
    expect(Number.isNaN(safeEvaluate("a.b", { a: 1 }))).toBe(true);
  });

  it("rejects pow with exponent exceeding MAX_EXPONENT", () => {
    expect(Number.isNaN(safeEvaluate("pow(2, 1001)", {}))).toBe(true);
    expect(Number.isNaN(safeEvaluate("pow(2, -1001)", {}))).toBe(true);
  });

  it("rejects pow with base exceeding MAX_POW_BASE", () => {
    expect(Number.isNaN(safeEvaluate("pow(1e13, 2)", {}))).toBe(true);
    expect(Number.isNaN(safeEvaluate("pow(-1e13, 2)", {}))).toBe(true);
  });

  it("rejects ^ operator with exponent exceeding MAX_EXPONENT", () => {
    expect(Number.isNaN(safeEvaluate("2 ^ 1001", {}))).toBe(true);
  });

  it("rejects ^ operator with base exceeding MAX_POW_BASE", () => {
    expect(Number.isNaN(safeEvaluate("1e13 ^ 2", {}))).toBe(true);
  });

  it("rejects exp with input exceeding MAX_EXP_INPUT", () => {
    expect(Number.isNaN(safeEvaluate("exp(710)", {}))).toBe(true);
  });

  it("allows pow and exp within bounds", () => {
    expect(safeEvaluate("pow(2, 10)", {})).toBe(1024);
    expect(safeEvaluate("2 ^ 3", {})).toBe(8);
    expect(safeEvaluate("exp(0)", {})).toBe(1);
  });

  it("allows pow with base at MAX_POW_BASE boundary", () => {
    expect(safeEvaluate("pow(1e12, 2)", {})).toBe(1e24);
    expect(safeEvaluate("pow(-1e12, 2)", {})).toBe(1e24);
  });

  it("allows pow with exponent at MAX_EXPONENT boundary", () => {
    expect(safeEvaluate("pow(2, 1000)", {})).toBe(Math.pow(2, 1000));
  });

  it("rejects pow with both operands at boundary (overflow to Infinity)", () => {
    expect(Number.isNaN(safeEvaluate("pow(1e12, 1000)", {}))).toBe(true);
    expect(Number.isNaN(safeEvaluate("1e12 ^ 1000", {}))).toBe(true);
  });
});
