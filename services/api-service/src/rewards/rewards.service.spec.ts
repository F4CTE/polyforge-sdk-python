import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RewardsService } from "./rewards.service";
import { PolymarketDataApiService } from "../portfolio/polymarket-data-api.service";
import { RedisService } from "@polyforge/shared-redis";

function makePrisma(user: any = null) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
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
    getRebates: vi.fn().mockResolvedValue([]),
  } as unknown as PolymarketDataApiService;
}

describe("RewardsService", () => {
  let service: RewardsService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: RedisService;
  let dataApi: ReturnType<typeof makeDataApi>;

  beforeEach(() => {
    prisma = makePrisma({
      polymarketAddress: "0xWallet",
      polymarketConnected: true,
    });
    redis = makeRedis();
    dataApi = makeDataApi();
    service = new RewardsService(prisma, redis, dataApi as any);
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
      service = new RewardsService(prisma, redis, dataApi as any);

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
      service = new RewardsService(prisma, redis, dataApi as any);

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
});
