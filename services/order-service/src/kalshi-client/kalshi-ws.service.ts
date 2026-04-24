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
import type { KalshiCommunicationsEvent } from "./kalshi-rest.service";
import { KalshiRestService } from "./kalshi-rest.service";

interface PriceUpdateEvent {
  tokenId: string;
  price: number;
  timestamp: number;
}

interface OrderbookDeltaEvent {
  ticker: string;
  side: "yes" | "no";
  price: number;
  delta: number;
  seq: number;
  timestamp: number;
}

interface FillEvent {
  fill_id: string;
  order_id: string;
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  price: number;
  is_taker: boolean;
  timestamp: number;
}

interface UserOrderEvent {
  order_id: string;
  ticker: string;
  status: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  remaining_count: number;
  fill_count: number;
  timestamp: number;
}

interface MarketPositionEvent {
  ticker: string;
  position: number;
  market_exposure: number;
  realized_pnl: number;
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
  private readonly privateChannels = new Set<string>();
  private readonly orderbookSeq = new Map<string, number>();

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

  subscribeOrderbookDelta(tickers: string[]) {
    this.privateChannels.add("orderbook_delta");
    tickers.forEach((t) => this.subscribedTickers.add(t));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendChannelSubscription("orderbook_delta", tickers);
    }
  }

  subscribeFills() {
    this.privateChannels.add("fill");

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendChannelSubscription("fill");
    }
  }

  subscribeUserOrders() {
    this.privateChannels.add("user_orders");

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendChannelSubscription("user_orders");
    }
  }

  subscribeMarketPositions() {
    this.privateChannels.add("market_positions");

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendChannelSubscription("market_positions");
    }
  }

  subscribeCommunications(rfqIds?: string[]) {
    this.privateChannels.add("communications");

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendChannelSubscription("communications", rfqIds);
    }
  }

  getOrderbookSeq(ticker: string): number | undefined {
    return this.orderbookSeq.get(ticker);
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
      for (const channel of this.privateChannels) {
        const tickers =
          channel === "orderbook_delta"
            ? [...this.subscribedTickers]
            : undefined;
        this.sendChannelSubscription(channel, tickers);
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
    const inner = msg["msg"] as Record<string, unknown> | undefined;
    if (!inner) return;

    switch (type) {
      case "ticker":
        this.handleTickerMessage(inner);
        break;
      case "orderbook_delta":
        this.handleOrderbookDeltaMessage(inner);
        break;
      case "fill":
        this.handleFillMessage(inner);
        break;
      case "user_orders":
        this.handleUserOrderMessage(inner);
        break;
      case "market_positions":
        this.handleMarketPositionMessage(inner);
        break;
      case "communications":
        this.handleCommunicationsMessage(inner);
        break;
    }
  }

  private handleTickerMessage(inner: Record<string, unknown>) {
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

  private handleOrderbookDeltaMessage(inner: Record<string, unknown>) {
    const ticker = inner["market_ticker"] as string | undefined;
    const seq = inner["seq"] as number | undefined;
    if (!ticker || seq === undefined) return;

    const lastSeq = this.orderbookSeq.get(ticker);
    if (lastSeq !== undefined && seq !== lastSeq + 1 && seq !== 0) {
      this.logger.warn(
        `Orderbook seq gap for ${ticker}: expected ${lastSeq + 1}, got ${seq}. Snapshot needed.`,
      );
    }
    this.orderbookSeq.set(ticker, seq);

    const side = inner["side"] as "yes" | "no" | undefined;
    const price = inner["price"] as number | undefined;
    const delta = inner["delta"] as number | undefined;
    if (!side || price === undefined || delta === undefined) return;

    const ts = typeof inner["ts"] === "number" ? inner["ts"] : Date.now();

    this.emitter.emit("kalshi.orderbook.delta", {
      ticker,
      side,
      price: KalshiRestService.normalizeKalshiPrice(price),
      delta,
      seq,
      timestamp: ts,
    } satisfies OrderbookDeltaEvent);
  }

  private handleFillMessage(inner: Record<string, unknown>) {
    const fillId = inner["fill_id"] as string | undefined;
    const orderId = inner["order_id"] as string | undefined;
    const ticker = inner["ticker"] as string | undefined;
    if (!fillId || !orderId || !ticker) return;

    const ts = typeof inner["ts"] === "number" ? inner["ts"] : Date.now();
    const price = inner["yes_price"] as number | undefined;

    this.emitter.emit("kalshi.fill", {
      fill_id: fillId,
      order_id: orderId,
      ticker,
      side: (inner["side"] as "yes" | "no") ?? "yes",
      action: (inner["action"] as "buy" | "sell") ?? "buy",
      count: (inner["count"] as number) ?? 0,
      price:
        price !== undefined ? KalshiRestService.normalizeKalshiPrice(price) : 0,
      is_taker: (inner["is_taker"] as boolean) ?? false,
      timestamp: ts,
    } satisfies FillEvent);
  }

  private handleUserOrderMessage(inner: Record<string, unknown>) {
    const orderId = inner["order_id"] as string | undefined;
    const ticker = inner["ticker"] as string | undefined;
    const status = inner["status"] as string | undefined;
    if (!orderId || !ticker || !status) return;

    const ts = typeof inner["ts"] === "number" ? inner["ts"] : Date.now();

    this.emitter.emit("kalshi.order", {
      order_id: orderId,
      ticker,
      status,
      side: (inner["side"] as "yes" | "no") ?? "yes",
      action: (inner["action"] as "buy" | "sell") ?? "buy",
      remaining_count: (inner["remaining_count"] as number) ?? 0,
      fill_count: (inner["fill_count"] as number) ?? 0,
      timestamp: ts,
    } satisfies UserOrderEvent);
  }

  private handleMarketPositionMessage(inner: Record<string, unknown>) {
    const ticker = inner["ticker"] as string | undefined;
    if (!ticker) return;

    const ts = typeof inner["ts"] === "number" ? inner["ts"] : Date.now();

    this.emitter.emit("kalshi.position", {
      ticker,
      position: (inner["position"] as number) ?? 0,
      market_exposure: (inner["market_exposure"] as number) ?? 0,
      realized_pnl: (inner["realized_pnl"] as number) ?? 0,
      timestamp: ts,
    } satisfies MarketPositionEvent);
  }

  private handleCommunicationsMessage(inner: Record<string, unknown>) {
    const rfqId = inner["rfq_id"] as string | undefined;
    const type = inner["type"] as string | undefined;
    if (!rfqId || !type) return;

    const ts = typeof inner["ts"] === "number" ? inner["ts"] : Date.now();

    this.emitter.emit("kalshi.communications", {
      rfq_id: rfqId,
      type: type as KalshiCommunicationsEvent["type"],
      quote_id: (inner["quote_id"] as string) ?? undefined,
      price: (inner["price"] as number) ?? undefined,
      count: (inner["count"] as number) ?? undefined,
      timestamp: ts,
    } satisfies KalshiCommunicationsEvent);
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

  private sendChannelSubscription(channel: string, tickers?: string[]) {
    if (!this.ws) return;
    const params: Record<string, unknown> = { channels: [channel] };
    if (tickers?.length) params["market_tickers"] = tickers;
    this.ws.send(JSON.stringify({ id: nextMsgId(), cmd: "subscribe", params }));
    this.logger.log(
      `Subscribed to Kalshi channel: ${channel}${tickers ? ` (${tickers.length} tickers)` : ""}`,
    );
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
