import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { FastifyRequest } from "fastify";

@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly seenJtis = new Set<string>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
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
        audience: "strategy-engine",
      });
    } catch {
      throw new UnauthorizedException("Invalid service token");
    }

    if (!payload.jti || this.seenJtis.has(payload.jti)) {
      throw new UnauthorizedException("Token already used or missing jti");
    }
    this.seenJtis.add(payload.jti);

    if (this.seenJtis.size > 1000) {
      const [first] = this.seenJtis;
      this.seenJtis.delete(first);
    }

    return true;
  }
}
