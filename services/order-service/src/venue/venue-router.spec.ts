import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  VenueAdapter,
  VenueOrderRequest,
  VenueOrderResponse,
} from "@polyforge/shared-types";
import { VenueRouter } from "./venue-router";

// ─── Stub adapters ────────────────────────────────────────────────────────────

function makeAdapter(
  venueId: "polymarket" | "kalshi",
  bidPrice = "0.45",
): VenueAdapter {
  return {
    venueId,
    getMarkets: vi.fn().mockResolvedValue([]),
    getOrderBook: vi.fn().mockResolvedValue({
      tokenId: "tok",
      bids: [{ price: bidPrice, size: "100" }],
      asks: [{ price: String(Number(bidPrice) + 0.02), size: "100" }],
      updatedAt: Date.now(),
    }),
    getPrice: vi.fn().mockResolvedValue(bidPrice),
    getPriceHistory: vi.fn().mockResolvedValue([]),
    submitOrder: vi.fn().mockResolvedValue({
      venueOrderId: `${venueId}-order-1`,
      status: "LIVE",
    } satisfies VenueOrderResponse),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    cancelAllOrders: vi.fn().mockResolvedValue(undefined),
    getPositions: vi.fn().mockResolvedValue([]),
    getOrderHistory: vi.fn().mockResolvedValue([]),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOrderReq(
  overrides: Partial<VenueOrderRequest> = {},
): VenueOrderRequest {
  return {
    venueMarketId: "mkt-abc",
    venueOutcomeId: "tok-abc",
    side: "BUY",
    size: "10",
    price: "0.50",
    orderType: "GTC",
    authContext: {},
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("VenueRouter", () => {
  let polyAdapter: VenueAdapter;
  let kalshiAdapter: VenueAdapter;
  let router: VenueRouter;

  beforeEach(() => {
    polyAdapter = makeAdapter("polymarket", "0.45");
    kalshiAdapter = makeAdapter("kalshi", "0.44");
    router = new VenueRouter([polyAdapter, kalshiAdapter]);
  });

  describe("resolve()", () => {
    it("resolves 'polymarket' to the polymarket adapter", () => {
      expect(router.resolve("polymarket")).toBe(polyAdapter);
    });

    it("resolves 'kalshi' to the kalshi adapter", () => {
      expect(router.resolve("kalshi")).toBe(kalshiAdapter);
    });

    it("resolves undefined to the polymarket adapter (backward compat default)", () => {
      expect(router.resolve(undefined)).toBe(polyAdapter);
    });

    it("resolves null to the polymarket adapter (backward compat default)", () => {
      expect(router.resolve(null as any)).toBe(polyAdapter);
    });

    it("throws when a non-'best' venue is requested but no adapter is registered for it", () => {
      const singleRouter = new VenueRouter([polyAdapter]);
      expect(() => singleRouter.resolve("kalshi")).toThrow(/kalshi/i);
    });
  });

  describe("resolveBest()", () => {
    it("picks the venue with the lowest ask price for the given outcomeId", async () => {
      // polymarket ask = 0.47, kalshi ask = 0.46 → kalshi is cheaper
      const polyAdapterLow = makeAdapter("polymarket", "0.45"); // ask 0.47
      const kalshiAdapterHigh = makeAdapter("kalshi", "0.44"); // ask 0.46
      const r = new VenueRouter([polyAdapterLow, kalshiAdapterHigh]);
      const best = await r.resolveBest("tok-abc");
      expect(best.venueId).toBe("kalshi");
    });

    it("falls back to polymarket when only one adapter is registered", async () => {
      const single = new VenueRouter([polyAdapter]);
      const best = await single.resolveBest("tok-abc");
      expect(best.venueId).toBe("polymarket");
    });

    it("skips adapters whose getOrderBook() rejects", async () => {
      const failingKalshi = {
        ...kalshiAdapter,
        getOrderBook: vi.fn().mockRejectedValue(new Error("timeout")),
      };
      const r = new VenueRouter([polyAdapter, failingKalshi]);
      const best = await r.resolveBest("tok-abc");
      expect(best.venueId).toBe("polymarket");
    });
  });

  describe("route()", () => {
    it("routes to polymarket when venue is 'polymarket'", async () => {
      const req = makeOrderReq();
      await router.route("polymarket", req);
      expect(polyAdapter.submitOrder).toHaveBeenCalledWith(req);
    });

    it("routes to kalshi when venue is 'kalshi'", async () => {
      const req = makeOrderReq();
      await router.route("kalshi", req);
      expect(kalshiAdapter.submitOrder).toHaveBeenCalledWith(req);
    });

    it("routes to polymarket when venue is undefined (default)", async () => {
      const req = makeOrderReq();
      await router.route(undefined, req);
      expect(polyAdapter.submitOrder).toHaveBeenCalledWith(req);
    });

    it("routes to the best venue when venue is 'best'", async () => {
      // kalshi ask is lower (0.46 vs 0.47) → kalshi
      const req = makeOrderReq({ venueOutcomeId: "tok-abc" });
      await router.route("best", req);
      expect(kalshiAdapter.submitOrder).toHaveBeenCalledWith(req);
    });

    it("returns the VenueOrderResponse from the selected adapter", async () => {
      const req = makeOrderReq();
      const result = await router.route("polymarket", req);
      expect(result).toMatchObject({
        venueOrderId: "polymarket-order-1",
        status: "LIVE",
      });
    });
  });

  describe("getAdapters()", () => {
    it("returns all registered adapters", () => {
      expect(router.getAdapters()).toHaveLength(2);
    });
  });
});
