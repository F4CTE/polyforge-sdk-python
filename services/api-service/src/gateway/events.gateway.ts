import { Injectable, Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Server } from "ws";
import type WebSocket from "ws";
import type { IncomingMessage } from "http";
import { URL } from "url";

@Injectable()
@WebSocketGateway({ path: "/ws" })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly userSockets = new Map<string, Set<WebSocket>>();
  private readonly socketUsers = new WeakMap<WebSocket, string>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    const token = this.extractToken(request);
    if (!token) {
      client.close(4001, "Authentication required");
      client.terminate();
      return;
    }

    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>("USER_JWT_SECRET"),
      });
      const userId: string = payload.sub;
      if (!userId) {
        client.close(4003, "Invalid token");
        client.terminate();
        return;
      }

      let sockets = this.userSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        this.userSockets.set(userId, sockets);
      }
      sockets.add(client);
      this.socketUsers.set(client, userId);

      client.send(JSON.stringify({ type: "AUTH_OK", timestamp: Date.now() }));
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

  broadcast(event: string, data: unknown): void {
    if (!this.server?.clients) return;
    const message = JSON.stringify({
      type: event,
      data,
      timestamp: Date.now(),
    });
    for (const client of this.server.clients) {
      if (client.readyState === 1 && this.socketUsers.has(client)) {
        client.send(message);
      }
    }
  }

  sendToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    const message = JSON.stringify({
      type: event,
      data,
      timestamp: Date.now(),
    });
    for (const client of sockets) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  pushPriceUpdate(tokenId: string, price: number, timestamp: number): void {
    this.broadcast("PRICE_UPDATE", { tokenId, price, timestamp });
  }

  pushStrategyEvent(
    strategyId: string,
    userId: string,
    type: string,
    data: unknown,
  ): void {
    this.sendToUser(userId, type, { strategyId, ...(data as object) });
  }

  pushOrderEvent(userId: string, type: string, data: unknown): void {
    this.sendToUser(userId, type, data);
  }

  pushWhaleTrade(data: unknown): void {
    this.broadcast("WHALE_TRADE", data);
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
