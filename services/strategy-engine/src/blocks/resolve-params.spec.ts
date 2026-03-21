import { describe, it, expect } from "vitest";
import { resolveParams } from "./resolve-params";

describe("resolveParams", () => {
  it("returns unchanged params when no $ references", () => {
    const params = { size: "10", tokenId: "tok-abc" };
    const variables = { myVar: 42 };

    const result = resolveParams(params, variables);

    expect(result).toEqual({ size: "10", tokenId: "tok-abc" });
  });

  it("resolves $varName to variable value", () => {
    const params = { size: "$betSize" };
    const variables = { betSize: 25 };

    const result = resolveParams(params, variables);

    expect(result).toEqual({ size: 25 });
  });

  it("leaves $varName unchanged when not in variables map", () => {
    const params = { size: "$missingVar" };
    const variables = { otherVar: 10 };

    const result = resolveParams(params, variables);

    expect(result).toEqual({ size: "$missingVar" });
  });

  it("handles multiple $ references in same params", () => {
    const params = { size: "$betSize", threshold: "$limit", tokenId: "tok-1" };
    const variables = { betSize: 50, limit: 0.75 };

    const result = resolveParams(params, variables);

    expect(result).toEqual({ size: 50, threshold: 0.75, tokenId: "tok-1" });
  });

  it("handles non-string values (numbers, booleans) unchanged", () => {
    const params = { count: 5, enabled: true, label: "hello" };
    const variables = { count: 99 };

    const result = resolveParams(params, variables);

    expect(result).toEqual({ count: 5, enabled: true, label: "hello" });
  });

  it("returns empty object for empty params", () => {
    const result = resolveParams({}, { x: 1 });

    expect(result).toEqual({});
  });

  it("does not mutate the original params object", () => {
    const params = { size: "$betSize" };
    const variables = { betSize: 25 };

    resolveParams(params, variables);

    expect(params.size).toBe("$betSize");
  });
});
