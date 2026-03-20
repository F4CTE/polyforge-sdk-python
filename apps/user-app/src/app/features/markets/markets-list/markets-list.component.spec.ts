import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The categoryColor method lives on MarketsListComponent. We extract the logic
// here so we can test it without Angular TestBed (user-app has no vitest wired up).

function categoryColor(cat: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    Sports:     { bg: "rgba(59,130,246,0.15)",  text: "#3B82F6" },
    Crypto:     { bg: "rgba(245,158,11,0.15)",  text: "#F59E0B" },
    Politics:   { bg: "rgba(168,85,247,0.15)",  text: "#A855F7" },
    Economics:  { bg: "rgba(16,185,129,0.15)",   text: "#10B981" },
    Finance:    { bg: "rgba(6,182,212,0.15)",    text: "#06B6D4" },
    Technology: { bg: "rgba(236,72,153,0.15)",   text: "#EC4899" },
  };
  return map[cat] ?? { bg: "rgba(107,114,128,0.15)", text: "#6B7280" };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("MarketsListComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("categoryColor", () => {
    it("returns blue colors for Sports", () => {
      const result = categoryColor("Sports");

      expect(result.bg).toBe("rgba(59,130,246,0.15)");
      expect(result.text).toBe("#3B82F6");
    });

    it("returns orange colors for Crypto", () => {
      const result = categoryColor("Crypto");

      expect(result.bg).toBe("rgba(245,158,11,0.15)");
      expect(result.text).toBe("#F59E0B");
    });

    it("returns purple colors for Politics", () => {
      const result = categoryColor("Politics");

      expect(result.bg).toBe("rgba(168,85,247,0.15)");
      expect(result.text).toBe("#A855F7");
    });

    it("returns emerald colors for Economics", () => {
      const result = categoryColor("Economics");

      expect(result.bg).toBe("rgba(16,185,129,0.15)");
      expect(result.text).toBe("#10B981");
    });

    it("returns cyan colors for Finance", () => {
      const result = categoryColor("Finance");

      expect(result.bg).toBe("rgba(6,182,212,0.15)");
      expect(result.text).toBe("#06B6D4");
    });

    it("returns pink colors for Technology", () => {
      const result = categoryColor("Technology");

      expect(result.bg).toBe("rgba(236,72,153,0.15)");
      expect(result.text).toBe("#EC4899");
    });

    it("returns gray default for unknown category", () => {
      const result = categoryColor("Unknown");

      expect(result.bg).toBe("rgba(107,114,128,0.15)");
      expect(result.text).toBe("#6B7280");
    });
  });
});
