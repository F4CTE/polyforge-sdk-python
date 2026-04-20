import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { PolymarketDataApiService } from "../portfolio/polymarket-data-api.service";

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly dataApi: PolymarketDataApiService,
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

  private async getWalletAddress(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { polymarketAddress: true, polymarketConnected: true },
    });
    if (!user?.polymarketConnected || !user.polymarketAddress) return null;
    return user.polymarketAddress;
  }
}
