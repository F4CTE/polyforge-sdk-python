import { Injectable, Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import WebSocket, { Server } from "ws";
import type { IncomingMessage } from "http";
import { URL } from "url";

const DEFAULT_MAX_CONNECTIONS_PER_USER = 5;
const MAX_PRICE_SUBSCRIPTIONS_PER_SOCKET = 200;
const DEV_ORIGINS = new Set([
  "http://localhost",
  "http://localhost:4200",
  "http://localhost:5173",
  "http://127.0.0.1",
]);

@Injectable()
@WebSocketGateway({ path: "/ws" })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly userSockets = new Map<string, Set<WebSocket>>();
  private readonly socketUsers = new WeakMap<WebSocket, string>();
  private readonly priceSubscriptions = new WeakMap<WebSocket, Set<string>>();
  private readonly strategySubscriptions = new WeakMap<
    WebSocket,
    Set<string>
  >();
  private readonly whaleSubscriptions = new WeakSet<WebSocket>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    if (!this.isAllowedOrigin(request)) {
      client.close(4003, "Origin not allowed");
      client.terminate();
      return;
    }

    const token = this.extractToken(request);
    if (!token) {
      client.close(4001, "Authentication required");
      client.terminate();
      return;
    }

    try {
      const payload = this.jwt.verify<{ sub?: unknown }>(token, {
        secret: this.config.get<string>("USER_JWT_SECRET"),
      });
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        client.close(4003, "Invalid token");
        client.terminate();
        return;
      }
      const userId = payload.sub;

      let sockets = this.userSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        this.userSockets.set(userId, sockets);
      }
      const maxConnections = this.maxConnectionsPerUser();
      while (sockets.size >= maxConnections) {
        this.closeOldestUserSocket(userId, sockets, maxConnections);
      }

      sockets.add(client);
      this.socketUsers.set(client, userId);
      this.priceSubscriptions.set(client, new Set());
      this.strategySubscriptions.set(client, new Set());
      client.on("message", (raw) => this.handleClientMessage(client, raw));
      client.on("error", (err) => {
        this.logger.warn(`WebSocket client error: ${err.message}`);
        this.handleDisconnect(client);
        client.terminate();
      });

      this.safeSend(client, {
        type: "AUTH_OK",
        timestamp: Date.now(),
      });
    } catch {
      client.close(4003, "Invalid token");
      client.terminate();
    }
  }

  handleDisconnect(client: WebSocket): void {
    const userId = this.socketUsers.get(client);
    if (!userId) return;

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.priceSubscriptions.delete(client);
    this.strategySubscriptions.delete(client);
    this.whaleSubscriptions.delete(client);
  }

  private extractToken(request: IncomingMessage): string | null {
    try {
      const url = new URL(request.url ?? "", "http://localhost");
      const queryToken = url.searchParams.get("token");
      if (queryToken) return queryToken;
    } catch {
      // malformed URL — fall through to cookie
    }

    const cookie = request.headers.cookie;
    if (cookie) {
      const match = cookie.match(/(?:^|;\s*)pf_token=([^;]+)/);
      if (match) return match[1];
    }

    return null;
  }

  private isAllowedOrigin(request: IncomingMessage): boolean {
    const originHeader = request.headers.origin as
      | string
      | string[]
      | undefined;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    if (!origin) return true;

    const configured = (
      this.config.get<string>("CORS_ORIGINS") ??
      process.env.CORS_ORIGINS ??
      ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const allowed = new Set(configured);

    if (process.env.NODE_ENV !== "production" || process.env.CI === "true") {
      for (const devOrigin of DEV_ORIGINS) allowed.add(devOrigin);
    }

    return allowed.has(origin);
  }

  private maxConnectionsPerUser(): number {
    const configured = Number.parseInt(
      this.config.get<string>("WS_MAX_CONNECTIONS_PER_USER") ??
        process.env.WS_MAX_CONNECTIONS_PER_USER ??
        "",
      10,
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_MAX_CONNECTIONS_PER_USER;
  }

  private closeOldestUserSocket(
    userId: string,
    sockets: Set<WebSocket>,
    maxConnections: number,
  ): void {
    const oldest = sockets.values().next().value;
    if (!oldest) return;

    this.logger.warn(
      `WS connection cap reached for user ${userId}; closing oldest socket at limit ${maxConnections}`,
    );
    sockets.delete(oldest);
    this.socketUsers.delete(oldest);
    this.priceSubscriptions.delete(oldest);
    this.strategySubscriptions.delete(oldest);
    this.whaleSubscriptions.delete(oldest);
    oldest.close(4008, "Connection limit exceeded");
    oldest.terminate();
  }

  private handleClientMessage(client: WebSocket, raw: WebSocket.RawData): void {
    if (!this.socketUsers.has(client)) return;

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(this.rawDataToString(raw)) as Record<
        string,
        unknown
      >;
    } catch {
      this.safeSend(client, { type: "ERROR", message: "Malformed JSON" });
      return;
    }

    switch (message.type) {
      case "PING":
        this.safeSend(client, { type: "PONG", timestamp: Date.now() });
        break;
      case "SUBSCRIBE_PRICES":
        this.updatePriceSubscriptions(client, message.tokenIds, true);
        break;
      case "UNSUBSCRIBE_PRICES":
        this.updatePriceSubscriptions(client, message.tokenIds, false);
        break;
      case "SUBSCRIBE_STRATEGY":
        if (typeof message.strategyId === "string") {
          this.strategySubscriptions.get(client)?.add(message.strategyId);
        }
        break;
      case "UNSUBSCRIBE_STRATEGY":
        if (typeof message.strategyId === "string") {
          this.strategySubscriptions.get(client)?.delete(message.strategyId);
        }
        break;
      case "SUBSCRIBE_WHALES":
        this.whaleSubscriptions.add(client);
        break;
      case "UNSUBSCRIBE_WHALES":
        this.whaleSubscriptions.delete(client);
        break;
    }
  }

  private rawDataToString(raw: WebSocket.RawData): string {
    if (typeof raw === "string") return raw;
    if (Buffer.isBuffer(raw)) return raw.toString("utf8");
    if (Array.isArray(raw)) return Buffer.concat(raw).toString("utf8");
    return Buffer.from(raw).toString("utf8");
  }

  private updatePriceSubscriptions(
    client: WebSocket,
    rawTokenIds: unknown,
    subscribe: boolean,
  ): void {
    if (!Array.isArray(rawTokenIds)) return;

    const subscriptions = this.priceSubscriptions.get(client);
    if (!subscriptions) return;

    for (const tokenId of rawTokenIds) {
      if (typeof tokenId !== "string" || tokenId.length === 0) continue;
      if (subscribe) {
        if (subscriptions.size >= MAX_PRICE_SUBSCRIPTIONS_PER_SOCKET) break;
        subscriptions.add(tokenId);
      } else {
        subscriptions.delete(tokenId);
      }
    }
  }

  private safeSend(client: WebSocket, payload: unknown): boolean {
    if (client.readyState !== WebSocket.OPEN) return false;
    try {
      const message = JSON.stringify(payload);
      const onError = (err?: Error) => {
        if (!err) return;
        this.logger.warn(`WebSocket send failed: ${err.message}`);
        this.handleDisconnect(client);
        client.terminate();
      };
      const send = client.send.bind(client) as (
        data: string,
        callback?: (err?: Error) => void,
      ) => void;
      if (send.length >= 2) {
        send(message, onError);
      } else {
        send(message);
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WebSocket send threw: ${msg}`);
      this.handleDisconnect(client);
      client.terminate();
      return false;
    }
  }

  broadcast(event: string, data: unknown): void {
    if (!this.server?.clients) return;
    for (const client of this.server.clients) {
      if (client.readyState === 1 && this.socketUsers.has(client)) {
        this.safeSend(client, {
          type: event,
          data,
          timestamp: Date.now(),
        });
      }
    }
  }

  sendToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const client of sockets) {
      if (client.readyState === 1) {
        this.safeSend(client, {
          type: event,
          data,
          timestamp: Date.now(),
        });
      }
    }
  }

  pushPriceUpdate(tokenId: string, price: number, timestamp: number): void {
    if (!this.server?.clients) return;
    for (const client of this.server.clients) {
      if (
        this.socketUsers.has(client) &&
        this.priceSubscriptions.get(client)?.has(tokenId)
      ) {
        this.safeSend(client, {
          type: "PRICE_UPDATE",
          data: { tokenId, price, timestamp },
          timestamp: Date.now(),
        });
      }
    }
  }

  pushStrategyEvent(
    strategyId: string,
    userId: string,
    type: string,
    data: unknown,
  ): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const client of sockets) {
      const subscribed = this.strategySubscriptions.get(client);
      if (subscribed && subscribed.size > 0 && !subscribed.has(strategyId)) {
        continue;
      }
      this.safeSend(client, {
        type,
        data: { strategyId, ...(data as object) },
        timestamp: Date.now(),
      });
    }
  }

  pushOrderEvent(userId: string, type: string, data: unknown): void {
    this.sendToUser(userId, type, data);
  }

  pushWhaleTrade(data: unknown): void {
    if (!this.server?.clients) return;
    for (const client of this.server.clients) {
      if (this.socketUsers.has(client) && this.whaleSubscriptions.has(client)) {
        this.safeSend(client, {
          type: "WHALE_TRADE",
          data,
          timestamp: Date.now(),
        });
      }
    }
  }

  pushNewsSignal(data: unknown): void {
    this.broadcast("NEWS_SIGNAL", data);
  }

  pushNotification(userId: string, data: unknown): void {
    this.sendToUser(userId, "NOTIFICATION", data);
  }

  pushMarketSettlement(data: {
    ticker: string;
    settlementValue: string;
    result: string | null;
  }): void {
    this.broadcast("MARKET_SETTLEMENT", data);
  }
}
