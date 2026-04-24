import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import WebSocket from "ws";
import { randomUUID } from "crypto";
import type { PriceUpdateEvent } from "./polymarket-ws.service";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_FACTOR = 2;
const REFRESH_MARGIN_SECS = 300;
const PING_INTERVAL_MS = 9_000;

let _msgId = 1;
function nextMsgId(): number {
  return _msgId++;
}

interface KalshiTokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class KalshiFeedService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KalshiFeedService.name);
  private readonly enabled: boolean;
  private readonly signerUrl: string;
  private readonly wsUrl: string;

  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  destroyed = false;

  private tokenCache: KalshiTokenCache | null = null;
  private refreshPromise: Promise<KalshiTokenCache> | null = null;

  private readonly subscribedTickers = new Set<string>();

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.enabled =
      (this.config.get<string>("KALSHI_ENABLED") ?? "false") === "true";
    this.signerUrl =
      this.config.get<string>("SIGNER_SERVICE_URL") ??
      "http://signer-service:3012";
    this.wsUrl =
      this.config.get<string>("KALSHI_WS_URL") ??
      "wss://api.kalshi.com/trade-api/ws/v2";
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log("Kalshi feed disabled (KALSHI_ENABLED != true)");
      return;
    }
    void this.connect();
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  // ─── Public subscription API ──────────────────────────────────────────────

  subscribeMarkets(tickers: string[]) {
    tickers.forEach((t) => this.subscribedTickers.add(t));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(tickers);
    }
  }

  // ─── Connection management ────────────────────────────────────────────────

  private async connect() {
    if (this.destroyed) return;
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    let token: string;
    try {
      token = await this.getToken();
    } catch (err) {
      this.logger.error("Failed to acquire Kalshi JWT for feed", String(err));
      this.scheduleReconnect();
      return;
    }

    this.logger.log(`Connecting Kalshi feed to ${this.wsUrl}`);
    this.ws = new WebSocket(this.wsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    this.ws.on("open", () => {
      this.logger.log("Kalshi feed WebSocket connected");
      this.reconnectDelay = RECONNECT_BASE_MS;
      this.pingTimer = setInterval(() => {
        this.ws?.ping();
      }, PING_INTERVAL_MS);

      if (this.subscribedTickers.size > 0) {
        this.sendSubscription([...this.subscribedTickers]);
      }
    });

    this.ws.on("message", (data: Buffer) => {
      const text = data.toString();
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(text) as Record<string, unknown>;
      } catch {
        this.logger.warn(`Kalshi WS: unparseable frame (${text.length} bytes)`);
        return;
      }
      try {
        this.handleMessage(msg);
      } catch (err) {
        this.logger.error("Kalshi WS: handleMessage threw", String(err));
      }
    });

    this.ws.on("close", (code, reason) => {
      this.logger.warn(
        `Kalshi feed closed [${code}]: ${reason.toString() || "no reason"}`,
      );
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.logger.error("Kalshi feed WebSocket error", err.message);
      this.ws?.close();
    });
  }

  private handleMessage(msg: Record<string, unknown>) {
    if (msg["type"] !== "ticker") return;

    const inner = msg["msg"] as Record<string, unknown> | undefined;
    if (!inner) return;

    const ticker = inner["market_ticker"] as string | undefined;
    const dollarStr = inner["yes_price_dollars"] as string | undefined;
    const centPrice = inner["yes_price"] as number | undefined;
    if (!ticker || (dollarStr === undefined && centPrice === undefined)) return;

    let price: number;
    if (typeof dollarStr === "string" && dollarStr.length > 0) {
      const parsed = Number(dollarStr);
      price = Number.isNaN(parsed) ? (centPrice ?? 0) / 100 : parsed;
    } else {
      price = (centPrice ?? 0) / 100;
    }

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

  private sendSubscription(tickers: string[]) {
    if (!tickers.length || !this.ws) return;
    this.ws.send(
      JSON.stringify({
        id: nextMsgId(),
        cmd: "subscribe",
        params: { channels: ["ticker"], market_tickers: tickers },
      }),
    );
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.logger.log(`Kalshi feed reconnecting in ${this.reconnectDelay}ms…`);
    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_FACTOR,
      RECONNECT_MAX_MS,
    );
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
        secret: this.config.get<string>("INTERNAL_JWT_SECRET"),
        issuer: "market-data-service",
        audience: "signer-service",
        expiresIn: 30,
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
