import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import { deriveServiceKey } from "@polyforge/shared-auth";
import { randomUUID } from "crypto";
import { BaseVenueWsService } from "@polyforge/venue-ws";
import { parseFiniteDecimal } from "@polyforge/shared-types";
import type { PriceUpdateEvent } from "./polymarket-ws.service";

const REFRESH_MARGIN_SECS = 300;

let _msgId = 1;
function nextMsgId(): number {
  return _msgId++;
}

interface KalshiTokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class KalshiFeedService
  extends BaseVenueWsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly signerUrl: string;
  private tokenCache: KalshiTokenCache | null = null;
  private refreshPromise: Promise<KalshiTokenCache> | null = null;

  constructor(
    emitter: EventEmitter2,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    const wsUrl =
      config.get<string>("KALSHI_WS_URL") ??
      "wss://api.kalshi.com/trade-api/ws/v2";
    const enabled =
      (config.get<string>("KALSHI_ENABLED") ?? "false") === "true";

    super(emitter, {
      venueId: "kalshi",
      url: wsUrl,
      enabled,
      pingIntervalMs: 9_000,
    });

    this.signerUrl =
      config.get<string>("SIGNER_SERVICE_URL") ?? "http://signer-service:3012";
  }

  onModuleInit() {
    this.init();
  }

  onModuleDestroy() {
    this.teardown();
  }

  // ─── Public subscription API ──────────────────────────────────────────────

  subscribeMarkets(tickers: string[]) {
    this.addSubscriptions(tickers);
  }

  // ─── BaseVenueWsService hooks ─────────────────────────────────────────────

  protected async getConnectionHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return { Authorization: `Bearer ${token}` };
  }

  protected handleMessage(msg: Record<string, unknown>) {
    if (msg["type"] !== "ticker") return;

    const inner = msg["msg"] as Record<string, unknown> | undefined;
    if (!inner) return;

    const ticker = inner["market_ticker"] as string | undefined;
    const dollarPrice = parseFiniteDecimal(inner["yes_price_dollars"]);
    const centPrice = parseFiniteDecimal(inner["yes_price"]);
    if (!ticker || (dollarPrice === null && centPrice === null)) return;

    const price = dollarPrice ?? centPrice! / 100;

    const ts =
      typeof inner["ts_ms"] === "number"
        ? inner["ts_ms"]
        : typeof inner["ts"] === "number"
          ? inner["ts"] * 1000
          : Date.now();

    this.emitter.emit("market-data.price.raw.kalshi", {
      tokenId: ticker,
      price,
      timestamp: ts,
    } satisfies PriceUpdateEvent);
  }

  protected sendSubscriptions(tickers: string[]) {
    if (!tickers.length) return;
    this.send({
      id: nextMsgId(),
      cmd: "subscribe",
      params: { channels: ["ticker"], market_tickers: tickers },
    });
  }

  // ─── JWT management ───────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    if (
      this.tokenCache &&
      this.tokenCache.expiresAt - now > REFRESH_MARGIN_SECS
    ) {
      return this.tokenCache.token;
    }

    if (this.refreshPromise) {
      const cached = await this.refreshPromise;
      return cached.token;
    }

    this.refreshPromise = this.fetchToken().finally(() => {
      this.refreshPromise = null;
    });

    const cached = await this.refreshPromise;
    this.tokenCache = cached;
    return cached.token;
  }

  private async fetchToken(): Promise<KalshiTokenCache> {
    const serviceJwt = this.jwt.sign(
      { jti: randomUUID() },
      {
        secret: deriveServiceKey(
          this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"),
          "market-data-service",
        ),
        issuer: "market-data-service",
        audience: "signer-service",
        expiresIn: 30,
        algorithm: "HS256",
      },
    );

    const res = await fetch(`${this.signerUrl}/sign/kalshi-jwt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceJwt}`,
      },
      body: JSON.stringify({ userId: "system", requestId: randomUUID() }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`signer-service error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { token: string; expiresAt: number };
    return { token: data.token, expiresAt: data.expiresAt };
  }
}
