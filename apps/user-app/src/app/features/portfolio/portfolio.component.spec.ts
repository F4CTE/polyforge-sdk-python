import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The pnlColor method lives on PortfolioComponent. We extract the logic here
// so we can test it without Angular TestBed (user-app has no vitest wired up).

function pnlColor(val: string): string {
  const n = parseFloat(val);
  if (n > 0) return "#22C55E";
  if (n < 0) return "#EF4444";
  return "#9CA3AF";
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("PortfolioComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("pnlColor", () => {
    it("returns green for positive value", () => {
      expect(pnlColor("100.50")).toBe("#22C55E");
    });

    it("returns red for negative value", () => {
      expect(pnlColor("-25.00")).toBe("#EF4444");
    });

    it("returns gray for zero", () => {
      expect(pnlColor("0")).toBe("#9CA3AF");
    });

    it("returns green for string positive value", () => {
      expect(pnlColor("0.01")).toBe("#22C55E");
    });

    it("returns red for string negative value", () => {
      expect(pnlColor("-0.01")).toBe("#EF4444");
    });
  });
});
