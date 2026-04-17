import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { PolymarketDataApiService } from "./polymarket-data-api.service";

function makeConfig(url = "https://data-api.polymarket.com"): ConfigService {
  return {
    get: (k: string) => (k === "POLYMARKET_DATA_API_URL" ? url : undefined),
  } as any;
}

describe("PolymarketDataApiService", () => {
  let svc: PolymarketDataApiService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    svc = new PolymarketDataApiService(makeConfig());
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── getPortfolio ─────────────────────────────────────────────────────────

  describe("getPortfolio()", () => {
    it("fetches from the v2/portfolio endpoint with user query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getPortfolio("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/v2/portfolio?user=0xWallet",
      );
    });

    it("returns parsed portfolio entries", async () => {
      const entries = [
        {
          asset: "tok-1",
          size: "50",
          avgPrice: "0.6",
          realizedPnl: "10",
          unrealizedPnl: "5",
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(entries),
      });

      const result = await svc.getPortfolio("0xWallet");
      expect(result).toEqual(entries);
    });

    it("returns empty array on non-ok response (graceful degradation)", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 404 });

      const result = await svc.getPortfolio("0xWallet");
      expect(result).toEqual([]);
    });

    it("URL-encodes the wallet address", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getPortfolio("0x1234+special");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        encodeURIComponent("0x1234+special"),
      );
    });

    it("uses custom DATA_API_URL from config", async () => {
      const customSvc = new PolymarketDataApiService(
        makeConfig("http://local-data-api:4000"),
      );
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await customSvc.getPortfolio("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain("http://local-data-api:4000");
    });
  });

  // ── getEarnings ─────────────────────────────────────────────────────────

  describe("getEarnings()", () => {
    it("fetches from the /earnings endpoint with user query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getEarnings("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain("/earnings?user=0xWallet");
    });

    it("returns parsed earnings entries", async () => {
      const entries = [
        {
          date: "2026-01-01",
          earnings: "25.50",
          volume: "500",
          winRate: "0.60",
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(entries),
      });

      const result = await svc.getEarnings("0xWallet");
      expect(result).toEqual(entries);
    });

    it("returns empty array on non-ok response (graceful degradation)", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getEarnings("0xWallet");
      expect(result).toEqual([]);
    });

    it("returns empty array when earnings endpoint returns empty array", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      const result = await svc.getEarnings("0xWallet");
      expect(result).toEqual([]);
    });
  });
});
