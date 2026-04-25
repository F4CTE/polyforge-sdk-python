import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { KalshiReadService } from "./kalshi-read.service";

const BASE_URL = "https://api.test.kalshi.co/trade-api/v2";

function makeConfig(): ConfigService {
  const map: Record<string, string> = { KALSHI_BASE_URL: BASE_URL };
  return {
    get: vi.fn((k: string) => map[k] ?? undefined),
  } as unknown as ConfigService;
}

describe("KalshiReadService", () => {
  let svc: KalshiReadService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    svc = new KalshiReadService(makeConfig());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("getCollections", () => {
    it("returns collections from the Kalshi MVE API", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            multivariate_contracts: [
              {
                collection_ticker: "NBA-COMBO",
                title: "NBA Championship Combo",
                category: "sports",
                status: "active",
                markets_count: 12,
              },
            ],
            cursor: "next-page",
          }),
      });

      const result = await svc.getCollections("NBA");

      expect(result.collections).toHaveLength(1);
      expect(result.collections[0].collection_ticker).toBe("NBA-COMBO");
      expect(result.cursor).toBe("next-page");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/events/multivariate?series_ticker=NBA"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("returns empty on HTTP error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await svc.getCollections();
      expect(result.collections).toHaveLength(0);
      expect(result.cursor).toBe("");
    });

    it("passes limit and cursor params", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ multivariate_contracts: [], cursor: "" }),
      });

      await svc.getCollections(undefined, 10, "abc");

      const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(calledUrl).toContain("limit=10");
      expect(calledUrl).toContain("cursor=abc");
    });
  });

  describe("getCollection", () => {
    it("returns a single collection by ticker", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            multivariate_contract: {
              collection_ticker: "NBA-COMBO",
              title: "NBA Championship Combo",
              category: "sports",
              status: "active",
              markets_count: 12,
            },
          }),
      });

      const result = await svc.getCollection("NBA-COMBO");
      expect(result).not.toBeNull();
      expect(result!.collection_ticker).toBe("NBA-COMBO");
    });

    it("returns null on 404", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await svc.getCollection("NONEXISTENT");
      expect(result).toBeNull();
    });
  });

  describe("lookupTicker", () => {
    it("resolves combo market ticker for given legs", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            event_ticker: "NBA-COMBO-EVT",
            market_ticker: "NBA-COMBO-MKT-1234",
          }),
      });

      const result = await svc.lookupTicker("NBA-COMBO", [
        { ticker: "NBA-WC-LAKERS", outcome: "yes" },
        { ticker: "NBA-EC-CELTICS", outcome: "yes" },
      ]);

      expect(result).not.toBeNull();
      expect(result!.market_ticker).toBe("NBA-COMBO-MKT-1234");

      const [url, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(url).toContain("/events/multivariate/NBA-COMBO/lookup");
      expect(opts.method).toBe("POST");
      const body = JSON.parse(opts.body as string);
      expect(body.selected_markets).toHaveLength(2);
      expect(body.selected_markets[0].ticker).toBe("NBA-WC-LAKERS");
      expect(body.selected_markets[0].yes).toBe(true);
    });

    it("returns null on HTTP error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      const result = await svc.lookupTicker("NBA-COMBO", [
        { ticker: "INVALID", outcome: "yes" },
      ]);
      expect(result).toBeNull();
    });
  });
});
