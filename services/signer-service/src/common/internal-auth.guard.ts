import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";
import { FastifyRequest } from "fastify";

/**
 * Validates the internal service JWT on every request.
 *
 * Expected JWT payload:
 *   { iss: <service-name>, aud: "signer-service", jti: <uuid>, exp: <30s TTL> }
 *
 * jti replay protection uses Redis SET NX with a 60s TTL (2× the JWT expiry)
 * so a replayed token is rejected even across restarts or multiple instances.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
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
      payload = this.jwt.verify(token, {
        secret: this.config.get<string>("INTERNAL_JWT_SECRET"),
        audience: "signer-service",
      });
    } catch {
      throw new UnauthorizedException("Invalid service token");
    }

    if (!payload.jti) {
      throw new UnauthorizedException("Missing jti claim");
    }

    // Atomic SET NX — only succeeds if the key does not exist (first use).
    // TTL is 60s (2× the 30s JWT expiry) so replayed tokens are always rejected.
    const key = `signer:jti:${payload.jti}`;
    const set = await this.redis.getClient().set(key, "1", "EX", 60, "NX");
    if (set === null) {
      throw new UnauthorizedException("Token already used");
    }

    return true;
  }
}
