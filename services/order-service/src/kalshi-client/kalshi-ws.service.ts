import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import WebSocket from "ws";
import { KalshiAuthService } from "./kalshi-auth.service";
import { KalshiRestService } from "./kalshi-rest.service";

interface PriceUpdateEvent {
  tokenId: string;
  price: number;
  timestamp: number;
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_FACTOR = 2;
const PING_INTERVAL_MS = 9_000;

let _msgId = 1;
function nextMsgId(): number {
  return _msgId++;
}

@Injectable()
export class KalshiWsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KalshiWsService.name);
  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private readonly enabled: boolean;
  destroyed = false;

  private readonly subscribedTickers = new Set<string>();

  private readonly wsUrl: string;

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly auth: KalshiAuthService,
    private readonly config: ConfigService,
  ) {
    this.wsUrl =
      this.config.get<string>("KALSHI_WS_URL") ??
      "wss://demo-api.kalshi.co/trade-api/ws/v2";
    this.enabled =
      (this.config.get<string>("KALSHI_ENABLED") ?? "false") === "true";
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log("Kalshi WS disabled (KALSHI_ENABLED != true)");
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

  // ─── Public API ───────────────────────────────────────────────────────────

  subscribeMarkets(tickers: string[]) {
    tickers.forEach((t) => this.subscribedTickers.add(t));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(tickers);
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
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

    const wsUrl = this.wsUrl;

    let token: string;
    try {
      token = await this.auth.getToken("system");
    } catch (err) {
      this.logger.error("Failed to get Kalshi JWT for WS", String(err));
      this.scheduleReconnect();
      return;
    }

    this.logger.log(`Connecting to Kalshi WebSocket: ${wsUrl}`);
    this.ws = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    this.ws.on("open", () => {
      this.logger.log("Kalshi WebSocket connected");
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
        `Kalshi WebSocket closed [${code}]: ${reason.toString() || "no reason"}`,
      );
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.logger.error("Kalshi WebSocket error", err.message);
      this.ws?.close();
    });
  }

  private handleMessage(msg: Record<string, unknown>) {
    const type = msg["type"] as string | undefined;
    if (type !== "ticker") return;

    const inner = msg["msg"] as Record<string, unknown> | undefined;
    if (!inner) return;

    const ticker = inner["market_ticker"] as string | undefined;
    const yesPrice = inner["yes_price"] as number | undefined;
    if (!ticker || yesPrice === undefined) return;

    const ts = typeof inner["ts"] === "number" ? inner["ts"] : Date.now();

    this.emitter.emit("market-data.price", {
      tokenId: ticker,
      price: KalshiRestService.normalizeKalshiPrice(yesPrice),
      timestamp: ts,
    } satisfies PriceUpdateEvent);
  }

  private sendSubscription(tickers: string[]) {
    if (!tickers.length || !this.ws) return;
    this.ws.send(
      JSON.stringify({
        id: nextMsgId(),
        cmd: "subscribe",
        params: {
          channels: ["ticker"],
          market_tickers: tickers,
        },
      }),
    );
    this.logger.log(`Subscribed to ${tickers.length} Kalshi ticker(s)`);
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.logger.log(`Kalshi WS reconnecting in ${this.reconnectDelay}ms…`);
    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_FACTOR,
      RECONNECT_MAX_MS,
    );
  }
}
