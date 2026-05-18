import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { deriveServiceKey } from "@polyforge/shared-auth";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

const REFRESH_MARGIN_SECS = 300; // refresh when ≤5 min left (TTL=30min, so ≤25 min elapsed)

interface CachedToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class KalshiAuthService {
  private readonly logger = new Logger(KalshiAuthService.name);
  private readonly signerUrl: string;

  private cache: CachedToken | null = null;
  // Single in-flight Promise shared by concurrent callers to prevent duplicate refresh calls
  private refreshPromise: Promise<CachedToken> | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.signerUrl =
      this.config.get<string>("SIGNER_SERVICE_URL") ??
      "http://signer-service:3012";
  }

  async getToken(userId: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    if (this.cache && this.cache.expiresAt - now > REFRESH_MARGIN_SECS) {
      return this.cache.token;
    }

    if (this.refreshPromise) {
      const cached = await this.refreshPromise;
      return cached.token;
    }

    this.refreshPromise = this.fetchToken(userId).finally(() => {
      this.refreshPromise = null;
    });

    const cached = await this.refreshPromise;
    this.cache = cached;
    return cached.token;
  }

  private async fetchToken(userId: string): Promise<CachedToken> {
    const serviceJwt = this.makeServiceJwt();

    let res: Response;
    try {
      res = await fetch(`${this.signerUrl}/sign/kalshi-jwt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceJwt}`,
        },
        body: JSON.stringify({ userId, requestId: randomUUID() }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException("signer-service unavailable");
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ServiceUnavailableException(
        `signer-service error ${res.status}: ${body}`,
      );
    }

    const data = (await res.json()) as { token: string; expiresAt: number };
    this.logger.log(`Kalshi JWT acquired for userId=${userId}`);
    return { token: data.token, expiresAt: data.expiresAt };
  }

  private makeServiceJwt(): string {
    return this.jwt.sign(
      { sub: "order-service", jti: randomUUID() },
      {
        secret: deriveServiceKey(
          this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"),
          "order-service",
        ),
        issuer: "order-service",
        audience: "signer-service",
        expiresIn: 30,
        algorithm: "HS256",
      },
    );
  }
}
