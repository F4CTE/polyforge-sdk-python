import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { OrderStatus } from "@prisma/client";

const CACHE_TTL_SECONDS = 60;

function monthKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function monthlyVolumeCacheKey(userId: string, now: Date = new Date()) {
  return `beta:monthly_volume:${userId}:${monthKey(now)}`;
}

/**
 * Returns the user's confirmed trade volume (USDC) for the current calendar month.
 *
 * Cache-aside with 60s TTL. Reads of CONFIRMED-only orders make the source of
 * truth eventually consistent up to the TTL window — acceptable because the
 * value can only change when an order transitions PENDING → CONFIRMED in
 * order-service (which is independent of this hot path).
 *
 * Falls back to a direct Prisma aggregate if Redis is unavailable so order
 * placement is never blocked by a cache outage.
 */
export async function getMonthlyConfirmedVolume(
  prisma: PrismaService,
  redis: RedisService,
  userId: string,
  options?: { bypassCache?: boolean },
): Promise<number> {
  const now = new Date();
  const cacheKey = monthlyVolumeCacheKey(userId, now);
  const bypassCache = options?.bypassCache === true;

  if (!bypassCache) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        const parsed = Number(cached);
        if (Number.isFinite(parsed)) return parsed;
      }
    } catch {
      // Redis unavailable — fall through to DB
    }
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const agg = await prisma.order.aggregate({
    where: {
      userId,
      status: OrderStatus.CONFIRMED,
      createdAt: { gte: monthStart },
    },
    _sum: { size: true },
  });
  const value = Number(agg._sum.size ?? 0);

  try {
    await redis.set(cacheKey, String(value), CACHE_TTL_SECONDS);
  } catch {
    // Best-effort cache write — never block the request
  }

  return value;
}

/**
 * Invalidate the cached monthly volume for a user. Intended for callers that
 * know the value just changed (e.g., admin adjustments). Order-service does
 * not need to call this — the 60s TTL covers normal PENDING → CONFIRMED lag.
 */
export async function invalidateMonthlyVolumeCache(
  redis: RedisService,
  userId: string,
): Promise<void> {
  try {
    await redis.del(monthlyVolumeCacheKey(userId));
  } catch {
    // Best-effort
  }
}
