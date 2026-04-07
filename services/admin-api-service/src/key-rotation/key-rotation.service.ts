import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "@polyforge/shared-redis";
import { createHash } from "crypto";

const ROTATION_META_KEY = "jwt:rotation:meta";
const SESSION_KEY_PATTERN = "admin:session:*";

export interface RotationStatus {
  lastRotatedAt: string | null;
  nextScheduledAt: string | null;
  sessionsInvalidated: number;
  status: "idle" | "rotating";
}

@Injectable()
export class KeyRotationService {
  private readonly logger = new Logger(KeyRotationService.name);

  constructor(private readonly redis: RedisService) {}

  async getStatus(): Promise<RotationStatus> {
    const meta = await this.redis.get(ROTATION_META_KEY);

    if (!meta) {
      return {
        lastRotatedAt: null,
        nextScheduledAt: null,
        sessionsInvalidated: 0,
        status: "idle",
      };
    }

    const parsed = JSON.parse(meta);
    return {
      lastRotatedAt: parsed.lastRotatedAt ?? null,
      nextScheduledAt: parsed.nextScheduledAt ?? null,
      sessionsInvalidated: parsed.sessionsInvalidated ?? 0,
      status: parsed.status ?? "idle",
    };
  }

  async startRotation(): Promise<{
    sessionsInvalidated: number;
    rotatedAt: string;
    note: string;
  }> {
    const now = new Date().toISOString();

    // Mark rotation in progress
    await this.redis.set(
      ROTATION_META_KEY,
      JSON.stringify({ lastRotatedAt: now, status: "rotating" }),
    );

    // Flush all active admin sessions — forces every admin to re-login.
    // This is the immediate response to a suspected credential compromise.
    const invalidated = await this.flushSessionKeys();

    // Hash the current ADMIN_JWT_SECRET for audit reference
    const envSecret = process.env.ADMIN_JWT_SECRET ?? "";
    const currentSecretHash = createHash("sha256")
      .update(envSecret)
      .digest("hex")
      .slice(0, 16);

    // Update rotation metadata
    await this.redis.set(
      ROTATION_META_KEY,
      JSON.stringify({
        lastRotatedAt: now,
        nextScheduledAt: null,
        sessionsInvalidated: invalidated,
        currentSecretHash,
        status: "idle",
      }),
    );

    this.logger.warn(
      `Key rotation triggered at ${now}: ${invalidated} admin sessions invalidated. ` +
        `Update ADMIN_JWT_SECRET env var and restart services to complete rotation.`,
    );

    return {
      sessionsInvalidated: invalidated,
      rotatedAt: now,
      note:
        "All admin sessions have been invalidated. " +
        "To complete the rotation, update the ADMIN_JWT_SECRET environment variable and restart all services.",
    };
  }

  /**
   * Scan and delete all `admin:session:*` keys from Redis.
   * Uses SCAN to avoid blocking Redis on large keyspaces.
   */
  private async flushSessionKeys(): Promise<number> {
    const client = this.redis.getClient();
    let cursor = "0";
    let deleted = 0;

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        SESSION_KEY_PATTERN,
        "COUNT",
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== "0");

    return deleted;
  }
}
