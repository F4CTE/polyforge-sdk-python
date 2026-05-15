import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  Inject,
  Optional,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { JwtPayload } from "@polyforge/shared-types";
import { createHash } from "crypto";

interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: JwtPayload;
  apiKeyMeta?: { keyId: string; userId: string; scopes: string[] };
}

// ── JWT verification cache (in-memory, 5s TTL with LRU eviction) ────────────
// Avoids re-verifying the same JWT token on every request within the TTL window.
// Reduced from 30s to 5s to minimize the post-password-change attack window.
// Also checks Redis pwchange key to immediately invalidate cached tokens.
// Uses LRU eviction: when cache exceeds max size, deletes oldest entries first.
const JWT_CACHE = new Map<string, { user: JwtPayload; expiresAt: number }>();
const JWT_CACHE_TTL = 5_000; // 5 seconds (reduced from 30s for security)
const MAX_CACHE_SIZE = 10_000;
const SUSPENDED_USER_KEY = (userId: string) => `suspended:${userId}`;
const PASSWORD_CHANGED_KEY = (userId: string) => `pwchange:${userId}`;
const JWT_OWNER_TTL = 120; // seconds — must exceed the throttler window

function getCachedJwtUser(token: string): JwtPayload | null {
  const cached = JWT_CACHE.get(token);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    JWT_CACHE.delete(token);
    return null;
  }
  return cached.user;
}

function setCachedJwtUser(token: string, user: JwtPayload): void {
  // LRU eviction: delete oldest entries when cache is at max capacity
  if (JWT_CACHE.size >= MAX_CACHE_SIZE) {
    // Map preserves insertion order; delete the oldest 10% of entries
    const entriesToDelete = Math.ceil(MAX_CACHE_SIZE * 0.1);
    let deleted = 0;
    for (const key of JWT_CACHE.keys()) {
      if (deleted >= entriesToDelete) break;
      JWT_CACHE.delete(key);
      deleted++;
    }
  }
  JWT_CACHE.set(token, { user, expiresAt: Date.now() + JWT_CACHE_TTL });
}

