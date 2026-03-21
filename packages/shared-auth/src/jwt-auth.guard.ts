import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "@polyforge/shared-db";
import { createHash } from "crypto";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Record<string, any>>();

    const authHeader: string | undefined = request.headers?.authorization;

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
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException("Invalid or expired token");
    }
    return user;
  }
}
