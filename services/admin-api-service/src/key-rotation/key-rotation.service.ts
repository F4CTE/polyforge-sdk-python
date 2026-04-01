import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "@polyforge/shared-redis";
import { randomBytes, createHash } from "crypto";

const ROTATION_META_KEY = "jwt:rotation:meta";
const JWT_SECRET_CURRENT = "jwt:secret:current";
const JWT_SECRET_PREVIOUS = "jwt:secret:previous";
const GRACE_PERIOD_TTL = 60 * 60; // 1 hour

export interface RotationStatus {
  lastRotatedAt: string | null;
  nextScheduledAt: string | null;
  activeSecretsCount: number;
  status: "idle" | "rotating";
}

@Injectable()
export class KeyRotationService {
  private readonly logger = new Logger(KeyRotationService.name);

  constructor(private readonly redis: RedisService) {}

  async getStatus(): Promise<RotationStatus> {
    const meta = await this.redis.get(ROTATION_META_KEY);
    const currentExists = await this.redis.get(JWT_SECRET_CURRENT);
    const previousExists = await this.redis.get(JWT_SECRET_PREVIOUS);

    let activeSecretsCount = 0;
    if (currentExists) activeSecretsCount++;
    if (previousExists) activeSecretsCount++;

    if (!meta) {
      return {
        lastRotatedAt: null,
        nextScheduledAt: null,
        activeSecretsCount,
        status: "idle",
      };
    }

    const parsed = JSON.parse(meta);
    return {
      lastRotatedAt: parsed.lastRotatedAt ?? null,
      nextScheduledAt: parsed.nextScheduledAt ?? null,
      activeSecretsCount,
      status: parsed.status ?? "idle",
    };
  }

  async startRotation(): Promise<{
    secretHash: string;
    gracePeriodSeconds: number;
  }> {
    // Mark rotation in progress
    const now = new Date().toISOString();
    await this.redis.set(
      ROTATION_META_KEY,
      JSON.stringify({ lastRotatedAt: now, status: "rotating" }),
    );

    // Generate a new secret
    const newSecret = randomBytes(64).toString("hex");
    const secretHash = createHash("sha256").update(newSecret).digest("hex");

    // Move current secret to previous (with grace period TTL)
    const currentSecret = await this.redis.get(JWT_SECRET_CURRENT);
    if (currentSecret) {
      await this.redis.set(
        JWT_SECRET_PREVIOUS,
        currentSecret,
        GRACE_PERIOD_TTL,
      );
    }

    // Store new secret as current
    await this.redis.set(JWT_SECRET_CURRENT, newSecret);

    // Update rotation metadata
    await this.redis.set(
      ROTATION_META_KEY,
      JSON.stringify({
        lastRotatedAt: now,
        nextScheduledAt: null,
        status: "idle",
      }),
    );

    this.logger.log(
      `JWT secret rotated at ${now}. Grace period: ${GRACE_PERIOD_TTL}s`,
    );

    return { secretHash, gracePeriodSeconds: GRACE_PERIOD_TTL };
  }
}
