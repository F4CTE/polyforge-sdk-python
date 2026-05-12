import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "./redis.service";
import {
  BetaLimits,
  BETA_LIMITS_DEFAULTS,
  BETA_LIMITS_KEY,
  betaLimitFieldKey,
} from "./beta-limits-config.types";

@Injectable()
export class BetaLimitsConfigService {
  private readonly logger = new Logger(BetaLimitsConfigService.name);

  constructor(private readonly redis: RedisService) {}

  async getAllLimits(): Promise<BetaLimits> {
    try {
      const stored = await this.redis.getJson<Partial<BetaLimits>>(
        BETA_LIMITS_KEY,
      );
      if (stored) {
        return { ...BETA_LIMITS_DEFAULTS, ...stored };
      }
    } catch (err) {
      this.logger.warn(
        "Failed to read beta limits from Redis, falling back to env defaults",
        err,
      );
    }
    return { ...BETA_LIMITS_DEFAULTS };
  }

  async getLimit<K extends keyof BetaLimits>(key: K): Promise<BetaLimits[K]> {
    try {
      const fieldKey = betaLimitFieldKey(key);
      const val = await this.redis.get(fieldKey);
      if (val !== null) {
        const parsed = Number(val);
        if (!Number.isNaN(parsed)) return parsed as BetaLimits[K];
      }
      // Fall back to the JSON blob (legacy / full sync)
      const stored = await this.redis.getJson<Partial<BetaLimits>>(
        BETA_LIMITS_KEY,
      );
      if (stored && stored[key] !== undefined) {
        return stored[key] as BetaLimits[K];
      }
    } catch (err) {
      this.logger.warn(
        `Failed to read beta limit '${key}' from Redis, falling back to env default`,
        err,
      );
    }
    return BETA_LIMITS_DEFAULTS[key];
  }

  async setLimits(
    updates: Partial<BetaLimits>,
  ): Promise<BetaLimits> {
    const current = await this.getAllLimits();
    const merged = { ...current, ...updates };

    // Write both the full JSON blob and per-field keys for fast single-key reads
    await Promise.all([
      this.redis.setJson(BETA_LIMITS_KEY, merged),
      ...Object.entries(updates).map(([key, value]) =>
        this.redis.set(
          betaLimitFieldKey(key as keyof BetaLimits),
          String(value),
        ),
      ),
    ]);

    return merged;
  }
}
