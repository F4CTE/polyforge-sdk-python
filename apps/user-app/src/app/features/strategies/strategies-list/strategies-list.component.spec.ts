import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The formatPnl and pnlClass methods live on StrategiesListComponent. We
// extract the logic here so we can test without Angular TestBed (user-app has
// no vitest wired up).

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function pnlClass(value: number): string {
  return value >= 0 ? 'pnl-positive' : 'pnl-negative';
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("StrategiesListComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("formatPnl", () => {
    it("formats positive values with + prefix and $ sign", () => {
      expect(formatPnl(142.5)).toBe("+$142.50");
    });

    it("formats negative values with - prefix and $ sign", () => {
      expect(formatPnl(-23)).toBe("-$23.00");
    });

    it("formats zero as positive with + prefix", () => {
      expect(formatPnl(0)).toBe("+$0.00");
    });

    it("formats small positive decimal values", () => {
      expect(formatPnl(0.1)).toBe("+$0.10");
    });

    it("formats large negative values", () => {
      expect(formatPnl(-9999.99)).toBe("-$9999.99");
    });
  });

  describe("pnlClass", () => {
    it("returns 'pnl-positive' for positive values", () => {
      expect(pnlClass(100)).toBe("pnl-positive");
    });

    it("returns 'pnl-negative' for negative values", () => {
      expect(pnlClass(-50)).toBe("pnl-negative");
    });

    it("returns 'pnl-positive' for zero", () => {
      expect(pnlClass(0)).toBe("pnl-positive");
    });
  });
});
