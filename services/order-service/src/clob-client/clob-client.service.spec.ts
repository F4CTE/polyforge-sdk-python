import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import type { ClobClient as PolymarketClobClient } from "@polymarket/clob-client" with {
  "resolution-mode": "import",
};
import { ClobClientService } from "./clob-client.service";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ClobClient } = require("@polymarket/clob-client");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(url = "http://clob:3099"): ConfigService {
  return {
    get: (k: string, d?: unknown) =>
      k === "CLOB_API_URL"
        ? url
        : k === "POLYMARKET_CHAIN_ID"
          ? 137
          : (d ?? ""),
    getOrThrow: (k: string) => {
      if (k === "CLOB_API_URL") return url;
      throw new Error(`Missing ${k}`);
    },
  } as any;
}

const SUBMIT_REQ = {
  order: { tokenId: "tok", signature: "0xsig" },
  builderHeaders: {
    POLY_BUILDER_API_KEY: "k",
    POLY_BUILDER_TIMESTAMP: "1",
    POLY_BUILDER_PASSPHRASE: "p",
    POLY_BUILDER_SIGNATURE: "s",
  },
};

type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertFalse<T extends false> = T;
type AssertTrue<T extends true> = T;
type _ClobClientSdkIsNotAny = AssertFalse<IsAny<ClobClientService["sdk"]>>;
type _ClobClientSdkUsesPolymarketSdk = AssertTrue<
  ClobClientService["sdk"] extends PolymarketClobClient ? true : false
