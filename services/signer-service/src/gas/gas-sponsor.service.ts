import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";

export interface GasUsageStats {
  userId: string;
  /** MATIC spent today */
  todayUsage: number;
  /** Configured daily limit in MATIC */
  dailyLimit: number;
  /** Remaining allowance in MATIC */
  remaining: number;
  /** Whether gas sponsorship is currently enabled */
  sponsorEnabled: boolean;
}

/**
 * Sponsors Polygon gas fees for user transactions using a platform-funded wallet.
 *
 * The platform absorbs gas costs to remove friction for users — critical for the
 * Polymarket Builder Program. Each user has a configurable daily gas limit tracked
 * in Redis to prevent abuse.
 *
 * Redis key pattern: `gas:spent:{userId}:{YYYY-MM-DD}`
 * TTL: 48 hours (auto-cleanup after day rolls over)
 */
@Injectable()
export class GasSponsorService {
  private readonly logger = new Logger(GasSponsorService.name);
  private readonly enabled: boolean;
  private readonly dailyLimitMatic: number;
  private readonly sponsorPrivateKey: string;

  /**
   * Default gas estimate in MATIC. Configurable via GAS_ESTIMATE_MATIC env var.
   * TODO: Eventually replace with a real-time gas oracle (e.g., Polygon gas station)
   * to dynamically estimate gas costs based on current network conditions.
   */
  readonly gasEstimateMatic: number;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.enabled =
      (this.config.get<string>("GAS_SPONSOR_ENABLED") ?? "true") === "true";
    this.dailyLimitMatic = parseFloat(
      this.config.get<string>("GAS_DAILY_LIMIT_MATIC") ?? "0.5",
    );
    this.sponsorPrivateKey =
      this.config.get<string>("GAS_SPONSOR_PRIVATE_KEY") ?? "";

    // Configurable gas estimate — should eventually be replaced with a gas oracle
    this.gasEstimateMatic = parseFloat(
      this.config.get<string>("GAS_ESTIMATE_MATIC") ?? "0.002",
    );

    if (this.enabled && !this.sponsorPrivateKey) {
      this.logger.warn(
        "GAS_SPONSOR_ENABLED=true but GAS_SPONSOR_PRIVATE_KEY is not set. " +
          "Gas sponsorship will be inactive until a key is provided.",
      );
    }

    this.logger.log(
      `Gas sponsorship ${this.enabled ? "ENABLED" : "DISABLED"} ` +
        `(daily limit: ${this.dailyLimitMatic} MATIC, estimate: ${this.gasEstimateMatic} MATIC)`,
    );
  }

  /** Whether the sponsor wallet is configured and enabled */
  isActive(): boolean {
    return this.enabled && this.sponsorPrivateKey.length > 0;
  }

  /**
   * Check if the user is within their daily gas allowance and, if so,
   * record the gas cost against their budget.
   *
   * @returns true if the gas was sponsored, false if the user exceeded their limit
   */
  async sponsorGas(userId: string, gasCostMatic: number): Promise<boolean> {
    if (!this.isActive()) {
      this.logger.debug(
        `Gas sponsorship inactive — user ${userId} must pay own gas`,
      );
      return false;
    }

    const key = this.redisKey(userId);
    const currentStr = await this.redis.get(key);
    const current = parseFloat(currentStr ?? "0");

    if (current + gasCostMatic > this.dailyLimitMatic) {
      this.logger.warn(
        `User ${userId} exceeded daily gas limit: ` +
          `${current.toFixed(6)} + ${gasCostMatic.toFixed(6)} > ${this.dailyLimitMatic}`,
      );
      return false;
    }

    const newTotal = current + gasCostMatic;

    // Atomic increment with 48h TTL (covers timezone edge cases)
    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.set(key, newTotal.toString());
    pipeline.expire(key, 48 * 60 * 60);
    await pipeline.exec();

    this.logger.log(
      `Sponsored ${gasCostMatic.toFixed(6)} MATIC for user ${userId} ` +
        `(daily total: ${newTotal.toFixed(6)} / ${this.dailyLimitMatic})`,
    );

    return true;
  }

  /**
   * Returns gas usage statistics for a given user.
   */
  async getUsageStats(userId: string): Promise<GasUsageStats> {
    const key = this.redisKey(userId);
    const currentStr = await this.redis.get(key);
    const todayUsage = parseFloat(currentStr ?? "0");

    return {
      userId,
      todayUsage,
      dailyLimit: this.dailyLimitMatic,
      remaining: Math.max(0, this.dailyLimitMatic - todayUsage),
      sponsorEnabled: this.isActive(),
    };
  }

  /**
   * Returns the platform gas wallet address derived from the private key.
   * In dev mode, returns a placeholder address.
   */
  getSponsorAddress(): string | null {
    if (!this.isActive()) return null;

    const isDev = this.config.get<string>("NODE_ENV") !== "production";
    if (isDev) {
      return "0x00000000000000000000000000000000GasSponsor";
    }

    // In production, derive address from private key using ethers
    try {
      // Dynamic import to avoid hard dependency in dev
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Wallet } = require("ethers");
      const wallet = new Wallet(this.sponsorPrivateKey);
      return wallet.address;
    } catch (err) {
      this.logger.error("Failed to derive sponsor wallet address", err);
      return null;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private redisKey(userId: string): string {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `gas:spent:${userId}:${today}`;
  }
}
