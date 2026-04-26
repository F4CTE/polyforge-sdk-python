import type { RedisService } from "@polyforge/shared-redis";

const TA_PRICE_TTL = 86_400; // 24 hours
const MAX_WINDOW_SIZE = 250;

function key(tokenId: string): string {
  return `ta:prices:${tokenId}`;
}

export interface PricePoint {
  price: number;
  timestamp: number;
}

/**
 * Reads the most recent `count` price points for a token from the sorted set.
 * Returns entries in ascending timestamp order (oldest first).
 */
export async function readPriceWindow(
  redis: RedisService,
  tokenId: string,
  count: number,
): Promise<PricePoint[]> {
  const client = redis.getClient();
  const k = key(tokenId);
  // ZRANGE with BYSCORE rev to get last N entries, then reverse for asc order
  const raw = await client.zrange(k, -count, -1, "WITHSCORES");
  const result: PricePoint[] = [];
  // Members are stored as "timestamp:price" — parse price from the member
  for (let i = 0; i < raw.length; i += 2) {
    const colonIdx = raw[i].indexOf(":");
    result.push({
      price: Number(raw[i].slice(colonIdx + 1)),
      timestamp: Number(raw[i + 1]),
    });
  }
  return result;
}

/**
 * Writes a price point into the sorted set (score = timestamp).
 * Prunes the set to MAX_WINDOW_SIZE and sets a 24h TTL on first write.
 */
export async function writePricePoint(
  redis: RedisService,
  tokenId: string,
  price: number,
  timestamp: number,
): Promise<void> {
  const client = redis.getClient();
  const k = key(tokenId);

  const isNew = (await client.exists(k)) === 0;

  // Composite member "timestamp:price" ensures uniqueness across flat-price ticks
  await client.zadd(k, timestamp, `${timestamp}:${price}`);
  // Keep only the newest MAX_WINDOW_SIZE entries
  await client.zremrangebyrank(k, 0, -(MAX_WINDOW_SIZE + 1));

  if (isNew) {
    await client.expire(k, TA_PRICE_TTL);
  }
}
