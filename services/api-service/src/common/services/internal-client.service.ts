import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";

/**
 * Issues short-lived internal JWTs and calls downstream NestJS services.
 */
@Injectable()
export class InternalClientService {
  private readonly logger = new Logger(InternalClientService.name);
  private readonly secret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.secret = this.config.getOrThrow<string>("INTERNAL_JWT_SECRET");
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
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    } as RequestInit);
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
    } as RequestInit);
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
    } as RequestInit);
    return res;
  }
}
