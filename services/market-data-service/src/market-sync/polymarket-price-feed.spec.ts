import { describe, it, expect, vi, beforeEach } from "vitest";
import { PolymarketPriceFeed } from "./polymarket-price-feed";
import type { RawPriceEvent } from "./venue-data-router";

const RAW: RawPriceEvent = { tokenId: "tok-1", price: 0.55, timestamp: 1000 };

describe("PolymarketPriceFeed", () => {
  let feed: PolymarketPriceFeed;

  beforeEach(() => {
    feed = new PolymarketPriceFeed();
  });

  it("has venueId 'polymarket'", () => {
    expect(feed.venueId).toBe("polymarket");
  });

  describe("subscribe() + handleRawPriceEvent()", () => {
    it("forwards a raw event to the registered handler", () => {
      const handler = vi.fn();
      feed.subscribe(handler);
      feed.handleRawPriceEvent(RAW);
      expect(handler).toHaveBeenCalledWith(RAW);
    });

    it("forwards an event with venueId 'polymarket'", () => {
      const handler = vi.fn();
      feed.subscribe(handler);
      feed.handleRawPriceEvent({ ...RAW, venueId: "polymarket" });
      expect(handler).toHaveBeenCalledOnce();
    });

    it("drops an event whose venueId is not 'polymarket'", () => {
      const handler = vi.fn();
      feed.subscribe(handler);
      feed.handleRawPriceEvent({ ...RAW, venueId: "kalshi" });
      expect(handler).not.toHaveBeenCalled();
    });

    it("silently drops an event when no handler is registered", () => {
      expect(() => feed.handleRawPriceEvent(RAW)).not.toThrow();
    });
  });

  describe("unsubscribe()", () => {
    it("clears the handler so subsequent events are ignored", () => {
      const handler = vi.fn();
      feed.subscribe(handler);
      feed.unsubscribe();
      feed.handleRawPriceEvent(RAW);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("subscribeTokens()", () => {
    it("is a no-op and does not throw", () => {
      expect(() => feed.subscribeTokens(["tok-1", "tok-2"])).not.toThrow();
    });
  });

  describe("isHealthy() + setHealthy()", () => {
    it("is healthy by default", () => {
      expect(feed.isHealthy()).toBe(true);
    });

    it("reflects false after setHealthy(false)", () => {
      feed.setHealthy(false);
      expect(feed.isHealthy()).toBe(false);
    });

    it("reflects true after toggling back to healthy", () => {
      feed.setHealthy(false);
      feed.setHealthy(true);
      expect(feed.isHealthy()).toBe(true);
    });
  });
});
