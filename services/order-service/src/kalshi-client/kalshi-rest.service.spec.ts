import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { KalshiAuthService } from "./kalshi-auth.service";
import { KalshiRestService } from "./kalshi-rest.service";

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

function makeAuth(token = "test.jwt.token"): KalshiAuthService {
  return { getToken: vi.fn().mockResolvedValue(token) } as any;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("KalshiRestService", () => {
  let svc: KalshiRestService;
  let auth: KalshiAuthService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    auth = makeAuth();
    svc = new KalshiRestService(auth, makeConfig());
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Authorization header ──────────────────────────────────────────────────

  describe("Authorization", () => {
    it("attaches Bearer JWT on every request", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ markets: [] }),
      });
      await svc.getMarkets({});
      const headers = fetchSpy.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["Authorization"]).toBe("Bearer test.jwt.token");
    });

    it("calls auth.getToken before each request", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ markets: [] }),
      });
      await svc.getMarkets({});
      expect(auth.getToken).toHaveBeenCalledOnce();
    });
  });

  // ── getMarkets ────────────────────────────────────────────────────────────

  describe("getMarkets()", () => {
    it("GETs /markets", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ markets: [] }),
      });
      await svc.getMarkets({});
      expect(fetchSpy.mock.calls[0][0]).toContain("/markets");
    });

    it("passes limit and offset as query params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ markets: [] }),
      });
      await svc.getMarkets({ limit: 50, offset: 100 });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("limit=50");
      expect(url).toContain("cursor=100");
    });

    it("returns the markets array", async () => {
      const markets = [{ ticker: "BTC-USD", status: "active" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ markets }),
      });
      const result = await svc.getMarkets({});
      expect(result).toEqual(markets);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("internal error"),
      });
      await expect(svc.getMarkets({})).rejects.toThrow("500");
    });
  });

  // ── getMarket ─────────────────────────────────────────────────────────────

  describe("getMarket()", () => {
    it("GETs /markets/:ticker", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ market: { ticker: "BTC-USD" } }),
      });
      await svc.getMarket("BTC-USD");
      expect(fetchSpy.mock.calls[0][0]).toContain("/markets/BTC-USD");
    });

    it("returns the market object", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          market: { ticker: "ETH-USD", status: "active" },
        }),
      });
      const m = await svc.getMarket("ETH-USD");
      expect(m.ticker).toBe("ETH-USD");
    });
  });

  // ── getOrderBook ──────────────────────────────────────────────────────────

  describe("getOrderBook()", () => {
    it("GETs /markets/:ticker/orderbook", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orderbook: { yes: [], no: [] } }),
      });
      await svc.getOrderBook("BTC-USD");
      expect(fetchSpy.mock.calls[0][0]).toContain("/markets/BTC-USD/orderbook");
    });

    it("returns the orderbook object", async () => {
      const orderbook = {
        yes: [{ price: 45, quantity: 100 }],
        no: [{ price: 55, quantity: 80 }],
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orderbook }),
      });
      const result = await svc.getOrderBook("BTC-USD");
      expect(result.yes).toHaveLength(1);
    });
  });

  // ── placeOrder ────────────────────────────────────────────────────────────

  describe("placeOrder()", () => {
    it("POSTs to /portfolio/orders", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-1", status: "resting" },
        }),
      });
      await svc.placeOrder({
        ticker: "BTC-USD",
        side: "yes",
        action: "buy",
        count: 10,
        type: "limit",
        yes_price: 45,
      });
      expect(fetchSpy.mock.calls[0][0]).toContain("/portfolio/orders");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
    });

    it("returns the order response", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-42", status: "resting" },
        }),
      });
      const result = await svc.placeOrder({
        ticker: "BTC-USD",
        side: "yes",
        action: "buy",
        count: 5,
        type: "limit",
        yes_price: 50,
      });
      expect(result.order_id).toBe("ord-42");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("insufficient funds"),
      });
      await expect(
        svc.placeOrder({
          ticker: "BTC-USD",
          side: "yes",
          action: "buy",
          count: 1,
          type: "limit",
          yes_price: 50,
        }),
      ).rejects.toThrow("400");
    });
  });

  // ── cancelOrder ───────────────────────────────────────────────────────────

  describe("cancelOrder()", () => {
    it("DELETEs /portfolio/orders/:orderId", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      await svc.cancelOrder("ord-123");
      expect(fetchSpy.mock.calls[0][0]).toContain("/portfolio/orders/ord-123");
      expect(fetchSpy.mock.calls[0][1].method).toBe("DELETE");
    });

    it("resolves without error on success", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      await expect(svc.cancelOrder("ord-123")).resolves.toBeUndefined();
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("order not found"),
      });
      await expect(svc.cancelOrder("ord-bad")).rejects.toThrow("404");
    });
  });

  // ── getPositions ──────────────────────────────────────────────────────────

  describe("getPositions()", () => {
    it("GETs /portfolio/positions", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ market_positions: [] }),
      });
      await svc.getPositions("user-1");
      expect(fetchSpy.mock.calls[0][0]).toContain("/portfolio/positions");
    });

    it("returns the positions array", async () => {
      const positions = [
        { ticker: "BTC-USD", position: 10, resting_orders_count: 1 },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ market_positions: positions }),
      });
      const result = await svc.getPositions("user-1");
      expect(result).toHaveLength(1);
    });
  });

  // ── getOrders ─────────────────────────────────────────────────────────────

  describe("getOrders()", () => {
    it("GETs /portfolio/orders", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orders: [] }),
      });
      await svc.getOrders("user-1", 50);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/portfolio/orders");
    });

    it("passes limit as query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orders: [] }),
      });
      await svc.getOrders("user-1", 25);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("limit=25");
    });
  });

  // ── 429 retry ─────────────────────────────────────────────────────────────

  describe("429 retry behaviour", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries getMarkets on 429 and succeeds on next attempt", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ markets: [{ ticker: "BTC-USD" }] }),
        });

      const promise = svc.getMarkets({});
      await vi.advanceTimersByTimeAsync(600);
      const result = await promise;
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
    });

    it("exhausts 3 retries on repeated 429 and throws", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue("rate limited"),
      });

      const promise = svc.getMarkets({});
      const assertion = expect(promise).rejects.toThrow("429");
      await vi.advanceTimersByTimeAsync(4000);
      await assertion;
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it("does NOT retry on 500", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("error"),
      });
      await expect(svc.getMarkets({})).rejects.toThrow("500");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── getCandlesticks ──────────────────────────────────────────────────────

  describe("getCandlesticks()", () => {
    it("fetches candlesticks for a given ticker and period interval", async () => {
      const candles = [
        {
          end_period_ts: 1700000000,
          price: { open: 40, close: 45, high: 50, low: 35 },
          volume: 200,
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ candlesticks: candles }),
      });

      const result = await svc.getCandlesticks("BTC-USD", 60);
      expect(result).toEqual(candles);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/markets/BTC-USD/candlesticks");
      expect(url).toContain("period_interval=60");
      expect(url).toContain("series_ticker=BTC-USD");
    });

    it("returns empty array when API returns no candlesticks field", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      const result = await svc.getCandlesticks("X", 1);
      expect(result).toEqual([]);
    });
  });

  // ── Phase 2: getEvents ─────────────────────────────────────────────────

  describe("getEvents()", () => {
    it("GETs /events with default params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ events: [], cursor: "" }),
      });
      await svc.getEvents();
      expect(fetchSpy.mock.calls[0][0]).toContain("/events?");
    });

    it("passes status and series_ticker query params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ events: [], cursor: "" }),
      });
      await svc.getEvents({ status: "open", series_ticker: "ECON" });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("status=open");
      expect(url).toContain("series_ticker=ECON");
    });

    it("returns events array and cursor", async () => {
      const events = [{ event_ticker: "EVT-1", title: "Test" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ events, cursor: "next-page" }),
      });
      const result = await svc.getEvents({ limit: 10 });
      expect(result.events).toEqual(events);
      expect(result.cursor).toBe("next-page");
    });
  });

  // ── Phase 2: getEvent ──────────────────────────────────────────────────

  describe("getEvent()", () => {
    it("GETs /events/:ticker", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          event: { event_ticker: "EVT-1" },
          markets: [],
        }),
      });
      await svc.getEvent("EVT-1");
      expect(fetchSpy.mock.calls[0][0]).toContain("/events/EVT-1");
    });

    it("passes with_nested_markets when requested", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          event: { event_ticker: "EVT-1" },
          markets: [],
        }),
      });
      await svc.getEvent("EVT-1", true);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("with_nested_markets=true");
    });
  });

  // ── Phase 2: getEventMetadata ──────────────────────────────────────────

  describe("getEventMetadata()", () => {
    it("GETs /events/:ticker/metadata", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          image_url: "https://img.test/1.png",
          market_details: [],
          settlement_sources: [],
        }),
      });
      await svc.getEventMetadata("EVT-1");
      expect(fetchSpy.mock.calls[0][0]).toContain("/events/EVT-1/metadata");
    });
  });

  // ── Phase 2: getForecastPercentileHistory ───────────────────────────────

  describe("getForecastPercentileHistory()", () => {
    it("GETs the forecast percentile history path", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ forecast_history: [] }),
      });
      await svc.getForecastPercentileHistory({
        series_ticker: "SER-1",
        event_ticker: "EVT-1",
        percentiles: [2500, 5000, 7500],
        start_ts: 1700000000,
        end_ts: 1700100000,
        period_interval: 60,
      });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain(
        "/series/SER-1/events/EVT-1/forecast_percentile_history",
      );
      expect(url).toContain("start_ts=1700000000");
      expect(url).toContain("period_interval=60");
    });

    it("returns empty array when API returns no data", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });
      const result = await svc.getForecastPercentileHistory({
        series_ticker: "S",
        event_ticker: "E",
        percentiles: [5000],
        start_ts: 0,
        end_ts: 1,
        period_interval: 1,
      });
      expect(result).toEqual([]);
    });
  });

  // ── Phase 2: getMultivariateCollection ─────────────────────────────────

  describe("getMultivariateCollection()", () => {
    it("GETs /multivariate_event_collections/:ticker", async () => {
      const collection = {
        collection_ticker: "MV-1",
        title: "Test",
        size_min: 2,
        size_max: 5,
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ multivariate_contract: collection }),
      });
      const result = await svc.getMultivariateCollection("MV-1");
      expect(result.collection_ticker).toBe("MV-1");
      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/multivariate_event_collections/MV-1",
      );
    });
  });

  // ── Phase 2: amendOrder ────────────────────────────────────────────────

  describe("amendOrder()", () => {
    it("POSTs to /portfolio/orders/:id/amend", async () => {
      const response = {
        old_order: { order_id: "ord-1", status: "resting" },
        order: { order_id: "ord-1", status: "resting", yes_price: 60 },
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(response),
      });
      const result = await svc.amendOrder("ord-1", {
        ticker: "BTC-USD",
        side: "yes",
        action: "buy",
        yes_price: 60,
        count: 5,
      });
      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/portfolio/orders/ord-1/amend",
      );
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      expect(result.order.order_id).toBe("ord-1");
    });
  });

  // ── Phase 2: decreaseOrder ─────────────────────────────────────────────

  describe("decreaseOrder()", () => {
    it("POSTs to /portfolio/orders/:id/decrease", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-1", remaining_count: 3 },
        }),
      });
      const result = await svc.decreaseOrder("ord-1", { reduce_by: 2 });
      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/portfolio/orders/ord-1/decrease",
      );
      expect(result.remaining_count).toBe(3);
    });

    it("supports reduce_to parameter", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          order: { order_id: "ord-2", remaining_count: 1 },
        }),
      });
      await svc.decreaseOrder("ord-2", { reduce_to: 1 });
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.reduce_to).toBe(1);
    });
  });

  // ── Phase 2: batchCreateOrders ─────────────────────────────────────────

  describe("batchCreateOrders()", () => {
    it("POSTs to /portfolio/orders/batched", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orders: [
            { order: { order_id: "o-1" } },
            { order: { order_id: "o-2" } },
          ],
        }),
      });
      const result = await svc.batchCreateOrders([
        {
          ticker: "T1",
          side: "yes",
          action: "buy",
          count: 1,
          type: "limit",
          yes_price: 50,
        },
        {
          ticker: "T2",
          side: "no",
          action: "sell",
          count: 2,
          type: "limit",
          no_price: 40,
        },
      ]);
      expect(fetchSpy.mock.calls[0][0]).toContain("/portfolio/orders/batched");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      expect(result).toHaveLength(2);
    });
  });

  // ── Phase 2: batchCancelOrders ─────────────────────────────────────────

  describe("batchCancelOrders()", () => {
    it("DELETEs /portfolio/orders/batched with body", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orders: [{ order_id: "o-1", reduced_by: 5 }],
        }),
      });
      const result = await svc.batchCancelOrders(["o-1"]);
      expect(fetchSpy.mock.calls[0][0]).toContain("/portfolio/orders/batched");
      expect(fetchSpy.mock.calls[0][1].method).toBe("DELETE");
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.ids).toEqual(["o-1"]);
      expect(result[0].reduced_by).toBe(5);
    });
  });

  // ── Phase 2: getFills ──────────────────────────────────────────────────

  describe("getFills()", () => {
    it("GETs /portfolio/fills with optional filters", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ fills: [], cursor: "" }),
      });
      await svc.getFills({ ticker: "BTC-USD", limit: 10 });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/portfolio/fills");
      expect(url).toContain("ticker=BTC-USD");
      expect(url).toContain("limit=10");
    });

    it("returns fills and cursor", async () => {
      const fills = [
        {
          fill_id: "f-1",
          trade_id: "t-1",
          order_id: "o-1",
          ticker: "BTC",
          side: "yes",
          action: "buy",
          count: 5,
          yes_price: 50,
          no_price: 50,
          is_taker: true,
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ fills, cursor: "pg2" }),
      });
      const result = await svc.getFills();
      expect(result.fills).toHaveLength(1);
      expect(result.cursor).toBe("pg2");
    });
  });

  // ── Phase 2: getSettlements ────────────────────────────────────────────

  describe("getSettlements()", () => {
    it("GETs /portfolio/settlements", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ settlements: [], cursor: "" }),
      });
      await svc.getSettlements({ ticker: "BTC-USD" });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/portfolio/settlements");
      expect(url).toContain("ticker=BTC-USD");
    });

    it("returns settlements and cursor", async () => {
      const settlements = [
        {
          ticker: "BTC",
          event_ticker: "E-1",
          market_result: "yes",
          yes_count: 10,
          no_count: 0,
          yes_total_cost: 500,
          no_total_cost: 0,
          revenue: 1000,
          settled_time: "2026-01-01T00:00:00Z",
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ settlements, cursor: "" }),
      });
      const result = await svc.getSettlements();
      expect(result.settlements).toHaveLength(1);
      expect(result.settlements[0].market_result).toBe("yes");
    });
  });

  // ── Phase 2: getOrderBooks (batch) ─────────────────────────────────────

  describe("getOrderBooks()", () => {
    it("fetches multiple orderbooks in parallel", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orderbook: { yes: [], no: [] } }),
      });
      const result = await svc.getOrderBooks(["T1", "T2", "T3"]);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(result.size).toBe(3);
    });

    it("skips failed tickers without throwing", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ orderbook: { yes: [], no: [] } }),
        })
        .mockRejectedValueOnce(new Error("network error"));
      const result = await svc.getOrderBooks(["T1", "T2"]);
      expect(result.size).toBe(1);
      expect(result.has("T1")).toBe(true);
      expect(result.has("T2")).toBe(false);
    });
  });

  // ── Phase 2: getExchangeStatus ─────────────────────────────────────────

  describe("getExchangeStatus()", () => {
    it("GETs /exchange/status", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          exchange_active: true,
          trading_active: true,
        }),
      });
      const result = await svc.getExchangeStatus();
      expect(fetchSpy.mock.calls[0][0]).toContain("/exchange/status");
      expect(result.exchange_active).toBe(true);
      expect(result.trading_active).toBe(true);
    });
  });

  // ── Phase 2: getExchangeSchedule ───────────────────────────────────────

  describe("getExchangeSchedule()", () => {
    it("GETs /exchange/schedule and unwraps the schedule", async () => {
      const schedule = {
        standard_hours: [],
        maintenance_windows: [],
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ schedule }),
      });
      const result = await svc.getExchangeSchedule();
      expect(fetchSpy.mock.calls[0][0]).toContain("/exchange/schedule");
      expect(result.standard_hours).toEqual([]);
      expect(result.maintenance_windows).toEqual([]);
    });
  });

  // ── Phase 2: getTrades ─────────────────────────────────────────────────

  describe("getTrades()", () => {
    it("GETs /markets/trades with filters", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ trades: [], cursor: "" }),
      });
      await svc.getTrades({ ticker: "BTC-USD", limit: 50 });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/markets/trades");
      expect(url).toContain("ticker=BTC-USD");
      expect(url).toContain("limit=50");
    });

    it("returns trades and cursor", async () => {
      const trades = [
        {
          trade_id: "t-1",
          ticker: "BTC",
          count: 10,
          yes_price: 55,
          no_price: 45,
          taker_side: "yes",
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ trades, cursor: "pg2" }),
      });
      const result = await svc.getTrades();
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].taker_side).toBe("yes");
      expect(result.cursor).toBe("pg2");
    });
  });

  // ── Price normalization ───────────────────────────────────────────────────

  describe("normalizeKalshiPrice()", () => {
    it("normalizes 1 → 0.01", () => {
      expect(KalshiRestService.normalizeKalshiPrice(1)).toBeCloseTo(0.01, 10);
    });

    it("normalizes 50 → 0.50", () => {
      expect(KalshiRestService.normalizeKalshiPrice(50)).toBeCloseTo(0.5, 10);
    });

    it("normalizes 99 → 0.99", () => {
      expect(KalshiRestService.normalizeKalshiPrice(99)).toBeCloseTo(0.99, 10);
    });

    it("denormalizes 0.01 → 1", () => {
      expect(KalshiRestService.denormalizeKalshiPrice(0.01)).toBe(1);
    });

    it("denormalizes 0.50 → 50", () => {
      expect(KalshiRestService.denormalizeKalshiPrice(0.5)).toBe(50);
    });

    it("denormalizes 0.99 → 99", () => {
      expect(KalshiRestService.denormalizeKalshiPrice(0.99)).toBe(99);
    });
  });
});
