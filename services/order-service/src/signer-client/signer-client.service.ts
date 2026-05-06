import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { logCloudWatchMetric } from "@polyforge/logger";
import { randomUUID } from "node:crypto";

export interface SignOrderRequest {
  userId: string;
  requestId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  orderType: "GTC" | "FOK" | "GTD" | "FAK" | "POST_ONLY";
  expiration?: number;
  tickSize?: string;
  negRisk?: boolean;
}

export interface SignedOrder {
  order: Record<string, unknown>;
  builderHeaders: {
    POLY_BUILDER_API_KEY: string;
    POLY_BUILDER_TIMESTAMP: string;
    POLY_BUILDER_PASSPHRASE: string;
    POLY_BUILDER_SIGNATURE: string;
  };
}

export interface PolymarketUsCredentials {
  keyId: string;
  secretKey: string;
}

export interface CancelPolymarketOrderRequest {
  userId: string;
  venueOrderId: string;
}

/**
 * HTTP client for signer-service.
 * Attaches a fresh internal service JWT (30s TTL, unique jti) to every request.
 */
@Injectable()
export class SignerClientService {
  private readonly logger = new Logger(SignerClientService.name);
  private readonly signerUrl: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.signerUrl =
      this.config.get<string>("SIGNER_SERVICE_URL") ??
      "http://signer-service:3012";
  }

  async signOrder(req: SignOrderRequest): Promise<SignedOrder> {
    const startedAt = Date.now();
    const token = this.makeServiceJwt();

    let res: Response;
    try {
      res = await fetch(`${this.signerUrl}/sign/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      this.logger.error(
        {
          event: "SIGNER_REQUEST_FAILED",
          operation: "signOrder",
          userId: req.userId,
          requestId: req.requestId,
          err,
        },
        "signer-service request failed",
      );
      throw new ServiceUnavailableException("signer-service unavailable");
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`signer-service error ${res.status}`);
      this.logger.error(
        {
          event: "SIGNER_REQUEST_FAILED",
          operation: "signOrder",
          userId: req.userId,
          requestId: req.requestId,
          status: res.status,
          err,
        },
        "signer-service returned an error response",
      );
      throw new ServiceUnavailableException(
        `signer-service error ${res.status}: ${body}`,
      );
    }

    const signed = (await res.json()) as SignedOrder;
    logCloudWatchMetric(this.logger, {
      name: "SignerLatencyMs",
      value: Date.now() - startedAt,
      unit: "Milliseconds",
      dimensions: {
        Service: "order-service",
        Operation: "signOrder",
      },
      properties: {
        requestId: req.requestId,
        userId: req.userId,
      },
    });
    return signed;
  }

  /**
   * Fetch decrypted Polymarket US credentials (keyId + secretKey) from signer-service.
   * Added by Phase 2 (POLA-957): GET /internal/v1/credentials/:userId/us
   */
  async getPolymarketUsCredentials(
    userId: string,
  ): Promise<PolymarketUsCredentials> {
    const token = this.makeServiceJwt();

    let res: Response;
    try {
      res = await fetch(
        `${this.signerUrl}/internal/v1/credentials/${encodeURIComponent(userId)}/us`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new ServiceUnavailableException("signer-service unavailable");
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ServiceUnavailableException(
        `signer-service error ${res.status}: ${body}`,
      );
    }

    return res.json() as Promise<PolymarketUsCredentials>;
  }

  async cancelPolymarketOrder(
    userId: string,
    venueOrderId: string,
  ): Promise<void> {
    const token = this.makeServiceJwt();

    let res: Response;
    try {
      res = await fetch(`${this.signerUrl}/sign/cancel-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, venueOrderId }),
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
  }

  private makeServiceJwt(): string {
    return this.jwt.sign(
      { jti: randomUUID() },
      {
        secret: this.config.get<string>("INTERNAL_JWT_SECRET"),
        issuer: "order-service",
        audience: "signer-service",
        expiresIn: 30,
        algorithm: "HS256",
      },
    );
  }
}
