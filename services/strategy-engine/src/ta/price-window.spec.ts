import { describe, it, expect, vi, beforeEach } from "vitest";
import { readPriceWindow, writePricePoint } from "./price-window";

// ─── Stateful sorted-set fake ─────────────────────────────────────────────────

/**
 * In-memory fake that mirrors Redis sorted-set semantics:
 * - members are unique strings
 * - ZADD overwrites score for an existing member
 * - ZRANGE returns members sorted by score ascending
 * - ZREMRANGEBYRANK prunes by rank
 * - WITHSCORES interleaves member, score, member, score…
 */
function makeFakeRedis() {
  // key → Map<member, score>
  const store = new Map<string, Map<string, number>>();
  const ttls = new Map<string, number>();
  let existsCallCount = 0;

  function getSet(k: string): Map<string, number> {
    if (!store.has(k)) store.set(k, new Map());
    return store.get(k)!;
  }

  function sorted(k: string): [string, number][] {
    return [...getSet(k).entries()].sort(([, a], [, b]) => a - b);
  }

  const client = {
    exists: vi.fn(async (k: string) => {
      existsCallCount++;
      return store.has(k) && store.get(k)!.size > 0 ? 1 : 0;
    }),
    zadd: vi.fn(async (k: string, score: number, member: string) => {
      const set = getSet(k);
      const isNew = !set.has(member);
      set.set(member, score);
      return isNew ? 1 : 0;
    }),
    zremrangebyrank: vi.fn(
      async (k: string, start: number, stop: number) => {
        const entries = sorted(k);
        const len = entries.length;
        const normStart = start < 0 ? Math.max(0, len + start) : start;
        const normStop = stop < 0 ? len + stop : Math.min(stop, len - 1);
        // Empty range when stop resolves before start (set smaller than window)
        if (normStop < normStart) return 0;
        const toRemove = entries.slice(normStart, normStop + 1);
        for (const [m] of toRemove) getSet(k).delete(m);
        return toRemove.length;
      },
    ),
    expire: vi.fn(async (k: string, ttl: number) => {
      ttls.set(k, ttl);
      return 1;
    }),
    zrange: vi.fn(
      async (k: string, start: number, stop: number, flag?: string) => {
        const entries = sorted(k);
        const len = entries.length;
        const normStart = start < 0 ? Math.max(0, len + start) : start;
        const normStop = stop < 0 ? len + stop : Math.min(stop, len - 1);
        const slice = entries.slice(normStart, normStop + 1);
        if (flag === "WITHSCORES") {
          return slice.flatMap(([m, s]) => [m, String(s)]);
        }
        return slice.map(([m]) => m);
      },
    ),
    _store: store,
    _ttls: ttls,
    _existsCallCount: () => existsCallCount,
  };

  const redis = { getClient: () => client } as any;
  return { redis, client };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("writePricePoint", () => {
  let redis: any;
  let client: ReturnType<typeof makeFakeRedis>["client"];

  beforeEach(() => {
    ({ redis, client } = makeFakeRedis());
  });

  it("stores a price entry in the sorted set", async () => {
    await writePricePoint(redis, "tok1", 0.5, 1000);
    const entries = client._store.get("ta:prices:tok1");
    expect(entries?.size).toBe(1);
  });

  it("uses composite member 'timestamp:price' to prevent key collision", async () => {
    await writePricePoint(redis, "tok1", 0.5, 1000);
    await writePricePoint(redis, "tok1", 0.5, 2000);
    const entries = client._store.get("ta:prices:tok1");
    // Both ticks must be stored even though price is identical
    expect(entries?.size).toBe(2);
    expect(entries?.has("1000:0.5")).toBe(true);
    expect(entries?.has("2000:0.5")).toBe(true);
  });

  it("trims the window to 250 entries after exceeding limit", async () => {
    for (let i = 0; i < 260; i++) {
      await writePricePoint(redis, "tok1", i, i);
    }
    // Read back more than we wrote to count actual stored entries
    const result = await readPriceWindow(redis, "tok1", 300);
    expect(result).toHaveLength(250);
  });

  it("retains the 250 most-recent (highest timestamp) entries after trim", async () => {
    for (let i = 0; i < 260; i++) {
      await writePricePoint(redis, "tok1", i, i);
    }
    const result = await readPriceWindow(redis, "tok1", 300);
    // Oldest timestamps (0-9) should be pruned; timestamps 10-259 remain
    const timestamps = result.map((p) => p.timestamp);
    expect(timestamps).not.toContain(0);
    expect(timestamps).not.toContain(9);
    expect(timestamps).toContain(10);
    expect(timestamps).toContain(259);
  });

  it("sets 24h TTL on first write", async () => {
    await writePricePoint(redis, "tok1", 0.5, 1000);
    expect(client._ttls.get("ta:prices:tok1")).toBe(86_400);
  });

  it("does NOT reset TTL on subsequent writes", async () => {
    await writePricePoint(redis, "tok1", 0.5, 1000);
    client.expire.mockClear();
    await writePricePoint(redis, "tok1", 0.6, 2000);
    expect(client.expire).not.toHaveBeenCalled();
  });

  it("uses the correct Redis key pattern ta:prices:{tokenId}", async () => {
    await writePricePoint(redis, "abc123", 0.5, 1000);
    expect(client._store.has("ta:prices:abc123")).toBe(true);
    expect(client._store.has("ta:prices:tok1")).toBe(false);
  });
});

describe("readPriceWindow", () => {
  let redis: any;

  beforeEach(() => {
    ({ redis } = makeFakeRedis());
  });

  it("returns empty array when key does not exist", async () => {
    const result = await readPriceWindow(redis, "tok1", 10);
    expect(result).toEqual([]);
  });

  it("round-trips a single price point correctly", async () => {
    await writePricePoint(redis, "tok1", 0.75, 5000);
    const result = await readPriceWindow(redis, "tok1", 10);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBeCloseTo(0.75);
    expect(result[0].timestamp).toBe(5000);
  });

  it("returns prices in ascending timestamp order (oldest first)", async () => {
    await writePricePoint(redis, "tok1", 0.50, 3000);
    await writePricePoint(redis, "tok1", 0.60, 1000);
    await writePricePoint(redis, "tok1", 0.55, 2000);
    const result = await readPriceWindow(redis, "tok1", 10);
    expect(result.map((p) => p.timestamp)).toEqual([1000, 2000, 3000]);
  });

  it("returns at most `count` entries from the tail", async () => {
    for (let i = 0; i < 20; i++) {
      await writePricePoint(redis, "tok1", i * 0.01, i * 100);
    }
    const result = await readPriceWindow(redis, "tok1", 5);
    expect(result).toHaveLength(5);
    // Last 5 timestamps: 1500, 1600, 1700, 1800, 1900
    expect(result[0].timestamp).toBe(1500);
    expect(result[4].timestamp).toBe(1900);
  });

  it("handles flat prices (same price, different timestamps) correctly", async () => {
    const price = 0.5;
    for (let i = 0; i < 5; i++) {
      await writePricePoint(redis, "tok1", price, i * 1000);
    }
    const result = await readPriceWindow(redis, "tok1", 10);
    // All 5 must be returned — member uniqueness fix prevents collision
    expect(result).toHaveLength(5);
    for (const pt of result) {
      expect(pt.price).toBeCloseTo(0.5);
    }
  });
});
