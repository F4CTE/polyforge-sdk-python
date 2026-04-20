import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { ClobClientService } from "./clob-client.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(url = "http://clob:3099"): ConfigService {
  return {
    get: (k: string, d?: string) => (k === "CLOB_API_URL" ? url : (d ?? "")),
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
  });

  // ── submitOrder ───────────────────────────────────────────────────────────

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
      // Should still throw an Error even when body is unreadable
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

  // ── getBook ──────────────────────────────────────────────────────────────

  describe("getBook()", () => {
    it("sends GET to /book with token_id query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bids: [{ price: "0.55", size: "100" }],
          asks: [{ price: "0.57", size: "200" }],
          spread: "0.0200",
          midpoint: "0.5600",
          timestamp: 1234567890,
        }),
      });
      const result = await svc.getBook("tok-yes");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/book?token_id=tok-yes",
      );
      expect(result.bids).toHaveLength(1);
      expect(result.spread).toBe("0.0200");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("not found"),
      });
      await expect(svc.getBook("bad")).rejects.toThrow("404");
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

  // ── getSpread ──────────────────────────────────────────────────────────

  describe("getSpread()", () => {
    it("sends GET to /spread with token_id query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ spread: "0.0200" }),
      });
      const result = await svc.getSpread("tok-yes");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/spread?token_id=tok-yes",
      );
      expect(result.spread).toBe("0.0200");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("error"),
      });
      await expect(svc.getSpread("bad")).rejects.toThrow("500");
    });
  });

  // ── getMidpoint ────────────────────────────────────────────────────────

  describe("getMidpoint()", () => {
    it("sends GET to /midpoint with token_id query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ mid: "0.5500" }),
      });
      const result = await svc.getMidpoint("tok-yes");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://clob:3099/midpoint?token_id=tok-yes",
      );
      expect(result.mid).toBe("0.5500");
    });
  });

  // ── getPricesHistory ───────────────────────────────────────────────────

  describe("getPricesHistory()", () => {
    it("sends GET to /prices-history with params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          history: [{ t: 123, p: "0.55" }],
        }),
      });
      const result = await svc.getPricesHistory("tok-yes", "1h", 60);
      expect(fetchSpy.mock.calls[0][0]).toContain("/prices-history?");
      expect(fetchSpy.mock.calls[0][0]).toContain("token_id=tok-yes");
      expect(fetchSpy.mock.calls[0][0]).toContain("interval=1h");
      expect(fetchSpy.mock.calls[0][0]).toContain("fidelity=60");
      expect(result.history).toHaveLength(1);
    });

    it("omits optional params when not provided", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ history: [] }),
      });
      await svc.getPricesHistory("tok-yes");
      expect(fetchSpy.mock.calls[0][0]).not.toContain("interval=");
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
  });

  // ── 429 retry / backoff ───────────────────────────────────────────────────

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
      // Advance past first retry delay (500ms)
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
      // Attach rejects assertion before advancing timers to avoid unhandled rejection
      const assertion = expect(promise).rejects.toThrow("429");
      // Advance past all three retry delays (500 + 1000 + 2000 = 3500ms)
      await vi.advanceTimersByTimeAsync(4000);
      await assertion;

      // Called: initial + 3 retries = 4 times (index 0,1,2 trigger retries; index 3 exhausts)
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
});
