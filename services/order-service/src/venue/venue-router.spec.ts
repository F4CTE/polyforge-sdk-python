import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  VenueAdapter,
  VenueOrderRequest,
  VenueOrderResponse,
} from "@polyforge/shared-types";
import { VenueRouter, type UserRailContext } from "./venue-router";

// ─── Stub adapters ────────────────────────────────────────────────────────────

function makeAdapter(
  venueId: "polymarket" | "polymarket_us" | "kalshi",
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

// ─── Phase 5: Jurisdiction-aware routing ─────────────────────────────────────

describe("VenueRouter — jurisdiction-aware routing (Phase 5)", () => {
  let polyAdapter: VenueAdapter;
  let polyUsAdapter: VenueAdapter;
  let kalshiAdapter: VenueAdapter;

  beforeEach(() => {
    polyAdapter = makeAdapter("polymarket", "0.45");
    polyUsAdapter = makeAdapter("polymarket_us", "0.45");
    kalshiAdapter = makeAdapter("kalshi", "0.44");
  });

  // ── resolve() with UserRailContext ────────────────────────────────────────

  describe("resolve() — auto rail mode", () => {
    it("redirects US user with US credentials from polymarket to polymarket_us", () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter, kalshiAdapter]);
      const userCtx: UserRailContext = {
        country: "US",
        polymarketUsConnected: true,
      };
      expect(r.resolve("polymarket", userCtx)).toBe(polyUsAdapter);
    });

    it("redirects undefined venue to polymarket_us for US user with credentials", () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter]);
      const userCtx: UserRailContext = {
        country: "US",
        polymarketUsConnected: true,
      };
      expect(r.resolve(undefined, userCtx)).toBe(polyUsAdapter);
    });

    it("does not redirect non-US user to polymarket_us", () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter]);
      const userCtx: UserRailContext = {
        country: "GB",
        polymarketUsConnected: false,
      };
      expect(r.resolve("polymarket", userCtx)).toBe(polyAdapter);
    });

    it("does not redirect US user without US credentials", () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter]);
      const userCtx: UserRailContext = {
        country: "US",
        polymarketUsConnected: false,
      };
      expect(r.resolve("polymarket", userCtx)).toBe(polyAdapter);
    });

    it("does not redirect when polymarket_us adapter is not registered", () => {
      const r = new VenueRouter([polyAdapter]);
      const userCtx: UserRailContext = {
        country: "US",
        polymarketUsConnected: true,
      };
      expect(r.resolve("polymarket", userCtx)).toBe(polyAdapter);
    });

    it("still routes kalshi directly regardless of US context", () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter, kalshiAdapter]);
      const userCtx: UserRailContext = {
        country: "US",
        polymarketUsConnected: true,
      };
      expect(r.resolve("kalshi", userCtx)).toBe(kalshiAdapter);
    });

    it("routes to polymarket when userCtx is absent (backward compat)", () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter]);
      expect(r.resolve("polymarket")).toBe(polyAdapter);
    });
  });

  // ── POLYMARKET_RAIL override modes ────────────────────────────────────────

  describe("resolve() — rail mode overrides", () => {
    it("forces global polymarket even for US user when railMode is 'global'", () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter], "global");
      const userCtx: UserRailContext = {
        country: "US",
        polymarketUsConnected: true,
      };
      expect(r.resolve("polymarket", userCtx)).toBe(polyAdapter);
    });

    it("forces polymarket_us when railMode is 'us'", () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter], "us");
      expect(r.resolve("polymarket")).toBe(polyUsAdapter);
    });

    it("defaults to auto when no railMode is provided", () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter]);
      const nonUsCtx: UserRailContext = {
        country: "CA",
        polymarketUsConnected: false,
      };
      expect(r.resolve("polymarket", nonUsCtx)).toBe(polyAdapter);
    });
  });

  // ── resolveBest() with UserRailContext ────────────────────────────────────

  describe("resolveBest() — user eligibility filtering", () => {
    it("excludes polymarket_us from resolveBest for non-US users", async () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter]);
      const userCtx: UserRailContext = {
        country: "GB",
        polymarketUsConnected: false,
      };
      const best = await r.resolveBest("tok-abc", undefined, userCtx);
      expect(best.venueId).toBe("polymarket");
    });

    it("excludes global polymarket from resolveBest for US users in auto mode", async () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter]);
      const userCtx: UserRailContext = {
        country: "US",
        polymarketUsConnected: true,
      };
      const best = await r.resolveBest("tok-abc", undefined, userCtx);
      expect(best.venueId).toBe("polymarket_us");
    });

    it("includes only global polymarket in resolveBest when railMode is 'global'", async () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter], "global");
      const usCtx: UserRailContext = {
        country: "US",
        polymarketUsConnected: true,
      };
      const best = await r.resolveBest("tok-abc", undefined, usCtx);
      expect(best.venueId).toBe("polymarket");
    });

    it("includes only polymarket_us in resolveBest when railMode is 'us'", async () => {
      const r = new VenueRouter([polyAdapter, polyUsAdapter], "us");
      const best = await r.resolveBest("tok-abc");
      expect(best.venueId).toBe("polymarket_us");
    });

    it("falls back to global polymarket when all eligible adapters fail getOrderBook", async () => {
      const failingUsAdapter = {
        ...polyUsAdapter,
        getOrderBook: vi.fn().mockRejectedValue(new Error("timeout")),
      };
      const failingKalshi = {
        ...kalshiAdapter,
        getOrderBook: vi.fn().mockRejectedValue(new Error("timeout")),
      };
      // US user: polymarket excluded, polymarket_us + kalshi eligible but both fail
      const r = new VenueRouter([polyAdapter, failingUsAdapter, failingKalshi]);
      const usCtx: UserRailContext = {
        country: "US",
        polymarketUsConnected: true,
      };
      const best = await r.resolveBest("tok-abc", undefined, usCtx);
      expect(best.venueId).toBe("polymarket");
    });
  });
});
