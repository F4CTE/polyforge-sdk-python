import { describe, it, expect } from "vitest";
import { VENUE_IDS, isKnownVenue } from "./venues";
import type { VenueId, KnownVenueId } from "./venues";

describe("VenueId type system", () => {
  describe("VENUE_IDS", () => {
    it("contains polymarket, kalshi, and polymarket_us", () => {
      expect(VENUE_IDS).toContain("polymarket");
      expect(VENUE_IDS).toContain("kalshi");
      expect(VENUE_IDS).toContain("polymarket_us");
    });

    it("has exactly 3 known venues", () => {
      expect(VENUE_IDS).toHaveLength(3);
    });
  });

  describe("isKnownVenue()", () => {
    it("returns true for polymarket", () => {
      expect(isKnownVenue("polymarket")).toBe(true);
    });

    it("returns true for kalshi", () => {
      expect(isKnownVenue("kalshi")).toBe(true);
    });

    it("returns true for polymarket_us", () => {
      expect(isKnownVenue("polymarket_us")).toBe(true);
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
      const polyUs: VenueId = "polymarket_us";
      expect(poly).toBe("polymarket");
      expect(kalshi).toBe("kalshi");
      expect(polyUs).toBe("polymarket_us");
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
