import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { Agent } from "undici";

/**
 * Issues short-lived internal JWTs and calls downstream NestJS services.
 * Uses a persistent HTTP agent with keep-alive to avoid TCP handshake overhead.
 */
@Injectable()
export class InternalClientService {
  private readonly logger = new Logger(InternalClientService.name);
  private readonly secret: string;

  /** Shared undici agent with keep-alive for internal service-to-service calls */
  private readonly agent = new Agent({
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 60_000,
    connections: 10,
  });

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.secret = this.config.getOrThrow<string>("INTERNAL_JWT_SECRET");
  }

  private issueToken(audience: string): string {
    return this.jwt.sign(
      { sub: "api-service", jti: randomUUID() },
      { secret: this.secret, audience, expiresIn: "30s" },
    );
  }

  async post(
    baseUrl: string,
    audience: string,
    path: string,
  ): Promise<Response> {
    const token = this.issueToken(audience);
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
      dispatcher: this.agent,
    } as any);
    return res;
  }

  async delete(
    baseUrl: string,
    audience: string,
    path: string,
  ): Promise<Response> {
    const token = this.issueToken(audience);
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
      dispatcher: this.agent,
    } as any);
    return res;
  }

  async get(
    baseUrl: string,
    audience: string,
    path: string,
  ): Promise<Response> {
    const token = this.issueToken(audience);
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
      dispatcher: this.agent,
    } as any);
    return res;
  }
}
