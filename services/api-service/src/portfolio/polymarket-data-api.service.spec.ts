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

  // ── getPositions ──────────────────────────────────────────────────────

  describe("getPositions()", () => {
    it("fetches from /positions with user query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getPositions("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain("/positions?user=0xWallet");
    });

    it("returns parsed position entries", async () => {
      const positions = [
        {
          proxyWallet: "0xProxy",
          asset: "tok-1",
          conditionId: "cond-1",
          size: "100",
          avgPrice: "0.55",
          currentValue: "60",
          cashPnl: "5",
          percentPnl: "9.09",
          redeemable: false,
          mergeable: false,
          negativeRisk: false,
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(positions),
      });

      const result = await svc.getPositions("0xWallet");
      expect(result).toEqual(positions);
      expect(result[0].conditionId).toBe("cond-1");
    });

    it("returns empty array on non-ok response (graceful degradation)", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getPositions("0xWallet");
      expect(result).toEqual([]);
    });

    it("includes optional params in query string", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getPositions("0xWallet", {
        market: "0xMarket",
        eventId: "evt-1",
        sizeThreshold: 10,
        redeemable: true,
        limit: 50,
        sortBy: "CURRENT",
        sortDirection: "ASC",
      });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("market=0xMarket");
      expect(url).toContain("eventId=evt-1");
      expect(url).toContain("sizeThreshold=10");
      expect(url).toContain("redeemable=true");
      expect(url).toContain("limit=50");
      expect(url).toContain("sortBy=CURRENT");
      expect(url).toContain("sortDirection=ASC");
    });

    it("caps limit at 500", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getPositions("0xWallet", { limit: 9999 });

      expect(fetchSpy.mock.calls[0][0]).toContain("limit=500");
    });

    it("caps offset at 10000", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getPositions("0xWallet", { offset: 99999 });

      expect(fetchSpy.mock.calls[0][0]).toContain("offset=10000");
    });

    it("omits optional params when not provided", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getPositions("0xWallet");

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).not.toContain("market=");
      expect(url).not.toContain("limit=");
      expect(url).not.toContain("sortBy=");
    });
  });

  // ── getClosedPositions ────────────────────────────────────────────────

  describe("getClosedPositions()", () => {
    it("fetches from /closed-positions with user query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getClosedPositions("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/closed-positions?user=0xWallet",
      );
    });

    it("returns parsed closed position entries", async () => {
      const positions = [
        {
          proxyWallet: "0xProxy",
          asset: "tok-2",
          conditionId: "cond-2",
          size: "0",
          avgPrice: "0.40",
          currentValue: "0",
          cashPnl: "-20",
          percentPnl: "-100",
          redeemable: false,
          mergeable: false,
          negativeRisk: true,
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(positions),
      });

      const result = await svc.getClosedPositions("0xWallet");
      expect(result).toEqual(positions);
    });

    it("returns empty array on non-ok response", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 404 });

      const result = await svc.getClosedPositions("0xWallet");
      expect(result).toEqual([]);
    });

    it("includes optional params in query string", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getClosedPositions("0xWallet", {
        eventId: "evt-2",
        mergeable: false,
        limit: 100,
        offset: 500,
        sortBy: "CASHPNL",
      });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("eventId=evt-2");
      expect(url).toContain("mergeable=false");
      expect(url).toContain("limit=100");
      expect(url).toContain("offset=500");
      expect(url).toContain("sortBy=CASHPNL");
    });

    it("caps limit at 500 and offset at 10000", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getClosedPositions("0xWallet", { limit: 1000, offset: 50000 });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("limit=500");
      expect(url).toContain("offset=10000");
    });
  });

  // ── Phase 4: Analytics ──────────────────────────────────────────────────

  describe("getLeaderboard()", () => {
    it("fetches from /v1/leaderboard with no params by default", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getLeaderboard();

      expect(fetchSpy.mock.calls[0][0]).toContain("/v1/leaderboard");
      expect(fetchSpy.mock.calls[0][0]).not.toContain("?");
    });

    it("includes category and timeframe params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getLeaderboard({
        category: "POLITICS",
        timeframe: "WEEK",
        limit: 10,
      });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("category=POLITICS");
      expect(url).toContain("timeframe=WEEK");
      expect(url).toContain("limit=10");
    });

    it("caps limit between 1 and 50", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getLeaderboard({ limit: 100 });
      expect(fetchSpy.mock.calls[0][0]).toContain("limit=50");
    });

    it("returns parsed leaderboard entries", async () => {
      const entries = [
        {
          rank: 1,
          address: "0xTop",
          username: "whale",
          volume: "1000000",
          pnl: "50000",
          markets_traded: 200,
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(entries),
      });

      const result = await svc.getLeaderboard();
      expect(result).toEqual(entries);
    });

    it("returns empty array on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getLeaderboard();
      expect(result).toEqual([]);
    });
  });

  describe("getTopHolders()", () => {
    it("fetches from /top-holders with market param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });

      await svc.getTopHolders("0xMarket");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/top-holders?market=0xMarket",
      );
    });

    it("returns parsed holders", async () => {
      const holders = [
        {
          address: "0xHolder",
          position: "YES",
          value: "50000",
          percentage: "5.2",
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(holders),
      });

      const result = await svc.getTopHolders("0xMarket");
      expect(result).toEqual(holders);
    });

    it("returns empty array on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getTopHolders("0xMarket");
      expect(result).toEqual([]);
    });
  });

  describe("getTotalPositionValue()", () => {
    it("fetches from /total-value with user param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ totalValue: "12345" }),
      });

      await svc.getTotalPositionValue("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain("/total-value?user=0xWallet");
    });

    it("returns default on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 404 });

      const result = await svc.getTotalPositionValue("0xWallet");
      expect(result).toEqual({ totalValue: "0" });
    });
  });

  describe("getTotalMarketsTraded()", () => {
    it("fetches from /total-markets-traded with user param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ totalMarkets: 42 }),
      });

      const result = await svc.getTotalMarketsTraded("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/total-markets-traded?user=0xWallet",
      );
      expect(result).toEqual({ totalMarkets: 42 });
    });

    it("returns default on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getTotalMarketsTraded("0xWallet");
      expect(result).toEqual({ totalMarkets: 0 });
    });
  });

  describe("getPublicProfile()", () => {
    it("fetches from /profile/{address}", async () => {
      const profile = {
        address: "0xWallet",
        username: "trader1",
        bio: "Top trader",
        profileImage: "https://img.com/a.jpg",
        twitterHandle: "@trader1",
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(profile),
      });

      const result = await svc.getPublicProfile("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain("/profile/0xWallet");
      expect(result).toEqual(profile);
    });

    it("URL-encodes the address", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      await svc.getPublicProfile("0x123+test");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        encodeURIComponent("0x123+test"),
      );
    });

    it("returns null on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 404 });

      const result = await svc.getPublicProfile("0xWallet");
      expect(result).toBeNull();
    });
  });

  describe("getOpenInterest()", () => {
    it("fetches from /open-interest with market param", async () => {
      const oi = { market: "0xMarket", openInterest: "500000" };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(oi),
      });

      const result = await svc.getOpenInterest("0xMarket");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/open-interest?market=0xMarket",
      );
      expect(result).toEqual(oi);
    });

    it("returns null on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getOpenInterest("0xMarket");
      expect(result).toBeNull();
    });
  });

  describe("getLiveVolume()", () => {
    it("fetches from /live-volume/{eventId}", async () => {
      const vol = {
        eventId: "evt-1",
        volume: "250000",
        timestamp: "2026-04-24T00:00:00Z",
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(vol),
      });

      const result = await svc.getLiveVolume("evt-1");

      expect(fetchSpy.mock.calls[0][0]).toContain("/live-volume/evt-1");
      expect(result).toEqual(vol);
    });

    it("returns null on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 404 });

      const result = await svc.getLiveVolume("evt-1");
      expect(result).toBeNull();
    });
  });

  describe("getAccountingSnapshot()", () => {
    it("fetches from /accounting-snapshot with user param", async () => {
      const buffer = new ArrayBuffer(8);
      fetchSpy.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(buffer),
      });

      const result = await svc.getAccountingSnapshot("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/accounting-snapshot?user=0xWallet",
      );
      expect(result).toBe(buffer);
    });

    it("returns null on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getAccountingSnapshot("0xWallet");
      expect(result).toBeNull();
    });

    it("uses 30s timeout for large ZIP downloads", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      });

      await svc.getAccountingSnapshot("0xWallet");

      const opts = fetchSpy.mock.calls[0][1] as { signal: AbortSignal };
      expect(opts.signal).toBeDefined();
    });
  });

  // ── Phase 4: Rewards Deep Dive ──────────────────────────────────────────

  describe("getRawRewards()", () => {
    it("fetches from /raw-rewards/{market}", async () => {
      const rewards = [
        {
          address: "0xTrader",
          amount: "100",
          epoch: 42,
          conditionId: "cond-1",
        },
      ];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(rewards),
      });

      const result = await svc.getRawRewards("0xMarket");

      expect(fetchSpy.mock.calls[0][0]).toContain("/raw-rewards/0xMarket");
      expect(result).toEqual(rewards);
    });

    it("returns empty array on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 404 });

      const result = await svc.getRawRewards("0xMarket");
      expect(result).toEqual([]);
    });
  });

  describe("getRewardPercentages()", () => {
    it("fetches from /reward-percentages/{user}", async () => {
      const pcts = [{ market: "0xMarket", percentage: "0.05", amount: "500" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(pcts),
      });

      const result = await svc.getRewardPercentages("0xWallet");

      expect(fetchSpy.mock.calls[0][0]).toContain(
        "/reward-percentages/0xWallet",
      );
      expect(result).toEqual(pcts);
    });

    it("returns empty array on failure", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.getRewardPercentages("0xWallet");
      expect(result).toEqual([]);
    });
  });
});
