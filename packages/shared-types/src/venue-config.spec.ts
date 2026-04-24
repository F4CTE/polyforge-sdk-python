import { describe, it, expect, beforeEach } from "vitest";
import {
  registerVenue,
  getVenueConfig,
  getVenueConfigOrThrow,
  getRegisteredVenueIds,
  getAllVenueConfigs,
  getEnabledVenueConfigs,
  isRegisteredVenue,
  clearVenueRegistry,
} from "./venue-config";
import type { VenueConfig } from "./venue-config";

function makeConfig(overrides: Partial<VenueConfig> = {}): VenueConfig {
  return {
    venueId: "test-venue",
    displayName: "Test Venue",
    restBaseUrl: "https://api.test-venue.com",
    wsUrl: "wss://ws.test-venue.com",
    authType: "api_key",
    capabilities: {
      supportedCandleResolutions: ["1m", "1h", "1d"],
      supportsPositionTracking: true,
      supportsFractionalContracts: false,
      supportsSubpenny: false,
      supportedOrderTypes: ["GTC", "FOK"],
      supportsOrderAmend: false,
      supportsBatchOrders: false,
      supportsRfq: false,
      supportsWebSocket: true,
      supportsUserWebSocket: false,
    },
    enabled: true,
    ...overrides,
  };
}

describe("VenueConfig Registry", () => {
  beforeEach(() => {
    clearVenueRegistry();
  });

  describe("registerVenue()", () => {
    it("registers a venue successfully", () => {
      const config = makeConfig();
      registerVenue(config);
      expect(getVenueConfig("test-venue")).toBe(config);
    });

    it("throws when registering the same venue twice", () => {
      registerVenue(makeConfig());
      expect(() => registerVenue(makeConfig())).toThrow(
        "Venue 'test-venue' is already registered",
      );
    });

    it("allows registering multiple different venues", () => {
      registerVenue(makeConfig({ venueId: "venue-a" }));
      registerVenue(makeConfig({ venueId: "venue-b" }));
      expect(getRegisteredVenueIds()).toHaveLength(2);
    });
  });

  describe("getVenueConfig()", () => {
    it("returns undefined for unregistered venue", () => {
      expect(getVenueConfig("nonexistent")).toBeUndefined();
    });

    it("returns the config for a registered venue", () => {
      const config = makeConfig({ venueId: "my-venue" });
      registerVenue(config);
      expect(getVenueConfig("my-venue")).toEqual(config);
    });
  });

  describe("getVenueConfigOrThrow()", () => {
    it("returns config for registered venue", () => {
      const config = makeConfig();
      registerVenue(config);
      expect(getVenueConfigOrThrow("test-venue")).toBe(config);
    });

    it("throws with helpful message for unregistered venue", () => {
      registerVenue(makeConfig({ venueId: "only-one" }));
      expect(() => getVenueConfigOrThrow("missing")).toThrow(
        /No configuration registered for venue 'missing'/,
      );
      expect(() => getVenueConfigOrThrow("missing")).toThrow(/only-one/);
    });

    it("shows empty list when no venues registered", () => {
      expect(() => getVenueConfigOrThrow("x")).toThrow(/\(none\)/);
    });
  });

  describe("getRegisteredVenueIds()", () => {
    it("returns empty array when no venues registered", () => {
      expect(getRegisteredVenueIds()).toEqual([]);
    });

    it("returns all registered venue IDs", () => {
      registerVenue(makeConfig({ venueId: "a" }));
      registerVenue(makeConfig({ venueId: "b" }));
      registerVenue(makeConfig({ venueId: "c" }));
      expect(getRegisteredVenueIds()).toEqual(["a", "b", "c"]);
    });
  });

  describe("getAllVenueConfigs()", () => {
    it("returns all configs", () => {
      registerVenue(makeConfig({ venueId: "x", enabled: true }));
      registerVenue(makeConfig({ venueId: "y", enabled: false }));
      expect(getAllVenueConfigs()).toHaveLength(2);
    });
  });

  describe("getEnabledVenueConfigs()", () => {
    it("filters to only enabled venues", () => {
      registerVenue(makeConfig({ venueId: "enabled-1", enabled: true }));
      registerVenue(makeConfig({ venueId: "disabled-1", enabled: false }));
      registerVenue(makeConfig({ venueId: "enabled-2", enabled: true }));

      const enabled = getEnabledVenueConfigs();
      expect(enabled).toHaveLength(2);
      expect(enabled.map((c) => c.venueId)).toEqual([
        "enabled-1",
        "enabled-2",
      ]);
    });
  });

  describe("isRegisteredVenue()", () => {
    it("returns true for registered venue", () => {
      registerVenue(makeConfig());
      expect(isRegisteredVenue("test-venue")).toBe(true);
    });

    it("returns false for unregistered venue", () => {
      expect(isRegisteredVenue("nope")).toBe(false);
    });
  });

  describe("clearVenueRegistry()", () => {
    it("removes all venues", () => {
      registerVenue(makeConfig({ venueId: "a" }));
      registerVenue(makeConfig({ venueId: "b" }));
      clearVenueRegistry();
      expect(getRegisteredVenueIds()).toEqual([]);
    });
  });
});
