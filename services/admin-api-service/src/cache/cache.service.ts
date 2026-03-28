import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { RedisService } from "@polyforge/shared-redis";
import { FlushCacheDto } from "./flush-cache.dto";

@Injectable()
export class CacheAdminService {
  private readonly logger = new Logger(CacheAdminService.name);

  constructor(private readonly redis: RedisService) {}

  async getStats() {
    const client = this.redis.getClient();

    // Memory info
    const info = await client.info("memory");
    const memMatch = info.match(/used_memory_human:(.+)/);
    const memPeakMatch = info.match(/used_memory_peak_human:(.+)/);

    // Key counts by prefix
    const prefixes = [
      "cache:price:",
      "cache:book:",
      "cache:market:",
      "health:",
      "cache:notif-prefs:",
    ];
    const counts: Record<string, number> = {};

    for (const prefix of prefixes) {
      let count = 0;
      let cursor = "0";
      do {
        const [newCursor, keys] = await client.scan(
          cursor,
          "MATCH",
          `${prefix}*`,
          "COUNT",
          100,
        );
        cursor = newCursor;
        count += keys.length;
      } while (cursor !== "0");
      counts[prefix.replace(/:/g, "_").replace(/\*/, "")] = count;
    }

    const dbSize = await client.dbsize();

    return {
      memoryUsed: memMatch?.[1]?.trim(),
      memoryPeak: memPeakMatch?.[1]?.trim(),
      totalKeys: dbSize,
      keysByPrefix: counts,
    };
  }

  async flushPattern(pattern: string): Promise<{ keysDeleted: number }> {
    // Validate pattern is in whitelist to prevent dangerous flushes
    if (!FlushCacheDto.isAllowed(pattern)) {
      throw new BadRequestException(
        `Pattern "${pattern}" is not allowed. ` +
        `Allowed patterns: ${FlushCacheDto.ALLOWED_PATTERNS.join(", ")}`,
      );
    }

    const client = this.redis.getClient();
    let cursor = "0";
    let keysDeleted = 0;

    do {
      const [newCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = newCursor;
      if (keys.length > 0) {
        await client.del(...keys);
        keysDeleted += keys.length;
      }
    } while (cursor !== "0");

    this.logger.log(`Flushed ${keysDeleted} keys matching ${pattern}`);
    return { keysDeleted };
  }
}
