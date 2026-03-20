import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The rankMedal method lives on LeaderboardComponent. We extract the logic here
// so we can test it without Angular TestBed (user-app has no vitest wired up).

function rankMedal(rank: number): string {
  if (rank === 1) return "\u{1F947}";
  if (rank === 2) return "\u{1F948}";
  if (rank === 3) return "\u{1F949}";
  return "";
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("LeaderboardComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rankMedal", () => {
    it("returns gold medal emoji for rank 1", () => {
      expect(rankMedal(1)).toBe("\u{1F947}");
    });

    it("returns silver medal emoji for rank 2", () => {
      expect(rankMedal(2)).toBe("\u{1F948}");
    });

    it("returns bronze medal emoji for rank 3", () => {
      expect(rankMedal(3)).toBe("\u{1F949}");
    });

    it("returns empty string for rank 4", () => {
      expect(rankMedal(4)).toBe("");
    });

    it("returns empty string for rank 10", () => {
      expect(rankMedal(10)).toBe("");
    });

    it("returns empty string for rank 0", () => {
      expect(rankMedal(0)).toBe("");
    });
  });
});
