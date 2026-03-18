import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";

export interface SignOrderRequest {
  userId: string;
  requestId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  orderType: "GTC" | "FOK" | "GTD";
  expiration?: number;
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
    } catch {
      throw new ServiceUnavailableException("signer-service unavailable");
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ServiceUnavailableException(
        `signer-service error ${res.status}: ${body}`,
      );
    }

    return res.json() as Promise<SignedOrder>;
  }

  private makeServiceJwt(): string {
    return this.jwt.sign(
      { jti: uuidv4() },
      {
        secret: this.config.get<string>("INTERNAL_JWT_SECRET"),
        issuer: "order-service",
        audience: "signer-service",
        expiresIn: 30,
      },
    );
  }
}
