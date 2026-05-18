import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";
import { deriveServiceKey } from "@polyforge/shared-auth";
import { FastifyRequest } from "fastify";

/**
 * Validates the internal service JWT on every request.
 *
 * Expected JWT payload:
 *   { iss: <service-name>, aud: "strategy-engine", jti: <uuid>, exp: <30s TTL> }
 *
 * jti replay protection uses Redis SET NX with a 60s TTL (2× the JWT expiry)
 * so a replayed token is rejected even across restarts or multiple instances.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalAuthGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const auth = req.headers["authorization"];

    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing service token");
    }

    const token = auth.slice(7);
    let payload: Record<string, unknown>;

    try {
      const masterSecret = this.config.getOrThrow<string>(
        "INTERNAL_JWT_SECRET",
      );

      // Decode without verification to extract issuer for key derivation
      const decoded = this.jwt.decode(token) as { iss?: string } | null;
      if (!decoded?.iss) {
        throw new UnauthorizedException("Missing issuer claim");
      }

      // Derive per-service key from the iss claim
      const derivedKey = deriveServiceKey(masterSecret, decoded.iss);

      try {
        payload = this.jwt.verify(token, {
          secret: derivedKey,
          audience: "strategy-engine",
          issuer: ["api-service", "bot-service", "admin-api-service"],
          algorithms: ["HS256"],
        });
      } catch {
        // Transition: fall back to raw master secret
        payload = this.jwt.verify(token, {
          secret: masterSecret,
          audience: "strategy-engine",
          issuer: ["api-service", "bot-service", "admin-api-service"],
          algorithms: ["HS256"],
        });
        this.logger.warn(
          `Deprecated: token from "${decoded.iss}" verified with raw INTERNAL_JWT_SECRET`,
        );
      }
    } catch {
      throw new UnauthorizedException("Invalid service token");
    }

    const jti = typeof payload.jti === "string" ? payload.jti : undefined;
    if (!jti) {
      throw new UnauthorizedException("Missing jti claim");
    }

    // Atomic SET NX — only succeeds if the key does not exist (first use).
    // TTL is 60s (2× the 30s JWT expiry) so replayed tokens are always rejected.
    const key = `strategy-engine:jti:${jti}`;
    let set: string | null;
    try {
      set = await this.redis.getClient().set(key, "1", "EX", 60, "NX");
    } catch {
      throw new ServiceUnavailableException(
        "Unable to verify token uniqueness",
      );
    }
    if (set === null) {
      throw new UnauthorizedException("Token already used");
    }

    return true;
  }
}
