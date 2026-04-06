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

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

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
      throw new UnauthorizedException("Missing token");
    }
    let payload: AdminJwtPayload;

    try {
      payload = this.jwtService.verify<AdminJwtPayload>(token, {
        secret: this.config.getOrThrow<string>("ADMIN_JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // Verify Redis session is still active
    const sessionKey = `admin:session:${payload.sessionId}`;
    const adminId = await this.redis.get(sessionKey);
    if (!adminId) {
      throw new UnauthorizedException("Session expired or revoked");
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
