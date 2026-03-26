import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import WebSocket from "ws";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_FACTOR = 2;
const PING_INTERVAL_MS = 9_000; // Polymarket requires PING every 10s; send at 9s for safety

/** Max tokens per subscription batch — avoids oversized WebSocket frames */
const SUBSCRIBE_BATCH_SIZE = 200;

export interface PriceUpdateEvent {
  tokenId: string;
  price: number;
  timestamp: number;
}

export interface BookUpdateEvent {
  tokenId: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  midpoint: string;
  spread: string;
  timestamp: number;
}

/**
 * Maintains a persistent WebSocket connection to the CLOB feed
 * (mock-polymarket in dev, real Polymarket WS in prod).
 *
 * Handles both message formats:
 *   - Mock: { type: "PRICE_UPDATE", tokenId, price, timestamp }
 *   - Real: { event_type: "price_change", price_changes: [...], timestamp }
 *
 * Emits typed events via EventEmitter2:
 *   - market-data.price  → PriceUpdateEvent
 *   - market-data.book   → BookUpdateEvent
 */
@Injectable()
export class PolymarketWsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PolymarketWsService.name);
  private ws: WebSocket | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  /** Whether we're connecting to real Polymarket or mock */
  private readonly isRealPolymarket: boolean;

  /** tokenIds currently subscribed to */
  private readonly subscribedTokens = new Set<string>();

  constructor(private readonly emitter: EventEmitter2) {
    const url = process.env.CLOB_WS_URL ?? "ws://localhost:3098";
    this.isRealPolymarket = url.includes("polymarket.com");
  }

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  subscribeTokens(tokenIds: string[]) {
    tokenIds.forEach((id) => this.subscribedTokens.add(id));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(tokenIds);
    }
  }

  unsubscribeTokens(tokenIds: string[]) {
    tokenIds.forEach((id) => this.subscribedTokens.delete(id));

    // Real Polymarket does not support unsubscribe; only send for mock
    if (!this.isRealPolymarket && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: "unsubscribe",
          channels: ["price", "book"],
          tokenIds,
        }),
      );
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── Connection management ────────────────────────────────────────────────

  private connect() {
    if (this.destroyed) return;

    const url = process.env.CLOB_WS_URL ?? "ws://localhost:3098";
    this.logger.log(`Connecting to CLOB WebSocket: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      this.logger.log("WebSocket connected");
      this.reconnectDelay = RECONNECT_BASE_MS; // reset backoff on success

      // Resubscribe all known tokens on reconnect
      if (this.subscribedTokens.size > 0) {
        this.sendSubscription([...this.subscribedTokens]);
      }

      // Keep-alive ping — Polymarket requires every 10s
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.ping();
        }
      }, PING_INTERVAL_MS);
    });

    this.ws.on("message", (data: Buffer) => {
      const text = data.toString();
      // Handle PONG text response (some servers send text "PONG" instead of WS pong frame)
      if (text === "PONG") return;

      try {
        const msg = JSON.parse(text);
        this.handleMessage(msg);
      } catch {
        // ignore malformed frames
      }
    });

    this.ws.on("close", (code, reason) => {
      this.logger.warn(
        `WebSocket closed [${code}]: ${reason.toString() || "no reason"}`,
      );
      this.clearTimers();
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.logger.error("WebSocket error", err.message);
      // 'error' is always followed by 'close', so no need to reconnect here
    });
  }

  private handleMessage(msg: any) {
    // Detect format: real Polymarket uses "event_type", mock uses "type"
    const eventType = msg.event_type ?? msg.type;
    const ts = msg.timestamp ? (typeof msg.timestamp === "string" ? Date.parse(msg.timestamp) : msg.timestamp) : Date.now();

    switch (eventType) {
      // ─── Real Polymarket format ──────────────────────────────────────
      case "price_change": {
        // { event_type: "price_change", price_changes: [{ asset_id, price, ... }] }
        if (Array.isArray(msg.price_changes)) {
          for (const pc of msg.price_changes) {
            this.emitter.emit("market-data.price", {
              tokenId: pc.asset_id,
              price: parseFloat(pc.price),
              timestamp: ts,
            } satisfies PriceUpdateEvent);
          }
        }
        break;
      }
      case "last_trade_price": {
        // { event_type: "last_trade_price", asset_id, price, ... }
        this.emitter.emit("market-data.price", {
          tokenId: msg.asset_id,
          price: parseFloat(msg.price),
          timestamp: ts,
        } satisfies PriceUpdateEvent);
        break;
      }
      case "book": {
        // { event_type: "book", asset_id, bids, asks, ... }
        this.emitter.emit("market-data.book", {
          tokenId: msg.asset_id,
          bids: msg.bids ?? [],
          asks: msg.asks ?? [],
          midpoint: "0",
          spread: "0",
          timestamp: ts,
        } satisfies BookUpdateEvent);
        break;
      }
      case "best_bid_ask": {
        // { event_type: "best_bid_ask", asset_id, best_bid, best_ask, spread }
        this.emitter.emit("market-data.book", {
          tokenId: msg.asset_id,
          bids: msg.best_bid ? [{ price: msg.best_bid, size: "0" }] : [],
          asks: msg.best_ask ? [{ price: msg.best_ask, size: "0" }] : [],
          midpoint: "0",
          spread: msg.spread ?? "0",
          timestamp: ts,
        } satisfies BookUpdateEvent);
        break;
      }

      // ─── Mock format (backwards compatibility) ───────────────────────
      case "PRICE_UPDATE": {
        this.emitter.emit("market-data.price", {
          tokenId: msg.tokenId,
          price: parseFloat(msg.price),
          timestamp: ts,
        } satisfies PriceUpdateEvent);
        break;
      }
      case "PRICE_SNAPSHOT": {
        if (msg.prices) {
          for (const [tokenId, price] of Object.entries(msg.prices)) {
            this.emitter.emit("market-data.price", {
              tokenId,
              price: parseFloat(price as string),
              timestamp: ts,
            } satisfies PriceUpdateEvent);
          }
        }
        break;
      }
      case "BOOK_UPDATE":
      case "BOOK_SNAPSHOT": {
        this.emitter.emit("market-data.book", {
          tokenId: msg.tokenId,
          bids: msg.bids ?? [],
          asks: msg.asks ?? [],
          midpoint: msg.midpoint ?? "0",
          spread: msg.spread ?? "0",
          timestamp: ts,
        } satisfies BookUpdateEvent);
        break;
      }
    }
  }

  private sendSubscription(tokenIds: string[]) {
    if (!tokenIds.length || !this.ws) return;

    if (this.isRealPolymarket) {
      // Real Polymarket format: { assets_ids, type: "market" }
      // Batch to avoid oversized frames
      for (let i = 0; i < tokenIds.length; i += SUBSCRIBE_BATCH_SIZE) {
        const batch = tokenIds.slice(i, i + SUBSCRIBE_BATCH_SIZE);
        this.ws.send(
          JSON.stringify({
            assets_ids: batch,
            type: "market",
            custom_feature_enabled: true,
          }),
        );
      }
      this.logger.log(
        `Subscribed to ${tokenIds.length} tokens in ${Math.ceil(tokenIds.length / SUBSCRIBE_BATCH_SIZE)} batch(es)`,
      );
    } else {
      // Mock format
      this.ws.send(
        JSON.stringify({
          action: "subscribe",
          channels: ["price", "book"],
          tokenIds,
        }),
      );
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.logger.log(`Reconnecting in ${this.reconnectDelay}ms…`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_FACTOR,
      RECONNECT_MAX_MS,
    );
  }

  private clearTimers() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
