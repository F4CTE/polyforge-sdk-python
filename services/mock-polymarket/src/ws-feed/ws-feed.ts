import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { WebSocketServer, WebSocket } from "ws";
import { ScenarioService } from "../scenario/scenario.service";
import { FIXTURE_MARKETS, TOKENS_BY_ID } from "../fixtures/markets";

const WS_PORT = parseInt(process.env.WS_PORT ?? "3098", 10);
const PRICE_INTERVAL_MS = 1000;
const BOOK_INTERVAL_MS = 2000;
const DISCONNECT_INTERVAL_MS = 15_000; // api_down scenario disconnect interval

interface SubscriptionMessage {
  action: "subscribe" | "unsubscribe";
  channels: ("price" | "book" | "orders")[];
  tokenIds?: string[];
  orderIds?: string[];
}

@Injectable()
export class WsFeedService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WsFeedService.name);
  private wss: WebSocketServer | null = null;
  private priceTimer: NodeJS.Timeout | null = null;
  private bookTimer: NodeJS.Timeout | null = null;
  private downTimer: NodeJS.Timeout | null = null;

  constructor(private readonly scenario: ScenarioService) {}

  onModuleInit() {
    this.wss = new WebSocketServer({ port: WS_PORT });

    this.wss.on("connection", (ws: WebSocket, req) => {
      this.logger.debug(`WS client connected from ${req.socket.remoteAddress}`);
      this.handleClient(ws);
    });

    this.wss.on("error", (err) => {
      this.logger.error("WebSocket server error", err);
    });

    this.startBroadcasts();

    if (this.scenario.scenario === "api_down") {
      this.scheduleDisconnects();
    }

    this.logger.log(
      `WebSocket feed listening on port ${WS_PORT} [scenario: ${this.scenario.scenario}]`,
    );
  }

  onModuleDestroy() {
    if (this.priceTimer) clearInterval(this.priceTimer);
    if (this.bookTimer) clearInterval(this.bookTimer);
    if (this.downTimer) clearInterval(this.downTimer);
    this.wss?.close();
  }

  // ─── Client handling ──────────────────────────────────────────────────────

  private handleClient(ws: WebSocket) {
    const subscriptions = {
      price: new Set<string>(), // tokenIds
      book: new Set<string>(), // tokenIds
      orders: new Set<string>(), // orderIds
    };

    // Send welcome snapshot
    ws.send(
      JSON.stringify({
        type: "CONNECTED",
        scenario: this.scenario.scenario,
        markets: FIXTURE_MARKETS.length,
      }),
    );

    ws.on("message", (data: Buffer) => {
      try {
        const msg: SubscriptionMessage = JSON.parse(data.toString());

        if (msg.action === "subscribe") {
          if (msg.channels.includes("price") && msg.tokenIds) {
            msg.tokenIds.forEach((id) => subscriptions.price.add(id));
            // Send immediate price snapshot
            this.sendPriceSnapshot(ws, msg.tokenIds);
          }
          if (msg.channels.includes("book") && msg.tokenIds) {
            msg.tokenIds.forEach((id) => subscriptions.book.add(id));
            this.sendBookSnapshot(ws, msg.tokenIds);
          }
          if (msg.channels.includes("orders") && msg.orderIds) {
            msg.orderIds.forEach((id) => subscriptions.orders.add(id));
          }
        } else if (msg.action === "unsubscribe") {
          msg.tokenIds?.forEach((id) => {
            subscriptions.price.delete(id);
            subscriptions.book.delete(id);
          });
          msg.orderIds?.forEach((id) => subscriptions.orders.delete(id));
        }
      } catch {
        ws.send(
          JSON.stringify({ type: "ERROR", message: "Invalid message format" }),
        );
      }
    });

    // Store subscriptions on the socket for broadcaster access
    (ws as any).__subs = subscriptions;
  }

  // ─── Broadcasts ───────────────────────────────────────────────────────────

  private startBroadcasts() {
    this.priceTimer = setInterval(
      () => this.broadcastPrices(),
      PRICE_INTERVAL_MS,
    );
    this.bookTimer = setInterval(() => this.broadcastBooks(), BOOK_INTERVAL_MS);
  }

  private broadcastPrices() {
    if (!this.wss) return;
    this.wss.clients.forEach((ws: WebSocket) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const subs = (ws as any).__subs?.price as Set<string> | undefined;
      if (!subs || subs.size === 0) return;

      subs.forEach((tokenId) => {
        if (!TOKENS_BY_ID.has(tokenId)) return;
        const price = this.scenario.getPrice(tokenId);
        ws.send(
          JSON.stringify({
            type: "PRICE_UPDATE",
            tokenId,
            price: price.toFixed(4),
            timestamp: Date.now(),
          }),
        );
      });
    });
  }

  private broadcastBooks() {
    if (!this.wss) return;
    this.wss.clients.forEach((ws: WebSocket) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const subs = (ws as any).__subs?.book as Set<string> | undefined;
      if (!subs || subs.size === 0) return;

      subs.forEach((tokenId) => {
        if (!TOKENS_BY_ID.has(tokenId)) return;
        const { bids, asks } = this.scenario.getOrderBook(tokenId);
        const midpoint = this.scenario.getPrice(tokenId);
        const spread = parseFloat(asks[0].price) - parseFloat(bids[0].price);

        ws.send(
          JSON.stringify({
            type: "BOOK_UPDATE",
            tokenId,
            bids,
            asks,
            spread: spread.toFixed(4),
            midpoint: midpoint.toFixed(4),
            timestamp: Date.now(),
          }),
        );
      });
    });
  }

  /** Broadcast an order lifecycle event to all subscribed clients */
  broadcastOrderEvent(event: {
    type:
      | "ORDER_PLACED"
      | "ORDER_SUBMITTED"
      | "ORDER_FILLED"
      | "ORDER_PARTIAL"
      | "ORDER_CANCELLED"
      | "ORDER_FAILED";
    orderId: string;
    [key: string]: any;
  }) {
    if (!this.wss) return;
    this.wss.clients.forEach((ws: WebSocket) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const subs = (ws as any).__subs?.orders as Set<string> | undefined;
      if (subs?.has(event.orderId)) {
        ws.send(JSON.stringify({ ...event, timestamp: Date.now() }));
      }
    });
  }

  // ─── Snapshots ────────────────────────────────────────────────────────────

  private sendPriceSnapshot(ws: WebSocket, tokenIds: string[]) {
    const prices: Record<string, string> = {};
    for (const tokenId of tokenIds) {
      if (TOKENS_BY_ID.has(tokenId)) {
        prices[tokenId] = this.scenario.getPrice(tokenId).toFixed(4);
      }
    }
    ws.send(
      JSON.stringify({ type: "PRICE_SNAPSHOT", prices, timestamp: Date.now() }),
    );
  }

  private sendBookSnapshot(ws: WebSocket, tokenIds: string[]) {
    for (const tokenId of tokenIds) {
      if (!TOKENS_BY_ID.has(tokenId)) continue;
      const { bids, asks } = this.scenario.getOrderBook(tokenId);
      const midpoint = this.scenario.getPrice(tokenId);
      ws.send(
        JSON.stringify({
          type: "BOOK_SNAPSHOT",
          tokenId,
          bids,
          asks,
          midpoint: midpoint.toFixed(4),
          timestamp: Date.now(),
        }),
      );
    }
  }

  // ─── api_down scenario: periodic disconnects ──────────────────────────────

  private scheduleDisconnects() {
    this.downTimer = setInterval(() => {
      if (!this.wss) return;
      this.logger.warn("[api_down] Forcing WebSocket disconnects");
      this.wss.clients.forEach((ws: WebSocket) => {
        ws.close(1001, "Service temporarily unavailable");
      });
    }, DISCONNECT_INTERVAL_MS);
  }
}
