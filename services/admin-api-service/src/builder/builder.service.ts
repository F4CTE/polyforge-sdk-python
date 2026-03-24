import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@polyforge/shared-db";

interface BuilderTrade {
  id: string;
  volume: string;
  timestamp: string;
}

interface BuilderTradesResponse {
  trades: BuilderTrade[];
  totalVolume: number;
  tier: string;
  weeklyRewardUsdc: number;
}

const TIER_THRESHOLDS: Record<string, number> = {
  BRONZE: 0,
  SILVER: 50_000,
  GOLD: 250_000,
  PLATINUM: 1_000_000,
  DIAMOND: 5_000_000,
};

function computeTierFromVolume(volumeUsdc: number): string {
  let tier = "BRONZE";
  for (const [name, threshold] of Object.entries(TIER_THRESHOLDS)) {
    if (volumeUsdc >= threshold) tier = name;
  }
  return tier;
}

@Injectable()
export class BuilderService {
  private readonly logger = new Logger(BuilderService.name);
  private readonly builderApiUrl: string;
  private readonly builderApiKey: string;
  private readonly builderSecret: string;
  private readonly builderPassphrase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.builderApiUrl =
      this.config.get<string>("BUILDER_API_URL") ??
      "https://clob.polymarket.com";
    this.builderApiKey =
      this.config.get<string>("POLY_BUILDER_API_KEY") ?? "";
    this.builderSecret =
      this.config.get<string>("POLY_BUILDER_SECRET") ?? "";
    this.builderPassphrase =
      this.config.get<string>("POLY_BUILDER_PASSPHRASE") ?? "";
  }

  async getStats() {
    // Aggregate live strategy volume (CONFIRMED orders from live strategies)
    const result = await this.prisma.order.aggregate({
      where: {
        status: "CONFIRMED",
        strategyId: { not: null },
      },
      _sum: { size: true },
      _count: { id: true },
    });

    // Active strategies (RUNNING)
    const activeStrategies = await this.prisma.strategy.count({
      where: { status: "RUNNING" },
    });

    // Connected users (have Polymarket credentials)
    const connectedUsers = await this.prisma.user.count({
      where: { polymarketConnected: true, suspended: false, deleted: false },
    });

    // Fetch tier and weekly reward from Polymarket Builder API
    const builderData = await this.fetchBuilderData();

    return {
      attributedVolumeUsdc: result._sum.size ?? 0,
      totalOrders: result._count.id,
      activeStrategies,
      connectedUsers,
      currentTier: builderData.currentTier,
      weeklyRewardUsdc: builderData.weeklyRewardUsdc,
    };
  }

  /**
   * Fetch attributed trades and reward data from the Polymarket Builder API.
   * Falls back to local data calculation on API failure.
   */
  async fetchBuilderData(): Promise<{
    currentTier: string | null;
    weeklyRewardUsdc: number | null;
  }> {
    try {
      const res = await fetch(`${this.builderApiUrl}/builder-trades`, {
        headers: {
          "POLY-API-KEY": this.builderApiKey,
          "POLY-API-SECRET": this.builderSecret,
          "POLY-API-PASSPHRASE": this.builderPassphrase,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`Builder API returned ${res.status}`);
      }

      const data = (await res.json()) as BuilderTradesResponse;

      // Use API-provided tier/reward, or compute tier from cumulative volume
      const currentTier = data.tier ?? computeTierFromVolume(data.totalVolume);
      const weeklyRewardUsdc = data.weeklyRewardUsdc ?? 0;

      return { currentTier, weeklyRewardUsdc };
    } catch (err) {
      this.logger.warn("Failed to fetch builder data from Polymarket API, falling back to local", err);
      return this.computeLocalBuilderData();
    }
  }

  private async computeLocalBuilderData(): Promise<{
    currentTier: string | null;
    weeklyRewardUsdc: number | null;
  }> {
    try {
      const result = await this.prisma.order.aggregate({
        where: {
          status: "CONFIRMED",
          strategyId: { not: null },
        },
        _sum: { size: true },
      });

      const volume = result._sum.size ?? 0;
      return {
        currentTier: computeTierFromVolume(Number(volume)),
        weeklyRewardUsdc: null, // cannot determine locally
      };
    } catch {
      return { currentTier: null, weeklyRewardUsdc: null };
    }
  }
}
