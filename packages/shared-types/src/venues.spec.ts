import { describe, it, expect } from "vitest";
import { VENUE_IDS, isKnownVenue } from "./venues";
import type { VenueId, KnownVenueId } from "./venues";

describe("VenueId type system", () => {
  describe("VENUE_IDS", () => {
    it("contains polymarket and kalshi", () => {
      expect(VENUE_IDS).toContain("polymarket");
      expect(VENUE_IDS).toContain("kalshi");
    });

    it("has exactly 2 known venues", () => {
      expect(VENUE_IDS).toHaveLength(2);
    });
  });

  describe("isKnownVenue()", () => {
    it("returns true for polymarket", () => {
      expect(isKnownVenue("polymarket")).toBe(true);
    });

    it("returns true for kalshi", () => {
      expect(isKnownVenue("kalshi")).toBe(true);
    });

    it("returns false for unknown venue", () => {
      expect(isKnownVenue("opinion")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isKnownVenue("")).toBe(false);
    });
  });

  describe("VenueId extensibility", () => {
    it("accepts known venues", () => {
      const poly: VenueId = "polymarket";
      const kalshi: VenueId = "kalshi";
      expect(poly).toBe("polymarket");
      expect(kalshi).toBe("kalshi");
    });

    it("accepts arbitrary string venues (extensible)", () => {
      const custom: VenueId = "opinion-market";
      expect(custom).toBe("opinion-market");
    });

    it("KnownVenueId narrows to polymarket | kalshi", () => {
      const known: KnownVenueId = "polymarket";
      const venueId: VenueId = known;
      expect(venueId).toBe("polymarket");
    });
  });
});
