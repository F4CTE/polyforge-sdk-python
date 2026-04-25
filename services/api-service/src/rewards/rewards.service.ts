import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { PolymarketDataApiService } from "../portfolio/polymarket-data-api.service";
import {
  ClobReadService,
  ClobRewardsMarketDetail,
} from "../common/services/clob-read.service";

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly dataApi: PolymarketDataApiService,
    private readonly clobRead: ClobReadService,
  ) {}

  async getRewardsMarkets() {
    const cacheKey = "cache:rewards:markets";
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const markets = await this.dataApi.getRewardsMarkets();
    await this.redis.set(cacheKey, JSON.stringify(markets), 300);
    return markets;
  }

  async getRewardsForMarket(conditionId: string) {
    const cacheKey = `cache:rewards:market:${conditionId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // no-op
      }
    }

    const reward = await this.dataApi.getRewardsForMarket(conditionId);
    if (reward) {
      await this.redis.set(cacheKey, JSON.stringify(reward), 300);
    }
    return reward;
  }

  async getUserRewards(userId: string) {
    const wallet = await this.getWalletAddress(userId);
    if (!wallet) return { rewards: [] };

    const rewards = await this.dataApi.getUserRewards(wallet);
    return { rewards };
  }

  async getUserRewardsTotal(userId: string) {
    const wallet = await this.getWalletAddress(userId);
    if (!wallet) return { total: "0", byDate: [] };

    return this.dataApi.getUserRewardsTotal(wallet);
  }

  async getUserRewardsPercentages(userId: string) {
    const wallet = await this.getWalletAddress(userId);
    if (!wallet) return {};

    return this.dataApi.getUserRewardsPercentages(wallet);
  }

  async getUserRewardsPerMarket(userId: string) {
    const wallet = await this.getWalletAddress(userId);
    if (!wallet) return { markets: [] };

    const markets = await this.dataApi.getUserRewardsPerMarket(wallet);
    return { markets };
  }

  async getRebates(userId: string) {
    const wallet = await this.getWalletAddress(userId);
    if (!wallet) return { rebates: [] };

    const rebates = await this.dataApi.getRebates(wallet);
    return { rebates };
  }

  async getMarketRewardsDetail(
    marketId: string,
  ): Promise<ClobRewardsMarketDetail | null> {
    const cacheKey = `cache:rewards:market-detail:${marketId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as ClobRewardsMarketDetail;
      } catch {
        // no-op
      }
    }

    const results = await this.clobRead.getRewardsForMarkets([marketId]);
    const detail = results[0] ?? null;
    if (detail) {
      await this.redis.set(cacheKey, JSON.stringify(detail), 60);
    }
    return detail;
  }

  async getUserSponsoredMarkets(userId: string) {
    const wallet = await this.getWalletAddress(userId);
    if (!wallet) return { markets: [] };

    const markets = await this.dataApi.getUserSponsoredMarkets(wallet);
    return { markets };
  }

  async getSponsorUrl(marketId: string): Promise<{ url: string }> {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      select: { slug: true },
    });
    if (!market) {
      throw new NotFoundException(`Market ${marketId} not found`);
    }
    return {
      url: `https://polymarket.com/event/${market.slug}/rewards`,
    };
  }

  private async getWalletAddress(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { polymarketAddress: true, polymarketConnected: true },
    });
    if (!user?.polymarketConnected || !user.polymarketAddress) return null;
    return user.polymarketAddress;
  }
}
