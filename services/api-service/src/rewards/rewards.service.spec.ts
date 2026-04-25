import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { RewardsService } from "./rewards.service";
import { PolymarketDataApiService } from "../portfolio/polymarket-data-api.service";
import { RedisService } from "@polyforge/shared-redis";
import { ClobReadService } from "../common/services/clob-read.service";

function makePrisma(user: any = null) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
    market: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  } as any;
}

function makeRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  } as unknown as RedisService;
}

function makeDataApi() {
  return {
    getRewardsMarkets: vi.fn().mockResolvedValue([]),
    getRewardsForMarket: vi.fn().mockResolvedValue(null),
    getUserRewards: vi.fn().mockResolvedValue([]),
    getUserRewardsTotal: vi.fn().mockResolvedValue({ total: "0", byDate: [] }),
    getUserRewardsPercentages: vi.fn().mockResolvedValue({}),
    getUserRewardsPerMarket: vi.fn().mockResolvedValue([]),
    getUserSponsoredMarkets: vi.fn().mockResolvedValue([]),
    getRebates: vi.fn().mockResolvedValue([]),
  } as unknown as PolymarketDataApiService;
}

function makeClobRead() {
  return {
    getRewardsForMarkets: vi.fn().mockResolvedValue([]),
  } as unknown as ClobReadService;
}

describe("RewardsService", () => {
  let service: RewardsService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: RedisService;
  let dataApi: ReturnType<typeof makeDataApi>;
  let clobRead: ReturnType<typeof makeClobRead>;

  beforeEach(() => {
    prisma = makePrisma({
      polymarketAddress: "0xWallet",
      polymarketConnected: true,
    });
    redis = makeRedis();
    dataApi = makeDataApi();
    clobRead = makeClobRead();
    service = new RewardsService(
      prisma,
      redis,
      dataApi as any,
      clobRead as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getRewardsMarkets()", () => {
    it("returns cached data when available", async () => {
      const cached = [{ conditionId: "c1" }];
      (redis.get as any).mockResolvedValue(JSON.stringify(cached));

      const result = await service.getRewardsMarkets();
      expect(result).toEqual(cached);
      expect(dataApi.getRewardsMarkets).not.toHaveBeenCalled();
    });

    it("fetches from data API and caches when no cache hit", async () => {
      const markets = [{ conditionId: "c1", rewardsDaily: "100" }];
      (dataApi.getRewardsMarkets as any).mockResolvedValue(markets);

      const result = await service.getRewardsMarkets();
      expect(result).toEqual(markets);
      expect(redis.set).toHaveBeenCalledWith(
        "cache:rewards:markets",
        JSON.stringify(markets),
        300,
      );
    });
  });

  describe("getUserRewards()", () => {
    it("returns empty when user has no wallet", async () => {
      prisma = makePrisma(null);
      service = new RewardsService(
        prisma,
        redis,
        dataApi as any,
        clobRead as any,
      );

      const result = await service.getUserRewards("user-1");
      expect(result).toEqual({ rewards: [] });
    });

    it("fetches rewards for connected user", async () => {
      const rewards = [{ date: "2026-01-01", amount: "50", market: "m1" }];
      (dataApi.getUserRewards as any).mockResolvedValue(rewards);

      const result = await service.getUserRewards("user-1");
      expect(result).toEqual({ rewards });
      expect(dataApi.getUserRewards).toHaveBeenCalledWith("0xWallet");
    });
  });

  describe("getRebates()", () => {
    it("returns empty when user has no wallet", async () => {
      prisma = makePrisma(null);
      service = new RewardsService(
        prisma,
        redis,
        dataApi as any,
        clobRead as any,
      );

      const result = await service.getRebates("user-1");
      expect(result).toEqual({ rebates: [] });
    });

    it("fetches rebates for connected user", async () => {
      const rebates = [{ date: "2026-01-01", amount: "5", feesPaid: "25" }];
      (dataApi.getRebates as any).mockResolvedValue(rebates);

      const result = await service.getRebates("user-1");
      expect(result).toEqual({ rebates });
    });
  });

  describe("getMarketRewardsDetail()", () => {
    const detail = {
      conditionId: "0xabc",
      rate_per_day: "100",
      total_rewards: "5000",
      remaining_reward_amount: "3200",
      max_spread: "0.04",
      min_size: "25",
    };

    it("returns cached detail when available", async () => {
      (redis.get as any).mockResolvedValue(JSON.stringify(detail));

      const result = await service.getMarketRewardsDetail("0xabc");
      expect(result).toEqual(detail);
      expect(clobRead.getRewardsForMarkets).not.toHaveBeenCalled();
    });

    it("fetches from CLOB and caches with 60s TTL on miss", async () => {
      (clobRead.getRewardsForMarkets as any).mockResolvedValue([detail]);

      const result = await service.getMarketRewardsDetail("0xabc");
      expect(result).toEqual(detail);
      expect(clobRead.getRewardsForMarkets).toHaveBeenCalledWith(["0xabc"]);
      expect(redis.set).toHaveBeenCalledWith(
        "cache:rewards:market-detail:0xabc",
        JSON.stringify(detail),
        60,
      );
    });

    it("returns null when CLOB returns empty results", async () => {
      (clobRead.getRewardsForMarkets as any).mockResolvedValue([]);

      const result = await service.getMarketRewardsDetail("0xnonexistent");
      expect(result).toBeNull();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe("getUserSponsoredMarkets()", () => {
    it("returns empty when user has no wallet", async () => {
      prisma = makePrisma(null);
      service = new RewardsService(
        prisma,
        redis,
        dataApi as any,
        clobRead as any,
      );

      const result = await service.getUserSponsoredMarkets("user-1");
      expect(result).toEqual({ markets: [] });
    });

    it("fetches sponsored markets for connected user", async () => {
      const markets = [{ conditionId: "c1", sponsored: true }];
      (dataApi.getUserSponsoredMarkets as any).mockResolvedValue(markets);

      const result = await service.getUserSponsoredMarkets("user-1");
      expect(result).toEqual({ markets });
      expect(dataApi.getUserSponsoredMarkets).toHaveBeenCalledWith("0xWallet");
    });
  });

  describe("getSponsorUrl()", () => {
    it("returns Polymarket deep-link for existing market", async () => {
      prisma.market.findUnique.mockResolvedValue({
        slug: "will-btc-hit-100k",
      });

      const result = await service.getSponsorUrl("market-123");
      expect(result).toEqual({
        url: "https://polymarket.com/event/will-btc-hit-100k/rewards",
      });
      expect(prisma.market.findUnique).toHaveBeenCalledWith({
        where: { id: "market-123" },
        select: { slug: true },
      });
    });

    it("throws NotFoundException when market not found", async () => {
      prisma.market.findUnique.mockResolvedValue(null);

      await expect(service.getSponsorUrl("no-such-market")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
