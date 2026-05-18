import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InternalJwtPayload } from "@polyforge/shared-types";
import { RedisService } from "@polyforge/shared-redis";
import { getInternalJwtConfig } from "./internal-jwt-config";
import { deriveServiceKey } from "./hmac-key-derivation";

@Injectable()
export class InternalJwtGuard implements CanActivate {
  private readonly logger = new Logger(InternalJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {
    this.validateInternalJwtSecret();
  }

  private validateInternalJwtSecret(): void {
    const secret = process.env.INTERNAL_JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error("INTERNAL_JWT_SECRET environment variable is required");
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing internal service token");
    }

    try {
      const { audience, issuer } = getInternalJwtConfig();
      const masterSecret = process.env.INTERNAL_JWT_SECRET!;

      // Decode without verification to extract issuer for key derivation
      const decoded = this.jwtService.decode(token);
      if (!decoded || typeof decoded === "string" || !decoded.iss) {
        throw new UnauthorizedException("Missing issuer claim");
      }

      // Derive per-service key from the iss claim
      const derivedKey = deriveServiceKey(masterSecret, decoded.iss);

      let payload: InternalJwtPayload;
      try {
        payload = this.jwtService.verify<InternalJwtPayload>(token, {
          secret: derivedKey,
          audience,
          issuer,
          algorithms: ["HS256"],
        });
      } catch {
        // Transition: fall back to raw master secret for tokens still signed
        // with the old shared key. Remove after all services migrate.
        payload = this.jwtService.verify<InternalJwtPayload>(token, {
          secret: masterSecret,
          audience,
          issuer,
          algorithms: ["HS256"],
        });
        this.logger.warn(
          `Deprecated: token from "${decoded.iss}" verified with raw INTERNAL_JWT_SECRET — issuer must migrate to derived keys`,
        );
      }

      if (!payload.iss) {
        throw new UnauthorizedException("Missing issuer claim");
      }
      if (!payload.aud) {
        throw new UnauthorizedException("Missing audience claim");
      }

      const jtiKey = `jti:${payload.jti}`;
      const used = await this.redisService.exists(jtiKey);
      if (used) {
        throw new UnauthorizedException("Token already used (replay attack)");
      }

      // Mark jti as used for 60 seconds
      await this.redisService.set(jtiKey, "1", 60);

      request.servicePayload = payload;
      return true;
    } catch (err) {
      // Log message only — full error object may contain decoded JWT payload with PII (email, role)
      this.logger.warn(
        `Internal JWT validation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException("Invalid internal service token");
    }
  }

  private extractToken(request: Record<string, unknown>): string | null {
    const headers = request.headers as
      | Record<string, string | undefined>
      | undefined;
    const auth = headers?.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    return auth.slice(7);
  }
}