/** Invalidate all cached entries for a given userId */
export function invalidateJwtCacheForUser(userId: string): void {
  for (const [token, entry] of JWT_CACHE.entries()) {
    if (entry.user?.sub === userId) {
      JWT_CACHE.delete(token);
    }
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(RedisService) private readonly redis?: RedisService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HttpRequest>();

    const rawAuth = request.headers?.authorization;
    const authHeader: string | undefined = Array.isArray(rawAuth)
      ? rawAuth[0]
      : rawAuth;

    // ── JWT cache fast-path: skip re-verification for recently verified tokens ─
    // Also checks Redis pwchange key to prevent post-password-change attack window
    if (
      authHeader?.startsWith("Bearer ") &&
      !authHeader.startsWith("Bearer pf_")
    ) {
      const token = authHeader.slice(7);
      const cachedUser = getCachedJwtUser(token);
      if (cachedUser) {
        await this.assertJwtUserActive(cachedUser, token);
        request.user = cachedUser;
        this.cacheJwtOwner(token, cachedUser.sub);
        return true;
      }
    }

    // ── API-key path: Bearer pf_… ──────────────────────────────────────────
    if (authHeader?.startsWith("Bearer pf_")) {
      const token = authHeader.slice(7); // strip "Bearer "
      const tokenHash = createHash("sha256").update(token).digest("hex");

      const apiKey = await this.prisma.apiKey.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!apiKey) {
        this.deleteApiKeyOwnerCache(tokenHash);
        throw new UnauthorizedException("Invalid API key");
      }

      if (apiKey.revoked) {
        this.deleteApiKeyOwnerCache(tokenHash);
        throw new UnauthorizedException("API key has been revoked");
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        this.deleteApiKeyOwnerCache(tokenHash);
        throw new UnauthorizedException("API key has expired");
      }

      if (apiKey.user.suspended) {
        this.deleteApiKeyOwnerCache(tokenHash);
        throw new UnauthorizedException("Account is suspended");
      }

      if (apiKey.user.deleted) {
        this.deleteApiKeyOwnerCache(tokenHash);
        throw new UnauthorizedException("Account not found");
      }

      // Set request.user to match JWT shape. Email is intentionally
      // excluded — JwtPayload no longer carries PII (GDPR).
      request.user = {
        sub: apiKey.user.id,
        username: apiKey.user.username,
      };

      // Attach API key metadata for scope checks
      request.apiKeyMeta = {
        keyId: apiKey.id,
        userId: apiKey.user.id,
        scopes: apiKey.scopes,
      };

      // Cache API-key → user ownership in Redis so the global
      // ApiKeyThrottlerGuard (which runs before this guard) can
      // resolve the owning user on subsequent requests and apply
      // per-user rate limits across all of a user's API keys.
      if (this.redis) {
        const ownerKey = `apikey:owner:${tokenHash}`;
        this.redis.set(ownerKey, apiKey.user.id, 120).catch((err: unknown) => {
          this.logger.warn("Failed to cache API-key owner in Redis", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      // Fire-and-forget: update lastUsedAt and lastUsedIp
      const rawForwardedFor = request.headers?.["x-forwarded-for"];
      const forwardedFor = Array.isArray(rawForwardedFor)
        ? rawForwardedFor[0]
        : rawForwardedFor;
      const ip = request.ip ?? forwardedFor?.split(",")[0]?.trim() ?? "unknown";

      this.prisma.apiKey
        .update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date(), lastUsedIp: ip },
        })
        .catch((err: unknown) => {
          this.logger.error("Failed to update API key usage", {
            error: err instanceof Error ? err.message : String(err),
            keyId: apiKey.id,
          });
        });

      return true;
    }

    // ── JWT path (existing) ────────────────────────────────────────────────
    const result = await (super.canActivate(context) as Promise<boolean>);

    // Cache the verified JWT user for subsequent requests with the same token
    if (
      result &&
      authHeader?.startsWith("Bearer ") &&
      !authHeader.startsWith("Bearer pf_") &&
      request.user
    ) {
      const token = authHeader.slice(7);

      await this.assertJwtUserActive(request.user, token);

      setCachedJwtUser(token, request.user);
      this.cacheJwtOwner(token, request.user.sub);
    }

    return result;
  }

  /**
   * Cache the JWT token→user ownership mapping in Redis so the global
   * ApiKeyThrottlerGuard (which runs before this guard) can resolve the
   * owning user on subsequent requests and apply per-user rate limits.
   */
  private cacheJwtOwner(token: string, sub?: string): void {
    if (!this.redis || !sub) return;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    this.redis
      .set(`jwt:owner:${tokenHash}`, sub, JWT_OWNER_TTL)
      .catch((err: unknown) => {
        this.logger.warn("Failed to cache JWT owner in Redis", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  handleRequest<TUser = JwtPayload>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException("Invalid or expired token");
    }
    return user;
  }

  private async assertJwtUserActive(
    user: JwtPayload,
    token?: string,
  ): Promise<void> {
    if (!user?.sub) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    if (this.redis) {
      const [pwChanged, suspended] = await Promise.all([
        this.redis.get(PASSWORD_CHANGED_KEY(user.sub)),
        this.redis.get(SUSPENDED_USER_KEY(user.sub)),
      ]);

      if (pwChanged) {
        if (token) {
          JWT_CACHE.delete(token);
          // Delete the Redis owner-cache entry for this specific token
          // so the global throttler guard stops attributing this user's
          // rate-limit budget to the replayed token (P2 — stale owner
          // cache after revocation).  Deletion is per-token, not
          // per-user, so a legitimate new JWT obtained after password
          // change is not penalised.
          const tokenHash = createHash("sha256").update(token).digest("hex");
          this.redis.del(`jwt:owner:${tokenHash}`).catch(() => {});
        }
        throw new UnauthorizedException(
          "Password was changed — please re-authenticate",
        );
      }

      if (suspended) {
        if (token) {
          JWT_CACHE.delete(token);
          const tokenHash = createHash("sha256").update(token).digest("hex");
          this.redis.del(`jwt:owner:${tokenHash}`).catch(() => {});
        }
        throw new UnauthorizedException("Account is suspended");
      }
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { suspended: true, deleted: true },
    });

    if (!dbUser || dbUser.deleted) {
      if (token) {
        JWT_CACHE.delete(token);
        this.deleteJwtOwnerCacheImpl(token);
      }
      throw new UnauthorizedException("Account not found");
    }

    if (dbUser.suspended) {
      if (token) {
        JWT_CACHE.delete(token);
        this.deleteJwtOwnerCacheImpl(token);
      }
      throw new UnauthorizedException("Account is suspended");
    }
  }

  private deleteApiKeyOwnerCache(tokenHash: string): void {
    if (!this.redis) return;
    this.redis.del(`apikey:owner:${tokenHash}`).catch(() => {});
  }

  private deleteJwtOwnerCacheImpl(token: string): void {
    if (!this.redis) return;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    this.redis.del(`jwt:owner:${tokenHash}`).catch(() => {});
  }
}
