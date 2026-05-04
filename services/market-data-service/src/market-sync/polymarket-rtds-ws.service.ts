import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MAX_VENUE_WS_FRAME_BYTES } from "@polyforge/shared-types";
import WebSocket from "ws";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_FACTOR = 2;
const PING_INTERVAL_MS = 5_000;
const PONG_TIMEOUT_MS = 15_000;

export type RtdsStreamType = "crypto" | "equity" | "comments";

export interface RtdsSubscription {
  topic: string;
  type: RtdsStreamType;
  filters?: Record<string, string>;
  auth?: { gamma_auth: string };
}

export interface RtdsCryptoPriceEvent {
  source: string;
  symbol: string;
  price: number;
  timestamp: number;
}

export interface RtdsEquityPriceEvent {
  source: string;
  symbol: string;
  price: number;
  timestamp: number;
}

export interface RtdsCommentEvent {
  marketId: string;
  author: string;
  body: string;
  timestamp: number;
}

@Injectable()
export class PolymarketRtdsWsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PolymarketRtdsWsService.name);
  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  private readonly subscriptions = new Map<string, RtdsSubscription>();

  constructor(private readonly emitter: EventEmitter2) {}

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.destroyed = true;
    this.clearTimers();
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  subscribe(sub: RtdsSubscription): void {
    const key = `${sub.type}:${sub.topic}`;
    this.subscriptions.set(key, sub);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(sub);
    }
  }

  unsubscribe(type: RtdsStreamType, topic: string): void {
    const key = `${type}:${topic}`;
    this.subscriptions.delete(key);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: "unsubscribe",
          topic,
          type,
        }),
      );
    }
  }

  // ─── Connection management ────────────────────────────────────────────────

  private connect() {
    if (this.destroyed) return;

    const url = process.env.RTDS_WS_URL ?? "wss://ws-live-data.polymarket.com";
    this.logger.log(`Connecting to RTDS WebSocket: ${url}`);

    this.ws = new WebSocket(url, { maxPayload: MAX_VENUE_WS_FRAME_BYTES });

    this.ws.on("open", () => {
      this.logger.log("RTDS WebSocket connected");
      this.reconnectDelay = RECONNECT_BASE_MS;

      for (const sub of this.subscriptions.values()) {
        this.sendSubscribe(sub);
      }

      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.startPongTimeout();
          this.ws.ping();
        }
      }, PING_INTERVAL_MS);
    });

    this.ws.on("pong", () => {
      this.clearPongTimeout();
    });

    this.ws.on("message", (data: Buffer) => {
      if (data.length > MAX_VENUE_WS_FRAME_BYTES) {
        this.logger.warn(
          `RTDS WebSocket oversized frame dropped (${data.length} bytes)`,
        );
        return;
      }

      const text = data.toString();
      if (text === "PONG") {
        this.clearPongTimeout();
        return;
      }

      try {
        const msg = JSON.parse(text);
        this.handleMessage(msg);
      } catch {
        // ignore malformed frames
      }
    });

    this.ws.on("close", (code, reason) => {
      this.logger.warn(
        `RTDS WebSocket closed [${code}]: ${reason.toString() || "no reason"}`,
      );
      this.clearTimers();
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.logger.error("RTDS WebSocket error", err.message);
      this.ws?.close();
    });
  }

  private handleMessage(msg: Record<string, unknown>) {
    const type = (msg.type ?? msg.stream_type) as string | undefined;
    const ts =
      typeof msg.timestamp === "number"
        ? msg.timestamp
        : typeof msg.timestamp === "string"
          ? Date.parse(msg.timestamp)
          : Date.now();

    switch (type) {
      case "crypto": {
        this.emitter.emit("market-data.rtds-crypto", {
          source: (msg.source as string) ?? "",
          symbol: (msg.symbol as string) ?? "",
          price: Number(msg.price ?? 0),
          timestamp: ts,
        } satisfies RtdsCryptoPriceEvent);
        break;
      }
      case "equity": {
        this.emitter.emit("market-data.rtds-equity", {
          source: (msg.source as string) ?? "",
          symbol: (msg.symbol as string) ?? "",
          price: Number(msg.price ?? 0),
          timestamp: ts,
        } satisfies RtdsEquityPriceEvent);
        break;
      }
      case "comment":
      case "comments": {
        this.emitter.emit("market-data.rtds-comment", {
          marketId: (msg.marketId ?? msg.market_id ?? "") as string,
          author: (msg.author as string) ?? "",
          body: (msg.body as string) ?? "",
          timestamp: ts,
        } satisfies RtdsCommentEvent);
        break;
      }
    }
  }

  private sendSubscribe(sub: RtdsSubscription) {
    if (!this.ws) return;
    this.ws.send(
      JSON.stringify({
        action: "subscribe",
        topic: sub.topic,
        type: sub.type,
        ...(sub.filters && { filters: sub.filters }),
        ...(sub.auth && { auth: sub.auth }),
      }),
    );
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.logger.log(`Reconnecting in ${this.reconnectDelay}ms…`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_FACTOR,
      RECONNECT_MAX_MS,
    );
  }

  private clearTimers() {
    this.clearPongTimeout();
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPongTimeout(): void {
    if (this.pongTimer) {
      return;
    }
    this.pongTimer = setTimeout(() => {
      this.logger.warn("RTDS WebSocket pong timeout; closing stale socket");
      this.ws?.close();
    }, PONG_TIMEOUT_MS);
  }

  private clearPongTimeout(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }
}
