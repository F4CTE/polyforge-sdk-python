import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { logCloudWatchMetric } from "@polyforge/logger";
import { randomUUID } from "node:crypto";

type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreakerOpenError extends Error {
  constructor() {
    super("circuit breaker open");
    this.name = "CircuitBreakerOpenError";
  }
}

class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failures = 0;
  private openedAt = 0;
  private halfOpenProbeInFlight = false;

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeoutMs: number,
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    isFailure: (result: T) => boolean,
  ): Promise<T> {
    const halfOpenProbe = this.beforeRequest();

    try {
      const result = await operation();
      if (isFailure(result)) {
        this.recordFailure();
      } else {
        this.recordSuccess();
      }
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    } finally {
      if (halfOpenProbe) {
        this.halfOpenProbeInFlight = false;
      }
    }
  }

  private beforeRequest(): boolean {
    if (this.state === "OPEN") {
      if (Date.now() - this.openedAt < this.resetTimeoutMs) {
        throw new CircuitBreakerOpenError();
      }
      this.state = "HALF_OPEN";
    }

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenProbeInFlight) {
        throw new CircuitBreakerOpenError();
      }
      this.halfOpenProbeInFlight = true;
      return true;
    }

    return false;
  }

  private recordSuccess(): void {
    this.failures = 0;
    this.openedAt = 0;
    this.state = "CLOSED";
  }

  private recordFailure(): void {
    this.failures += 1;
    if (this.state === "HALF_OPEN" || this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
    }
  }
}

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
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.signerUrl =
      this.config.get<string>("SIGNER_SERVICE_URL") ??
      "http://signer-service:3012";
    this.breaker = new CircuitBreaker(
      this.getPositiveInteger(
        "SIGNER_SERVICE_CIRCUIT_BREAKER_FAILURE_THRESHOLD",
        3,
      ),
      this.getPositiveInteger(
        "SIGNER_SERVICE_CIRCUIT_BREAKER_RESET_MS",
        30_000,
      ),
    );
  }

  async signOrder(req: SignOrderRequest): Promise<SignedOrder> {
    const startedAt = Date.now();
    const token = this.makeServiceJwt();

    let res: Response;
    try {
      res = await this.breaker.execute(
        () =>
          fetch(`${this.signerUrl}/sign/order`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(req),
            signal: AbortSignal.timeout(10_000),
          }),
        (response) => !response.ok,
      );
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        this.logger.warn("signer-service circuit breaker is open");
      } else {
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
      }
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
      res = await this.breaker.execute(
        () =>
          fetch(
            `${this.signerUrl}/internal/v1/credentials/${encodeURIComponent(userId)}/us`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(10_000),
            },
          ),
        (response) => !response.ok,
      );
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        this.logger.warn("signer-service circuit breaker is open");
      }
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
      res = await this.breaker.execute(
        () =>
          fetch(`${this.signerUrl}/sign/cancel-order`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ userId, venueOrderId }),
            signal: AbortSignal.timeout(10_000),
          }),
        (response) => !response.ok,
      );
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        this.logger.warn("signer-service circuit breaker is open");
      }
      throw new ServiceUnavailableException("signer-service unavailable");
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ServiceUnavailableException(
        `signer-service error ${res.status}: ${body}`,
      );
    }
  }

  private getPositiveInteger(key: string, fallback: number): number {
    const value = this.config.get<string | number>(key);
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : fallback;
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
