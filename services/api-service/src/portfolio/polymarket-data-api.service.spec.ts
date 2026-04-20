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

  // ── getRewardsMarkets ─────────────────────────────────────────────────

  describe("getRewardsMarkets()", () => {
    it("fetches from /rewards/markets/current", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getRewardsMarkets();

      expect(fetchSpy.mock.calls[0][0]).toContain("/rewards/markets/current");
    });

    it("returns parsed rewards markets", async () => {
      const markets = [
        {
          conditionId: "c1",
          rewardsDaily: "100",
          rewardsMaxSpread: "0.05",
          rewardsMinSize: "10",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(markets),
      });

      const result = await svc.getRewardsMarkets();
      expect(result).toEqual(markets);
    });

    it("returns empty array on non-ok response", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getRewardsMarkets();
      expect(result).toEqual([]);
    });
  });

  // ── getUserRewards ────────────────────────────────────────────────────

  describe("getUserRewards()", () => {
    it("fetches from /rewards/user with wallet address", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getUserRewards("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/rewards/user?user=0xWallet",
      );
    });

    it("returns empty array on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getUserRewards("0xWallet");
      expect(result).toEqual([]);
    });
  });

  // ── getActivity ──────────────────────────────────────────────────────

  describe("getActivity()", () => {
    it("fetches from /activity with wallet address", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getActivity("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain("/activity?user=0xWallet");
    });

    it("includes type filter when provided", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getActivity("0xWallet", "TRADE");

      expect(fetchSpy.mock.calls[0][0]).toContain("type=TRADE");
    });

    it("returns parsed activity entries", async () => {
      const activities = [
        {
          id: "a1",
          type: "TRADE",
          amount: "100",
          asset: "tok-1",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(activities),
      });

      const result = await svc.getActivity("0xWallet");
      expect(result).toEqual(activities);
    });

    it("returns empty array on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getActivity("0xWallet");
      expect(result).toEqual([]);
    });
  });

  // ── getRebates ───────────────────────────────────────────────────────

  describe("getRebates()", () => {
    it("fetches from /rebates/current with wallet address", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getRebates("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/rebates/current?user=0xWallet",
      );
    });

    it("returns empty array on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getRebates("0xWallet");
      expect(result).toEqual([]);
    });
  });
});
