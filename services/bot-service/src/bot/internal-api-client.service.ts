import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";

@Injectable()
export class InternalApiClient {
  private readonly logger = new Logger(InternalApiClient.name);
  readonly apiUrl: string;
  readonly engineUrl: string;
  private readonly secret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.apiUrl =
      this.config.get<string>("API_SERVICE_URL") ?? "http://api-service:3002";
    this.engineUrl =
      this.config.get<string>("STRATEGY_ENGINE_URL") ??
      "http://strategy-engine:3006";
    this.secret = this.config.getOrThrow<string>("INTERNAL_JWT_SECRET");
  }

  private issueToken(): string {
    return this.jwt.sign(
      { sub: "bot-service", jti: randomUUID() },
      { secret: this.secret, audience: "strategy-engine", expiresIn: "30s" },
    );
  }

  async get(url: string): Promise<Response> {
    const token = this.issueToken();
    return fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  }

  async post(url: string, body?: unknown): Promise<Response> {
    const token = this.issueToken();
    const init: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return fetch(url, init);
  }

  async delete(url: string): Promise<Response> {
    const token = this.issueToken();
    return fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  }
}
