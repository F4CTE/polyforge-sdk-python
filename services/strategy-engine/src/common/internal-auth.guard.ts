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
    let payload: Record<string, unknown>;

    try {
      payload = this.jwt.verify(token, {
        secret: this.config.get<string>("INTERNAL_JWT_SECRET"),
        audience: "strategy-engine",
        issuer: ["api-service", "bot-service", "admin-api-service"],
        algorithms: ["HS256"],
      });
    } catch {
      throw new UnauthorizedException("Invalid service token");
    }

    const jti = typeof payload.jti === "string" ? payload.jti : undefined;
    if (!jti) {
      throw new UnauthorizedException("Token already used or missing jti");
    }

    const set = await this.redis
      .getClient()
      .set(`strategy-engine:jti:${jti}`, "1", "EX", 60, "NX");
    if (set === null) {
      throw new UnauthorizedException("Token already used or missing jti");
    }

    return true;
  }
}
