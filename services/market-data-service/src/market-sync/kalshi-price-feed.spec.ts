import { describe, it, expect, vi } from "vitest";
import { KalshiPriceFeed } from "./kalshi-price-feed";

describe("KalshiPriceFeed", () => {
  it("has venueId = 'kalshi'", () => {
    const feed = new KalshiPriceFeed();
    expect(feed.venueId).toBe("kalshi");
  });

  it("forwards raw price events to subscribed handler", () => {
    const feed = new KalshiPriceFeed();
    const handler = vi.fn();
    feed.subscribe(handler);

    const event = { tokenId: "BTC-USD", price: 0.55, timestamp: Date.now() };
    feed.handleRawPriceEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("ignores events after unsubscribe", () => {
    const feed = new KalshiPriceFeed();
    const handler = vi.fn();
    feed.subscribe(handler);
    feed.unsubscribe();

    feed.handleRawPriceEvent({
      tokenId: "X",
      price: 0.5,
      timestamp: Date.now(),
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("filters events with wrong venueId", () => {
    const feed = new KalshiPriceFeed();
    const handler = vi.fn();
    feed.subscribe(handler);

    feed.handleRawPriceEvent({
      tokenId: "X",
      price: 0.5,
      timestamp: Date.now(),
      venueId: "polymarket",
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("passes through events with matching venueId", () => {
    const feed = new KalshiPriceFeed();
    const handler = vi.fn();
    feed.subscribe(handler);

    const event = {
      tokenId: "X",
      price: 0.5,
      timestamp: Date.now(),
      venueId: "kalshi",
    };
    feed.handleRawPriceEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("tracks health state", () => {
    const feed = new KalshiPriceFeed();
    expect(feed.isHealthy()).toBe(true);
    feed.setHealthy(false);
    expect(feed.isHealthy()).toBe(false);
  });

  it("subscribeTokens is a no-op", () => {
    const feed = new KalshiPriceFeed();
    expect(() => feed.subscribeTokens(["A", "B"])).not.toThrow();
  });
});
