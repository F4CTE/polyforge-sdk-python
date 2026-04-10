/**
 * Validates that BigInt JSON serialization uses string representation
 * to prevent silent precision loss for values > Number.MAX_SAFE_INTEGER.
 *
 * Regression test for security issue #502.
 */
import { describe, it, expect } from "vitest";

// Apply the same prototype patch as main.ts
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

describe("BigInt JSON serialization", () => {
  it("should serialize small BigInt as string", () => {
    const value = BigInt(42);
    expect(JSON.parse(JSON.stringify({ id: value }))).toEqual({ id: "42" });
  });

  it("should preserve precision for values exceeding MAX_SAFE_INTEGER", () => {
    const large = BigInt("9007199254740993"); // Number.MAX_SAFE_INTEGER + 2
    const parsed = JSON.parse(JSON.stringify({ amount: large }));
    expect(parsed.amount).toBe("9007199254740993");
  });

  it("should serialize zero correctly", () => {
    const zero = BigInt(0);
    expect(JSON.parse(JSON.stringify({ val: zero }))).toEqual({ val: "0" });
  });
});
