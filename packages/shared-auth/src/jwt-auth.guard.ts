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
import { createHash } from "crypto";

// ── JWT verification cache (in-memory, 5s TTL with LRU eviction) ────────────
// Avoids re-verifying the same JWT token on every request within the TTL window.
// Reduced from 30s to 5s to minimize the post-password-change attack window.
// Also checks Redis pwchange key to immediately invalidate cached tokens.
// Uses LRU eviction: when cache exceeds max size, deletes oldest entries first.
const JWT_CACHE = new Map<string, { user: any; expiresAt: number }>();
const JWT_CACHE_TTL = 5_000; // 5 seconds (reduced from 30s for security)
const MAX_CACHE_SIZE = 10_000;

function getCachedJwtUser(token: string): any {
  const cached = JWT_CACHE.get(token);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    JWT_CACHE.delete(token);
    return null;
  }
  return cached.user;
}

function setCachedJwtUser(token: string, user: any): void {
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
    const request = context.switchToHttp().getRequest<Record<string, any>>();

    const authHeader: string | undefined = request.headers?.authorization;

    // ── JWT cache fast-path: skip re-verification for recently verified tokens ─
    // Also checks Redis pwchange key to prevent post-password-change attack window
    if (
      authHeader?.startsWith("Bearer ") &&
      !authHeader.startsWith("Bearer pf_")
    ) {
      const token = authHeader.slice(7);
      const cachedUser = getCachedJwtUser(token);
      if (cachedUser) {
        // Check if the user's password was changed (invalidates all tokens)
        if (this.redis && cachedUser.sub) {
          const pwChanged = await this.redis.get(`pwchange:${cachedUser.sub}`);
          if (pwChanged) {
            JWT_CACHE.delete(token);
            throw new UnauthorizedException(
              "Password was changed — please re-authenticate",
            );
          }
        }
        request.user = cachedUser;
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
        throw new UnauthorizedException("Invalid API key");
      }

      if (apiKey.revoked) {
        throw new UnauthorizedException("API key has been revoked");
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        throw new UnauthorizedException("API key has expired");
      }

      if (apiKey.user.suspended) {
        throw new UnauthorizedException("Account is suspended");
      }

      if (apiKey.user.deleted) {
        throw new UnauthorizedException("Account not found");
      }

      // Set request.user to match JWT shape
      request.user = {
        sub: apiKey.user.id,
        email: apiKey.user.email,
        username: apiKey.user.username,
      };

      // Attach API key metadata for scope checks
      request.apiKeyMeta = {
        keyId: apiKey.id,
        scopes: apiKey.scopes,
      };

      // Fire-and-forget: update lastUsedAt and lastUsedIp
      const ip =
        request.ip ||
        request.headers?.["x-forwarded-for"]
          ?.toString()
          .split(",")[0]
          ?.trim() ||
        "unknown";

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
      !authHeader.startsWith("Bearer pf_")
    ) {
      const token = authHeader.slice(7);
      setCachedJwtUser(token, request.user);
    }

    return result;
  }

  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException("Invalid or expired token");
    }
    return user;
  }
}
