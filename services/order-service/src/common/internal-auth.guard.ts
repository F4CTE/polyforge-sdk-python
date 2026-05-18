import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";
import { deriveServiceKey } from "@polyforge/shared-auth";
import { FastifyRequest } from "fastify";

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
    let payload: any;

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
          audience: "order-service",
          issuer: ["api-service"],
          algorithms: ["HS256"],
        });
      } catch {
        // Transition: fall back to raw master secret
        payload = this.jwt.verify(token, {
          secret: masterSecret,
          audience: "order-service",
          issuer: ["api-service"],
          algorithms: ["HS256"],
        });
        this.logger.warn(
          `Deprecated: token from "${decoded.iss}" verified with raw INTERNAL_JWT_SECRET`,
        );
      }
    } catch {
      throw new UnauthorizedException("Invalid service token");
    }

    if (!payload.jti) {
      throw new UnauthorizedException("Token missing jti");
    }

    // Redis SET NX — atomic replay protection, survives restarts and scales horizontally.
    // TTL = 60s (2× the max JWT expiry for internal tokens).
    const key = `jti:order:${payload.jti}`;
    const set = await this.redis.getClient().set(key, "1", "EX", 60, "NX");
    if (set === null) {
      throw new UnauthorizedException("Token already used");
    }

    return true;
  }
}