>;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("ClobClientService", () => {
  let svc: ClobClientService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    svc = new ClobClientService(makeConfig());
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── SDK-backed methods ──────────────────────────────────────────────────

  describe("getBook() — SDK-backed", () => {
    it("delegates to sdk.getOrderBook and maps OrderBookSummary shape", async () => {
      vi.spyOn(svc.sdk, "getOrderBook").mockResolvedValue({
        market: "0xcond",
        asset_id: "tok-yes",
        timestamp: "1700000000",
        bids: [{ price: "0.55", size: "100" }],
        asks: [{ price: "0.57", size: "200" }],
        min_order_size: "5",
        tick_size: "0.01",
        neg_risk: false,
        last_trade_price: "0.56",
        hash: "0xabc",
      });
      const result = await svc.getBook("tok-yes");
      expect(svc.sdk.getOrderBook).toHaveBeenCalledWith("tok-yes");
      expect(result.bids).toEqual([{ price: "0.55", size: "100" }]);
      expect(result.asks).toEqual([{ price: "0.57", size: "200" }]);
      expect(result.timestamp).toBe(1700000000);
      expect(parseFloat(result.spread)).toBeCloseTo(0.02, 2);
      expect(parseFloat(result.midpoint)).toBeCloseTo(0.56, 2);
    });

    it("handles empty order book gracefully", async () => {
      vi.spyOn(svc.sdk, "getOrderBook").mockResolvedValue({
        market: "0xcond",
        asset_id: "tok",
        timestamp: "0",
        bids: [],
        asks: [],
        min_order_size: "5",
        tick_size: "0.01",
        neg_risk: false,
        last_trade_price: "0",
        hash: "0x0",
      });
      const result = await svc.getBook("tok");
      expect(result.spread).toBe("0.0000");
      expect(result.midpoint).toBe("0.0000");
    });

    it("propagates SDK errors", async () => {
      vi.spyOn(svc.sdk, "getOrderBook").mockRejectedValue(
        new Error("Network error"),
      );
      await expect(svc.getBook("bad")).rejects.toThrow("Network error");
    });
  });

  describe("getSpread() — SDK-backed", () => {
    it("delegates to sdk.getSpread", async () => {
      vi.spyOn(svc.sdk, "getSpread").mockResolvedValue({ spread: "0.0200" });
      const result = await svc.getSpread("tok-yes");
      expect(svc.sdk.getSpread).toHaveBeenCalledWith("tok-yes");
      expect(result.spread).toBe("0.0200");
    });

    it("propagates SDK errors", async () => {
      vi.spyOn(svc.sdk, "getSpread").mockRejectedValue(new Error("timeout"));
      await expect(svc.getSpread("bad")).rejects.toThrow("timeout");
    });
  });

  describe("getMidpoint() — SDK-backed", () => {
    it("delegates to sdk.getMidpoint", async () => {
      vi.spyOn(svc.sdk, "getMidpoint").mockResolvedValue({ mid: "0.5500" });
      const result = await svc.getMidpoint("tok-yes");
      expect(svc.sdk.getMidpoint).toHaveBeenCalledWith("tok-yes");
      expect(result.mid).toBe("0.5500");
    });
  });

  describe("getTickSize() — SDK-backed", () => {
    it("delegates to sdk.getTickSize and returns as string", async () => {
      vi.spyOn(svc.sdk, "getTickSize").mockResolvedValue("0.01");
      const result = await svc.getTickSize("tok-yes");
      expect(svc.sdk.getTickSize).toHaveBeenCalledWith("tok-yes");
      expect(result).toBe("0.01");
    });
  });

  describe("getFeeRate() — SDK-backed", () => {
    it("delegates to sdk.getFeeRateBps and returns as string", async () => {
      vi.spyOn(svc.sdk, "getFeeRateBps").mockResolvedValue(200);
      const result = await svc.getFeeRate("tok-yes");
      expect(svc.sdk.getFeeRateBps).toHaveBeenCalledWith("tok-yes");
      expect(result).toBe("200");
    });
  });

  describe("getLastTradePrice() — SDK-backed", () => {
    it("delegates to sdk.getLastTradePrice", async () => {
      vi.spyOn(svc.sdk, "getLastTradePrice").mockResolvedValue({
        price: "0.55",
      });
      const result = await svc.getLastTradePrice("tok-yes");
      expect(svc.sdk.getLastTradePrice).toHaveBeenCalledWith("tok-yes");
      expect(result.price).toBe("0.55");
    });

    it("propagates SDK errors", async () => {
      vi.spyOn(svc.sdk, "getLastTradePrice").mockRejectedValue(
        new Error("not found"),
      );
      await expect(svc.getLastTradePrice("bad")).rejects.toThrow("not found");
    });
  });

  describe("getServerTime() — SDK-backed", () => {
    it("delegates to sdk.getServerTime and wraps in ClobServerTime shape", async () => {
      vi.spyOn(svc.sdk, "getServerTime").mockResolvedValue(1700000000);
      const result = await svc.getServerTime();
      expect(svc.sdk.getServerTime).toHaveBeenCalled();
      expect(result.time).toBe("1700000000");
    });

    it("propagates SDK errors", async () => {
      vi.spyOn(svc.sdk, "getServerTime").mockRejectedValue(
        new Error("unavailable"),
      );
      await expect(svc.getServerTime()).rejects.toThrow("unavailable");
    });
  });

  describe("getClobMarketInfo() — SDK-backed", () => {
    it("delegates to sdk.getMarket", async () => {
      const info = {
        condition_id: "cid-1",
        min_tick_size: "0.01",
        min_order_size: "5",
      };
      vi.spyOn(svc.sdk, "getMarket").mockResolvedValue(info);
      const result = await svc.getClobMarketInfo("cid-1");
      expect(svc.sdk.getMarket).toHaveBeenCalledWith("cid-1");
      expect(result.condition_id).toBe("cid-1");
      expect(result.min_tick_size).toBe("0.01");
    });

    it("propagates SDK errors", async () => {
      vi.spyOn(svc.sdk, "getMarket").mockRejectedValue(new Error("not found"));
      await expect(svc.getClobMarketInfo("bad")).rejects.toThrow("not found");
    });
  });

  describe("getPricesHistory() — SDK-backed", () => {
    it("delegates to sdk.getPricesHistory and maps MarketPrice to legacy shape", async () => {
      vi.spyOn(svc.sdk, "getPricesHistory").mockResolvedValue([
        { t: 123, p: 0.55 },
        { t: 456, p: 0.6 },
      ]);
      const result = await svc.getPricesHistory("tok-yes", "1h", 60);
      expect(svc.sdk.getPricesHistory).toHaveBeenCalledWith({
        market: "tok-yes",
        interval: "1h",
        fidelity: 60,
      });
      expect(result.history).toHaveLength(2);
      expect(result.history[0]).toEqual({ t: 123, p: "0.55" });
      expect(result.history[1]).toEqual({ t: 456, p: "0.6" });
    });

    it("omits optional params when not provided", async () => {
      vi.spyOn(svc.sdk, "getPricesHistory").mockResolvedValue([]);
      await svc.getPricesHistory("tok-yes");
      expect(svc.sdk.getPricesHistory).toHaveBeenCalledWith({
        market: "tok-yes",
      });
    });
  });

  // ── submitOrder (fetch-based) ──────────────────────────────────────────

  describe("submitOrder()", () => {
    it("POSTs to /order on the configured CLOB URL", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orderID: "clob-1", status: "LIVE" }),
      });
      await svc.submitOrder(SUBMIT_REQ);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/order");
    });

    it("uses POST method", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orderID: "x", status: "LIVE" }),
      });
      await svc.submitOrder(SUBMIT_REQ);
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
    });

    it("sets Content-Type: application/json", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orderID: "x", status: "LIVE" }),
      });
      await svc.submitOrder(SUBMIT_REQ);
      expect(fetchSpy.mock.calls[0][1].headers["Content-Type"]).toBe(
        "application/json",
      );
    });

    it("spreads builderHeaders into request headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orderID: "x", status: "LIVE" }),
      });
      await svc.submitOrder(SUBMIT_REQ);
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers.POLY_BUILDER_API_KEY).toBe("k");
      expect(headers.POLY_BUILDER_SIGNATURE).toBe("s");
    });

    it("serialises the order as the request body", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orderID: "x", status: "LIVE" }),
      });
      await svc.submitOrder(SUBMIT_REQ);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.tokenId).toBe("tok");
      expect(body.signature).toBe("0xsig");
    });

    it("returns the parsed response with orderID and status", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ orderID: "clob-456", status: "MATCHED" }),
      });
      const result = await svc.submitOrder(SUBMIT_REQ);
      expect(result.orderID).toBe("clob-456");
      expect(result.status).toBe("MATCHED");
    });

    it("returns transactionHash when present", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          orderID: "x",
          status: "CONFIRMED",
          transactionHash: "0xtx123",
        }),
      });
      const result = await svc.submitOrder(SUBMIT_REQ);
      expect(result.transactionHash).toBe("0xtx123");
    });

    it("throws an Error on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Bad Request"),
      });
      await expect(svc.submitOrder(SUBMIT_REQ)).rejects.toThrow("400");
    });

    it("error message includes the CLOB response body", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 422,
        text: vi.fn().mockResolvedValue("invalid size"),
      });
      await expect(svc.submitOrder(SUBMIT_REQ)).rejects.toThrow("invalid size");
    });

    it("uses empty string when res.text() rejects (graceful degradation)", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockRejectedValue(new Error("read error")),
      });
      await expect(svc.submitOrder(SUBMIT_REQ)).rejects.toThrow("500");
    });
  });

  // ── cancelOrder ───────────────────────────────────────────────────────────

  describe("cancelOrder()", () => {
    it("sends DELETE to /order/:clobOrderId", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      await svc.cancelOrder("order-abc", "api-key-xyz");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/order/order-abc",
      );
      expect(fetchSpy.mock.calls[0][1].method).toBe("DELETE");
    });

    it("attaches POLY-API-KEY header", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      await svc.cancelOrder("order-abc", "my-api-key");
      expect(fetchSpy.mock.calls[0][1].headers["POLY-API-KEY"]).toBe(
        "my-api-key",
      );
    });

    it("resolves without error on success", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      await expect(
        svc.cancelOrder("order-abc", "key"),
      ).resolves.toBeUndefined();
    });

    it("throws an Error on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("Order not found"),
      });
      await expect(svc.cancelOrder("order-abc", "key")).rejects.toThrow("404");
    });

    it("uses empty string when res.text() rejects during cancel error", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockRejectedValue(new Error("read err")),
      });
      await expect(svc.cancelOrder("order-abc", "key")).rejects.toThrow("500");
    });
  });

  // ── cancelAll ────────────────────────────────────────────────────────────

  describe("cancelAll()", () => {
    it("sends DELETE to /cancel-all with API key", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      await svc.cancelAll("api-key-xyz");
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/cancel-all");
      expect(fetchSpy.mock.calls[0][1].method).toBe("DELETE");
      expect(fetchSpy.mock.calls[0][1].headers["POLY-API-KEY"]).toBe(
        "api-key-xyz",
      );
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Internal error"),
      });
      await expect(svc.cancelAll("key")).rejects.toThrow("500");
    });
  });

  // ── cancelByMarket ──────────────────────────────────────────────────────

  describe("cancelByMarket()", () => {
    it("sends DELETE to /cancel-orders with market query param", async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      await svc.cancelByMarket("api-key-xyz", "market-123");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/cancel-orders?market=market-123",
      );
      expect(fetchSpy.mock.calls[0][1].method).toBe("DELETE");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("Market not found"),
      });
      await expect(svc.cancelByMarket("key", "bad-market")).rejects.toThrow(
        "404",
      );
    });
  });

  // ── fetchTrades ─────────────────────────────────────────────────────────

  describe("fetchTrades()", () => {
    it("sends GET to /trades with user, limit, offset params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });
      await svc.fetchTrades("0xwallet");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/trades?user=0xwallet&limit=500&offset=0",
      );
    });

    it("caps limit at 500 and offset at 1000", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });
      await svc.fetchTrades("0xwallet", 9999, 9999);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("limit=500");
      expect(url).toContain("offset=1000");
    });

    it("returns parsed trades array", async () => {
      const trades = [{ id: "t1", order_id: "o1", status: "FILLED" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(trades),
      });
      const result = await svc.fetchTrades("0xwallet");
      expect(result).toEqual(trades);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("error"),
      });
      await expect(svc.fetchTrades("0xwallet")).rejects.toThrow("500");
    });
  });

  // ── getBooks ────────────────────────────────────────────────────────────

  describe("getBooks()", () => {
    it("POSTs to /books with array of token IDs", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue([{ tokenId: "t1", bids: [], asks: [] }]),
      });
      const result = await svc.getBooks(["t1", "t2"]);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/books");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      expect(result).toHaveLength(1);
    });
  });

  // ── getBatchPricesHistory ──────────────────────────────────────────────

  describe("getBatchPricesHistory()", () => {
    it("POSTs to /batch-prices-history", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ "tok-1": [{ t: 1, p: "0.5" }] }),
      });
      const result = await svc.getBatchPricesHistory(["tok-1"], "1h", 30);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/batch-prices-history",
      );
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      expect(result["tok-1"]).toHaveLength(1);
    });
  });

  // ── submitBatchOrders ──────────────────────────────────────────────────

  describe("submitBatchOrders()", () => {
    it("POSTs to /orders with order array", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{ orderID: "o1", status: "PENDING" }]),
      });
      const result = await svc.submitBatchOrders([
        {
          order: { tokenId: "tok", price: "0.5", size: "10" },
          builderHeaders: { "POLY-API-KEY": "k" },
        },
      ]);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/orders");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      expect(result).toHaveLength(1);
    });

    it("throws if batch exceeds 15 orders", async () => {
      const orders = Array.from({ length: 16 }, () => ({
        order: { tokenId: "tok" },
        builderHeaders: {},
      }));
      await expect(svc.submitBatchOrders(orders)).rejects.toThrow(
        "Batch order limit is 15",
      );
    });
  });

  // ── cancelOrders ──────────────────────────────────────────────────────

  describe("cancelOrders()", () => {
    it("sends DELETE to /orders with order ID array", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ cancelled: ["o1", "o2"] }),
      });
      const result = await svc.cancelOrders(["o1", "o2"], "api-key");
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/orders");
      expect(fetchSpy.mock.calls[0][1].method).toBe("DELETE");
      expect(fetchSpy.mock.calls[0][1].headers["POLY-API-KEY"]).toBe("api-key");
      expect(result.cancelled).toEqual(["o1", "o2"]);
    });

    it("throws if bulk cancel exceeds 3000 orders", async () => {
      const ids = Array.from({ length: 3001 }, (_, i) => `o${i}`);
      await expect(svc.cancelOrders(ids, "key")).rejects.toThrow(
        "Bulk cancel limit is 3000",
      );
    });
  });

  // ── sendHeartbeat ────────────────────────────────────────────────────────

  describe("sendHeartbeat()", () => {
    const HMAC_HEADERS = {
      POLY_API_KEY: "key",
      POLY_ADDRESS: "0xaddr",
      POLY_SIGNATURE: "sig",
      POLY_PASSPHRASE: "pass",
      POLY_TIMESTAMP: "12345",
    };

    it("POSTs to /heartbeats with HMAC headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: "ok" }),
      });
      await svc.sendHeartbeat(HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/heartbeats");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      expect(fetchSpy.mock.calls[0][1].headers.POLY_API_KEY).toBe("key");
    });

    it("includes orderIds in body when provided", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: "ok" }),
      });
      await svc.sendHeartbeat(HMAC_HEADERS, ["o1", "o2"]);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.orderIds).toEqual(["o1", "o2"]);
    });

    it("sends no body when orderIds not provided", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: "ok" }),
      });
      await svc.sendHeartbeat(HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][1].body).toBeUndefined();
    });

    it("returns parsed response", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: "ok" }),
      });
      const result = await svc.sendHeartbeat(HMAC_HEADERS);
      expect(result.status).toBe("ok");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("Unauthorized"),
      });
      await expect(svc.sendHeartbeat(HMAC_HEADERS)).rejects.toThrow("401");
    });
  });

  // ── getUserOrders ─────────────────────────────────────────────────────────

  describe("getUserOrders()", () => {
    const HMAC_HEADERS = {
      POLY_API_KEY: "key",
      POLY_SIGNATURE: "sig",
    };

    it("sends GET to /data/orders with query params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          limit: 100,
          count: 1,
          next_cursor: "",
          data: [],
        }),
      });
      await svc.getUserOrders({ market: "0xmarket" }, HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][0]).toContain("/data/orders?");
      expect(fetchSpy.mock.calls[0][0]).toContain("market=0xmarket");
    });

    it("sends GET without query string when no params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          limit: 100,
          count: 0,
          next_cursor: "",
          data: [],
        }),
      });
      await svc.getUserOrders({}, HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/data/orders");
    });

    it("includes HMAC headers in request", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          limit: 100,
          count: 0,
          next_cursor: "",
          data: [],
        }),
      });
      await svc.getUserOrders({}, HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][1].headers.POLY_API_KEY).toBe("key");
    });

    it("includes next_cursor for pagination", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          limit: 100,
          count: 0,
          next_cursor: "",
          data: [],
        }),
      });
      await svc.getUserOrders({ next_cursor: "abc123" }, HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][0]).toContain("next_cursor=abc123");
    });

    it("returns paginated response", async () => {
      const resp = {
        limit: 100,
        count: 1,
        next_cursor: "next",
        data: [{ id: "o1", market: "0xm", status: "LIVE" }],
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(resp),
      });
      const result = await svc.getUserOrders({}, HMAC_HEADERS);
      expect(result.count).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.next_cursor).toBe("next");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue("Forbidden"),
      });
      await expect(svc.getUserOrders({}, HMAC_HEADERS)).rejects.toThrow("403");
    });
  });

  // ── getOrder ──────────────────────────────────────────────────────────────

  describe("getOrder()", () => {
    const HMAC_HEADERS = { POLY_API_KEY: "key", POLY_SIGNATURE: "sig" };

    it("sends GET to /order/{orderId}", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "o1", status: "LIVE" }),
      });
      await svc.getOrder("order-abc", HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/order/order-abc",
      );
    });

    it("does not set method (defaults to GET)", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "o1", status: "LIVE" }),
      });
      await svc.getOrder("order-abc", HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][1].method).toBeUndefined();
    });

    it("includes HMAC headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "o1", status: "LIVE" }),
      });
      await svc.getOrder("order-abc", HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][1].headers.POLY_API_KEY).toBe("key");
    });

    it("URL-encodes the orderId", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "o+1", status: "LIVE" }),
      });
      await svc.getOrder("o+1", HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][0]).toContain("o%2B1");
    });

    it("returns parsed order", async () => {
      const order = { id: "o1", market: "m1", status: "FILLED", price: "0.55" };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(order),
      });
      const result = await svc.getOrder("o1", HMAC_HEADERS);
      expect(result.id).toBe("o1");
      expect(result.status).toBe("FILLED");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("Not found"),
      });
      await expect(svc.getOrder("bad", HMAC_HEADERS)).rejects.toThrow("404");
    });
  });

  // ── getOrderScoring ───────────────────────────────────────────────────────

  describe("getOrderScoring()", () => {
    const HMAC_HEADERS = { POLY_API_KEY: "key", POLY_SIGNATURE: "sig" };

    it("sends GET to /order-scoring", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ scoring: {} }),
      });
      await svc.getOrderScoring(HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/order-scoring");
    });

    it("includes HMAC headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ scoring: {} }),
      });
      await svc.getOrderScoring(HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][1].headers.POLY_API_KEY).toBe("key");
    });

    it("returns scoring response", async () => {
      const scoring = { scoring: { score: 0.95, tier: "A" } };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(scoring),
      });
      const result = await svc.getOrderScoring(HMAC_HEADERS);
      expect(result.scoring).toBeDefined();
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("error"),
      });
      await expect(svc.getOrderScoring(HMAC_HEADERS)).rejects.toThrow("500");
    });
  });

  // ── getBuilderTrades ──────────────────────────────────────────────────────

  describe("getBuilderTrades()", () => {
    const HMAC_HEADERS = { POLY_API_KEY: "key", POLY_SIGNATURE: "sig" };

    it("sends GET to /builder-trades", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });
      await svc.getBuilderTrades(HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/builder-trades");
    });

    it("includes HMAC headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });
      await svc.getBuilderTrades(HMAC_HEADERS);
      expect(fetchSpy.mock.calls[0][1].headers.POLY_API_KEY).toBe("key");
    });

    it("returns parsed trades array", async () => {
      const trades = [
        { id: "t1", volume: "100" },
        { id: "t2", volume: "200" },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(trades),
      });
      const result = await svc.getBuilderTrades(HMAC_HEADERS);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("t1");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue("Forbidden"),
      });
      await expect(svc.getBuilderTrades(HMAC_HEADERS)).rejects.toThrow("403");
    });
  });

  // ── URL config ────────────────────────────────────────────────────────────

  describe("URL configuration", () => {
    it("uses a custom CLOB URL from config", async () => {
      const customSvc = new ClobClientService(
        makeConfig("http://prod-clob:443"),
      );
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ orderID: "x", status: "LIVE" }),
      });
      await customSvc.submitOrder(SUBMIT_REQ);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://prod-clob:443/order");
    });

    it("throws when CLOB_API_URL is not configured", () => {
      const config = {
        getOrThrow: () => {
          throw new Error("Missing CLOB_API_URL");
        },
      } as any as ConfigService;
      expect(() => new ClobClientService(config)).toThrow(
        "Missing CLOB_API_URL",
      );
    });

    it("creates ClobClient SDK instance with configured URL", () => {
      expect(svc.sdk).toBeInstanceOf(ClobClient);
      expect(svc.sdk.host).toBe("http://clob:3099");
    });
  });

  // ── Market Data Phase 2 (fetch-based batch) ──────────────────────────────

  describe("getLastTradePrices()", () => {
    it("sends GET to /last-trade-prices with comma-separated token_ids", async () => {
      const resp = [
        { token_id: "t1", price: "0.55" },
        { token_id: "t2", price: "0.45" },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(resp),
      });
      const result = await svc.getLastTradePrices(["t1", "t2"]);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/last-trade-prices?token_ids=t1%2Ct2",
      );
      expect(result).toHaveLength(2);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("error"),
      });
      await expect(svc.getLastTradePrices(["t1"])).rejects.toThrow("500");
    });
  });

  describe("getLastTradePricesBody()", () => {
    it("POSTs to /last-trade-prices with JSON body", async () => {
      const resp = [{ token_id: "t1", price: "0.55" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(resp),
      });
      const result = await svc.getLastTradePricesBody(["t1", "t2"]);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/last-trade-prices",
      );
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      expect(fetchSpy.mock.calls[0][1].headers["Content-Type"]).toBe(
        "application/json",
      );
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body).toEqual(["t1", "t2"]);
      expect(result).toHaveLength(1);
    });
  });

  describe("getMarketPrice()", () => {
    it("sends GET to /price with token_id", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ price: "0.62" }),
      });
      const result = await svc.getMarketPrice("tok-yes");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/price?token_id=tok-yes",
      );
      expect(result.price).toBe("0.62");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("error"),
      });
      await expect(svc.getMarketPrice("bad")).rejects.toThrow("500");
    });
  });

  describe("getMarketPrices()", () => {
    it("sends GET to /prices with comma-separated token_ids", async () => {
      const resp = [{ token_id: "t1", price: "0.55" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(resp),
      });
      const result = await svc.getMarketPrices(["t1", "t2"]);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/prices?token_ids=t1%2Ct2",
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getMarketPricesBody()", () => {
    it("POSTs to /prices with JSON body", async () => {
      const resp = [{ token_id: "t1", price: "0.55" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(resp),
      });
      const result = await svc.getMarketPricesBody(["t1"]);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/prices");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      expect(result).toHaveLength(1);
    });
  });

  describe("getMidpoints()", () => {
    it("sends GET to /midpoints with comma-separated token_ids", async () => {
      const resp = [{ token_id: "t1", mid: "0.56" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(resp),
      });
      const result = await svc.getMidpoints(["t1", "t2"]);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/midpoints?token_ids=t1%2Ct2",
      );
      expect(result).toHaveLength(1);
      expect(result[0].mid).toBe("0.56");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("error"),
      });
      await expect(svc.getMidpoints(["t1"])).rejects.toThrow("500");
    });
  });

  describe("getMidpointsBody()", () => {
    it("POSTs to /midpoints with JSON body", async () => {
      const resp = [{ token_id: "t1", mid: "0.56" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(resp),
      });
      const result = await svc.getMidpointsBody(["t1"]);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://clob:3099/midpoints");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      expect(result[0].mid).toBe("0.56");
    });
  });

  describe("getSpreads()", () => {
    it("sends GET to /spreads with comma-separated token_ids", async () => {
      const resp = [{ token_id: "t1", spread: "0.02" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(resp),
      });
      const result = await svc.getSpreads(["t1"]);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/spreads?token_ids=t1",
      );
      expect(result[0].spread).toBe("0.02");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue("unavailable"),
      });
      await expect(svc.getSpreads(["t1"])).rejects.toThrow("503");
    });
  });

  // ── 429 retry / backoff (fetch-based methods) ────────────────────────────

  describe("429 retry behaviour", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries submitOrder on 429 and succeeds on next attempt", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi
            .fn()
            .mockResolvedValue({ orderID: "retry-ok", status: "LIVE" }),
        });

      const promise = svc.submitOrder(SUBMIT_REQ);
      await vi.advanceTimersByTimeAsync(600);
      const result = await promise;

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.orderID).toBe("retry-ok");
    });

    it("retries up to 3 times before throwing on repeated 429", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue("rate limited"),
      });

      const promise = svc.submitOrder(SUBMIT_REQ);
      const assertion = expect(promise).rejects.toThrow("429");
      await vi.advanceTimersByTimeAsync(4000);
      await assertion;

      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it("does NOT retry on 500 — propagates immediately", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("server error"),
      });

      await expect(svc.submitOrder(SUBMIT_REQ)).rejects.toThrow("500");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on 400 — propagates immediately", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("bad request"),
      });

      await expect(svc.submitOrder(SUBMIT_REQ)).rejects.toThrow("400");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("retries cancelOrder on 429", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({ ok: true });

      const promise = svc.cancelOrder("order-abc", "key");
      await vi.advanceTimersByTimeAsync(600);
      await expect(promise).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("retries cancelAll on 429", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({ ok: true });

      const promise = svc.cancelAll("key");
      await vi.advanceTimersByTimeAsync(600);
      await expect(promise).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("retries fetchTrades on 429 and returns result", async () => {
      const trades = [{ id: "t1" }];
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(trades),
        });

      const promise = svc.fetchTrades("0xwallet");
      await vi.advanceTimersByTimeAsync(600);
      const result = await promise;
      expect(result).toEqual(trades);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ── Phase 4: Builder Analytics ────────────────────────────────────────────

  describe("getBuilderLeaderboard()", () => {
    it("sends GET to /builder-leaderboard", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue([
            { builder: "b1", volume: "1000", trades: 10, rank: 1 },
          ]),
      });

      const result = await svc.getBuilderLeaderboard();

      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/builder-leaderboard",
      );
      expect(result).toEqual([
        { builder: "b1", volume: "1000", trades: 10, rank: 1 },
      ]);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("server error"),
      });

      await expect(svc.getBuilderLeaderboard()).rejects.toThrow("500");
    });

    it("retries on 429", async () => {
      vi.useFakeTimers();
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        });

      const promise = svc.getBuilderLeaderboard();
      await vi.advanceTimersByTimeAsync(600);
      const result = await promise;
      expect(result).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe("getDailyBuilderVolume()", () => {
    it("sends GET to /daily-builder-volume", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue([
            { date: "2026-04-24", builder: "b1", volume: "500" },
          ]),
      });

      const result = await svc.getDailyBuilderVolume();

      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/daily-builder-volume",
      );
      expect(result).toEqual([
        { date: "2026-04-24", builder: "b1", volume: "500" },
      ]);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue("unavailable"),
      });

      await expect(svc.getDailyBuilderVolume()).rejects.toThrow("503");
    });

    it("retries on 429", async () => {
      vi.useFakeTimers();
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        });

      const promise = svc.getDailyBuilderVolume();
      await vi.advanceTimersByTimeAsync(600);
      const result = await promise;
      expect(result).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });
});
