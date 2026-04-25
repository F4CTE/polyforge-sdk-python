import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { KalshiAuthService } from "./kalshi-auth.service";
import { KalshiRestService } from "./kalshi-rest.service";
import { KalshiAdapterService } from "./kalshi-adapter.service";
import type { VenueOrderRequest } from "@polyforge/shared-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(
  url = "https://demo-api.kalshi.co/trade-api/v2",
): ConfigService {
  return {
    get: (k: string, d?: string) => {
      const map: Record<string, string> = {
        KALSHI_BASE_URL: url,
        SIGNER_SERVICE_URL: "http://signer:3012",
      };
      return map[k] ?? d ?? "";
    },
    getOrThrow: (k: string) => {
      const map: Record<string, string> = { KALSHI_BASE_URL: url };
      if (!(k in map)) throw new Error(`Missing ${k}`);
      return map[k];
    },
  } as any;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("KalshiAdapterService", () => {
  let adapter: KalshiAdapterService;
  let rest: KalshiRestService;

  beforeEach(() => {
    const jwt = {
      sign: vi.fn().mockReturnValue("svc-jwt"),
    } as any as JwtService;
    const auth = new KalshiAuthService(jwt, makeConfig());
    // Pre-seed auth cache to avoid signer calls in unit tests
    (auth as any).cache = {
      token: "unit-test-jwt",
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
    };
    rest = new KalshiRestService(auth, makeConfig());
    adapter = new KalshiAdapterService(rest);
  });

  it("has venueId = 'kalshi'", () => {
    expect(adapter.venueId).toBe("kalshi");
  });

  // ── getMarkets ────────────────────────────────────────────────────────────

  describe("getMarkets()", () => {
    it("returns UnifiedMarket array mapped from Kalshi markets", async () => {
      vi.spyOn(rest, "getMarkets").mockResolvedValue([
        {
          ticker: "PRES-2024",
          yes_sub_title: "2024 US Presidential election",
          status: "active",
          close_time: "2024-11-05T00:00:00Z",
        } as any,
      ]);
      const result = await adapter.getMarkets({});
      expect(result).toHaveLength(1);
      expect(result[0].venueId).toBe("kalshi");
      expect(result[0].externalId).toBe("PRES-2024");
      expect(result[0].closed).toBe(false);
    });

    it("passes 'finalized' status when active is false", async () => {
      const spy = vi.spyOn(rest, "getMarkets").mockResolvedValue([]);
      await adapter.getMarkets({ active: false });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ status: "finalized" }),
      );
    });

    it("maps market without close_time or title using ticker fallback", async () => {
      vi.spyOn(rest, "getMarkets").mockResolvedValue([
        {
          ticker: "SOME-MKT",
          yes_sub_title: undefined,
          status: "finalized",
        } as any,
      ]);
      const result = await adapter.getMarkets({});
      expect(result[0].title).toBe("SOME-MKT");
      expect(result[0].endDate).toBeUndefined();
      expect(result[0].closed).toBe(true);
    });
  });

  // ── getOrderBook ──────────────────────────────────────────────────────────

  describe("getOrderBook()", () => {
    it("maps Kalshi orderbook to OrderBook shape with normalized prices", async () => {
      vi.spyOn(rest, "getOrderBook").mockResolvedValue({
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 55, quantity: 80 }],
      });
      const book = await adapter.getOrderBook("BTC-USD");
      expect(book.tokenId).toBe("BTC-USD");
      // yes bids become bids, no becomes asks (yes_bid ↔ no_ask)
      expect(book.bids[0].price).toBe("0.45");
      expect(book.asks[0].price).toBe("0.45"); // no=55 → 1 - 0.55 = 0.45 from yes perspective
    });

    it("handles missing yes/no arrays gracefully", async () => {
      vi.spyOn(rest, "getOrderBook").mockResolvedValue({
        yes: undefined as any,
        no: undefined as any,
      });
      const book = await adapter.getOrderBook("EMPTY-MKT");
      expect(book.bids).toEqual([]);
      expect(book.asks).toEqual([]);
    });
  });

  // ── getPrice ──────────────────────────────────────────────────────────────

  describe("getPrice()", () => {
    it("returns normalized yes_bid price as string", async () => {
      vi.spyOn(rest, "getMarket").mockResolvedValue({
        ticker: "BTC-USD",
        yes_bid_dollars: "0.45",
        status: "active",
      } as any);
      const price = await adapter.getPrice("BTC-USD");
      expect(price).toBe("0.45");
    });

    it("falls back to last_price when yes_bid is null", async () => {
      vi.spyOn(rest, "getMarket").mockResolvedValue({
        ticker: "X",
        yes_bid_dollars: undefined,
        last_price_dollars: "0.60",
        status: "active",
      } as any);
      expect(await adapter.getPrice("X")).toBe("0.6");
    });

    it("falls back to 0 when both yes_bid and last_price are null", async () => {
      vi.spyOn(rest, "getMarket").mockResolvedValue({
        ticker: "X",
        yes_bid_dollars: undefined,
        last_price_dollars: undefined,
        status: "active",
      } as any);
      expect(await adapter.getPrice("X")).toBe("0");
    });
  });

  // ── submitOrder ───────────────────────────────────────────────────────────

  describe("submitOrder()", () => {
    it("places order and returns VenueOrderResponse", async () => {
      vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-99",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "BTC-USD",
        side: "BUY",
        size: "10",
        price: "0.45",
        orderType: "GTC",
        authContext: { userId: "user-1" },
      };
      const resp = await adapter.submitOrder(req);
      expect(resp.venueOrderId).toBe("ord-99");
      expect(resp.status).toBe("resting");
    });

    it("denormalizes price from 0.45 to 45 for Kalshi API", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-1",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "BTC-USD",
        side: "BUY",
        size: "5",
        price: "0.67",
        orderType: "GTC",
        authContext: { userId: "user-1" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ yes_price_dollars: "0.6700" }),
      );
    });

    it("maps SELL side to 'sell' action", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-s1",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "BTC-USD",
        side: "SELL",
        size: "5",
        price: "0.55",
        orderType: "GTC",
        authContext: { userId: "user-1" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ action: "sell" }),
      );
    });

    it("places 'no' side order when venueOutcomeId is 'no'", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-no1",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "no",
        side: "BUY",
        size: "10",
        price: "0.35",
        orderType: "GTC",
        authContext: { userId: "user-1" },
      };
      const resp = await adapter.submitOrder(req);
      expect(resp.venueOrderId).toBe("ord-no1");
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          side: "no",
          no_price_dollars: "0.3500",
        }),
      );
      // yes_price_dollars should not be present
      const callArgs = spy.mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(callArgs.yes_price_dollars).toBeUndefined();
    });

    it("places 'yes' side order by default when venueOutcomeId is not 'no'", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-y1",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "BUY",
        size: "5",
        price: "0.65",
        orderType: "GTC",
        authContext: { userId: "user-1" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          side: "yes",
          yes_price_dollars: "0.6500",
        }),
      );
      const callArgs = spy.mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(callArgs.no_price_dollars).toBeUndefined();
    });

    it("passes subaccount from authContext to placeOrder", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-sub",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "BTC-USD",
        side: "BUY",
        size: "5",
        price: "0.55",
        orderType: "GTC",
        authContext: { userId: "user-1", subaccount: 3 },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ subaccount: 3 }),
      );
    });

    it("omits subaccount when not in authContext", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-nosub",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "BTC-USD",
        side: "BUY",
        size: "5",
        price: "0.55",
        orderType: "GTC",
        authContext: { userId: "user-1" },
      };
      await adapter.submitOrder(req);
      const callArgs = spy.mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(callArgs.subaccount).toBeUndefined();
    });
  });

  // ── cancelOrder ───────────────────────────────────────────────────────────

  describe("cancelOrder()", () => {
    it("calls cancelOrder on the REST client", async () => {
      const spy = vi.spyOn(rest, "cancelOrder").mockResolvedValue(undefined);
      await expect(
        adapter.cancelOrder("ord-123", { userId: "user-1" }),
      ).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledWith("ord-123");
    });
  });

  // ── cancelAllOrders ───────────────────────────────────────────────────────

  describe("cancelAllOrders()", () => {
    it("fetches active orders and cancels each one", async () => {
      vi.spyOn(rest, "getOrders").mockResolvedValue([
        { order_id: "o1", status: "resting" } as any,
        { order_id: "o2", status: "resting" } as any,
      ]);
      const cancelSpy = vi
        .spyOn(rest, "cancelOrder")
        .mockResolvedValue(undefined);

      await adapter.cancelAllOrders({ userId: "user-1" });
      // 2 resting orders → 2 cancel calls
      expect(cancelSpy).toHaveBeenCalledTimes(2);
    });

    it("skips orders that are not resting or pending", async () => {
      vi.spyOn(rest, "getOrders").mockResolvedValue([
        { order_id: "o1", status: "resting" } as any,
        { order_id: "o2", status: "filled" } as any,
        { order_id: "o3", status: "pending" } as any,
      ]);
      const cancelSpy = vi
        .spyOn(rest, "cancelOrder")
        .mockResolvedValue(undefined);

      await adapter.cancelAllOrders({ userId: "user-1" });
      // Only resting orders are cancelled (o1), not filled (o2) or pending (o3)
      // The adapter filters for status === "resting" only
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });

    it("throws if authContext.userId is missing", async () => {
      await expect(adapter.cancelAllOrders({})).rejects.toThrow(
        "cancelAllOrders requires authContext.userId",
      );
    });
  });

  // ── getPositions ──────────────────────────────────────────────────────────

  describe("getPositions()", () => {
    it("maps Kalshi positions with live currentPrice and unrealizedPnl", async () => {
      vi.spyOn(rest, "getPositions").mockResolvedValue([
        {
          ticker: "BTC-USD",
          position_fp: "10",
          total_traded_dollars: "4.50",
        } as any,
      ]);
      vi.spyOn(rest, "getMarket").mockResolvedValue({
        ticker: "BTC-USD",
        yes_bid_dollars: "0.55",
        status: "active",
      } as any);

      const positions = await adapter.getPositions("user-1");
      expect(positions).toHaveLength(1);
      expect(positions[0].venueId).toBe("kalshi");
      expect(positions[0].venueMarketId).toBe("BTC-USD");
      expect(positions[0].outcome).toBe("yes");
      expect(positions[0].size).toBe("10");
      expect(positions[0].currentPrice).toBe("0.55");
      expect(positions[0].avgPrice).toBe("0.4500");
      expect(parseFloat(positions[0].unrealizedPnl)).toBeCloseTo(1.0, 2);
    });

    it("handles no-side positions (negative position) with inverted price", async () => {
      vi.spyOn(rest, "getPositions").mockResolvedValue([
        {
          ticker: "ETH-USD",
          position_fp: "-5",
          total_traded_dollars: "2.00",
        } as any,
      ]);
      vi.spyOn(rest, "getMarket").mockResolvedValue({
        ticker: "ETH-USD",
        yes_bid_dollars: "0.40",
        status: "active",
      } as any);

      const positions = await adapter.getPositions("user-1");
      expect(positions[0].outcome).toBe("no");
      expect(positions[0].size).toBe("5");
      expect(positions[0].currentPrice).toBe("0.6");
    });

    it("falls back to 0 price when market fetch fails", async () => {
      vi.spyOn(rest, "getPositions").mockResolvedValue([
        {
          ticker: "FAIL-MKT",
          position_fp: "3",
          total_traded_dollars: "1.50",
        } as any,
      ]);
      vi.spyOn(rest, "getMarket").mockRejectedValue(new Error("Network error"));

      const positions = await adapter.getPositions("user-1");
      expect(positions[0].currentPrice).toBe("0");
    });
  });

  // ── getOrderHistory ───────────────────────────────────────────────────────

  describe("getOrderHistory()", () => {
    it("maps Kalshi orders to VenueOrderHistory shape", async () => {
      vi.spyOn(rest, "getOrders").mockResolvedValue([
        {
          order_id: "o1",
          ticker: "BTC-USD",
          action: "buy",
          remaining_count_fp: "5",
          yes_price_dollars: "0.45",
          status: "filled",
          created_time: "2024-01-01T00:00:00Z",
        } as any,
      ]);
      const history = await adapter.getOrderHistory("user-1", 50);
      expect(history).toHaveLength(1);
      expect(history[0].venueOrderId).toBe("o1");
      expect(history[0].price).toBe("0.45");
    });

    it("maps sell action to SELL side and uses no_price fallback", async () => {
      vi.spyOn(rest, "getOrders").mockResolvedValue([
        {
          order_id: "o2",
          ticker: "ETH-USD",
          action: "sell",
          remaining_count_fp: "3",
          yes_price_dollars: undefined,
          no_price_dollars: "0.30",
          status: "filled",
          created_time: undefined,
        } as any,
      ]);
      const history = await adapter.getOrderHistory("user-1", 50);
      expect(history[0].side).toBe("SELL");
      expect(history[0].price).toBe("0.3");
      expect(history[0].filledAt).toBeUndefined();
    });

    it("falls back to 0 when both yes_price and no_price are null", async () => {
      vi.spyOn(rest, "getOrders").mockResolvedValue([
        {
          order_id: "o3",
          ticker: "X",
          action: "buy",
          remaining_count_fp: "1",
          yes_price_dollars: undefined,
          no_price_dollars: undefined,
          status: "canceled",
          created_time: "2024-06-01T12:00:00Z",
        } as any,
      ]);
      const history = await adapter.getOrderHistory("user-1", 10);
      expect(history[0].price).toBe("0");
      expect(history[0].filledAt).toBeInstanceOf(Date);
    });
  });

  // ── healthCheck ───────────────────────────────────────────────────────────

  describe("healthCheck()", () => {
    it("returns true when balance endpoint responds OK", async () => {
      vi.spyOn(rest, "getBalance").mockResolvedValue({ balance: 100 });
      expect(await adapter.healthCheck()).toBe(true);
    });

    it("returns false when balance endpoint throws", async () => {
      vi.spyOn(rest, "getBalance").mockRejectedValue(
        new Error("Network error"),
      );
      expect(await adapter.healthCheck()).toBe(false);
    });
  });

  // ── getPriceHistory ───────────────────────────────────────────────────────

  describe("getPriceHistory()", () => {
    it("returns mapped candles for supported resolutions (1m, 1h, 1d)", async () => {
      vi.spyOn(rest, "getCandlesticks").mockResolvedValue([
        {
          end_period_ts: 1700000000,
          price: {
            open_dollars: "0.40",
            close_dollars: "0.45",
            high_dollars: "0.50",
            low_dollars: "0.35",
          },
          volume_fp: "100",
        } as any,
      ]);
      const candles = await adapter.getPriceHistory("BTC-USD", "1h");
      expect(candles).toHaveLength(1);
      expect(candles[0].open).toBe("0.40");
      expect(candles[0].close).toBe("0.45");
      expect(candles[0].high).toBe("0.50");
      expect(candles[0].low).toBe("0.35");
      expect(candles[0].volume).toBe(100);
      expect(candles[0].bucket).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it("returns empty array for unsupported resolutions (5m, 15m)", async () => {
      const spy = vi.spyOn(rest, "getCandlesticks");
      const candles5m = await adapter.getPriceHistory("BTC-USD", "5m");
      expect(candles5m).toEqual([]);
      const candles15m = await adapter.getPriceHistory("BTC-USD", "15m");
      expect(candles15m).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("passes correct period_interval for 1d resolution", async () => {
      const spy = vi.spyOn(rest, "getCandlesticks").mockResolvedValue([]);
      await adapter.getPriceHistory("MKT-1", "1d");
      expect(spy).toHaveBeenCalledWith("MKT-1", 1440);
    });
  });

  // ── Phase 5b: _dollars field support in submitOrder ───────────────────────

  describe("submitOrder() modern fields", () => {
    it("sends yes_price_dollars alongside yes_price", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-d1",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "BUY",
        size: "5",
        price: "0.4567",
        orderType: "GTC",
        authContext: { userId: "u1" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ yes_price_dollars: "0.4567" }),
      );
    });

    it("sends no_price_dollars for no-side orders", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-nd1",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "no",
        side: "BUY",
        size: "5",
        price: "0.35",
        orderType: "GTC",
        authContext: { userId: "u1" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ no_price_dollars: "0.3500" }),
      );
      const callArgs = spy.mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(callArgs.yes_price_dollars).toBeUndefined();
    });

    it("sends self_trade_prevention_type defaulting to taker_at_cross", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-stp",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "BUY",
        size: "5",
        price: "0.45",
        orderType: "GTC",
        authContext: { userId: "u1" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          self_trade_prevention_type: "taker_at_cross",
        }),
      );
    });

    it("sends maker self_trade_prevention_type from authContext", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-stpm",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "BUY",
        size: "5",
        price: "0.45",
        orderType: "GTC",
        authContext: { userId: "u1", selfTradePreventionType: "maker" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ self_trade_prevention_type: "maker" }),
      );
    });

    it("sends post_only=true for POST_ONLY orderType", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-po",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "BUY",
        size: "5",
        price: "0.45",
        orderType: "POST_ONLY",
        authContext: { userId: "u1" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ post_only: true }),
      );
    });

    it("sends reduce_only from authContext", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-ro",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "SELL",
        size: "3",
        price: "0.60",
        orderType: "GTC",
        authContext: { userId: "u1", reduceOnly: true },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ reduce_only: true }),
      );
    });

    it("sends cancel_order_on_pause from authContext", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-cop",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "BUY",
        size: "5",
        price: "0.45",
        orderType: "GTC",
        authContext: { userId: "u1", cancelOrderOnPause: true },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ cancel_order_on_pause: true }),
      );
    });

    it("sends client_order_id from authContext", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-coi",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "BUY",
        size: "5",
        price: "0.45",
        orderType: "GTC",
        authContext: {
          userId: "u1",
          clientOrderId: "550e8400-e29b-41d4-a716-446655440000",
        },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          client_order_id: "550e8400-e29b-41d4-a716-446655440000",
        }),
      );
    });

    it("sends count_fp for fractional contract sizes", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-fp",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "BUY",
        size: "5.50",
        price: "0.45",
        orderType: "GTC",
        authContext: { userId: "u1" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ count_fp: "5.50", count: 5 }),
      );
    });

    it("omits count_fp for integer contract sizes", async () => {
      const spy = vi.spyOn(rest, "placeOrder").mockResolvedValue({
        order_id: "ord-int",
        status: "resting",
      });
      const req: VenueOrderRequest = {
        venueMarketId: "BTC-USD",
        venueOutcomeId: "yes",
        side: "BUY",
        size: "10",
        price: "0.45",
        orderType: "GTC",
        authContext: { userId: "u1" },
      };
      await adapter.submitOrder(req);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ count: 10 }));
      const callArgs = spy.mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(callArgs.count_fp).toBeUndefined();
    });
  });

  // ── Phase 5b: _dollars field support in getPrice ──────────────────────────

  describe("getPrice() _dollars support", () => {
    it("prefers yes_bid_dollars over integer yes_bid", async () => {
      vi.spyOn(rest, "getMarket").mockResolvedValue({
        ticker: "BTC-USD",
        yes_bid_dollars: "0.4567",
        status: "active",
      } as any);
      const price = await adapter.getPrice("BTC-USD");
      expect(price).toBe("0.4567");
    });

    it("prefers last_price_dollars when yes_bid_dollars is absent", async () => {
      vi.spyOn(rest, "getMarket").mockResolvedValue({
        ticker: "X",
        yes_bid_dollars: undefined,
        last_price_dollars: "0.6050",
        status: "active",
      } as any);
      expect(await adapter.getPrice("X")).toBe("0.605");
    });
  });

  // ── Phase 5b: count_fp in getOrderHistory ─────────────────────────────────

  describe("getOrderHistory() modern fields", () => {
    it("uses count_fp for order size when available", async () => {
      vi.spyOn(rest, "getOrders").mockResolvedValue([
        {
          order_id: "o-fp",
          ticker: "BTC-USD",
          action: "buy",
          remaining_count_fp: "5.50",
          yes_price_dollars: "0.4567",
          status: "filled",
          created_time: "2024-01-01T00:00:00Z",
        } as any,
      ]);
      const history = await adapter.getOrderHistory("user-1", 50);
      expect(history[0].size).toBe("5.50");
      expect(history[0].price).toBe("0.4567");
    });

    it("falls back to integer count when count_fp is absent", async () => {
      vi.spyOn(rest, "getOrders").mockResolvedValue([
        {
          order_id: "o-int",
          ticker: "BTC-USD",
          action: "buy",
          remaining_count_fp: undefined,
          initial_count_fp: "10",
          yes_price_dollars: "0.45",
          status: "filled",
        } as any,
      ]);
      const history = await adapter.getOrderHistory("user-1", 50);
      expect(history[0].size).toBe("10");
    });
  });
});
