import { describe, it, expect, vi, beforeEach } from "vitest";
import { PolymarketUsAdapter } from "./polymarket-us-adapter";
import { PolymarketUsClientService } from "../polymarket-us-client/polymarket-us-client.service";
import type { VenueOrderRequest } from "@polyforge/shared-types";
import type { MarketBook } from "polymarket-us";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(): PolymarketUsClientService {
  return {
    getMarkets: vi.fn(),
    getOrderBook: vi.fn(),
    getBBO: vi.fn(),
    getPrice: vi.fn(),
    submitOrder: vi.fn(),
    cancelOrder: vi.fn(),
    cancelAll: vi.fn(),
    getPositions: vi.fn(),
    getOrderHistory: vi.fn(),
    healthCheck: vi.fn(),
  } as unknown as PolymarketUsClientService;
}

const MOCK_BOOK: MarketBook = {
  marketSlug: "president-2024",
  bids: [{ px: { value: "0.62", currency: "USD" }, qty: "500" }],
  offers: [{ px: { value: "0.64", currency: "USD" }, qty: "300" }],
  state: "MARKET_STATE_OPEN",
  transactTime: "2024-01-01T12:00:00Z",
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("PolymarketUsAdapter", () => {
  let adapter: PolymarketUsAdapter;
  let client: PolymarketUsClientService;

  beforeEach(() => {
    client = makeClient();
    adapter = new PolymarketUsAdapter(client);
  });

  it("has venueId = 'polymarket_us'", () => {
    expect(adapter.venueId).toBe("polymarket_us");
  });

  describe("getOrderBook()", () => {
    it("maps MarketBook bids/offers to OrderBook shape", async () => {
      vi.mocked(client.getOrderBook).mockResolvedValue(MOCK_BOOK);

      const result = await adapter.getOrderBook("president-2024");
      expect(result.tokenId).toBe("president-2024");
      expect(result.bids).toHaveLength(1);
      expect(result.bids[0]).toEqual({ price: "0.62", size: "500" });
      expect(result.asks[0]).toEqual({ price: "0.64", size: "300" });
      expect(result.updatedAt).toBeGreaterThan(0);
    });
  });

  describe("getPrice()", () => {
    it("returns price string from client.getPrice", async () => {
      vi.mocked(client.getPrice).mockResolvedValue("0.63");
      const price = await adapter.getPrice("president-2024");
      expect(price).toBe("0.63");
    });

    it("returns '0' when client.getPrice returns null", async () => {
      vi.mocked(client.getPrice).mockResolvedValue(null);
      const price = await adapter.getPrice("no-trades-yet");
      expect(price).toBe("0");
    });
  });

  describe("getMarkets()", () => {
    it("maps US market detail to UnifiedMarket shape", async () => {
      vi.mocked(client.getMarkets).mockResolvedValue({
        markets: [
          {
            id: 1,
            slug: "president-2024",
            title: "Presidential Election 2024",
            outcome: "Yes",
            active: true,
            closed: false,
          },
        ],
      });

      const markets = await adapter.getMarkets({ limit: 10, active: true });
      expect(markets).toHaveLength(1);
      expect(markets[0].venueId).toBe("polymarket_us");
      expect(markets[0].externalId).toBe("president-2024");
      expect(markets[0].outcomes).toEqual(["Yes"]);
      expect(markets[0].closed).toBe(false);
    });
  });

  describe("getPriceHistory()", () => {
    it("returns empty array (US API has no candle endpoint)", async () => {
      const candles = await adapter.getPriceHistory("president-2024", "1h");
      expect(candles).toEqual([]);
    });
  });

  describe("submitOrder()", () => {
    it("maps VenueOrderRequest GTC BUY to CreateOrderParams and returns VenueOrderResponse", async () => {
      vi.mocked(client.submitOrder).mockResolvedValue({
        id: "us-order-123",
        executions: [{ type: "EXECUTION_TYPE_NEW" } as any],
      });

      const req: VenueOrderRequest = {
        venueMarketId: "president-2024",
        venueOutcomeId: "president-2024",
        side: "BUY",
        size: "10",
        price: "0.62",
        orderType: "GTC",
        authContext: {
          venue: "polymarket_us",
          keyId: "key-1",
          secretKey: "secret-1",
        },
      };

      const resp = await adapter.submitOrder(req);
      expect(resp.venueOrderId).toBe("us-order-123");
      expect(resp.status).toBe("EXECUTION_TYPE_NEW");

      const [creds, params] = vi.mocked(client.submitOrder).mock.calls[0];
      expect(creds).toEqual({ keyId: "key-1", secretKey: "secret-1" });
      expect(params.marketSlug).toBe("president-2024");
      expect(params.intent).toBe("ORDER_INTENT_BUY_LONG");
      expect(params.tif).toBe("TIME_IN_FORCE_GOOD_TILL_CANCEL");
      expect(params.price).toEqual({ value: "0.62", currency: "USD" });
      expect(params.quantity).toBe(10);
    });

    it("maps SELL order to ORDER_INTENT_SELL_LONG", async () => {
      vi.mocked(client.submitOrder).mockResolvedValue({ id: "sell-1" });

      const req: VenueOrderRequest = {
        venueMarketId: "president-2024",
        venueOutcomeId: "president-2024",
        side: "SELL",
        size: "5",
        price: "0.65",
        orderType: "FOK",
        authContext: { venue: "polymarket_us", keyId: "k", secretKey: "s" },
      };

      await adapter.submitOrder(req);
      const [, params] = vi.mocked(client.submitOrder).mock.calls[0];
      expect(params.intent).toBe("ORDER_INTENT_SELL_LONG");
      expect(params.tif).toBe("TIME_IN_FORCE_FILL_OR_KILL");
    });

    it("maps GTD order and includes goodTillTime from expiration", async () => {
      vi.mocked(client.submitOrder).mockResolvedValue({ id: "gtd-1" });

      const req: VenueOrderRequest = {
        venueMarketId: "president-2024",
        venueOutcomeId: "president-2024",
        side: "BUY",
        size: "1",
        price: "0.50",
        orderType: "GTD",
        expiration: 1_700_000_000,
        authContext: { venue: "polymarket_us", keyId: "k", secretKey: "s" },
      };

      await adapter.submitOrder(req);
      const [, params] = vi.mocked(client.submitOrder).mock.calls[0];
      expect(params.tif).toBe("TIME_IN_FORCE_GOOD_TILL_DATE");
      expect(params.goodTillTime).toBeDefined();
    });
  });

  describe("cancelOrder()", () => {
    it("calls client.cancelOrder with extracted creds and marketSlug", async () => {
      vi.mocked(client.cancelOrder).mockResolvedValue(undefined);

      await adapter.cancelOrder("order-456", {
        venue: "polymarket_us",
        keyId: "k1",
        secretKey: "s1",
        marketSlug: "president-2024",
      });

      const [creds, orderId, params] = vi.mocked(client.cancelOrder).mock
        .calls[0];
      expect(creds).toEqual({ keyId: "k1", secretKey: "s1" });
      expect(orderId).toBe("order-456");
      expect(params.marketSlug).toBe("president-2024");
    });
  });

  describe("cancelAllOrders()", () => {
    it("calls client.cancelAll with creds", async () => {
      vi.mocked(client.cancelAll).mockResolvedValue({ canceledOrderIds: [] });

      await adapter.cancelAllOrders({
        venue: "polymarket_us",
        keyId: "k1",
        secretKey: "s1",
      });

      const [creds] = vi.mocked(client.cancelAll).mock.calls[0];
      expect(creds).toEqual({ keyId: "k1", secretKey: "s1" });
    });
  });

  describe("getPositions()", () => {
    it("returns empty array (credentials not available in this path)", async () => {
      const positions = await adapter.getPositions("user-1");
      expect(positions).toEqual([]);
    });
  });

  describe("getOrderHistory()", () => {
    it("returns empty array (credentials not available in this path)", async () => {
      const history = await adapter.getOrderHistory("user-1", 50);
      expect(history).toEqual([]);
    });
  });

  describe("healthCheck()", () => {
    it("delegates to client.healthCheck()", async () => {
      vi.mocked(client.healthCheck).mockResolvedValue(true);
      expect(await adapter.healthCheck()).toBe(true);
    });

    it("returns false when client.healthCheck() returns false", async () => {
      vi.mocked(client.healthCheck).mockResolvedValue(false);
      expect(await adapter.healthCheck()).toBe(false);
    });
  });
});
