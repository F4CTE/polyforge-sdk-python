import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { PolymarketUsClientService } from "./polymarket-us-client.service";
import type { MarketBook, MarketBBO } from "polymarket-us";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(apiUrl = "https://api.polymarket.us"): ConfigService {
  return {
    get: (k: string, d?: string) =>
      k === "POLYMARKET_US_API_URL" ? apiUrl : (d ?? ""),
    getOrThrow: (k: string) => {
      if (k === "POLYMARKET_US_API_URL") return apiUrl;
      throw new Error(`Missing env var: ${k}`);
    },
  } as unknown as ConfigService;
}

const MOCK_BOOK: MarketBook = {
  marketSlug: "test-slug",
  bids: [{ px: { value: "0.45", currency: "USD" }, qty: "100" }],
  offers: [{ px: { value: "0.55", currency: "USD" }, qty: "80" }],
  state: "MARKET_STATE_OPEN",
  transactTime: "2024-01-01T00:00:00Z",
};

const MOCK_BBO: MarketBBO = {
  marketSlug: "test-slug",
  bestBid: { value: "0.45", currency: "USD" },
  bestAsk: { value: "0.55", currency: "USD" },
  lastTradePx: { value: "0.50", currency: "USD" },
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("PolymarketUsClientService", () => {
  let svc: PolymarketUsClientService;

  beforeEach(() => {
    svc = new PolymarketUsClientService(makeConfig());
  });

  it("constructs without throwing", () => {
    expect(svc).toBeDefined();
  });

  describe("getOrderBook()", () => {
    it("calls markets.book() and returns the raw MarketBook", async () => {
      vi.spyOn((svc as any).readonlySdk.markets, "book").mockResolvedValue(
        MOCK_BOOK,
      );

      const result = await svc.getOrderBook("test-slug");
      expect(result).toEqual(MOCK_BOOK);
      expect((svc as any).readonlySdk.markets.book).toHaveBeenCalledWith(
        "test-slug",
      );
    });
  });

  describe("getPrice()", () => {
    it("returns lastTradePx.value from BBO", async () => {
      vi.spyOn((svc as any).readonlySdk.markets, "bbo").mockResolvedValue(
        MOCK_BBO,
      );

      const price = await svc.getPrice("test-slug");
      expect(price).toBe("0.50");
    });

    it("returns null when lastTradePx is absent", async () => {
      vi.spyOn((svc as any).readonlySdk.markets, "bbo").mockResolvedValue({
        marketSlug: "test-slug",
      } as MarketBBO);

      const price = await svc.getPrice("test-slug");
      expect(price).toBeNull();
    });
  });

  describe("getMarkets()", () => {
    it("calls markets.list() with provided params", async () => {
      const mockResponse = { markets: [] };
      vi.spyOn((svc as any).readonlySdk.markets, "list").mockResolvedValue(
        mockResponse,
      );

      const result = await svc.getMarkets({ limit: 10, active: true });
      expect(result).toEqual(mockResponse);
      expect((svc as any).readonlySdk.markets.list).toHaveBeenCalledWith({
        limit: 10,
        active: true,
      });
    });
  });

  describe("submitOrder()", () => {
    it("creates a fresh SDK per call and delegates to orders.create()", async () => {
      const mockResponse = { id: "order-123" };
      const mockCreate = vi.fn().mockResolvedValue(mockResponse);

      vi.spyOn(svc as any, "makeSdk").mockReturnValue({
        orders: { create: mockCreate },
      });

      const creds = { keyId: "k1", secretKey: "s1" };
      const params = {
        marketSlug: "test-slug",
        intent: "ORDER_INTENT_BUY_LONG" as const,
        type: "ORDER_TYPE_LIMIT" as const,
        price: { value: "0.45", currency: "USD" as const },
        quantity: 10,
        tif: "TIME_IN_FORCE_GOOD_TILL_CANCEL" as const,
      };

      const result = await svc.submitOrder(creds, params);
      expect(result).toEqual(mockResponse);
      expect(mockCreate).toHaveBeenCalledWith(params);
    });
  });

  describe("cancelAll()", () => {
    it("delegates to orders.cancelAll()", async () => {
      const mockResponse = { canceledOrderIds: ["o1", "o2"] };
      const mockCancelAll = vi.fn().mockResolvedValue(mockResponse);

      vi.spyOn(svc as any, "makeSdk").mockReturnValue({
        orders: { cancelAll: mockCancelAll },
      });

      const result = await svc.cancelAll({ keyId: "k", secretKey: "s" });
      expect(result.canceledOrderIds).toHaveLength(2);
    });
  });

  describe("healthCheck()", () => {
    it("returns true when markets.list() succeeds", async () => {
      vi.spyOn((svc as any).readonlySdk.markets, "list").mockResolvedValue({
        markets: [],
      });

      expect(await svc.healthCheck()).toBe(true);
    });

    it("returns false when markets.list() throws", async () => {
      vi.spyOn((svc as any).readonlySdk.markets, "list").mockRejectedValue(
        new Error("Network down"),
      );

      expect(await svc.healthCheck()).toBe(false);
    });
  });

  describe("rate limiter", () => {
    it("allows up to 20 requests within 1 second without waiting", async () => {
      vi.spyOn((svc as any).readonlySdk.markets, "bbo").mockResolvedValue(
        MOCK_BBO,
      );

      const calls = Array.from({ length: 20 }, (_, i) =>
        svc.getPrice(`slug-${i}`),
      );
      await expect(Promise.all(calls)).resolves.toHaveLength(20);
    });
  });
});
