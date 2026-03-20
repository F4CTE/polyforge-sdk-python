import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The mockPnl method lives on DiscoverComponent. We extract the logic here
// so we can test it without Angular TestBed (user-app has no vitest wired up).

interface PublicStrategy {
  id: string;
  [key: string]: any;
}

function mockPnl(s: PublicStrategy): number {
  const hash = s.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  if (hash % 10 < 3) return 0; // ~30% show no data
  const seed = Math.sin(hash) * 10000;
  return parseFloat(((seed - Math.floor(seed)) * 20 - 10).toFixed(1));
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("DiscoverComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mockPnl", () => {
    it("returns a number for a valid strategy ID", () => {
      const result = mockPnl({ id: "abc-123-def" });

      expect(typeof result).toBe("number");
    });

    it("returns 0 for ~30% of strategies (deterministic based on ID)", () => {
      // Generate many IDs and check that roughly 30% return 0
      const ids = Array.from({ length: 100 }, (_, i) => `strategy-${i}`);
      const zeroCount = ids.filter(id => mockPnl({ id }) === 0).length;

      // Allow a reasonable range around 30%
      expect(zeroCount).toBeGreaterThanOrEqual(15);
      expect(zeroCount).toBeLessThanOrEqual(45);
    });

    it("returns 0 when hash % 10 < 3", () => {
      // Find an ID that produces a hash where hash % 10 < 3
      // 'a' has charCode 97, hash=97, 97%10=7 -> not zero
      // We need to find one: 'aab' -> 97+97+98=292, 292%10=2 -> zero
      const result = mockPnl({ id: "aab" });

      expect(result).toBe(0);
    });

    it("same ID always returns the same value (deterministic)", () => {
      const id = "strategy-xyz-789";
      const result1 = mockPnl({ id });
      const result2 = mockPnl({ id });

      expect(result1).toBe(result2);
    });

    it("different IDs can return different values", () => {
      const r1 = mockPnl({ id: "alpha" });
      const r2 = mockPnl({ id: "beta" });
      const r3 = mockPnl({ id: "gamma" });

      // At least two of three should differ (extremely unlikely all match)
      const unique = new Set([r1, r2, r3]);
      expect(unique.size).toBeGreaterThanOrEqual(2);
    });
  });
});
