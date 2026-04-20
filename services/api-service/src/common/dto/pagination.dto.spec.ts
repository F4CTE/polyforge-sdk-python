import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { paginate, PaginatedResponse } from "./pagination.dto";

const FLAT_SHAPE_KEYS = [
  "data",
  "total",
  "page",
  "limit",
  "totalPages",
  "hasNext",
] as const;

function assertFlatShape(result: unknown) {
  const obj = result as Record<string, unknown>;
  for (const key of FLAT_SHAPE_KEYS) {
    expect(obj).toHaveProperty(key);
  }
  expect(obj).not.toHaveProperty("meta");
}

describe("paginate() contract", () => {
  it("returns all flat shape keys", () => {
    const result = paginate(["a", "b"], 10, 1, 5);
    assertFlatShape(result);
  });

  it("never returns a meta wrapper", () => {
    const result = paginate([], 0, 1, 20);
    expect(result).not.toHaveProperty("meta");
  });

  it("calculates hasNext=true when more pages exist", () => {
    const result = paginate(["a"], 25, 1, 10);
    expect(result.hasNext).toBe(true);
    expect(result.totalPages).toBe(3);
  });

  it("calculates hasNext=false on last page", () => {
    const result = paginate(["a"], 25, 3, 10);
    expect(result.hasNext).toBe(false);
  });

  it("handles empty results", () => {
    const result = paginate([], 0, 1, 20);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.hasNext).toBe(false);
  });

  it("matches PaginatedResponse<T> type shape at compile time", () => {
    const result: PaginatedResponse<string> = paginate(["x"], 1, 1, 10);
    expect(result.data[0]).toBe("x");
  });
});
