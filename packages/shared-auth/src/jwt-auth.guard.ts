import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "@polyforge/shared-db";
import { createHash } from "crypto";

// ── JWT verification cache (in-memory, 30s TTL) ─────────────────────────────
// Avoids re-verifying the same JWT token on every request within the TTL window.
// The cache is bounded to prevent memory leaks — entries are evicted on access
// if expired, and the entire cache is cleared if it exceeds MAX_CACHE_SIZE.
const JWT_CACHE = new Map<string, { user: any; expiresAt: number }>();
const JWT_CACHE_TTL = 30_000; // 30 seconds
const MAX_CACHE_SIZE = 10_000;

function getCachedJwtUser(token: string): any | null {
  const cached = JWT_CACHE.get(token);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    JWT_CACHE.delete(token);
    return null;
  }
  return cached.user;
}

function setCachedJwtUser(token: string, user: any): void {
  // Evict all entries if cache is too large (simple bounded cache)
  if (JWT_CACHE.size >= MAX_CACHE_SIZE) {
    JWT_CACHE.clear();
  }
  JWT_CACHE.set(token, { user, expiresAt: Date.now() + JWT_CACHE_TTL });
}

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Record<string, any>>();

    const authHeader: string | undefined = request.headers?.authorization;

    // ── JWT cache fast-path: skip re-verification for recently verified tokens ─
    if (authHeader?.startsWith("Bearer ") && !authHeader.startsWith("Bearer pf_")) {
      const token = authHeader.slice(7);
      const cachedUser = getCachedJwtUser(token);
      if (cachedUser) {
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
        .catch((err: unknown) =>
          this.logger.warn("Failed to update API key usage", err),
        );

      return true;
    }

    // ── JWT path (existing) ────────────────────────────────────────────────
    const result = await (super.canActivate(context) as Promise<boolean>);

    // Cache the verified JWT user for subsequent requests with the same token
    if (result && authHeader?.startsWith("Bearer ") && !authHeader.startsWith("Bearer pf_")) {
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
