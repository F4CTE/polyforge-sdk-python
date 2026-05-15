import { describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import { ApiKeyThrottlerGuard } from "./api-key-throttler.guard";

// Helper: build a minimal JWT with a given sub claim.
// The token is NOT cryptographically signed — it only needs to survive
// base64url decoding in the guard's trackerFromAuthHeader path.
function makeJwt(sub: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub })).toString("base64url");
  return `${header}.${payload}.unsigned`;
}

// Helper: build a fake API-key token (pf_ prefix, opaque secret).
function makeApiKeyToken(suffix: string): string {
  return `pf_${suffix}`;
}

function makeRedis(ownerMap: Map<string, string> = new Map()): {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn((key: string) => Promise.resolve(ownerMap.get(key) ?? null)),
    set: vi.fn(() => Promise.resolve()),
  };
}

class TestApiKeyThrottlerGuard extends ApiKeyThrottlerGuard {
  tracker(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }

  weight(req: Record<string, unknown>): number {
    return (this as any).getRequestWeight(req);
  }

  injectRedis(redis: { get: any; set: any }): void {
    (this as any).redis = redis;
  }
}

describe("ApiKeyThrottlerGuard", () => {
  function makeGuard() {
    return new TestApiKeyThrottlerGuard({} as any, {} as any, {} as any);
  }

  // ── Identity tracking with pre-populated req.user / req.apiKeyMeta ─

  it("tracks API-key requests by owning user id instead of key id", async () => {
    const guard = makeGuard();

    await expect(
      guard.tracker({
        user: { sub: "user-1" },
        apiKeyMeta: { keyId: "key-1", userId: "user-1" },
        ip: "203.0.113.10",
      }),
    ).resolves.toBe("user:user-1");
  });

  it("does not multiply rate limits across multiple keys owned by the same user", async () => {
    const guard = makeGuard();

    await expect(
      Promise.all([
        guard.tracker({ apiKeyMeta: { keyId: "key-a", userId: "user-1" } }),
        guard.tracker({ apiKeyMeta: { keyId: "key-b", userId: "user-1" } }),
      ]),
    ).resolves.toEqual(["user:user-1", "user:user-1"]);
  });

  // ── Identity tracking from raw Authorization header (APP_GUARD runs first) ─

  it("falls back to IP for structurally valid JWTs when Redis is absent (no owner cache)", async () => {
    const guard = makeGuard();

    const jwt = makeJwt("user-jwt-1");

    // Without Redis, structurally valid JWTs fall back to IP because
    // there is no trusted identity source (no owner-cache hit, no
    // req.user / req.apiKeyMeta). Attacker-controlled three-part JWT
    // strings cannot create per-token throttle buckets.
    await expect(
      guard.tracker({
        headers: { authorization: `Bearer ${jwt}` },
        ip: "203.0.113.10",
      }),
    ).resolves.toBe("203.0.113.10");
  });

  it("falls back to IP for API-key requests when req.apiKeyMeta is not yet populated (no Redis cache)", async () => {
    const guard = makeGuard();

    const token = makeApiKeyToken("secret-42");

    const tracker = await guard.tracker({
      headers: { authorization: `Bearer ${token}` },
      ip: "203.0.113.10",
    });

    // Without Redis, even pf_ tokens fall back to IP — random pf_
    // strings that never pass JwtAuthGuard cannot create per-key
    // throttle buckets.
    expect(tracker).toBe("203.0.113.10");
  });

  it("falls back to IP for repeated API-key requests without Redis (shared IP bucket)", async () => {
    const guard = makeGuard();

    const token = makeApiKeyToken("pk_live_a1b2c3");

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${token}` },
      ip: "10.0.2.1",
    });
    const t2 = await guard.tracker({
      headers: { authorization: `Bearer ${token}` },
      ip: "10.0.2.1",
    });

    // Without a cached owner, both requests land on the shared IP bucket.
    expect(t1).toBe("10.0.2.1");
    expect(t2).toBe("10.0.2.1");
  });

  it("uses the same per-user tracker for different API keys owned by the same user (Redis owner cache)", async () => {
    const guard = makeGuard();

    // Inject a Redis mock that maps both API keys to the same user
    const tokenA = makeApiKeyToken("key-alpha");
    const tokenB = makeApiKeyToken("key-beta");
    const hashA = createHash("sha256").update(tokenA).digest("hex");
    const hashB = createHash("sha256").update(tokenB).digest("hex");
    const redis = makeRedis(
      new Map([
        [`apikey:owner:${hashA}`, "user-same"],
        [`apikey:owner:${hashB}`, "user-same"],
      ]),
    );
    (guard as any).redis = redis;

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const t2 = await guard.tracker({
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(t1).toBe("user:user-same");
    expect(t2).toBe("user:user-same");
  });

  it("uses different per-user trackers for API keys owned by different users", async () => {
    const guard = makeGuard();

    const tokenA = makeApiKeyToken("key-alpha");
    const tokenB = makeApiKeyToken("key-beta");
    const hashA = createHash("sha256").update(tokenA).digest("hex");
    const hashB = createHash("sha256").update(tokenB).digest("hex");
    const redis = makeRedis(
      new Map([
        [`apikey:owner:${hashA}`, "user-alice"],
        [`apikey:owner:${hashB}`, "user-bob"],
      ]),
    );
    (guard as any).redis = redis;

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const t2 = await guard.tracker({
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(t1).toBe("user:user-alice");
    expect(t2).toBe("user:user-bob");
  });

  it("falls back to IP when API-key Redis owner cache is cold (shared IP bucket)", async () => {
    const guard = makeGuard();

    const redis = makeRedis();
    (guard as any).redis = redis;

    const tokenA = makeApiKeyToken("key-alpha");
    const tokenB = makeApiKeyToken("key-beta");

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${tokenA}` },
      ip: "10.0.3.1",
    });
    const t2 = await guard.tracker({
      headers: { authorization: `Bearer ${tokenB}` },
      ip: "10.0.3.1",
    });

    // Cold cache → IP (no per-key hash). Random pf_ strings land on
    // the shared IP bucket until JwtAuthGuard warms the owner cache.
    expect(t1).toBe("10.0.3.1");
    expect(t2).toBe("10.0.3.1");
  });

  it("resolves JWT requests to per-user tracker when Redis owner cache is warm", async () => {
    const guard = makeGuard();

    const jwt = makeJwt("user-jwt-owned");
    const tokenHash = createHash("sha256").update(jwt).digest("hex");
    const redis = makeRedis(
      new Map([[`jwt:owner:${tokenHash}`, "user-cached"]]),
    );
    (guard as any).redis = redis;

    await expect(
      guard.tracker({
        headers: { authorization: `Bearer ${jwt}` },
      }),
    ).resolves.toBe("user:user-cached");
  });

  it("falls back to IP when Redis JWT owner cache is cold (shared IP bucket)", async () => {
    const guard = makeGuard();

    const redis = makeRedis();
    (guard as any).redis = redis;

    const jwtA = makeJwt("user-a");
    const jwtB = makeJwt("user-b");

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${jwtA}` },
      ip: "10.0.0.1",
    });
    const t2 = await guard.tracker({
      headers: { authorization: `Bearer ${jwtB}` },
      ip: "10.0.0.1",
    });

    // Cold cache → IP for both. Structurally valid but unauthenticated
    // JWTs share the IP bucket; they cannot select per-token buckets.
    expect(t1).toBe("10.0.0.1");
    expect(t2).toBe("10.0.0.1");
  });

  it("falls back to IP for repeated JWT requests when Redis cache is cold (shared IP bucket)", async () => {
    const guard = makeGuard();

    const jwt = makeJwt("stable-user");

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${jwt}` },
      ip: "10.0.1.1",
    });
    const t2 = await guard.tracker({
      headers: { authorization: `Bearer ${jwt}` },
      ip: "10.0.1.1",
    });

    // Same JWT, cold cache → both land on IP.
    expect(t1).toBe("10.0.1.1");
    expect(t2).toBe("10.0.1.1");
  });

  it("falls back to IP when Authorization header is absent", async () => {
    const guard = makeGuard();

    await expect(guard.tracker({ ip: "198.51.100.42" })).resolves.toBe(
      "198.51.100.42",
    );
  });

  it("falls back to IP for structurally valid JWTs without sub claim (cold cache)", async () => {
    const guard = makeGuard();

    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
      "base64url",
    );
    const payload = Buffer.from(JSON.stringify({ iss: "test" })).toString(
      "base64url",
    );
    const token = `${header}.${payload}.unsigned`;

    // Structurally valid (three base64url segments, parseable payload)
    // but no warm owner cache → falls back to IP.
    await expect(
      guard.tracker({
        headers: { authorization: `Bearer ${token}` },
        ip: "198.51.100.99",
      }),
    ).resolves.toBe("198.51.100.99");
  });

  it("falls back to IP when JWT is malformed", async () => {
    const guard = makeGuard();

    await expect(
      guard.tracker({
        headers: { authorization: "Bearer not.a.jwt" },
        ip: "198.51.100.77",
      }),
    ).resolves.toBe("198.51.100.77");
  });

  it("falls back to IP when Authorization header is not Bearer", async () => {
    const guard = makeGuard();

    await expect(
      guard.tracker({
        headers: { authorization: "Basic dXNlcjpwYXNz" },
        ip: "203.0.113.22",
      }),
    ).resolves.toBe("203.0.113.22");
  });

  // ── API key owner resolution (Redis cache only) ─

  it("falls back to IP when Redis API-key owner cache is cold (still checks Redis)", async () => {
    const guard = makeGuard();

    const token = makeApiKeyToken("pk-bypass");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const redis = makeRedis();
    guard.injectRedis(redis);

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${token}` },
      ip: "10.0.4.1",
    });

    // Cold cache → IP (no DB lookup). Random pf_ strings land on
    // the shared IP bucket until JwtAuthGuard warms the owner cache.
    expect(t1).toBe("10.0.4.1");

    // Redis was checked for the owner key
    expect(redis.get).toHaveBeenCalledWith(`apikey:owner:${tokenHash}`);
  });

  it("falls back to IP when Redis is unavailable (API key path)", async () => {
    const guard = makeGuard();

    const token = makeApiKeyToken("pk-no-infra");

    // No Redis → IP fallback (no per-key bucket)
    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${token}` },
      ip: "10.0.7.1",
    });

    expect(t1).toBe("10.0.7.1");
  });

  it("falls back to IP when Redis throws (API key path)", async () => {
    const guard = makeGuard();

    const token = makeApiKeyToken("pk-throw");

    const redis = {
      get: vi.fn().mockRejectedValue(new Error("connection lost")),
      set: vi.fn(() => Promise.resolve()),
    };
    guard.injectRedis(redis);

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${token}` },
      ip: "10.0.8.1",
    });

    // Redis error → IP (graceful degradation, no per-key bucket)
    expect(t1).toBe("10.0.8.1");
  });

  it("falls back to IP when Redis is unavailable (JWT path)", async () => {
    const guard = makeGuard();

    const jwt = makeJwt("user-no-redis");

    // No Redis → IP fallback (no per-token bucket)
    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${jwt}` },
      ip: "10.0.9.1",
    });

    expect(t1).toBe("10.0.9.1");
  });

  it("falls back to shared IP for two structurally valid JWTs without warm owner cache", async () => {
    const guard = makeGuard();

    const jwtA = makeJwt("user-a");
    const jwtB = makeJwt("user-b");
    const sharedIp = "10.0.0.99";

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${jwtA}` },
      ip: sharedIp,
    });
    const t2 = await guard.tracker({
      headers: { authorization: `Bearer ${jwtB}` },
      ip: sharedIp,
    });

    // Without a warm owner cache, both structurally valid tokens
    // share the IP bucket — no per-token isolation for unauthenticated
    // bearer traffic.
    expect(t1).toBe(sharedIp);
    expect(t2).toBe(sharedIp);
  });

  it("falls back to IP when Redis throws (JWT path)", async () => {
    const guard = makeGuard();

    const jwt = makeJwt("user-throw");

    const redis = {
      get: vi.fn().mockRejectedValue(new Error("connection lost")),
      set: vi.fn(() => Promise.resolve()),
    };
    guard.injectRedis(redis);

    const t1 = await guard.tracker({
      headers: { authorization: `Bearer ${jwt}` },
      ip: "10.0.10.1",
    });

    // Redis error → IP (graceful degradation, no per-token bucket)
    expect(t1).toBe("10.0.10.1");
  });

  // ── Request weight / batch throttling ─

  it("returns weight 1 for requests without a batch-orders body", () => {
    const guard = makeGuard();

    expect(guard.weight({ body: {} })).toBe(1);
    expect(guard.weight({ body: { notOrders: [1, 2, 3] } })).toBe(1);
    expect(guard.weight({})).toBe(1);
  });

  it("returns the batch order count as weight for batch endpoint requests", () => {
    const guard = makeGuard();

    expect(guard.weight({ body: { orders: [{ qty: 1 }] } })).toBe(1);
    expect(guard.weight({ body: { orders: Array(15).fill({ qty: 1 }) } })).toBe(
      15,
    );
    expect(guard.weight({ body: { orders: [] } })).toBe(1);
  });

  it("caps weight at MAX_BATCH_ORDERS_WEIGHT to prevent throttler self-DoS", () => {
    const guard = makeGuard();

    // Exactly at the cap — should return the cap value
    expect(
      guard.weight({ body: { orders: Array(100).fill({ qty: 1 }) } }),
    ).toBe(100);

    // Well beyond the cap — should still be capped
    expect(
      guard.weight({ body: { orders: Array(500).fill({ qty: 1 }) } }),
    ).toBe(100);
    expect(
      guard.weight({ body: { orders: Array(10000).fill({ qty: 1 }) } }),
    ).toBe(100);
  });
});
