import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { deriveServiceKey } from "@polyforge/shared-auth";
import { randomUUID } from "crypto";

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

/**
 * Issues short-lived internal JWTs and calls downstream NestJS services.
 */
@Injectable()
export class InternalClientService {
  private readonly logger = new Logger(InternalClientService.name);
  private readonly secret: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.secret = deriveServiceKey(
      this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"),
      "api-service",
    );
    this.failureThreshold = this.getPositiveInteger(
      "INTERNAL_CLIENT_CIRCUIT_BREAKER_FAILURE_THRESHOLD",
      3,
    );
    this.resetTimeoutMs = this.getPositiveInteger(
      "INTERNAL_CLIENT_CIRCUIT_BREAKER_RESET_MS",
      30_000,
    );
  }

  private issueToken(audience: string): string {
    return this.jwt.sign(
      { sub: "api-service", jti: randomUUID() },
      {
        secret: this.secret,
        audience,
        issuer: "api-service",
        expiresIn: "30s",
        algorithm: "HS256",
      },
    );
  }

  async post(
    baseUrl: string,
    audience: string,
    path: string,
  ): Promise<Response> {
    const token = this.issueToken(audience);
    const url = `${baseUrl}${path}`;
    return this.fetchWithBreaker(baseUrl, audience, url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  }

  async delete(
    baseUrl: string,
    audience: string,
    path: string,
  ): Promise<Response> {
    const token = this.issueToken(audience);
    const url = `${baseUrl}${path}`;
    return this.fetchWithBreaker(baseUrl, audience, url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  }

  async get(
    baseUrl: string,
    audience: string,
    path: string,
  ): Promise<Response> {
    const token = this.issueToken(audience);
    const url = `${baseUrl}${path}`;
    return this.fetchWithBreaker(baseUrl, audience, url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  }

  private async fetchWithBreaker(
    baseUrl: string,
    audience: string,
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const key = `${audience}|${baseUrl}`;
    const breaker = this.getBreaker(key);

    try {
      return await breaker.execute(
        () => fetch(url, init),
        (response) => !response.ok,
      );
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        this.logger.warn(`Internal client circuit breaker is open for ${key}`);
        throw new ServiceUnavailableException(
          `${audience} temporarily unavailable`,
        );
      }
      throw err;
    }
  }

  private getBreaker(key: string): CircuitBreaker {
    const existing = this.breakers.get(key);
    if (existing) {
      return existing;
    }

    const breaker = new CircuitBreaker(
      this.failureThreshold,
      this.resetTimeoutMs,
    );
    this.breakers.set(key, breaker);
    return breaker;
  }

  private getPositiveInteger(key: string, fallback: number): number {
    const value = this.config.get<string | number>(key);
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : fallback;
  }
}
