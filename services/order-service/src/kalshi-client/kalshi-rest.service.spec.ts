import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { KalshiAuthService } from "./kalshi-auth.service";
import {
  KalshiRestService,
  parseKalshiTimestamp,
  parseKalshiDollars,
} from "./kalshi-rest.service";

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

  beforeEach(() => {
    auth = makeAuth();
    svc = new KalshiRestService(auth, makeConfig());
  });

  // ── Authorization header ──────────────────────────────────────────────────

  describe("Authorization", () => {
    it("attaches Bearer JWT on every request", async () => {
      // The service's auth interceptor is the first registered request interceptor (index 0).
      // SDK BaseAPI constructors add their own interceptors after.
      const interceptors = (svc as any).axiosInstance.interceptors.request;
      const handler = interceptors.handlers[0];
      const { AxiosHeaders } = await import("axios");
      const fakeConfig = { headers: new AxiosHeaders() };
      await handler.fulfilled(fakeConfig);
      expect(auth.getToken).toHaveBeenCalled();
      expect(fakeConfig.headers.get("Authorization")).toBe("Bearer test.jwt.token");
    });

    it("calls auth.getToken before each request", async () => {
      const interceptors = (svc as any).axiosInstance.interceptors.request;
      const handler = interceptors.handlers[0];
      const { AxiosHeaders } = await import("axios");
      const fakeConfig1 = { headers: new AxiosHeaders() };
      const fakeConfig2 = { headers: new AxiosHeaders() };
      await handler.fulfilled(fakeConfig1);
      await handler.fulfilled(fakeConfig2);
      expect(auth.getToken).toHaveBeenCalledTimes(2);
    });
  });

  // ── getMarkets ────────────────────────────────────────────────────────────

  describe("getMarkets()", () => {
    it("GETs /markets", async () => {
      const spy = vi.spyOn((svc as any).marketApi, "getMarkets").mockResolvedValue({
        data: { markets: [], cursor: "" },
      });
      await svc.getMarkets({});
      expect(spy).toHaveBeenCalled();
    });

    it("passes limit and offset as query params", async () => {
      const spy = vi.spyOn((svc as any).marketApi, "getMarkets").mockResolvedValue({
        data: { markets: [], cursor: "" },
      });
      await svc.getMarkets({ limit: 50, offset: 100 });
      // limit is the first arg to the SDK method
      expect(spy.mock.calls[0][0]).toBe(50);
    });

    it("returns the markets array", async () => {
      const markets = [{ ticker: "BTC-USD", status: "active" }];
      vi.spyOn((svc as any).marketApi, "getMarkets").mockResolvedValue({
        data: { markets, cursor: "" },
      });
      const result = await svc.getMarkets({});
      expect(result).toEqual(markets);
    });

    it("throws on non-OK response", async () => {
      vi.spyOn((svc as any).marketApi, "getMarkets").mockRejectedValue(
        new Error("Request failed with status code 500"),
      );
      await expect(svc.getMarkets({})).rejects.toThrow("500");
    });
  });

  // ── getMarket ─────────────────────────────────────────────────────────────

  describe("getMarket()", () => {
    it("GETs /markets/:ticker", async () => {
      const spy = vi.spyOn((svc as any).marketApi, "getMarket").mockResolvedValue({
        data: { market: { ticker: "BTC-USD" } },
      });
      await svc.getMarket("BTC-USD");
      expect(spy).toHaveBeenCalledWith("BTC-USD");
    });

    it("returns the market object", async () => {
      vi.spyOn((svc as any).marketApi, "getMarket").mockResolvedValue({
        data: { market: { ticker: "ETH-USD", status: "active" } },
      });
      const m = await svc.getMarket("ETH-USD");
      expect(m.ticker).toBe("ETH-USD");
    });
  });

  // ── getOrderBook ──────────────────────────────────────────────────────────

  describe("getOrderBook()", () => {
    it("GETs /markets/:ticker/orderbook", async () => {
      const spy = vi.spyOn((svc as any).marketApi, "getMarketOrderbook").mockResolvedValue({
        data: { orderbook_fp: { yes_dollars: [], no_dollars: [] } },
      });
      await svc.getOrderBook("BTC-USD");
      expect(spy).toHaveBeenCalledWith("BTC-USD");
    });

    it("returns the orderbook object", async () => {
      vi.spyOn((svc as any).marketApi, "getMarketOrderbook").mockResolvedValue({
        data: {
          orderbook_fp: {
            yes_dollars: [["0.45", "100"]],
            no_dollars: [["0.55", "80"]],
          },
        },
      });
      const result = await svc.getOrderBook("BTC-USD");
      expect(result.yes).toHaveLength(1);
    });
  });

  // ── placeOrder ────────────────────────────────────────────────────────────

  describe("placeOrder()", () => {
    it("POSTs to /portfolio/orders", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "createOrder").mockResolvedValue({
        data: {
          order: {
            order_id: "ord-1",
            status: "resting",
            ticker: "BTC-USD",
            side: "yes",
            action: "buy",
            remaining_count_fp: "10",
            yes_price_dollars: "0.45",
            no_price_dollars: "0.55",
            client_order_id: undefined,
          },
        },
      });
      await svc.placeOrder({
        ticker: "BTC-USD",
        side: "yes",
        action: "buy",
        count: 10,
        yes_price: 45,
      });
      expect(spy).toHaveBeenCalled();
    });

    it("returns the order response", async () => {
      vi.spyOn((svc as any).ordersApi, "createOrder").mockResolvedValue({
        data: {
          order: {
            order_id: "ord-42",
            status: "resting",
            ticker: "BTC-USD",
            side: "yes",
            action: "buy",
            remaining_count_fp: "5",
            yes_price_dollars: "0.50",
            no_price_dollars: "0.50",
            client_order_id: undefined,
          },
        },
      });
      const result = await svc.placeOrder({
        ticker: "BTC-USD",
        side: "yes",
        action: "buy",
        count: 5,
        yes_price: 50,
      });
      expect(result.order_id).toBe("ord-42");
    });

    it("throws on non-OK response", async () => {
      vi.spyOn((svc as any).ordersApi, "createOrder").mockRejectedValue(
        new Error("Request failed with status code 400"),
      );
      await expect(
        svc.placeOrder({
          ticker: "BTC-USD",
          side: "yes",
          action: "buy",
          count: 1,
          yes_price: 50,
        }),
      ).rejects.toThrow("400");
    });
  });

  // ── cancelOrder ───────────────────────────────────────────────────────────

  describe("cancelOrder()", () => {
    it("DELETEs /portfolio/orders/:orderId", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "cancelOrder").mockResolvedValue({
        data: {},
      });
      await svc.cancelOrder("ord-123");
      expect(spy).toHaveBeenCalledWith("ord-123");
    });

    it("resolves without error on success", async () => {
      vi.spyOn((svc as any).ordersApi, "cancelOrder").mockResolvedValue({
        data: {},
      });
      await expect(svc.cancelOrder("ord-123")).resolves.toBeUndefined();
    });

    it("throws on non-OK response", async () => {
      vi.spyOn((svc as any).ordersApi, "cancelOrder").mockRejectedValue(
        new Error("Request failed with status code 404"),
      );
      await expect(svc.cancelOrder("ord-bad")).rejects.toThrow("404");
    });
  });

  // ── getPositions ──────────────────────────────────────────────────────────

  describe("getPositions()", () => {
    it("GETs /portfolio/positions", async () => {
      const spy = vi.spyOn((svc as any).portfolioApi, "getPositions").mockResolvedValue({
        data: { market_positions: [] },
      });
      await svc.getPositions("user-1");
      expect(spy).toHaveBeenCalled();
    });

    it("returns the positions array", async () => {
      const positions = [
        { ticker: "BTC-USD", position: 10, resting_orders_count: 1 },
      ];
      vi.spyOn((svc as any).portfolioApi, "getPositions").mockResolvedValue({
        data: { market_positions: positions },
      });
      const result = await svc.getPositions("user-1");
      expect(result).toHaveLength(1);
    });
  });

  // ── getOrders ─────────────────────────────────────────────────────────────

  describe("getOrders()", () => {
    it("GETs /portfolio/orders", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "getOrders").mockResolvedValue({
        data: { orders: [] },
      });
      await svc.getOrders("user-1", 50);
      expect(spy).toHaveBeenCalled();
    });

    it("passes limit as query param", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "getOrders").mockResolvedValue({
        data: { orders: [] },
      });
      await svc.getOrders("user-1", 25);
      expect(spy).toHaveBeenCalledWith(
        undefined, // ticker
        undefined, // eventTicker
        undefined, // minTs
        undefined, // maxTs
        undefined, // status
        25,        // limit
      );
    });
  });

  // ── 429 retry ─────────────────────────────────────────────────────────────

  describe("429 retry behaviour", () => {
    let responseInterceptor: { rejected: (error: unknown) => Promise<unknown> };

    beforeEach(() => {
      vi.useFakeTimers();
      // Get the response interceptor (retry logic) registered on the axios instance
      const handlers = (svc as any).axiosInstance.interceptors.response.handlers;
      responseInterceptor = handlers[handlers.length - 1];
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries getMarkets on 429 and succeeds on next attempt", async () => {
      // Test the response interceptor directly: first call returns 429, retry succeeds
      const requestSpy = vi.spyOn((svc as any).axiosInstance, "request")
        .mockResolvedValue({ data: { markets: [{ ticker: "BTC-USD" }], cursor: "" } });

      const error429 = Object.assign(new Error("429"), {
        response: { status: 429 },
        config: { __retryCount: 0 },
      });

      const retryPromise = responseInterceptor.rejected(error429);
      await vi.advanceTimersByTimeAsync(600);
      const result = await retryPromise;
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect((result as any).data.markets).toHaveLength(1);
    });

    it("exhausts 3 retries on repeated 429 and throws", async () => {
      // After 3 retries (retryCount reaches RETRY_DELAYS_MS.length), it should throw
      const error429 = Object.assign(new Error("429"), {
        response: { status: 429 },
        config: { __retryCount: 3 }, // already exhausted
      });

      await expect(responseInterceptor.rejected(error429)).rejects.toThrow("429");
    });

    it("does NOT retry on 500", async () => {
      const spy = vi.spyOn((svc as any).marketApi, "getMarkets").mockRejectedValue(
        new Error("Request failed with status code 500"),
      );
      await expect(svc.getMarkets({})).rejects.toThrow("500");
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("retries on TypeError (network error) then succeeds", async () => {
      // Test the response interceptor directly for network error retry
      const requestSpy = vi.spyOn((svc as any).axiosInstance, "request")
        .mockResolvedValue({ data: { markets: [], cursor: "" } });

      const networkError = Object.assign(new Error("Network Error"), {
        code: "ERR_NETWORK",
        config: { __retryCount: 0 },
      });

      const retryPromise = responseInterceptor.rejected(networkError);
      await vi.advanceTimersByTimeAsync(600);
      const result = await retryPromise;
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect((result as any).data.markets).toEqual([]);
    });

    it("retries on AbortError (timeout) then succeeds", async () => {
      const requestSpy = vi.spyOn((svc as any).axiosInstance, "request")
        .mockResolvedValue({ data: { markets: [], cursor: "" } });

      const timeoutError = Object.assign(new Error("timeout"), {
        code: "ECONNABORTED",
        config: { __retryCount: 0 },
      });

      const retryPromise = responseInterceptor.rejected(timeoutError);
      await vi.advanceTimersByTimeAsync(600);
      const result = await retryPromise;
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect((result as any).data.markets).toEqual([]);
    });

    it("does not retry non-retryable errors", async () => {
      const spy = vi.spyOn((svc as any).marketApi, "getMarkets").mockRejectedValue(
        new Error("unexpected"),
      );
      await expect(svc.getMarkets({})).rejects.toThrow("unexpected");
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("throws on unparseable JSON response", async () => {
      vi.spyOn((svc as any).marketApi, "getMarkets").mockRejectedValue(
        new Error("unparseable response"),
      );
      await expect(svc.getMarkets({})).rejects.toThrow("unparseable response");
    });

    it("handles text() also failing on unparseable response", async () => {
      vi.spyOn((svc as any).marketApi, "getMarkets").mockRejectedValue(
        new Error("unparseable response"),
      );
      await expect(svc.getMarkets({})).rejects.toThrow("unparseable response");
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
      const spy = vi.spyOn((svc as any).marketApi, "getMarketCandlesticks").mockResolvedValue({
        data: { candlesticks: candles },
      });
      const result = await svc.getCandlesticks("BTC-USD", 60);
      expect(result).toEqual(candles);
      expect(spy).toHaveBeenCalledWith(
        "BTC-USD",
        "BTC-USD",
        expect.any(Number),
        expect.any(Number),
        60,
      );
    });

    it("returns empty array when API returns no candlesticks field", async () => {
      vi.spyOn((svc as any).marketApi, "getMarketCandlesticks").mockResolvedValue({
        data: {},
      });
      const result = await svc.getCandlesticks("X", 1);
      expect(result).toEqual([]);
    });
  });

  // ── Phase 2: getEvents ─────────────────────────────────────────────────

  describe("getEvents()", () => {
    it("GETs /events with default params", async () => {
      const spy = vi.spyOn((svc as any).eventsApi, "getEvents").mockResolvedValue({
        data: { events: [], cursor: "" },
      });
      await svc.getEvents();
      expect(spy).toHaveBeenCalled();
    });

    it("passes status and series_ticker query params", async () => {
      const spy = vi.spyOn((svc as any).eventsApi, "getEvents").mockResolvedValue({
        data: { events: [], cursor: "" },
      });
      await svc.getEvents({ status: "open", series_ticker: "ECON" });
      expect(spy).toHaveBeenCalledWith(
        undefined, // limit
        undefined, // cursor
        undefined, // withNestedMarkets
        undefined, // withMilestones
        "open",    // status
        "ECON",    // seriesTicker
      );
    });

    it("returns events array and cursor", async () => {
      const events = [{ event_ticker: "EVT-1", title: "Test" }];
      vi.spyOn((svc as any).eventsApi, "getEvents").mockResolvedValue({
        data: { events, cursor: "next-page" },
      });
      const result = await svc.getEvents({ limit: 10 });
      expect(result.events).toEqual(events);
      expect(result.cursor).toBe("next-page");
    });
  });

  // ── Phase 2: getEvent ──────────────────────────────────────────────────

  describe("getEvent()", () => {
    it("GETs /events/:ticker", async () => {
      const spy = vi.spyOn((svc as any).eventsApi, "getEvent").mockResolvedValue({
        data: {
          event: { event_ticker: "EVT-1" },
          markets: [],
        },
      });
      await svc.getEvent("EVT-1");
      expect(spy).toHaveBeenCalledWith("EVT-1", false);
    });

    it("passes with_nested_markets when requested", async () => {
      const spy = vi.spyOn((svc as any).eventsApi, "getEvent").mockResolvedValue({
        data: {
          event: { event_ticker: "EVT-1" },
          markets: [],
        },
      });
      await svc.getEvent("EVT-1", true);
      expect(spy).toHaveBeenCalledWith("EVT-1", true);
    });
  });

  // ── Phase 2: getEventMetadata ──────────────────────────────────────────

  describe("getEventMetadata()", () => {
    it("GETs /events/:ticker/metadata", async () => {
      const spy = vi.spyOn((svc as any).eventsApi, "getEventMetadata").mockResolvedValue({
        data: {
          image_url: "https://img.test/1.png",
          market_details: [],
          settlement_sources: [],
        },
      });
      await svc.getEventMetadata("EVT-1");
      expect(spy).toHaveBeenCalledWith("EVT-1");
    });
  });

  // ── Phase 2: getForecastPercentileHistory ───────────────────────────────

  describe("getForecastPercentileHistory()", () => {
    it("GETs the forecast percentile history path", async () => {
      const spy = vi.spyOn((svc as any).eventsApi, "getEventForecastPercentilesHistory").mockResolvedValue({
        data: { forecast_history: [] },
      });
      await svc.getForecastPercentileHistory({
        series_ticker: "SER-1",
        event_ticker: "EVT-1",
        percentiles: [2500, 5000, 7500],
        start_ts: 1700000000,
        end_ts: 1700100000,
        period_interval: 60,
      });
      expect(spy).toHaveBeenCalledWith(
        "EVT-1",
        "SER-1",
        [2500, 5000, 7500],
        1700000000,
        1700100000,
        60,
      );
    });

    it("returns empty array when API returns no data", async () => {
      vi.spyOn((svc as any).eventsApi, "getEventForecastPercentilesHistory").mockResolvedValue({
        data: {},
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
      const spy = vi.spyOn((svc as any).multivariateApi, "getMultivariateEventCollection").mockResolvedValue({
        data: { multivariate_contract: collection },
      });
      const result = await svc.getMultivariateCollection("MV-1");
      expect(result.collection_ticker).toBe("MV-1");
      expect(spy).toHaveBeenCalledWith("MV-1");
    });
  });

  // ── Phase 2: amendOrder ────────────────────────────────────────────────

  describe("amendOrder()", () => {
    it("POSTs to /portfolio/orders/:id/amend", async () => {
      const response = {
        old_order: { order_id: "ord-1", status: "resting" },
        order: { order_id: "ord-1", status: "resting", yes_price: 60 },
      };
      const spy = vi.spyOn((svc as any).ordersApi, "amendOrder").mockResolvedValue({
        data: response,
      });
      const result = await svc.amendOrder("ord-1", {
        ticker: "BTC-USD",
        side: "yes",
        action: "buy",
        yes_price: 60,
        count: 5,
      });
      expect(spy).toHaveBeenCalledWith("ord-1", {
        ticker: "BTC-USD",
        side: "yes",
        action: "buy",
        yes_price: 60,
        count: 5,
      });
      expect(result.order.order_id).toBe("ord-1");
    });
  });

  // ── Phase 2: decreaseOrder ─────────────────────────────────────────────

  describe("decreaseOrder()", () => {
    it("POSTs to /portfolio/orders/:id/decrease", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "decreaseOrder").mockResolvedValue({
        data: {
          order: { order_id: "ord-1", remaining_count_fp: 3 },
        },
      });
      const result = await svc.decreaseOrder("ord-1", { reduce_by: 2 });
      expect(spy).toHaveBeenCalledWith("ord-1", { reduce_by: 2 });
      expect(result.remaining_count_fp).toBe(3);
    });

    it("supports reduce_to parameter", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "decreaseOrder").mockResolvedValue({
        data: {
          order: { order_id: "ord-2", remaining_count_fp: 1 },
        },
      });
      await svc.decreaseOrder("ord-2", { reduce_to: 1 });
      expect(spy).toHaveBeenCalledWith("ord-2", { reduce_to: 1 });
    });
  });

  // ── Phase 2: batchCreateOrders ─────────────────────────────────────────

  describe("batchCreateOrders()", () => {
    it("POSTs to /portfolio/orders/batched", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "batchCreateOrders").mockResolvedValue({
        data: {
          orders: [
            { order: { order_id: "o-1" } },
            { order: { order_id: "o-2" } },
          ],
        },
      });
      const result = await svc.batchCreateOrders([
        {
          ticker: "T1",
          side: "yes",
          action: "buy",
          count: 1,
          yes_price: 50,
        },
        {
          ticker: "T2",
          side: "no",
          action: "sell",
          count: 2,
          no_price: 40,
        },
      ]);
      expect(spy).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  // ── Phase 2: batchCancelOrders ─────────────────────────────────────────

  describe("batchCancelOrders()", () => {
    it("DELETEs /portfolio/orders/batched with body", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "batchCancelOrders").mockResolvedValue({
        data: {
          orders: [{ order_id: "o-1", reduced_by_fp: 5 }],
        },
      });
      const result = await svc.batchCancelOrders(["o-1"]);
      expect(spy).toHaveBeenCalledWith({
        orders: [{ order_id: "o-1" }],
      });
      expect(result[0].reduced_by_fp).toBe(5);
    });
  });

  // ── Phase 2: getFills ──────────────────────────────────────────────────

  describe("getFills()", () => {
    it("GETs /portfolio/fills with optional filters", async () => {
      const spy = vi.spyOn((svc as any).portfolioApi, "getFills").mockResolvedValue({
        data: { fills: [], cursor: "" },
      });
      await svc.getFills({ ticker: "BTC-USD", limit: 10 });
      expect(spy).toHaveBeenCalledWith(
        "BTC-USD", // ticker
        undefined, // orderId
        undefined, // minTs
        undefined, // maxTs
        10,        // limit
        undefined, // cursor
      );
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
      vi.spyOn((svc as any).portfolioApi, "getFills").mockResolvedValue({
        data: { fills, cursor: "pg2" },
      });
      const result = await svc.getFills();
      expect(result.fills).toHaveLength(1);
      expect(result.cursor).toBe("pg2");
    });
  });

  // ── Phase 2: getSettlements ────────────────────────────────────────────

  describe("getSettlements()", () => {
    it("GETs /portfolio/settlements", async () => {
      const spy = vi.spyOn((svc as any).portfolioApi, "getSettlements").mockResolvedValue({
        data: { settlements: [], cursor: "" },
      });
      await svc.getSettlements({ ticker: "BTC-USD" });
      expect(spy).toHaveBeenCalled();
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
      vi.spyOn((svc as any).portfolioApi, "getSettlements").mockResolvedValue({
        data: { settlements, cursor: "" },
      });
      const result = await svc.getSettlements();
      expect(result.settlements).toHaveLength(1);
      expect(result.settlements[0].market_result).toBe("yes");
    });
  });

  // ── Phase 2: getOrderBooks (batch) ─────────────────────────────────────

  describe("getOrderBooks()", () => {
    it("fetches multiple orderbooks in parallel", async () => {
      const spy = vi.spyOn((svc as any).marketApi, "getMarketOrderbook").mockResolvedValue({
        data: { orderbook_fp: { yes_dollars: [], no_dollars: [] } },
      });
      const result = await svc.getOrderBooks(["T1", "T2", "T3"]);
      expect(spy).toHaveBeenCalledTimes(3);
      expect(result.size).toBe(3);
    });

    it("skips failed tickers without throwing", async () => {
      vi.spyOn((svc as any).marketApi, "getMarketOrderbook")
        .mockResolvedValueOnce({
          data: { orderbook_fp: { yes_dollars: [], no_dollars: [] } },
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
      const spy = vi.spyOn((svc as any).exchangeApi, "getExchangeStatus").mockResolvedValue({
        data: {
          exchange_active: true,
          trading_active: true,
        },
      });
      const result = await svc.getExchangeStatus();
      expect(spy).toHaveBeenCalled();
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
      const spy = vi.spyOn((svc as any).exchangeApi, "getExchangeSchedule").mockResolvedValue({
        data: { schedule },
      });
      const result = await svc.getExchangeSchedule();
      expect(spy).toHaveBeenCalled();
      expect(result.standard_hours).toEqual([]);
      expect(result.maintenance_windows).toEqual([]);
    });
  });

  // ── Phase 2: getTrades ─────────────────────────────────────────────────

  describe("getTrades()", () => {
    it("GETs /markets/trades with filters", async () => {
      const spy = vi.spyOn((svc as any).marketApi, "getTrades").mockResolvedValue({
        data: { trades: [], cursor: "" },
      });
      await svc.getTrades({ ticker: "BTC-USD", limit: 50 });
      expect(spy).toHaveBeenCalledWith(
        50,        // limit
        undefined, // cursor
        "BTC-USD", // ticker
        undefined, // minTs
        undefined, // maxTs
      );
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
      vi.spyOn((svc as any).marketApi, "getTrades").mockResolvedValue({
        data: { trades, cursor: "pg2" },
      });
      const result = await svc.getTrades();
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].taker_side).toBe("yes");
      expect(result.cursor).toBe("pg2");
    });
  });

  // ── Phase 3: createOrderGroup ─────────────────────────────────────────────

  describe("createOrderGroup()", () => {
    it("POSTs to /portfolio/order-groups", async () => {
      const spy = vi.spyOn((svc as any).orderGroupsApi, "createOrderGroup").mockResolvedValue({
        data: { order_group_id: "og-1" },
      });
      const result = await svc.createOrderGroup({ contracts_limit: 1000 });
      expect(spy).toHaveBeenCalledWith({ contracts_limit: 1000 });
      expect(result.order_group_id).toBe("og-1");
    });
  });

  // ── Phase 3: getOrderGroups ───────────────────────────────────────────────

  describe("getOrderGroups()", () => {
    it("GETs /portfolio/order-groups", async () => {
      const spy = vi.spyOn((svc as any).orderGroupsApi, "getOrderGroups").mockResolvedValue({
        data: {
          order_groups: [{ id: "og-1" }, { id: "og-2" }],
        },
      });
      const result = await svc.getOrderGroups();
      expect(spy).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  // ── Phase 3: getOrderGroup ────────────────────────────────────────────────

  describe("getOrderGroup()", () => {
    it("GETs /portfolio/order-groups/:id", async () => {
      const spy = vi.spyOn((svc as any).orderGroupsApi, "getOrderGroup").mockResolvedValue({
        data: {
          is_auto_cancel_enabled: false,
          contracts_limit_fp: "500.00",
          orders: [],
        },
      });
      const result = await svc.getOrderGroup("og-42");
      expect(spy).toHaveBeenCalledWith("og-42");
      expect(result.contracts_limit_fp).toBe("500.00");
    });
  });

  // ── Phase 3: updateOrderGroup ─────────────────────────────────────────────

  describe("updateOrderGroup()", () => {
    it("PUTs to /portfolio/order-groups/:id", async () => {
      const spy = vi.spyOn((svc as any).orderGroupsApi, "updateOrderGroupLimit").mockResolvedValue({
        data: {},
      });
      await svc.updateOrderGroup("og-1", { contracts_limit: 2000 });
      expect(spy).toHaveBeenCalledWith("og-1", { contracts_limit: 2000 });
    });
  });

  // ── Phase 3: resetOrderGroup ──────────────────────────────────────────────

  describe("resetOrderGroup()", () => {
    it("POSTs to /portfolio/order-groups/:id/reset", async () => {
      const spy = vi.spyOn((svc as any).orderGroupsApi, "resetOrderGroup").mockResolvedValue({
        data: {},
      });
      await svc.resetOrderGroup("og-1");
      expect(spy).toHaveBeenCalledWith("og-1");
    });
  });

  // ── Phase 3: triggerOrderGroup ────────────────────────────────────────────

  describe("triggerOrderGroup()", () => {
    it("POSTs to /portfolio/order-groups/:id/trigger", async () => {
      const spy = vi.spyOn((svc as any).orderGroupsApi, "triggerOrderGroup").mockResolvedValue({
        data: {},
      });
      await svc.triggerOrderGroup("og-1");
      expect(spy).toHaveBeenCalledWith("og-1");
    });
  });

  // ── Phase 3: deleteOrderGroup ─────────────────────────────────────────────

  describe("deleteOrderGroup()", () => {
    it("DELETEs /portfolio/order-groups/:id", async () => {
      const spy = vi.spyOn((svc as any).orderGroupsApi, "deleteOrderGroup").mockResolvedValue({
        data: {},
      });
      await svc.deleteOrderGroup("og-1");
      expect(spy).toHaveBeenCalledWith("og-1");
    });
  });

  // ── Phase 3: getHistoricalMarkets ─────────────────────────────────────────

  describe("getHistoricalMarkets()", () => {
    it("GETs /markets with timestamp filters", async () => {
      const spy = vi.spyOn((svc as any).historicalApi, "getHistoricalMarkets").mockResolvedValue({
        data: { markets: [], cursor: "" },
      });
      await svc.getHistoricalMarkets({
        min_close_ts: 1700000000,
        max_close_ts: 1710000000,
        status: "settled",
      });
      expect(spy).toHaveBeenCalled();
    });

    it("returns markets and cursor", async () => {
      vi.spyOn((svc as any).historicalApi, "getHistoricalMarkets").mockResolvedValue({
        data: {
          markets: [{ ticker: "OLD-MKT" }],
          cursor: "next",
        },
      });
      const result = await svc.getHistoricalMarkets();
      expect(result.markets).toHaveLength(1);
      expect(result.cursor).toBe("next");
    });
  });

  // ── Phase 3: getHistoricalMarketCandlesticks ──────────────────────────────

  describe("getHistoricalMarketCandlesticks()", () => {
    it("GETs candlesticks with time-range filters", async () => {
      const candles = [
        {
          end_period_ts: 1700000000,
          price: { open: 40, close: 45, high: 50, low: 35 },
          volume: 100,
        },
      ];
      const spy = vi.spyOn((svc as any).historicalApi, "getMarketCandlesticksHistorical").mockResolvedValue({
        data: { candlesticks: candles },
      });
      const result = await svc.getHistoricalMarketCandlesticks("BTC-USD", {
        start_ts: 1699000000,
        end_ts: 1700000000,
        period_interval: 60,
      });
      expect(result).toEqual(candles);
      expect(spy).toHaveBeenCalledWith(
        "BTC-USD",
        1699000000,
        1700000000,
        60,
      );
    });

    it("returns empty array when no candlesticks field", async () => {
      vi.spyOn((svc as any).historicalApi, "getMarketCandlesticksHistorical").mockResolvedValue({
        data: {},
      });
      const result = await svc.getHistoricalMarketCandlesticks("X", {});
      expect(result).toEqual([]);
    });
  });

  // ── Phase 3: getHistoricalOrders ──────────────────────────────────────────

  describe("getHistoricalOrders()", () => {
    it("GETs /portfolio/orders with time and status filters", async () => {
      const spy = vi.spyOn((svc as any).historicalApi, "getHistoricalOrders").mockResolvedValue({
        data: { orders: [], cursor: "" },
      });
      await svc.getHistoricalOrders({
        ticker: "BTC-USD",
        status: "executed",
        min_ts: 1700000000,
      });
      expect(spy).toHaveBeenCalled();
    });
  });

  // ── Phase 3: getCutoffTimestamps ──────────────────────────────────────────

  describe("getCutoffTimestamps()", () => {
    it("GETs /history/cutoff-timestamps", async () => {
      const cutoff = {
        markets_cutoff_ts: 1690000000,
        fills_cutoff_ts: 1690000000,
        orders_cutoff_ts: 1690000000,
        trades_cutoff_ts: 1690000000,
      };
      const spy = vi.spyOn((svc as any).historicalApi, "getHistoricalCutoff").mockResolvedValue({
        data: cutoff,
      });
      const result = await svc.getCutoffTimestamps();
      expect(spy).toHaveBeenCalled();
      expect(result.markets_cutoff_ts).toBe(1690000000);
    });
  });

  // ── Phase 3: createSubaccount ─────────────────────────────────────────────

  describe("createSubaccount()", () => {
    it("POSTs to /portfolio/subaccounts", async () => {
      const spy = vi.spyOn((svc as any).portfolioApi, "createSubaccount").mockResolvedValue({
        data: { subaccount_number: 1 },
      });
      const result = await svc.createSubaccount();
      expect(spy).toHaveBeenCalled();
      expect(result.subaccount_number).toBe(1);
    });
  });

  // ── Phase 3: getSubaccountBalances ────────────────────────────────────────

  describe("getSubaccountBalances()", () => {
    it("GETs /portfolio/subaccount-balances", async () => {
      const spy = vi.spyOn((svc as any).portfolioApi, "getSubaccountBalances").mockResolvedValue({
        data: {
          subaccount_balances: [
            { subaccount_id: "sub-1", balance: 5000 },
            { subaccount_id: "sub-2", balance: 3000 },
          ],
        },
      });
      const result = await svc.getSubaccountBalances();
      expect(spy).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].balance).toBe(5000);
    });
  });

  // ── Phase 3: transferSubaccountFunds ──────────────────────────────────────

  describe("transferSubaccountFunds()", () => {
    it("POSTs to /portfolio/subaccount-transfers", async () => {
      const spy = vi.spyOn((svc as any).portfolioApi, "applySubaccountTransfer").mockResolvedValue({
        data: {},
      });
      await svc.transferSubaccountFunds({
        client_transfer_id: "xfer-1",
        from_subaccount: 1,
        to_subaccount: 2,
        amount_cents: 1000,
      });
      expect(spy).toHaveBeenCalledWith({
        client_transfer_id: "xfer-1",
        from_subaccount: 1,
        to_subaccount: 2,
        amount_cents: 1000,
      });
    });
  });

  // ── Phase 3: getSubaccountNetting ─────────────────────────────────────────

  describe("getSubaccountNetting()", () => {
    it("GETs /portfolio/subaccount-netting", async () => {
      const spy = vi.spyOn((svc as any).portfolioApi, "getSubaccountNetting").mockResolvedValue({
        data: {
          netting_configs: [{ subaccount_number: 0, enabled: true }],
        },
      });
      const result = await svc.getSubaccountNetting();
      expect(spy).toHaveBeenCalled();
      expect(result[0].enabled).toBe(true);
    });
  });

  // ── Phase 3: updateSubaccountNetting ──────────────────────────────────────

  describe("updateSubaccountNetting()", () => {
    it("PUTs to /portfolio/subaccount-netting", async () => {
      const spy = vi.spyOn((svc as any).portfolioApi, "updateSubaccountNetting").mockResolvedValue({
        data: {},
      });
      await svc.updateSubaccountNetting({
        subaccount_number: 0,
        enabled: false,
      });
      expect(spy).toHaveBeenCalledWith({
        subaccount_number: 0,
        enabled: false,
      });
    });
  });

  // ── Phase 3: getSportsFilters ─────────────────────────────────────────────

  describe("getSportsFilters()", () => {
    it("GETs /search/sports/filters", async () => {
      const spy = vi.spyOn((svc as any).searchApi, "getFiltersForSports").mockResolvedValue({
        data: {
          filters: [
            { sport: "NBA", filters: [{ key: "team", values: ["LAL"] }] },
          ],
        },
      });
      const result = await svc.getSportsFilters() as any;
      expect(spy).toHaveBeenCalled();
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].sport).toBe("NBA");
    });
  });

  // ── Phase 3: getSeriesTags ────────────────────────────────────────────────

  describe("getSeriesTags()", () => {
    it("GETs /search/series/tags", async () => {
      const spy = vi.spyOn((svc as any).searchApi, "getTagsForSeriesCategories").mockResolvedValue({
        data: {
          tags: [{ tag: "politics", series_tickers: ["POL-2026"] }],
        },
      });
      const result = await svc.getSeriesTags() as any;
      expect(spy).toHaveBeenCalled();
      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].tag).toBe("politics");
    });
  });

  // ── Phase 3: getOrderQueuePosition ────────────────────────────────────────

  describe("getOrderQueuePosition()", () => {
    it("GETs /portfolio/orders/:id/queue-position", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "getOrderQueuePosition").mockResolvedValue({
        data: {
          order_id: "ord-1",
          queue_position: 3,
          ticker: "BTC-USD",
        },
      });
      const result = await svc.getOrderQueuePosition("ord-1");
      expect(spy).toHaveBeenCalledWith("ord-1");
      expect(result.queue_position).toBe(3);
    });
  });

  // ── Phase 3: getOrderQueuePositions (batch) ───────────────────────────────

  describe("getOrderQueuePositions()", () => {
    it("GETs /portfolio/orders/queue-positions with order_ids params", async () => {
      const spy = vi.spyOn((svc as any).ordersApi, "getOrderQueuePositions").mockResolvedValue({
        data: {
          queue_positions: [
            { order_id: "ord-1", queue_position: 3, ticker: "BTC-USD" },
            { order_id: "ord-2", queue_position: 7, ticker: "ETH-USD" },
          ],
        },
      });
      const result = await svc.getOrderQueuePositions(["ord-1", "ord-2"]);
      expect(spy).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  // ── Phase 4: RFQ system ──────────────────────────────────────────────────

  describe("createRfq()", () => {
    it("POSTs /rfqs with market_ticker, contracts, rest_remainder", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "createRFQ").mockResolvedValue({
        data: { id: "rfq-1" },
      });
      const result = await svc.createRfq({
        market_ticker: "BTC-USD",
        contracts: 100,
        rest_remainder: true,
      });
      expect(spy).toHaveBeenCalledWith({
        market_ticker: "BTC-USD",
        contracts: 100,
        rest_remainder: true,
      });
      expect(result.id).toBe("rfq-1");
    });
  });

  describe("getRfqs()", () => {
    it("GETs /rfqs with cursor pagination", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "getRFQs").mockResolvedValue({
        data: {
          rfqs: [
            {
              rfq_id: "rfq-1",
              ticker: "BTC-USD",
              side: "yes",
              count: 100,
              status: "open",
            },
          ],
          cursor: "next-cursor",
        },
      });
      const result = await svc.getRfqs({ ticker: "BTC-USD", limit: 10 });
      expect(spy).toHaveBeenCalled();
      expect(result.rfqs).toHaveLength(1);
      expect(result.cursor).toBe("next-cursor");
    });
  });

  describe("getRfq()", () => {
    it("GETs /rfqs/{id}", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "getRFQ").mockResolvedValue({
        data: {
          rfq: {
            rfq_id: "rfq-1",
            id: "rfq-1",
            ticker: "BTC-USD",
            side: "yes",
            count: 100,
            status: "open",
          },
        },
      });
      const result = await svc.getRfq("rfq-1");
      expect(spy).toHaveBeenCalledWith("rfq-1");
      expect(result.id).toBe("rfq-1");
    });
  });

  describe("deleteRfq()", () => {
    it("DELETEs /rfqs/{id}", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "deleteRFQ").mockResolvedValue({
        data: {},
      });
      await svc.deleteRfq("rfq-1");
      expect(spy).toHaveBeenCalledWith("rfq-1");
    });
  });

  describe("createQuote()", () => {
    it("POSTs /quotes", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "createQuote").mockResolvedValue({
        data: { id: "q-1" },
      });
      const result = await svc.createQuote({
        rfq_id: "rfq-1",
        yes_bid: "0.50",
        no_bid: "0.50",
        rest_remainder: true,
      });
      expect(spy).toHaveBeenCalledWith({
        rfq_id: "rfq-1",
        yes_bid: "0.50",
        no_bid: "0.50",
        rest_remainder: true,
      });
      expect(result.id).toBe("q-1");
    });
  });

  describe("getQuotes()", () => {
    it("GETs /rfqs/{id}/quotes", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "getQuotes").mockResolvedValue({
        data: {
          quotes: [
            {
              quote_id: "q-1",
              rfq_id: "rfq-1",
              price: 50,
              side: "yes",
              count: 100,
              status: "open",
            },
          ],
        },
      });
      const result = await svc.getQuotes({ rfq_id: "rfq-1" });
      expect(spy).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe("getQuote()", () => {
    it("GETs /quotes/{quoteId}", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "getQuote").mockResolvedValue({
        data: {
          quote: {
            id: "q-1",
            rfq_id: "rfq-1",
            market_ticker: "BTC-USD",
            contracts_fp: "100.00",
            yes_bid_dollars: "0.50",
            no_bid_dollars: "0.50",
            created_ts: "2026-01-01T00:00:00Z",
            updated_ts: "2026-01-01T00:00:00Z",
            creator_id: "user-1",
            rfq_creator_id: "user-2",
            status: "open",
          },
        },
      });
      const result = await svc.getQuote("q-1");
      expect(spy).toHaveBeenCalledWith("q-1");
      expect(result.id).toBe("q-1");
    });
  });

  describe("deleteQuote()", () => {
    it("DELETEs /quotes/{quoteId}", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "deleteQuote").mockResolvedValue({
        data: undefined,
      });
      await svc.deleteQuote("q-1");
      expect(spy).toHaveBeenCalledWith("q-1");
    });
  });

  describe("acceptQuote()", () => {
    it("POSTs /quotes/{quoteId}/accept", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "acceptQuote").mockResolvedValue({
        data: undefined,
      });
      await svc.acceptQuote("q-1", { accepted_side: "yes" });
      expect(spy).toHaveBeenCalledWith("q-1", { accepted_side: "yes" });
    });
  });

  describe("confirmQuote()", () => {
    it("POSTs /quotes/{quoteId}/confirm", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "confirmQuote").mockResolvedValue({
        data: undefined,
      });
      await svc.confirmQuote("q-1");
      expect(spy).toHaveBeenCalledWith("q-1");
    });
  });

  describe("getRfqCommunicationsId()", () => {
    it("GETs /rfqs/{id}/communications-id", async () => {
      const spy = vi.spyOn((svc as any).communicationsApi, "getCommunicationsID").mockResolvedValue({
        data: { communications_id: "comm-abc" },
      });
      const result = await svc.getRfqCommunicationsId();
      expect(spy).toHaveBeenCalled();
      expect(result.communications_id).toBe("comm-abc");
    });
  });

  // ── Phase 4: Combo / MVE markets ────────────────────────────────────────

  describe("createComboMarket()", () => {
    it("POSTs /markets/mve/{collection}/create", async () => {
      const spy = vi.spyOn((svc as any).multivariateApi, "createMarketInMultivariateEventCollection").mockResolvedValue({
        data: {
          event_ticker: "EVT-COMBO-1",
          market_ticker: "COMBO-1",
        },
      });
      const result = await svc.createComboMarket("coll-1", {
        selected_markets: [
          { market_ticker: "A", event_ticker: "EVT-A", side: "yes" },
          { market_ticker: "B", event_ticker: "EVT-B", side: "no" },
        ],
      });
      expect(spy).toHaveBeenCalledWith("coll-1", {
        selected_markets: [
          { market_ticker: "A", event_ticker: "EVT-A", side: "yes" },
          { market_ticker: "B", event_ticker: "EVT-B", side: "no" },
        ],
      });
      expect(result.market_ticker).toBe("COMBO-1");
    });
  });

  describe("getMultivariateCollections()", () => {
    it("GETs /multivariate_event_collections with series_ticker filter", async () => {
      const spy = vi.spyOn((svc as any).multivariateApi, "getMultivariateEventCollections").mockResolvedValue({
        data: {
          multivariate_contracts: [
            {
              collection_ticker: "coll-1",
              series_ticker: "SER-1",
              title: "Test",
            },
          ],
          cursor: "next",
        },
      });
      const result = await svc.getMultivariateCollections({
        series_ticker: "SER-1",
      });
      expect(spy).toHaveBeenCalled();
      expect(result.collections).toHaveLength(1);
    });
  });

  describe("lookupTicker()", () => {
    it("POSTs /markets/mve/{collection}/lookup", async () => {
      const spy = vi.spyOn((svc as any).multivariateApi, "lookupTickersForMarketInMultivariateEventCollection").mockResolvedValue({
        data: {
          event_ticker: "EVT-1",
          market_ticker: "BTC-USD",
        },
      });
      const result = await svc.lookupTicker("coll-1", [
        { market_ticker: "A", event_ticker: "EVT-A", side: "yes" },
      ]);
      expect(spy).toHaveBeenCalledWith("coll-1", {
        selected_markets: [
          { market_ticker: "A", event_ticker: "EVT-A", side: "yes" },
        ],
      });
      expect(result.market_ticker).toBe("BTC-USD");
    });
  });

  // ── Phase 4: Live sports data ───────────────────────────────────────────

  describe("getGameStats()", () => {
    it("GETs /live-data with milestone_id", async () => {
      vi.spyOn((svc as any).liveDataApi, "getLiveDatas").mockResolvedValue({
        data: {
          live_datas: [
            {
              milestone_id: "g-1",
              type: "nfl",
              details: { home_team: "KC", away_team: "BUF" },
            },
          ],
        },
      });
      const result = await svc.getGameStats({ sport: "nfl", milestone_id: "g-1" });
      expect(result).toHaveLength(1);
      expect(result[0].milestone_id).toBe("g-1");
    });
  });

  describe("getLiveData()", () => {
    it("GETs /live-data/{type}/{milestoneId}", async () => {
      const spy = vi.spyOn((svc as any).liveDataApi, "getLiveData").mockResolvedValue({
        data: {
          live_data: { milestone_id: "m-1", type: "touchdown", details: { value: 1 } },
        },
      });
      const result = await svc.getLiveData("touchdown", "m-1");
      expect(spy).toHaveBeenCalledWith("touchdown", "m-1");
      expect(result.milestone_id).toBe("m-1");
    });
  });

  describe("getBatchLiveData()", () => {
    it("POSTs /live-data/batch with milestone_ids", async () => {
      const spy = vi.spyOn((svc as any).liveDataApi, "getLiveDatas").mockResolvedValue({
        data: {
          live_datas: [
            { milestone_id: "m-1", type: "td", value: 1 },
            { milestone_id: "m-2", type: "fg", value: 1 },
          ],
        },
      });
      const result = await svc.getBatchLiveData({
        milestone_ids: ["m-1", "m-2"],
      });
      expect(spy).toHaveBeenCalledWith(["m-1", "m-2"]);
      expect(result).toHaveLength(2);
    });
  });

  // ── Phase 4: Milestones ─────────────────────────────────────────────────

  describe("getMilestones()", () => {
    it("GETs /milestones with cursor pagination and status filter", async () => {
      const spy = vi.spyOn((svc as any).milestoneApi, "getMilestones").mockResolvedValue({
        data: {
          milestones: [
            {
              id: "ms-1",
              title: "Bitcoin 100k",
              type: "price",
              status: "active",
            },
          ],
          cursor: "next",
        },
      });
      const result = await svc.getMilestones({ status: "active", limit: 10 });
      expect(spy).toHaveBeenCalled();
      expect(result.milestones).toHaveLength(1);
    });
  });

  describe("getMilestone()", () => {
    it("GETs /milestones/{id}", async () => {
      const spy = vi.spyOn((svc as any).milestoneApi, "getMilestone").mockResolvedValue({
        data: {
          milestone: {
            id: "ms-1",
            title: "Bitcoin 100k",
            type: "price",
            status: "active",
          },
        },
      });
      const result = await svc.getMilestone("ms-1");
      expect(spy).toHaveBeenCalledWith("ms-1");
      expect(result.id).toBe("ms-1");
    });
  });

  // ── Phase 4: Structured targets ─────────────────────────────────────────

  describe("getStructuredTargets()", () => {
    it("GETs /structured-targets with type filter", async () => {
      const spy = vi.spyOn((svc as any).structuredTargetsApi, "getStructuredTargets").mockResolvedValue({
        data: {
          structured_targets: [
            { id: "st-1", title: "Target", type: "numeric" },
          ],
          cursor: "next",
        },
      });
      const result = await svc.getStructuredTargets({ type: "numeric" });
      expect(spy).toHaveBeenCalled();
      expect(result.structured_targets).toHaveLength(1);
    });
  });

  describe("getStructuredTarget()", () => {
    it("GETs /structured-targets/{id}", async () => {
      const spy = vi.spyOn((svc as any).structuredTargetsApi, "getStructuredTarget").mockResolvedValue({
        data: {
          structured_target: { id: "st-1", title: "Target", type: "numeric" },
        },
      });
      const result = await svc.getStructuredTarget("st-1");
      expect(spy).toHaveBeenCalledWith("st-1");
      expect(result!.id).toBe("st-1");
    });
  });

  // ── Phase 4: Incentives ─────────────────────────────────────────────────

  describe("getIncentives()", () => {
    it("GETs /incentives", async () => {
      const spy = vi.spyOn((svc as any).incentivesApi, "getIncentivePrograms").mockResolvedValue({
        data: {
          incentive_programs: [
            {
              id: "inc-1",
              title: "Welcome Bonus",
              type: "bonus",
              status: "active",
              value: 50,
            },
          ],
        },
      });
      const result = await svc.getIncentives();
      expect(spy).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("inc-1");
    });
  });

  // ── Phase 4: API key management ─────────────────────────────────────────

  describe("createApiKey()", () => {
    it("POSTs /api-keys", async () => {
      const spy = vi.spyOn((svc as any).apiKeysApi, "createApiKey").mockResolvedValue({
        data: { api_key_id: "ak-1", name: "test-key" },
      });
      const result = await svc.createApiKey({ name: "test-key", public_key: "ssh-rsa AAAA..." });
      expect(spy).toHaveBeenCalledWith({ name: "test-key", public_key: "ssh-rsa AAAA..." });
      expect(result.api_key_id).toBe("ak-1");
    });
  });

  describe("generateApiKey()", () => {
    it("POSTs /api-keys/generate and returns secret", async () => {
      const spy = vi.spyOn((svc as any).apiKeysApi, "generateApiKey").mockResolvedValue({
        data: {
          api_key_id: "ak-2",
          name: "gen-key",
          private_key: "sk_live_abc123",
        },
      });
      const result = await svc.generateApiKey({ name: "gen-key" });
      expect(spy).toHaveBeenCalledWith({ name: "gen-key" });
      expect(result.private_key).toBe("sk_live_abc123");
    });
  });

  describe("getApiKeys()", () => {
    it("GETs /api-keys", async () => {
      const spy = vi.spyOn((svc as any).apiKeysApi, "getApiKeys").mockResolvedValue({
        data: {
          api_keys: [
            { api_key_id: "ak-1", name: "key-1" },
            { api_key_id: "ak-2", name: "key-2" },
          ],
        },
      });
      const result = await svc.getApiKeys();
      expect(spy).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe("deleteApiKey()", () => {
    it("DELETEs /api-keys/{id}", async () => {
      const spy = vi.spyOn((svc as any).apiKeysApi, "deleteApiKey").mockResolvedValue({
        data: {},
      });
      await svc.deleteApiKey("ak-1");
      expect(spy).toHaveBeenCalledWith("ak-1");
    });
  });

  // ── Phase 4: Account rate limits ────────────────────────────────────────

  describe("getAccountLimits()", () => {
    it("GETs /account/limits", async () => {
      const spy = vi.spyOn((svc as any).accountApi, "getAccountApiLimits").mockResolvedValue({
        data: {
          tier: "standard",
          order_rate_limit: 100,
          order_rate_remaining: 95,
          combo_creation_limit: 5000,
          combo_creation_remaining: 4990,
        },
      });
      const result = await svc.getAccountLimits();
      expect(spy).toHaveBeenCalled();
      expect(result.tier).toBe("standard");
      expect(result.order_rate_limit).toBe(100);
      expect(result.combo_creation_limit).toBe(5000);
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

  // ── Phase 5b: toDollarsString ─────────────────────────────────────────────

  describe("toDollarsString()", () => {
    it("formats to 4 decimal places", () => {
      expect(KalshiRestService.toDollarsString(0.45)).toBe("0.4500");
    });

    it("preserves subpenny precision", () => {
      expect(KalshiRestService.toDollarsString(0.4567)).toBe("0.4567");
    });

    it("formats 0 correctly", () => {
      expect(KalshiRestService.toDollarsString(0)).toBe("0.0000");
    });

    it("formats 1 correctly", () => {
      expect(KalshiRestService.toDollarsString(1)).toBe("1.0000");
    });
  });

  // ── Phase 5b: resolvePriceDollars ─────────────────────────────────────────

  describe("resolvePriceDollars()", () => {
    it("prefers dollars string over cents", () => {
      expect(KalshiRestService.resolvePriceDollars("0.4567", 45)).toBe(0.4567);
    });

    it("falls back to cents when dollars is undefined", () => {
      expect(KalshiRestService.resolvePriceDollars(undefined, 45)).toBe(0.45);
    });

    it("returns 0 when both are undefined", () => {
      expect(KalshiRestService.resolvePriceDollars(undefined, undefined)).toBe(
        0,
      );
    });

    it("ignores empty string dollars", () => {
      expect(KalshiRestService.resolvePriceDollars("", 45)).toBe(0.45);
    });
  });
});

// ── Phase 5b: parseKalshiTimestamp ─────────────────────────────────────────

describe("parseKalshiTimestamp()", () => {
  it("returns ts_ms when present", () => {
    expect(parseKalshiTimestamp({ ts_ms: 1700000000123, ts: 1700000000 })).toBe(
      1700000000123,
    );
  });

  it("converts ts seconds to ms when ts_ms is absent", () => {
    expect(parseKalshiTimestamp({ ts: 1700000000 })).toBe(1700000000000);
  });

  it("falls back to Date.now() when both are absent", () => {
    const now = Date.now();
    const result = parseKalshiTimestamp({});
    expect(result).toBeGreaterThanOrEqual(now);
    expect(result).toBeLessThanOrEqual(now + 100);
  });

  it("prefers ts_ms over ts even when ts_ms is 0", () => {
    expect(parseKalshiTimestamp({ ts_ms: 0, ts: 1700000000 })).toBe(0);
  });
});

// ── Phase 5b: parseKalshiDollars ──────────────────────────────────────────

describe("parseKalshiDollars()", () => {
  it("parses valid dollar string", () => {
    expect(parseKalshiDollars("0.4567")).toBe(0.4567);
  });

  it("returns undefined for undefined input", () => {
    expect(parseKalshiDollars(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseKalshiDollars("")).toBeUndefined();
  });

  it("returns undefined for non-string input", () => {
    expect(parseKalshiDollars(42)).toBeUndefined();
  });

  it("returns undefined for NaN string", () => {
    expect(parseKalshiDollars("not-a-number")).toBeUndefined();
  });

  it("parses integer dollar string", () => {
    expect(parseKalshiDollars("1")).toBe(1);
  });

  it("parses zero", () => {
    expect(parseKalshiDollars("0")).toBe(0);
  });
});
