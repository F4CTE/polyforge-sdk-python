import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { ClobClientService } from "../clob-client/clob-client.service";
import { PolymarketAdapter } from "./polymarket-adapter";
import type { VenueOrderRequest } from "@polyforge/shared-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(url = "http://clob:3099"): ConfigService {
  return {
    get: (k: string, d?: string) => (k === "CLOB_API_URL" ? url : (d ?? "")),
    getOrThrow: (k: string) => {
      if (k === "CLOB_API_URL") return url;
      throw new Error(`Missing ${k}`);
    },
  } as any;
}

function makeFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("PolymarketAdapter", () => {
  let adapter: PolymarketAdapter;
  let clob: ClobClientService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clob = new ClobClientService(makeConfig());
    adapter = new PolymarketAdapter(clob);
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has venueId = 'polymarket'", () => {
    expect(adapter.venueId).toBe("polymarket");
  });

  describe("getOrderBook()", () => {
    it("delegates to ClobClientService.getBook() and maps to OrderBook shape", async () => {
      vi.spyOn(clob, "getBook").mockResolvedValue({
        bids: [{ price: "0.45", size: "100" }],
        asks: [{ price: "0.55", size: "80" }],
        midpoint: "0.50",
        spread: "0.10",
        timestamp: 1_700_000_000,
      });
      const result = await adapter.getOrderBook("tok-1");
      expect(result.tokenId).toBe("tok-1");
      expect(result.bids).toHaveLength(1);
      expect(result.updatedAt).toBe(1_700_000_000);
    });
  });

  describe("getPrice()", () => {
    it("returns the price from getMarketPrice", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ price: "0.63" }),
      });
      const price = await adapter.getPrice("tok-1");
      expect(price).toBe("0.63");
      expect(fetchSpy.mock.calls[0][0]).toContain("/price?token_id=tok-1");
    });
  });

  describe("submitOrder()", () => {
    it("maps VenueOrderRequest to ClobSubmitRequest and returns VenueOrderResponse", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ orderID: "clob-123", status: "LIVE" }),
      });
      const req: VenueOrderRequest = {
        venueMarketId: "mkt-1",
        venueOutcomeId: "tok-1",
        side: "BUY",
        size: "10",
        price: "0.45",
        orderType: "GTC",
        authContext: {
          order: { tokenId: "tok-1", signature: "0xsig" },
          builderHeaders: {
            POLY_BUILDER_API_KEY: "k",
            POLY_BUILDER_TIMESTAMP: "1",
            POLY_BUILDER_PASSPHRASE: "p",
            POLY_BUILDER_SIGNATURE: "s",
          },
        },
      };
      const resp = await adapter.submitOrder(req);
      expect(resp.venueOrderId).toBe("clob-123");
      expect(resp.status).toBe("LIVE");
    });
  });

  describe("cancelOrder()", () => {
    it("calls clobClient.cancelOrder with venueOrderId", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      const authContext = { apiKey: "my-key" };
      await expect(
        adapter.cancelOrder("clob-456", authContext),
      ).resolves.toBeUndefined();
    });
  });

  describe("cancelAllOrders()", () => {
    it("calls clobClient.cancelAll with apiKey from authContext", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      await expect(
        adapter.cancelAllOrders({ apiKey: "my-key" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("getPriceHistory()", () => {
    it("maps 1h resolution to 1h interval and returns candles", async () => {
      vi.spyOn(clob, "getPricesHistory").mockResolvedValue({
        history: [{ t: 1_700_000_000, p: "0.50" }],
      });
      const candles = await adapter.getPriceHistory("tok-1", "1h");
      expect(clob.getPricesHistory).toHaveBeenCalledWith(
        "tok-1",
        "1h",
        undefined,
      );
      expect(candles).toHaveLength(1);
      expect(candles[0].bucket).toBeDefined();
      expect(candles[0].close).toBe("0.50");
    });

    it("maps 1m resolution to max interval with 1 min fidelity", async () => {
      vi.spyOn(clob, "getPricesHistory").mockResolvedValue({ history: [] });
      await adapter.getPriceHistory("tok-1", "1m");
      expect(clob.getPricesHistory).toHaveBeenCalledWith("tok-1", "max", 1);
    });

    it("maps 5m resolution to max interval with 5 min fidelity", async () => {
      vi.spyOn(clob, "getPricesHistory").mockResolvedValue({ history: [] });
      await adapter.getPriceHistory("tok-1", "5m");
      expect(clob.getPricesHistory).toHaveBeenCalledWith("tok-1", "max", 5);
    });

    it("maps 15m resolution to max interval with 15 min fidelity", async () => {
      vi.spyOn(clob, "getPricesHistory").mockResolvedValue({ history: [] });
      await adapter.getPriceHistory("tok-1", "15m");
      expect(clob.getPricesHistory).toHaveBeenCalledWith("tok-1", "max", 15);
    });

    it("maps 1d resolution to 1d interval without fidelity", async () => {
      vi.spyOn(clob, "getPricesHistory").mockResolvedValue({ history: [] });
      await adapter.getPriceHistory("tok-1", "1d");
      expect(clob.getPricesHistory).toHaveBeenCalledWith(
        "tok-1",
        "1d",
        undefined,
      );
    });
  });

  describe("getMarkets()", () => {
    it("returns empty array (not implemented in Phase 1 via CLOB client)", async () => {
      const markets = await adapter.getMarkets({});
      expect(markets).toEqual([]);
    });
  });

  describe("getPositions()", () => {
    it("returns empty array (not available via CLOB API)", async () => {
      const positions = await adapter.getPositions("user-1");
      expect(positions).toEqual([]);
    });
  });

  describe("getOrderHistory()", () => {
    it("delegates to fetchTrades and maps to VenueOrderHistory", async () => {
      const trades = [
        {
          tradeID: "t-1",
          market: "mkt-1",
          side: "BUY",
          size: "10",
          price: "0.45",
          status: "MATCHED",
          matchTime: "2024-01-01T00:00:00Z",
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(trades),
      });
      const history = await adapter.getOrderHistory("0xwallet", 50);
      expect(history).toHaveLength(1);
      expect(history[0].venueOrderId).toBe("t-1");
    });
  });

  describe("getBatchPrices()", () => {
    it("delegates to getMarketPricesBody and maps token_id to tokenId", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([
          { token_id: "t1", price: "0.55" },
          { token_id: "t2", price: "0.45" },
        ]),
      });
      const result = await adapter.getBatchPrices(["t1", "t2"]);
      expect(result).toHaveLength(2);
      expect(result[0].tokenId).toBe("t1");
      expect(result[0].price).toBe("0.55");
    });
  });

  describe("getBatchMidpoints()", () => {
    it("delegates to getMidpointsBody and maps token_id to tokenId", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{ token_id: "t1", mid: "0.56" }]),
      });
      const result = await adapter.getBatchMidpoints(["t1"]);
      expect(result).toHaveLength(1);
      expect(result[0].tokenId).toBe("t1");
      expect(result[0].mid).toBe("0.56");
    });
  });

  describe("getBatchSpreads()", () => {
    it("delegates to getSpreads and maps token_id to tokenId", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{ token_id: "t1", spread: "0.02" }]),
      });
      const result = await adapter.getBatchSpreads(["t1"]);
      expect(result).toHaveLength(1);
      expect(result[0].tokenId).toBe("t1");
      expect(result[0].spread).toBe("0.02");
    });
  });

  describe("getServerTime()", () => {
    it("returns time string from CLOB server-time endpoint", async () => {
      vi.spyOn(clob, "getServerTime").mockResolvedValue({ time: "1700000000" });
      const time = await adapter.getServerTime();
      expect(time).toBe("1700000000");
    });
  });

  describe("healthCheck()", () => {
    it("returns true when CLOB responds with book data", async () => {
      vi.spyOn(clob, "getMidpoint").mockResolvedValue({ mid: "0.50" });
      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(true);
    });

    it("returns false when CLOB throws", async () => {
      vi.spyOn(clob, "getMidpoint").mockRejectedValue(
        new Error("Network error"),
      );
      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});
