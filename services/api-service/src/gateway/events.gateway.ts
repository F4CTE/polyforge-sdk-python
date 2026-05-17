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
  private readonly blockedRegions: Record<string, string[]> = {
    CA: ["ON"],
    UA: ["43", "14", "09"],
  };

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

    if (this.isGeoBlocked(request)) {
      client.close(4008, "Service not available in your region");
      client.terminate();
      return;
    }

    const credential = this.extractToken(request);
    if (!credential) {
      client.close(4001, "Authentication required");
      client.terminate();
      return;
    }

    try {
      const payload = this.jwt.verify<{ sub?: unknown }>(credential.token, {
        secret: this.config.get<string>("USER_JWT_SECRET"),
        algorithms: ["HS256"],
      });
      const userId = payload.sub;
      if (typeof userId !== "string" || !userId) {
        client.close(4003, "Invalid token");
        client.terminate();
        return;
      }

      let sockets = this.userSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        this.userSockets.set(userId, sockets);
      }
      const maxConnections = this.maxConnectionsPerUser();
      if (sockets.size >= maxConnections) {
        this.logger.warn(
          `WS connection cap reached for user ${userId}; rejecting new socket at limit ${maxConnections}`,
        );
        client.close(4008, "Too many connections");
        client.terminate();
        return;
      }

      sockets.add(client);
      this.socketUsers.set(client, userId);
      this.priceSubscriptions.set(client, new Set());
      this.strategySubscriptions.set(client, new Set());
      client.on("message", (raw) => this.handleClientMessage(client, raw));
      client.once?.("close", () => this.handleDisconnect(client));
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

  private isGeoBlocked(request: IncomingMessage): boolean {
    if (!this.fromTrustedProxy(request)) {
      return process.env.NODE_ENV === "production";
    }

    const country = this.headerValue(request, "x-country-code")?.toUpperCase();
    const region = this.headerValue(request, "x-region-code")?.toUpperCase();

    if (!country) {
      return process.env.NODE_ENV === "production";
    }

    const usRailEnabled =
      this.config.get<string>("POLYMARKET_US_ENABLED") === "true";
    const blockedCountries = this.csvConfig(
      "GEO_BLOCKED_COUNTRIES",
      "US,AU,BE,BY,BI,CF,CG,CU,DE,ET,FR,GB,IR,IQ,IT,KP,LB,LY,MM,NI,NL,RU,SO,SS,SD,SY,VE,YE,ZW,UM",
    );
    const closeOnlyCountries = this.csvConfig(
      "GEO_CLOSE_ONLY_COUNTRIES",
      "PL,SG,TH,TW",
    );

    if (blockedCountries.includes(country)) {
      return !(country === "US" && usRailEnabled);
    }

    // Close-only countries may view live data but cannot open new
    // positions (enforced at order-placement level, not WebSocket).
    if (closeOnlyCountries.includes(country)) {
      return false;
    }

    return Boolean(
      region &&
      this.blockedRegions[country] &&
      this.blockedRegions[country].includes(region),
    );
  }

  private fromTrustedProxy(request: IncomingMessage): boolean {
    let remote = request.socket.remoteAddress ?? "";
    // Normalise IPv4-mapped IPv6 addresses so that ::ffff:10.0.0.1 is
    // evaluated against the same RFC 1918 rules as 10.0.0.1.
    if (remote.startsWith("::ffff:") && remote.length > 7) {
      remote = remote.slice(7);
    }
    if (remote === "127.0.0.1" || remote === "::1") return true;
    if (remote.startsWith("10.") || remote.startsWith("192.168.")) return true;
    if (remote.startsWith("172.")) {
      const parts = remote.split(".");
      if (parts.length < 2) return false;
      const secondOctet = parseInt(parts[1], 10);
      return !isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
    }
    return false;
  }

  private csvConfig(key: string, fallback: string): string[] {
    return (this.config.get<string>(key) ?? fallback)
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
  }

  private headerValue(
    request: IncomingMessage,
    headerName: string,
  ): string | undefined {
    const value = request.headers[headerName];
    return Array.isArray(value) ? value[0] : value;
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

  private extractToken(
    request: IncomingMessage,
  ): { token: string; source: "cookie" | "query" } | null {
    const cookie = request.headers.cookie;
    if (cookie) {
      const match = cookie.match(/(?:^|;\s*)pf_token=([^;]+)/);
      if (match) return { token: match[1], source: "cookie" };
    }

    try {
      const url = new URL(request.url ?? "", "http://localhost");
      const queryToken = url.searchParams.get("token");
      if (queryToken) {
        this.logger.warn(
          `Deprecated WebSocket query token used from ${request.socket.remoteAddress ?? "unknown"}`,
        );
        return { token: queryToken, source: "query" };
      }
    } catch {
      // malformed URL — no query token fallback
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
      } else {
        this.socketUsers.delete(client);
        sockets.delete(client);
        this.priceSubscriptions.delete(client);
        this.strategySubscriptions.delete(client);
        this.whaleSubscriptions.delete(client);
      }
    }
    if (sockets.size === 0) {
      this.userSockets.delete(userId);
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
