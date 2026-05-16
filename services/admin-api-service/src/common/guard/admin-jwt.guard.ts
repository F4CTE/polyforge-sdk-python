import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";
import { AdminJwtPayload } from "@polyforge/shared-types";
import { createHash } from "crypto";

const JWT_CACHE_TTL = 30_000;
const MAX_CACHE_SIZE = 10_000;

interface CacheEntry {
  payload: AdminJwtPayload;
  expiresAt: number;
  secretHash: string;
}

// ── JWT verification cache (in-memory, 30s TTL with LRU eviction) ───────────
// Avoids re-verifying the same admin JWT token on every request within the TTL.
// Uses LRU eviction: when cache exceeds max size, deletes oldest entries first.
// Redis session check runs on every request (no local cache) to catch
// logout/revocation immediately.
const JWT_CACHE = new Map<string, CacheEntry>();

function hashString(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function getCachedAdminPayload(
  token: string,
  secretHash?: string,
): AdminJwtPayload | null {
  const cached = JWT_CACHE.get(token);
  if (!cached) return null;
  if (secretHash === undefined || cached.secretHash !== secretHash) {
    JWT_CACHE.delete(token);
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    JWT_CACHE.delete(token);
    return null;
  }
  // Reject cached payloads whose JWT has expired (exp is in seconds).
  if (
    cached.payload.exp &&
    cached.payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    JWT_CACHE.delete(token);
    return null;
  }
  // LRU: delete and re-insert to move this entry to the end (most-recently used).
  // Without this, cache hits never update recency and actively used tokens
  // are evicted first by the insertion-order-based eviction in setCachedAdminPayload.
  JWT_CACHE.delete(token);
  JWT_CACHE.set(token, cached);
  return cached.payload;
}

function setCachedAdminPayload(
  token: string,
  payload: AdminJwtPayload,
  secretHash: string,
): void {
  if (JWT_CACHE.size >= MAX_CACHE_SIZE) {
    const entriesToDelete = Math.ceil(MAX_CACHE_SIZE * 0.1);
    let deleted = 0;
    for (const key of JWT_CACHE.keys()) {
      if (deleted >= entriesToDelete) break;
      JWT_CACHE.delete(key);
      deleted++;
    }
  }
  JWT_CACHE.set(token, {
    payload,
    expiresAt: Date.now() + JWT_CACHE_TTL,
    secretHash,
  });
}

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private getSecretHash(): string | undefined {
    const secret = this.config.get<string>("ADMIN_JWT_SECRET");
    if (!secret || secret.length < 32) return undefined;
    return hashString(secret);
  }

  private getAdminSecret(): string {
    const secret = this.config.get<string>("ADMIN_JWT_SECRET");
    if (!secret || secret.length < 32) {
      throw new UnauthorizedException("Invalid or expired admin token");
    }
    return secret;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Accept token from HttpOnly cookie (browser) or Authorization header (API clients)
    const cookieToken: string | undefined = request.cookies?.pf_admin_token;
    const authHeader: string | undefined = request.headers["authorization"];
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;
    const token = cookieToken ?? bearerToken;

    if (!token) {
      throw new UnauthorizedException("Missing admin token");
    }

    // ── JWT cache fast-path: skip re-verification for recently verified tokens ─
    const secretHash = this.getSecretHash();
    const cachedPayload =
      secretHash !== undefined
        ? getCachedAdminPayload(token, secretHash)
        : null;
    let payload: AdminJwtPayload;

    if (cachedPayload) {
      payload = cachedPayload;
    } else {
      const adminSecret = this.getAdminSecret();

      try {
        payload = this.jwtService.verify<AdminJwtPayload>(token, {
          secret: adminSecret,
          algorithms: ["HS256"],
        });
      } catch {
        throw new UnauthorizedException("Invalid or expired admin token");
      }

      setCachedAdminPayload(token, payload, hashString(adminSecret));
    }

    // ── Redis session check (always direct — no local cache to avoid logout/revocation bypass) ─
    const sessionKey = `admin:session:${payload.sessionId}`;
    const adminId = await this.redis.get(sessionKey);

    if (!adminId) {
      JWT_CACHE.delete(token);
      throw new UnauthorizedException("Admin session expired or revoked");
    }

    request.admin = payload;
    // Use only the first IP in X-Forwarded-For to prevent spoofing by clients
    // appending extra addresses to the header.
    const xff = request.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(xff)
      ? xff[0].trim().split(",")[0].trim()
      : typeof xff === "string"
        ? xff.trim().split(",")[0].trim()
        : undefined;
    request.adminIp = forwardedIp ?? request.ip ?? "unknown";
    return true;
  }
}
