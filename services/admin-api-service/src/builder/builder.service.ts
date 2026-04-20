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

/**
 * Polymarket Builder tiers (matches Polymarket's actual 3-tier system):
 *
 *   UNVERIFIED  — default, relay limit 100
 *   VERIFIED    — after approval, relay limit 3000
 *   PARTNER     — special arrangement, unlimited relay
 *
 * The tier is determined by approval status, not by volume.
 * Configure via BUILDER_TIER env var or fetch from Polymarket API.
 */
const TIERS = [
  { name: "UNVERIFIED", relayLimit: 100 },
  { name: "VERIFIED", relayLimit: 3000 },
  { name: "PARTNER", relayLimit: Infinity },
];

function getTierByName(tierName: string): (typeof TIERS)[number] {
  return TIERS.find((t) => t.name === tierName.toUpperCase()) ?? TIERS[0];
}

@Injectable()
export class BuilderService {
  private readonly logger = new Logger(BuilderService.name);
  private readonly builderApiUrl: string;
  private readonly builderApiKey: string;
  private readonly builderSecret: string;
  private readonly builderPassphrase: string;
  private readonly configuredTier: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.builderApiUrl =
      this.config.get<string>("BUILDER_API_URL") ??
      "https://clob.polymarket.com";
    this.builderApiKey = this.config.get<string>("POLY_BUILDER_API_KEY") ?? "";
    this.builderSecret = this.config.get<string>("POLY_BUILDER_SECRET") ?? "";
    this.builderPassphrase =
      this.config.get<string>("POLY_BUILDER_PASSPHRASE") ?? "";
    this.configuredTier =
      this.config.get<string>("BUILDER_TIER") ?? "UNVERIFIED";
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

    const tier = getTierByName(builderData.currentTier ?? this.configuredTier);

    return {
      attributedVolumeUsdc: result._sum.size ?? 0,
      totalOrders: result._count.id,
      activeStrategies,
      connectedUsers,
      currentTier: tier.name,
      relayLimit: tier.relayLimit,
      weeklyRewardUsdc: builderData.weeklyRewardUsdc,
    };
  }

  /**
   * Fetch attributed trades and reward data from the Polymarket Builder API.
   * Falls back to configured tier on API failure.
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

      const currentTier = data.tier ?? this.configuredTier;
      const weeklyRewardUsdc = data.weeklyRewardUsdc ?? 0;

      return { currentTier, weeklyRewardUsdc };
    } catch (err) {
      this.logger.warn(
        "Failed to fetch builder data from Polymarket API, falling back to config",
        err,
      );
      return {
        currentTier: this.configuredTier,
        weeklyRewardUsdc: null,
      };
    }
  }

  async getBuilderLeaderboard(): Promise<{
    rank: number | null;
    totalBuilders: number;
    entries: unknown[];
  }> {
    try {
      const res = await fetch(`${this.builderApiUrl}/v1/builders/leaderboard`, {
        headers: {
          "POLY-API-KEY": this.builderApiKey,
          "POLY-API-SECRET": this.builderSecret,
          "POLY-API-PASSPHRASE": this.builderPassphrase,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`Builder leaderboard API returned ${res.status}`);
      }

      const data = (await res.json()) as {
        rank?: number;
        totalBuilders?: number;
        entries?: unknown[];
      };

      return {
        rank: data.rank ?? null,
        totalBuilders: data.totalBuilders ?? 0,
        entries: data.entries ?? [],
      };
    } catch (err) {
      this.logger.warn("Failed to fetch builder leaderboard", err);
      return { rank: null, totalBuilders: 0, entries: [] };
    }
  }

  async getBuilderVolume(): Promise<{ daily: unknown[]; totalVolume: number }> {
    try {
      const res = await fetch(`${this.builderApiUrl}/v1/builders/volume`, {
        headers: {
          "POLY-API-KEY": this.builderApiKey,
          "POLY-API-SECRET": this.builderSecret,
          "POLY-API-PASSPHRASE": this.builderPassphrase,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`Builder volume API returned ${res.status}`);
      }

      const data = (await res.json()) as {
        daily?: unknown[];
        totalVolume?: number;
      };

      return {
        daily: data.daily ?? [],
        totalVolume: data.totalVolume ?? 0,
      };
    } catch (err) {
      this.logger.warn("Failed to fetch builder volume", err);
      return { daily: [], totalVolume: 0 };
    }
  }
}
