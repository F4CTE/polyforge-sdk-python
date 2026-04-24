import { describe, it, expect, beforeEach } from "vitest";
import { clearVenueRegistry, getVenueConfig } from "../venue-config";
import { KALSHI_DEFAULTS } from "./kalshi.config";
import { POLYMARKET_DEFAULTS } from "./polymarket.config";

describe("Venue Config Definitions", () => {
  beforeEach(() => {
    clearVenueRegistry();
    // Re-register after clear for isolated tests
    // The actual configs auto-register on import, but clearVenueRegistry wipes them
  });

  describe("Kalshi config", () => {
    it("has correct venueId", () => {
      expect(KALSHI_DEFAULTS.venueId).toBe("kalshi");
    });

    it("has correct display name", () => {
      expect(KALSHI_DEFAULTS.displayName).toBe("Kalshi");
    });

    it("uses RSA-PSS auth", () => {
      expect(KALSHI_DEFAULTS.authType).toBe("rsa_pss");
    });

    it("supports 1m, 1h, 1d candles", () => {
      expect(KALSHI_DEFAULTS.capabilities.supportedCandleResolutions).toEqual([
        "1m",
        "1h",
        "1d",
      ]);
    });

    it("supports order amend", () => {
      expect(KALSHI_DEFAULTS.capabilities.supportsOrderAmend).toBe(true);
    });

    it("supports batch orders", () => {
      expect(KALSHI_DEFAULTS.capabilities.supportsBatchOrders).toBe(true);
    });

    it("supports RFQ", () => {
      expect(KALSHI_DEFAULTS.capabilities.supportsRfq).toBe(true);
    });

    it("does not support fractional contracts", () => {
      expect(KALSHI_DEFAULTS.capabilities.supportsFractionalContracts).toBe(
        false,
      );
    });

    it("is disabled by default", () => {
      expect(KALSHI_DEFAULTS.enabled).toBe(false);
    });
  });

  describe("Polymarket config", () => {
    it("has correct venueId", () => {
      expect(POLYMARKET_DEFAULTS.venueId).toBe("polymarket");
    });

    it("has correct display name", () => {
      expect(POLYMARKET_DEFAULTS.displayName).toBe("Polymarket");
    });

    it("uses API key auth", () => {
      expect(POLYMARKET_DEFAULTS.authType).toBe("api_key");
    });

    it("supports 1m, 5m, 15m, 1h, 1d candles", () => {
      expect(
        POLYMARKET_DEFAULTS.capabilities.supportedCandleResolutions,
      ).toEqual(["1m", "5m", "15m", "1h", "1d"]);
    });

    it("does not support order amend", () => {
      expect(POLYMARKET_DEFAULTS.capabilities.supportsOrderAmend).toBe(false);
    });

    it("supports fractional contracts", () => {
      expect(POLYMARKET_DEFAULTS.capabilities.supportsFractionalContracts).toBe(
        true,
      );
    });

    it("supports subpenny pricing", () => {
      expect(POLYMARKET_DEFAULTS.capabilities.supportsSubpenny).toBe(true);
    });

    it("is enabled by default", () => {
      expect(POLYMARKET_DEFAULTS.enabled).toBe(true);
    });
  });
});
