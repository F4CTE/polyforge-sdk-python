import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, WebSocket } from "ws";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

interface AuthedSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
  subscribedTokens: Set<string>;
  subscribedStrategies: Set<string>;
}

/**
 * WebSocket gateway — path: /ws
 *
 * Protocol:
 *   1. Client connects, sends { type: 'AUTH', token: 'Bearer eyJ...' }
 *   2. Server validates JWT → replies AUTH_OK or AUTH_ERROR + close
 *   3. Client subscribes to prices / strategies
 *   4. EventsService pushes events to subscribed clients
 */
@WebSocketGateway({ path: "/ws" })
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  declare server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly jwtSecret: string;

  // Maps for fast lookup
  private readonly clients = new Map<string, AuthedSocket>(); // userId → socket (last wins)
  private readonly tokenSubscribers = new Map<string, Set<string>>(); // tokenId → Set<userId>
  private readonly strategySubscribers = new Map<string, Set<string>>(); // strategyId → Set<userId>

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.getOrThrow<string>("JWT_SECRET");
  }

  afterInit() {
    this.logger.log("WebSocket gateway initialized on /ws");
  }

  /** Parse a single cookie value from a raw Cookie header string. */
  private parseCookie(cookieHeader: string, name: string): string | null {
    for (const part of cookieHeader.split(";")) {
      const [k, v] = part.trim().split("=");
      if (k === name && v) return decodeURIComponent(v);
    }
    return null;
  }

  handleConnection(client: AuthedSocket, req: any) {
    client.isAuthenticated = false;
    client.subscribedTokens = new Set();
    client.subscribedStrategies = new Set();

    // Try cookie auth from the HTTP upgrade request (browser clients)
    const cookieHeader: string = req?.headers?.cookie ?? "";
    if (cookieHeader) {
      const cookieToken = this.parseCookie(cookieHeader, "pf_token");
      if (cookieToken) {
        try {
          const decoded = this.jwt.verify(cookieToken, {
            secret: this.jwtSecret,
          });
          client.userId = decoded.sub;
          client.isAuthenticated = true;
          this.clients.set(decoded.sub, client);
          this.send(client, { type: "AUTH_OK", userId: decoded.sub });
        } catch {
          // Cookie present but invalid — will require explicit AUTH message
        }
      }
    }

    client.on("message", (raw: Buffer) => {
      if (raw.length > 65_536) {
        client.terminate();
        return;
      }
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(client, msg);
      } catch {
        // ignore malformed JSON
      }
    });
  }

  handleDisconnect(client: AuthedSocket) {
    if (client.userId) {
      this.clients.delete(client.userId);
      for (const tokenId of client.subscribedTokens) {
        this.tokenSubscribers.get(tokenId)?.delete(client.userId);
      }
      for (const strategyId of client.subscribedStrategies) {
        this.strategySubscribers.get(strategyId)?.delete(client.userId);
      }
    }
  }

  private handleMessage(client: AuthedSocket, msg: any) {
    const { type, ...payload } = msg;

    if (!client.isAuthenticated) {
      if (type !== "AUTH") {
        this.send(client, {
          type: "AUTH_ERROR",
          message: "Must authenticate first",
        });
        client.terminate();
        return;
      }
      this.handleAuth(client, payload);
      return;
    }

    switch (type) {
      case "SUBSCRIBE_PRICES":
        this.handleSubscribePrices(client, payload.tokenIds ?? []);
        break;
      case "UNSUBSCRIBE_PRICES":
        this.handleUnsubscribePrices(client, payload.tokenIds ?? []);
        break;
      case "SUBSCRIBE_STRATEGY":
        this.handleSubscribeStrategy(client, payload.strategyId);
        break;
      case "UNSUBSCRIBE_STRATEGY":
        this.handleUnsubscribeStrategy(client, payload.strategyId);
        break;
      case "PING":
        this.send(client, { type: "PONG" });
        break;
    }
  }

  private handleAuth(client: AuthedSocket, payload: any) {
    const raw: string = payload.token ?? "";
    const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;

    try {
      const decoded = this.jwt.verify(token, { secret: this.jwtSecret });
      client.userId = decoded.sub;
      client.isAuthenticated = true;
      this.clients.set(decoded.sub, client);
      this.send(client, { type: "AUTH_OK", userId: decoded.sub });
    } catch {
      this.send(client, { type: "AUTH_ERROR", message: "Invalid token" });
      client.terminate();
    }
  }

  private handleSubscribePrices(client: AuthedSocket, tokenIds: string[]) {
    if (!Array.isArray(tokenIds) || tokenIds.length > 1000) return;
    for (const tokenId of tokenIds) {
      client.subscribedTokens.add(tokenId);
      if (!this.tokenSubscribers.has(tokenId)) {
        this.tokenSubscribers.set(tokenId, new Set());
      }
      this.tokenSubscribers.get(tokenId)!.add(client.userId!);
    }
  }

  private handleUnsubscribePrices(client: AuthedSocket, tokenIds: string[]) {
    for (const tokenId of tokenIds) {
      client.subscribedTokens.delete(tokenId);
      this.tokenSubscribers.get(tokenId)?.delete(client.userId!);
    }
  }

  private handleSubscribeStrategy(client: AuthedSocket, strategyId: string) {
    if (!strategyId) return;
    client.subscribedStrategies.add(strategyId);
    if (!this.strategySubscribers.has(strategyId)) {
      this.strategySubscribers.set(strategyId, new Set());
    }
    this.strategySubscribers.get(strategyId)!.add(client.userId!);
  }

  private handleUnsubscribeStrategy(client: AuthedSocket, strategyId: string) {
    if (!strategyId) return;
    client.subscribedStrategies.delete(strategyId);
    this.strategySubscribers.get(strategyId)?.delete(client.userId!);
  }

  // ─── Push methods (called by EventsService) ───────────────────────────────

  /** Push a price update to all subscribers of this tokenId */
  pushPriceUpdate(tokenId: string, price: number, timestamp: number) {
    const userIds = this.tokenSubscribers.get(tokenId);
    if (!userIds?.size) return;

    const msg = { type: "PRICE_UPDATE", tokenId, price, timestamp };
    for (const userId of userIds) {
      const client = this.clients.get(userId);
      if (client) this.send(client, msg);
    }
  }

  /** Push a strategy event to all subscribers of this strategy */
  pushStrategyEvent(
    strategyId: string,
    userId: string,
    type: string,
    payload: Record<string, any>,
  ) {
    const msg = { type, strategyId, ...payload };

    // Push to all subscribers of this strategy
    const strategyUsers = this.strategySubscribers.get(strategyId);
    const sent = new Set<string>();

    if (strategyUsers) {
      for (const uid of strategyUsers) {
        const client = this.clients.get(uid);
        if (client) {
          this.send(client, msg);
          sent.add(uid);
        }
      }
    }

    // Always push to strategy owner if not already sent
    if (!sent.has(userId)) {
      const client = this.clients.get(userId);
      if (client) this.send(client, msg);
    }
  }

  /** Push an order event to the order owner */
  pushOrderEvent(userId: string, type: string, payload: Record<string, any>) {
    const client = this.clients.get(userId);
    if (client) this.send(client, { type, ...payload });
  }

  /** Push a notification to a user */
  pushNotification(userId: string, payload: Record<string, any>) {
    const client = this.clients.get(userId);
    if (client) this.send(client, { type: "NOTIFICATION", ...payload });
  }

  private send(client: AuthedSocket, msg: Record<string, any>) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(msg));
    }
  }
}
