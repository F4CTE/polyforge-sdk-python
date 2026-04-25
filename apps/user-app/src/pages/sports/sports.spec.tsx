import { describe, it, expect } from "vitest";
import { GameStatus, SportsCategory, SPORTS_CATEGORY_LABELS } from "./types";

// These tests mirror the sidebar.test.tsx pattern: structural invariants
// that catch regressions in data structures and logic without requiring
// a DOM environment (happy-dom + React 19 act compat is a pre-existing blocker).

/* ─── SPORTS_CATEGORY_LABELS completeness ────────────────────────────── */

describe("SPORTS_CATEGORY_LABELS", () => {
  it("has a label for every SportsCategory enum value", () => {
    for (const cat of Object.values(SportsCategory)) {
      expect(SPORTS_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it("contains no empty string labels", () => {
    for (const label of Object.values(SPORTS_CATEGORY_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it("label count matches enum value count", () => {
    expect(Object.keys(SPORTS_CATEGORY_LABELS).length).toBe(
      Object.values(SportsCategory).length,
    );
  });
});

/* ─── SportsCategory enum ────────────────────────────────────────────── */

describe("SportsCategory enum", () => {
  const EXPECTED_CATEGORIES = [
    "NFL",
    "NBA",
    "MLB",
    "NHL",
    "SOCCER",
    "MMA",
    "GOLF",
    "TENNIS",
    "NCAA_FOOTBALL",
    "NCAA_BASKETBALL",
    "F1",
    "NASCAR",
    "BOXING",
    "CRICKET",
    "RUGBY",
    "ESPORTS",
    "OTHER",
  ];

  it("contains the 17 expected sport categories", () => {
    for (const cat of EXPECTED_CATEGORIES) {
      expect(Object.values(SportsCategory)).toContain(cat);
    }
  });

  it("has no duplicate values", () => {
    const values = Object.values(SportsCategory);
    expect(new Set(values).size).toBe(values.length);
  });

  it("includes key US major leagues", () => {
    expect(Object.values(SportsCategory)).toContain(SportsCategory.NFL);
    expect(Object.values(SportsCategory)).toContain(SportsCategory.NBA);
    expect(Object.values(SportsCategory)).toContain(SportsCategory.MLB);
    expect(Object.values(SportsCategory)).toContain(SportsCategory.NHL);
  });
});

/* ─── GameStatus enum ────────────────────────────────────────────────── */

describe("GameStatus enum", () => {
  const EXPECTED_STATUSES = [
    "SCHEDULED",
    "PREGAME",
    "LIVE",
    "HALFTIME",
    "FINAL",
    "POSTPONED",
    "CANCELLED",
  ];

  it("contains the 7 expected game statuses", () => {
    for (const s of EXPECTED_STATUSES) {
      expect(Object.values(GameStatus)).toContain(s);
    }
  });

  it("has no duplicate values", () => {
    const values = Object.values(GameStatus);
    expect(new Set(values).size).toBe(values.length);
  });

  it("LIVE and HALFTIME are distinct statuses", () => {
    expect(GameStatus.LIVE).not.toBe(GameStatus.HALFTIME);
  });

  it("terminal statuses include FINAL, POSTPONED, CANCELLED", () => {
    const terminal = [GameStatus.FINAL, GameStatus.POSTPONED, GameStatus.CANCELLED];
    for (const s of terminal) {
      expect(Object.values(GameStatus)).toContain(s);
    }
  });
});

/* ─── Category label display names ───────────────────────────────────── */

describe("SPORTS_CATEGORY_LABELS display names", () => {
  it("NFL label is human-readable (not the enum key)", () => {
    expect(SPORTS_CATEGORY_LABELS[SportsCategory.NFL]).toBe("NFL Football");
  });

  it("SOCCER label is display-friendly", () => {
    expect(SPORTS_CATEGORY_LABELS[SportsCategory.SOCCER]).toBe("Soccer");
  });

  it("MMA label includes both acronyms", () => {
    expect(SPORTS_CATEGORY_LABELS[SportsCategory.MMA]).toContain("MMA");
    expect(SPORTS_CATEGORY_LABELS[SportsCategory.MMA]).toContain("UFC");
  });

  it("NCAA_FOOTBALL has a readable label", () => {
    expect(SPORTS_CATEGORY_LABELS[SportsCategory.NCAA_FOOTBALL]).toBe(
      "College Football",
    );
  });

  it("F1 label is Formula 1", () => {
    expect(SPORTS_CATEGORY_LABELS[SportsCategory.F1]).toBe("Formula 1");
  });

  it("all labels are title-cased or all-caps (no all-lowercase entries)", () => {
    for (const label of Object.values(SPORTS_CATEGORY_LABELS)) {
      // Label should start with an uppercase letter
      expect(label[0]).toBe(label[0].toUpperCase());
    }
  });
});
