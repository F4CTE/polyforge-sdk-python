import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

function makeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("KalshiAdapterService", () => {
  let adapter: KalshiAdapterService;
  let fetchSpy: ReturnType<typeof vi.fn>;

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
    const rest = new KalshiRestService(auth, makeConfig());
    adapter = new KalshiAdapterService(rest);
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has venueId = 'kalshi'", () => {
    expect(adapter.venueId).toBe("kalshi");
  });

  // ── getMarkets ────────────────────────────────────────────────────────────

  describe("getMarkets()", () => {
    it("returns UnifiedMarket array mapped from Kalshi markets", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          markets: [
            {
              ticker: "PRES-2024",
              title: "2024 US Presidential election",
              status: "active",
              category: "Politics",
              close_time: "2024-11-05T00:00:00Z",
            },
          ],
        }),
      });
      const result = await adapter.getMarkets({});
      expect(result).toHaveLength(1);
      expect(result[0].venueId).toBe("kalshi");
      expect(result[0].externalId).toBe("PRES-2024");
      expect(result[0].closed).toBe(false);
    });

    it("passes 'finalized' status when active is false", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ markets: [] }),
      });
      await adapter.getMarkets({ active: false });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("status=finalized");
    });

    it("maps market without close_time or title using ticker fallback", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          markets: [
            {
              ticker: "SOME-MKT",
              title: undefined,
              status: "finalized",
              category: "Crypto",
            },
          ],
        }),
      });
      const result = await adapter.getMarkets({});
      expect(result[0].title).toBe("SOME-MKT");
      expect(result[0].endDate).toBeUndefined();
      expect(result[0].closed).toBe(true);
    });
  });

  // ── getOrderBook ──────────────────────────────────────────────────────────

  describe("getOrderBook()", () => {
    it("maps Kalshi orderbook to OrderBook shape with normalized prices", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orderbook: {
            yes: [{ price: 45, quantity: 100 }],
            no: [{ price: 55, quantity: 80 }],
          },
        }),
      });
      const book = await adapter.getOrderBook("BTC-USD");
      expect(book.tokenId).toBe("BTC-USD");
      // yes bids become bids, no becomes asks (yes_bid ↔ no_ask)
      expect(book.bids[0].price).toBe("0.45");
      expect(book.asks[0].price).toBe("0.45"); // no=55 → 1 - 0.55 = 0.45 from yes perspective
    });

    it("handles missing yes/no arrays gracefully", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orderbook: { yes: undefined, no: undefined },
        }),
      });
      const book = await adapter.getOrderBook("EMPTY-MKT");
      expect(book.bids).toEqual([]);
      expect(book.asks).toEqual([]);
    });
  });

  // ── getPrice ──────────────────────────────────────────────────────────────

  describe("getPrice()", () => {
    it("returns normalized yes_bid price as string", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          market: {
            ticker: "BTC-USD",
            yes_bid: 45,
            status: "active",
          },
        }),
      });
      const price = await adapter.getPrice("BTC-USD");
      expect(price).toBe("0.45");
    });

    it("falls back to last_price when yes_bid is null", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          market: {
            ticker: "X",
            yes_bid: null,
            last_price: 60,
            status: "active",
          },
        }),
      });
      expect(await adapter.getPrice("X")).toBe("0.6");
    });

    it("falls back to 0 when both yes_bid and last_price are null", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          market: {
            ticker: "X",
            yes_bid: null,
            last_price: null,
            status: "active",
          },
        }),
      });
      expect(await adapter.getPrice("X")).toBe("0");
    });
  });

  // ── submitOrder ───────────────────────────────────────────────────────────

  describe("submitOrder()", () => {
    it("places order and returns VenueOrderResponse", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-99", status: "resting" },
        }),
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
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-1", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.yes_price).toBe(67);
    });

    it("maps SELL side to 'sell' action", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-s1", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.action).toBe("sell");
    });

    it("places 'no' side order when venueOutcomeId is 'no'", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-no1", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.side).toBe("no");
      expect(body.no_price).toBe(35);
      expect(body.yes_price).toBeUndefined();
    });

    it("places 'yes' side order by default when venueOutcomeId is not 'no'", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-y1", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.side).toBe("yes");
      expect(body.yes_price).toBe(65);
      expect(body.no_price).toBeUndefined();
    });
  });

  // ── cancelOrder ───────────────────────────────────────────────────────────

  describe("cancelOrder()", () => {
    it("calls cancelOrder on the REST client", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      await expect(
        adapter.cancelOrder("ord-123", { userId: "user-1" }),
      ).resolves.toBeUndefined();
      expect(fetchSpy.mock.calls[0][0]).toContain("/portfolio/orders/ord-123");
    });
  });

  // ── cancelAllOrders ───────────────────────────────────────────────────────

  describe("cancelAllOrders()", () => {
    it("fetches active orders and cancels each one", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            orders: [
              { order_id: "o1", status: "resting" },
              { order_id: "o2", status: "resting" },
            ],
          }),
        })
        .mockResolvedValue({ ok: true });

      await adapter.cancelAllOrders({ userId: "user-1" });
      // 1 getOrders + 2 cancels = 3 calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("skips orders that are not resting or pending", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            orders: [
              { order_id: "o1", status: "resting" },
              { order_id: "o2", status: "filled" },
              { order_id: "o3", status: "pending" },
            ],
          }),
        })
        .mockResolvedValue({ ok: true });
      await adapter.cancelAllOrders({ userId: "user-1" });
      // 1 getOrders + 2 cancels (o1 + o3, not o2)
      expect(fetchSpy).toHaveBeenCalledTimes(3);
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
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            market_positions: [
              {
                ticker: "BTC-USD",
                position: 10,
                resting_orders_count: 1,
                realized_pnl: "2.50",
                total_cost: "4.50",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            market: { ticker: "BTC-USD", yes_bid: 55, status: "active" },
          }),
        });
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
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            market_positions: [
              {
                ticker: "ETH-USD",
                position: -5,
                resting_orders_count: 0,
                total_cost: "2.00",
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            market: { ticker: "ETH-USD", yes_bid: 40, status: "active" },
          }),
        });
      const positions = await adapter.getPositions("user-1");
      expect(positions[0].outcome).toBe("no");
      expect(positions[0].size).toBe("5");
      expect(positions[0].currentPrice).toBe("0.6");
    });

    it("falls back to 0 price when market fetch fails", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            market_positions: [
              {
                ticker: "FAIL-MKT",
                position: 3,
                resting_orders_count: 0,
                total_cost: "1.50",
              },
            ],
          }),
        })
        .mockRejectedValueOnce(new Error("Network error"));
      const positions = await adapter.getPositions("user-1");
      expect(positions[0].currentPrice).toBe("0");
    });
  });

  // ── getOrderHistory ───────────────────────────────────────────────────────

  describe("getOrderHistory()", () => {
    it("maps Kalshi orders to VenueOrderHistory shape", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orders: [
            {
              order_id: "o1",
              ticker: "BTC-USD",
              side: "yes",
              action: "buy",
              count: 5,
              yes_price: 45,
              status: "filled",
              created_time: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      });
      const history = await adapter.getOrderHistory("user-1", 50);
      expect(history).toHaveLength(1);
      expect(history[0].venueOrderId).toBe("o1");
      expect(history[0].price).toBe("0.45");
    });

    it("maps sell action to SELL side and uses no_price fallback", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orders: [
            {
              order_id: "o2",
              ticker: "ETH-USD",
              action: "sell",
              count: 3,
              yes_price: null,
              no_price: 30,
              status: "filled",
              created_time: undefined,
            },
          ],
        }),
      });
      const history = await adapter.getOrderHistory("user-1", 50);
      expect(history[0].side).toBe("SELL");
      expect(history[0].price).toBe("0.3");
      expect(history[0].filledAt).toBeUndefined();
    });

    it("falls back to 0 when both yes_price and no_price are null", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orders: [
            {
              order_id: "o3",
              ticker: "X",
              action: "buy",
              count: 1,
              yes_price: null,
              no_price: null,
              status: "canceled",
              created_time: "2024-06-01T12:00:00Z",
            },
          ],
        }),
      });
      const history = await adapter.getOrderHistory("user-1", 10);
      expect(history[0].price).toBe("0");
      expect(history[0].filledAt).toBeInstanceOf(Date);
    });
  });

  // ── healthCheck ───────────────────────────────────────────────────────────

  describe("healthCheck()", () => {
    it("returns true when balance endpoint responds OK", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ balance: 100 }),
      });
      expect(await adapter.healthCheck()).toBe(true);
    });

    it("returns false when balance endpoint throws", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));
      expect(await adapter.healthCheck()).toBe(false);
    });
  });

  // ── getPriceHistory ───────────────────────────────────────────────────────

  describe("getPriceHistory()", () => {
    it("returns mapped candles for supported resolutions (1m, 1h, 1d)", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          candlesticks: [
            {
              end_period_ts: 1700000000,
              price: { open: 40, close: 45, high: 50, low: 35 },
              volume: 100,
            },
          ],
        }),
      });
      const candles = await adapter.getPriceHistory("BTC-USD", "1h");
      expect(candles).toHaveLength(1);
      expect(candles[0].open).toBe("0.4");
      expect(candles[0].close).toBe("0.45");
      expect(candles[0].high).toBe("0.5");
      expect(candles[0].low).toBe("0.35");
      expect(candles[0].volume).toBe(100);
      expect(candles[0].bucket).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it("returns empty array for unsupported resolutions (5m, 15m)", async () => {
      const candles5m = await adapter.getPriceHistory("BTC-USD", "5m");
      expect(candles5m).toEqual([]);
      const candles15m = await adapter.getPriceHistory("BTC-USD", "15m");
      expect(candles15m).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("passes correct period_interval for 1d resolution", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ candlesticks: [] }),
      });
      await adapter.getPriceHistory("MKT-1", "1d");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("period_interval=1440");
    });
  });

  // ── Phase 5b: _dollars field support in submitOrder ───────────────────────

  describe("submitOrder() modern fields", () => {
    it("sends yes_price_dollars alongside yes_price", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-d1", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.yes_price_dollars).toBe("0.4567");
      expect(body.yes_price).toBe(46);
    });

    it("sends no_price_dollars for no-side orders", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-nd1", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.no_price_dollars).toBe("0.3500");
      expect(body.no_price).toBe(35);
      expect(body.yes_price_dollars).toBeUndefined();
    });

    it("sends self_trade_prevention_type defaulting to taker_at_cross", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-stp", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.self_trade_prevention_type).toBe("taker_at_cross");
    });

    it("sends maker self_trade_prevention_type from authContext", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-stpm", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.self_trade_prevention_type).toBe("maker");
    });

    it("sends post_only=true for POST_ONLY orderType", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-po", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.post_only).toBe(true);
    });

    it("sends reduce_only from authContext", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-ro", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.reduce_only).toBe(true);
    });

    it("sends cancel_order_on_pause from authContext", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-cop", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.cancel_order_on_pause).toBe(true);
    });

    it("sends client_order_id from authContext", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-coi", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.client_order_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("sends count_fp for fractional contract sizes", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-fp", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.count_fp).toBe("5.50");
      expect(body.count).toBe(5);
    });

    it("omits count_fp for integer contract sizes", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-int", status: "resting" },
        }),
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
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.count_fp).toBeUndefined();
      expect(body.count).toBe(10);
    });
  });

  // ── Phase 5b: _dollars field support in getPrice ──────────────────────────

  describe("getPrice() _dollars support", () => {
    it("prefers yes_bid_dollars over integer yes_bid", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          market: {
            ticker: "BTC-USD",
            yes_bid: 45,
            yes_bid_dollars: "0.4567",
            status: "active",
          },
        }),
      });
      const price = await adapter.getPrice("BTC-USD");
      expect(price).toBe("0.4567");
    });

    it("prefers last_price_dollars when yes_bid_dollars is absent", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          market: {
            ticker: "X",
            yes_bid: null,
            last_price: 60,
            last_price_dollars: "0.6050",
            status: "active",
          },
        }),
      });
      expect(await adapter.getPrice("X")).toBe("0.605");
    });
  });

  // ── Phase 5b: count_fp in getOrderHistory ─────────────────────────────────

  describe("getOrderHistory() modern fields", () => {
    it("uses count_fp for order size when available", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orders: [
            {
              order_id: "o-fp",
              ticker: "BTC-USD",
              action: "buy",
              count: 5,
              count_fp: "5.50",
              yes_price: 45,
              yes_price_dollars: "0.4567",
              status: "filled",
              created_time: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      });
      const history = await adapter.getOrderHistory("user-1", 50);
      expect(history[0].size).toBe("5.50");
      expect(history[0].price).toBe("0.4567");
    });

    it("falls back to integer count when count_fp is absent", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orders: [
            {
              order_id: "o-int",
              ticker: "BTC-USD",
              action: "buy",
              count: 10,
              yes_price: 45,
              status: "filled",
            },
          ],
        }),
      });
      const history = await adapter.getOrderHistory("user-1", 50);
      expect(history[0].size).toBe("10");
    });
  });
});
