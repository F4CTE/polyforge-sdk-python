import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * Unit tests for the onboarding checklist logic.
 *
 * These tests verify the pure business logic (visibility rules, toggle behavior,
 * completion state) without rendering React components.
 */

// ─── Constants mirrored from the component ───────────────────────────────────

const CHECKLIST_KEYS = [
  "completeProfile",
  "browseMarkets",
  "createStrategy",
  "runPaperTrade",
  "runBacktest",
  "setupNotifications",
] as const;

const STORAGE_KEY = "polyforge:onboarding:completed";
const DISMISSED_KEY = "polyforge:onboarding:dismissed";

// ─── Logic helpers (extracted from component for testability) ─────────────────

function shouldShowChecklist(user: {
  createdAt: string | Date;
}, dismissed: boolean, now: Date = new Date()): boolean {
  if (!user) return false;
  if (dismissed) return false;

  const joinDate = new Date(user.createdAt);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return joinDate >= sevenDaysAgo;
}

function toggleItem(
  completed: Record<string, boolean>,
  key: string,
): Record<string, boolean> {
  return { ...completed, [key]: !completed[key] };
}

function allCompleted(completed: Record<string, boolean>): boolean {
  return CHECKLIST_KEYS.every((key) => completed[key] === true);
}

function getCompletedCount(completed: Record<string, boolean>): number {
  return CHECKLIST_KEYS.filter((key) => completed[key]).length;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("OnboardingChecklist logic", () => {
  const NOW = new Date("2026-03-24T12:00:00Z");

  describe("shouldShowChecklist", () => {
    it("returns true for users who joined less than 7 days ago", () => {
      const user = { createdAt: "2026-03-20T00:00:00Z" };

      expect(shouldShowChecklist(user, false, NOW)).toBe(true);
    });

    it("returns true for users who joined exactly 7 days ago", () => {
      // 7 days ago from NOW = 2026-03-17T12:00:00Z
      const user = { createdAt: "2026-03-17T12:00:00Z" };

      expect(shouldShowChecklist(user, false, NOW)).toBe(true);
    });

    it("returns false for users who joined more than 7 days ago", () => {
      const user = { createdAt: "2026-03-10T00:00:00Z" };

      expect(shouldShowChecklist(user, false, NOW)).toBe(false);
    });

    it("returns false when dismissed is true", () => {
      const user = { createdAt: "2026-03-23T00:00:00Z" };

      expect(shouldShowChecklist(user, true, NOW)).toBe(false);
    });

    it("returns true for user who joined today", () => {
      const user = { createdAt: "2026-03-24T08:00:00Z" };

      expect(shouldShowChecklist(user, false, NOW)).toBe(true);
    });

    it("returns false for users who joined well in the past", () => {
      const user = { createdAt: "2025-01-01T00:00:00Z" };

      expect(shouldShowChecklist(user, false, NOW)).toBe(false);
    });
  });

  describe("Checklist items initial state", () => {
    it("starts with all items unchecked (empty object)", () => {
      const completed: Record<string, boolean> = {};

      expect(getCompletedCount(completed)).toBe(0);
      for (const key of CHECKLIST_KEYS) {
        expect(completed[key]).toBeUndefined();
      }
    });

    it("has exactly 6 checklist items", () => {
      expect(CHECKLIST_KEYS).toHaveLength(6);
    });
  });

  describe("toggleItem", () => {
    it("toggles an unchecked item to checked", () => {
      const before: Record<string, boolean> = {};
      const after = toggleItem(before, "completeProfile");

      expect(after.completeProfile).toBe(true);
    });

    it("toggles a checked item back to unchecked", () => {
      const before: Record<string, boolean> = { completeProfile: true };
      const after = toggleItem(before, "completeProfile");

      expect(after.completeProfile).toBe(false);
    });

    it("does not mutate the original object", () => {
      const before: Record<string, boolean> = { browseMarkets: true };
      const after = toggleItem(before, "browseMarkets");

      expect(before.browseMarkets).toBe(true);
      expect(after.browseMarkets).toBe(false);
    });

    it("preserves other items when toggling one", () => {
      const before: Record<string, boolean> = {
        completeProfile: true,
        browseMarkets: false,
      };
      const after = toggleItem(before, "browseMarkets");

      expect(after.completeProfile).toBe(true);
      expect(after.browseMarkets).toBe(true);
    });
  });

  describe("allCompleted", () => {
    it("returns false when no items are checked", () => {
      expect(allCompleted({})).toBe(false);
    });

    it("returns false when only some items are checked", () => {
      const completed: Record<string, boolean> = {
        completeProfile: true,
        browseMarkets: true,
        createStrategy: true,
      };

      expect(allCompleted(completed)).toBe(false);
    });

    it("returns true when all 6 items are checked", () => {
      const completed: Record<string, boolean> = {};
      for (const key of CHECKLIST_KEYS) {
        completed[key] = true;
      }

      expect(allCompleted(completed)).toBe(true);
    });

    it("returns false when one item is explicitly set to false", () => {
      const completed: Record<string, boolean> = {};
      for (const key of CHECKLIST_KEYS) {
        completed[key] = true;
      }
      completed.runBacktest = false;

      expect(allCompleted(completed)).toBe(false);
    });
  });

  describe("getCompletedCount", () => {
    it("returns 0 for empty state", () => {
      expect(getCompletedCount({})).toBe(0);
    });

    it("returns correct count for partial completion", () => {
      const completed: Record<string, boolean> = {
        completeProfile: true,
        browseMarkets: true,
      };

      expect(getCompletedCount(completed)).toBe(2);
    });

    it("returns 6 when all items are completed", () => {
      const completed: Record<string, boolean> = {};
      for (const key of CHECKLIST_KEYS) {
        completed[key] = true;
      }

      expect(getCompletedCount(completed)).toBe(6);
    });
  });
});
