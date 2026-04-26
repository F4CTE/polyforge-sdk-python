import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { RedisService } from "@polyforge/shared-redis";
import { AdminJwtPayload } from "@polyforge/shared-types";

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  private getAdminSecret(): string {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException(
        "ADMIN_JWT_SECRET environment variable is required",
      );
    }
    if (secret.length < 32) {
      throw new UnauthorizedException(
        `ADMIN_JWT_SECRET must be at least 32 characters long (current length: ${secret.length})`,
      );
    }
    return secret;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const cookieToken: string | undefined = request.cookies?.pf_admin_token;
    const authHeader: string | undefined = request.headers["authorization"];
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;
    const token = cookieToken ?? bearerToken;

    if (!token) {
      throw new UnauthorizedException("Missing admin token");
    }

    const adminSecret = this.getAdminSecret();

    let payload: AdminJwtPayload;
    try {
      payload = this.jwtService.verify<AdminJwtPayload>(token, {
        secret: adminSecret,
        algorithms: ["HS256"],
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired admin token");
    }

    const sessionKey = `admin:session:${payload.sessionId}`;
    const adminId = await this.redis.get(sessionKey);
    if (!adminId) {
      throw new UnauthorizedException("Admin session expired or revoked");
    }

    request.admin = payload;

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
