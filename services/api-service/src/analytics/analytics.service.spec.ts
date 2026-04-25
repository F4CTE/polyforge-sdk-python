import { describe, it, expect, beforeEach } from "vitest";
import { AnalyticsService } from "./analytics.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

function makeGroupByResult(category: string, count: number, volume: string) {
  return {
    category,
    _count: { id: count },
    _sum: { volume24h: volume as any },
  };
}

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new AnalyticsService(db as any);
  });

  describe("getCorrelationCategories", () => {
    it("returns categories as string[], matrix as number[][], and updatedAt", async () => {
      (db.market.groupBy as any).mockResolvedValue([
        makeGroupByResult("politics", 50, "500000"),
        makeGroupByResult("crypto", 30, "300000"),
        makeGroupByResult("sports", 20, "100000"),
      ]);

      const result = await service.getCorrelationCategories();

      expect(result).toHaveProperty("categories");
      expect(result).toHaveProperty("matrix");
      expect(result).toHaveProperty("updatedAt");

      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.categories).toEqual(["politics", "crypto", "sports"]);
      expect(typeof result.categories[0]).toBe("string");
    });

    it("returns an NxN matrix matching categories length", async () => {
      (db.market.groupBy as any).mockResolvedValue([
        makeGroupByResult("politics", 50, "500000"),
        makeGroupByResult("crypto", 30, "300000"),
        makeGroupByResult("sports", 20, "100000"),
      ]);

      const result = await service.getCorrelationCategories();
      const n = result.categories.length;

      expect(result.matrix).toHaveLength(n);
      for (const row of result.matrix) {
        expect(row).toHaveLength(n);
      }
    });

    it("has 1.0 on the diagonal (self-correlation)", async () => {
      (db.market.groupBy as any).mockResolvedValue([
        makeGroupByResult("politics", 50, "500000"),
        makeGroupByResult("crypto", 30, "300000"),
      ]);

      const result = await service.getCorrelationCategories();

      for (let i = 0; i < result.categories.length; i++) {
        expect(result.matrix[i][i]).toBe(1);
      }
    });

    it("produces a symmetric matrix", async () => {
      (db.market.groupBy as any).mockResolvedValue([
        makeGroupByResult("politics", 50, "500000"),
        makeGroupByResult("crypto", 30, "300000"),
        makeGroupByResult("sports", 20, "100000"),
      ]);

      const result = await service.getCorrelationCategories();
      const n = result.categories.length;

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          expect(result.matrix[i][j]).toBe(result.matrix[j][i]);
        }
      }
    });

    it("all values are between -1 and 1", async () => {
      (db.market.groupBy as any).mockResolvedValue([
        makeGroupByResult("politics", 50, "500000"),
        makeGroupByResult("crypto", 30, "300000"),
        makeGroupByResult("sports", 20, "100000"),
        makeGroupByResult("science", 10, "50000"),
      ]);

      const result = await service.getCorrelationCategories();

      for (const row of result.matrix) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(-1);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    });

    it("returns empty arrays when no categories exist", async () => {
      (db.market.groupBy as any).mockResolvedValue([]);

      const result = await service.getCorrelationCategories();

      expect(result.categories).toEqual([]);
      expect(result.matrix).toEqual([]);
      expect(result.updatedAt).toBeDefined();
    });

    it("handles a single category", async () => {
      (db.market.groupBy as any).mockResolvedValue([
        makeGroupByResult("politics", 50, "500000"),
      ]);

      const result = await service.getCorrelationCategories();

      expect(result.categories).toEqual(["politics"]);
      expect(result.matrix).toEqual([[1]]);
    });

    it("updatedAt is a valid ISO date string", async () => {
      (db.market.groupBy as any).mockResolvedValue([
        makeGroupByResult("politics", 50, "500000"),
      ]);

      const result = await service.getCorrelationCategories();

      expect(new Date(result.updatedAt).toISOString()).toBe(result.updatedAt);
    });
  });
});
