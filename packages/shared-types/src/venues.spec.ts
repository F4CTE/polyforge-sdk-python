import { describe, it, expect } from "vitest";
import { VENUE_IDS, isKnownVenue, isUsVenue } from "./venues";
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

    it("returns true for polymarket_us", () => {
      expect(isKnownVenue("polymarket_us")).toBe(true);
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

  describe("isUsVenue()", () => {
    it("returns true for polymarket_us", () => {
      expect(isUsVenue("polymarket_us")).toBe(true);
    });

    it("returns false for polymarket", () => {
      expect(isUsVenue("polymarket")).toBe(false);
    });

    it("returns false for kalshi", () => {
      expect(isUsVenue("kalshi")).toBe(false);
    });
  });

  describe("VenueId extensibility", () => {
    it("accepts known venues", () => {
      const poly: VenueId = "polymarket";
      const polyUs: VenueId = "polymarket_us";
      const kalshi: VenueId = "kalshi";
      expect(poly).toBe("polymarket");
      expect(polyUs).toBe("polymarket_us");
      expect(kalshi).toBe("kalshi");
    });

    it("accepts arbitrary string venues (extensible)", () => {
      const custom: VenueId = "opinion-market";
      expect(custom).toBe("opinion-market");
    });

    it("KnownVenueId narrows to polymarket | polymarket_us | kalshi", () => {
      const known: KnownVenueId = "polymarket";
      const venueId: VenueId = known;
      expect(venueId).toBe("polymarket");
    });
  });
});
