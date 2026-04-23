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
