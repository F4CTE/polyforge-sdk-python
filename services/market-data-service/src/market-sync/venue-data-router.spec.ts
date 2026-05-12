import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  VenueDataRouter,
  type VenuePriceFeed,
  type UnifiedPriceEvent,
} from "./venue-data-router";

// ─── Stubs ────────────────────────────────────────────────────────────────────

function makeFeed(venueId: "polymarket" | "kalshi"): VenuePriceFeed {
  return {
    venueId,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    subscribeTokens: vi.fn(),
    isHealthy: vi.fn().mockReturnValue(true),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("VenueDataRouter", () => {
  let emitter: EventEmitter2;
  let polyFeed: VenuePriceFeed;
  let kalshiFeed: VenuePriceFeed;
  let router: VenueDataRouter;

  beforeEach(() => {
    emitter = new EventEmitter2();
    polyFeed = makeFeed("polymarket");
    kalshiFeed = makeFeed("kalshi");
    router = new VenueDataRouter([polyFeed, kalshiFeed], emitter);
  });

  afterEach(() => {
    router.destroy();
  });

  describe("getFeeds()", () => {
    it("returns all registered feeds", () => {
      expect(router.getFeeds()).toHaveLength(2);
    });

    it("returns the feed for a specific venue", () => {
      expect(router.getFeed("polymarket")).toBe(polyFeed);
      expect(router.getFeed("kalshi")).toBe(kalshiFeed);
    });

    it("returns undefined for an unregistered venue", () => {
      expect(router.getFeed("kalshi" as any)).toBe(kalshiFeed);
    });
  });

  describe("onPriceUpdate()", () => {
    it("re-emits a unified market-data.price event with venueId when a feed fires a price", () => {
      const received: UnifiedPriceEvent[] = [];
      emitter.on("market-data.price", (e: UnifiedPriceEvent) =>
        received.push(e),
      );

      router.onPriceUpdate("polymarket", {
        tokenId: "tok-1",
        price: 0.55,
        timestamp: 1000,
      });

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        venueId: "polymarket",
        tokenId: "tok-1",
        price: 0.55,
      });
    });

    it("includes venueId 'kalshi' when a kalshi feed fires", () => {
      const received: UnifiedPriceEvent[] = [];
      emitter.on("market-data.price", (e: UnifiedPriceEvent) =>
        received.push(e),
      );

      router.onPriceUpdate("kalshi", {
        tokenId: "tok-2",
        price: 0.44,
        timestamp: 2000,
      });

      expect(received[0]).toMatchObject({
        venueId: "kalshi",
        tokenId: "tok-2",
      });
    });

    it("does not emit when feed is not registered", () => {
      const spy = vi.fn();
      emitter.on("market-data.price", spy);

      router.onPriceUpdate("unknown", {
        tokenId: "tok-3",
        price: 0.5,
        timestamp: 3000,
      });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("subscribeTokens()", () => {
    it("delegates to a specific venue feed", () => {
      router.subscribeTokens("polymarket", ["tok-1", "tok-2"]);
      expect(polyFeed.subscribeTokens).toHaveBeenCalledWith(["tok-1", "tok-2"]);
      expect(kalshiFeed.subscribeTokens).not.toHaveBeenCalled();
    });

    it("does not throw for a registered venue", () => {
      expect(() => router.subscribeTokens("kalshi", ["tok"])).not.toThrow();
    });

    it("throws for an unregistered venue", () => {
      expect(() => router.subscribeTokens("unknown" as any, ["tok"])).toThrow(
        "No feed registered for venue 'unknown'",
      );
    });
  });

  describe("healthCheck()", () => {
    it("returns a per-venue health map", () => {
      const health = router.healthCheck();
      expect(health.get("polymarket")).toBe(true);
      expect(health.get("kalshi")).toBe(true);
    });

    it("reports unhealthy for a failing feed", () => {
      (kalshiFeed.isHealthy as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const health = router.healthCheck();
      expect(health.get("kalshi")).toBe(false);
    });
  });
});
