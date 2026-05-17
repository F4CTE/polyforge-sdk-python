import { Injectable, Inject, Optional } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from "@nestjs/throttler";
import { RedisService } from "@polyforge/shared-redis";
import { createHash } from "crypto";

const APIKEY_OWNER_PREFIX = "apikey:owner:";
const APIKEY_OWNER_TTL = 120; // seconds, > default throttler window

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  @Optional()
  @Inject(RedisService)
  private readonly redis?: RedisService;

  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    // Track authenticated traffic by identity so multiple API keys or JWTs
    // cannot multiply rate limits.

    // When JwtAuthGuard has already populated the request (controller-level
    // guard runs before throttler on route-scoped modules), use the resolved
    // identity directly.
    const user = req["user"] as { sub?: string } | undefined;
    if (user?.sub) {
      return `user:${user.sub}`;
    }
    const apiKeyMeta = req["apiKeyMeta"] as { userId?: string } | undefined;
    if (apiKeyMeta?.userId) {
      return `user:${apiKeyMeta.userId}`;
    }

    // This guard is registered as a global APP_GUARD and runs BEFORE
    // controller-level JwtAuthGuard.  Extract identity from the raw
    // Authorization header so authenticated traffic is tracked per-user
    // even before the JWT guard populates req.user / req.apiKeyMeta.
    const authHeader = this.extractAuthHeader(req);
    if (authHeader) {
      const tracker = await this.trackerFromAuthHeader(authHeader);
      if (tracker) return tracker;
    }

    // Fallback to IP for unauthenticated requests
    return (req["ip"] as string | undefined) ?? "";
  }

  private extractAuthHeader(req: Record<string, unknown>): string | undefined {
    const headers = req["headers"] as
      | Record<string, string | string[] | undefined>
      | undefined;
    if (!headers) return undefined;
    const raw = headers["authorization"];
    return Array.isArray(raw) ? raw[0] : raw;
  }

  private async trackerFromAuthHeader(
    header: string,
  ): Promise<string | undefined> {
    if (!header.startsWith("Bearer ")) return undefined;
    const token = header.slice(7);

    // API-key tokens use the pf_ prefix and are opaque secrets.  Use a
    // lightweight Redis cache populated by JwtAuthGuard to resolve the
    // owning user.  When the cache is warm, same-user API keys share a
    // per-user rate-limit bucket even when this global guard runs before
    // the controller-level JwtAuthGuard.
    //
    // When the cache is cold or Redis is unavailable, fall back to IP.
    // Random pf_ strings that never pass JwtAuthGuard will never have a
    // warm cache entry and therefore always land on the shared IP bucket
    // instead of receiving attacker-controlled per-key hash buckets.
    if (token.startsWith("pf_")) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const ownerKey = `${APIKEY_OWNER_PREFIX}${tokenHash}`;
      if (this.redis) {
        try {
          const userId = await this.redis.get(ownerKey);
          if (userId) {
            return `user:${userId}`;
          }
        } catch {
          /* Redis unavailable — fall through to IP */
        }
      }
      return undefined;
    }

    // JWT tokens — do NOT decode unverified claims.  Decoding `sub`
    // from an unverified token enables rate-limit poisoning: an
    // attacker can forge a JWT carrying a victim's sub to drain the
    // victim's rate-limit budget before JwtAuthGuard rejects it.
    //
    // Check Redis for a JwtAuthGuard-cached token→user mapping
    // (mirrors the API-key path).  Only structurally valid JWTs
    // (3 base64url parts with parseable payload) proceed to the Redis
    // lookup; malformed tokens fall through to IP without a Redis call.
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return undefined;
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch {
      return undefined; // malformed → IP fallback
    }

    // Redis owner cache is cold or Redis unavailable — fall back to IP.
    // Only a warm owner-cache hit (written by JwtAuthGuard after successful
    // verification) moves JWT traffic out of the unauthenticated/IP bucket.
    // Unauthenticated callers who mint unsigned/forged three-part JWTs
    // will never have a warm cache entry and therefore stay on IP.
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const ownerKey = `jwt:owner:${tokenHash}`;
    if (this.redis) {
      try {
        const userId = await this.redis.get(ownerKey);
        if (userId) {
          return `user:${userId}`;
        }
      } catch {
        /* Redis unavailable — fall through to IP */
      }
    }
    return undefined;
  }

  /**
   * Charge the rate-limit counter once per item for batch endpoints so
   * that a batch of N orders consumes N hits against the budget instead
   * of bypassing single-order endpoint limits.
   */
  protected override async handleRequest(requestProps: any): Promise<boolean> {
    const { context } = requestProps;
    const { req } = this.getRequestResponse(context);
    const weight = this.getRequestWeight(req as Record<string, unknown>);

    if (weight <= 1) {
      return super.handleRequest(requestProps);
    }

    // Call the base implementation once per batch item. Each call increments
    // the counter by 1; when the limit is reached the base class throws
    // ThrottlerException which propagates naturally.
    for (let i = 0; i < weight; i++) {
      await super.handleRequest(requestProps);
    }

    return true;
  }

  /**
   * Maximum number of batch orders we will charge against the rate-limit
   * budget.  Legitimate batch endpoints validate a far lower limit at the DTO
   * layer; this cap exists only to prevent a self-DoS inside the throttler
   * guard when an attacker sends an oversized `body.orders` array before
   * validation runs.
   */
  private static readonly MAX_BATCH_ORDERS_WEIGHT = 100;

  private getRequestWeight(req: Record<string, unknown>): number {
    try {
      const body = req["body"] as Record<string, unknown> | undefined;
      if (body && Array.isArray(body["orders"])) {
        const count = body["orders"].length;
        if (count === 0) {
          return 1;
        }
        return Math.min(count, ApiKeyThrottlerGuard.MAX_BATCH_ORDERS_WEIGHT);
      }
    } catch {
      /* body may not be parsed yet — fall back to 1 */
    }
    return 1;
  }
}
