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
});
