import { Injectable } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server } from "ws";

@Injectable()
@WebSocketGateway({ path: "/ws" })
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  broadcast(event: string, data: unknown): void {
    if (!this.server?.clients) return;
    const message = JSON.stringify({ type: event, data, timestamp: Date.now() });
    for (const client of this.server.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  sendToUser(_userId: string, event: string, data: unknown): void {
    this.broadcast(event, data);
  }

  pushPriceUpdate(tokenId: string, price: number, timestamp: number): void {
    this.broadcast("PRICE_UPDATE", { tokenId, price, timestamp });
  }

  pushStrategyEvent(strategyId: string, userId: string, type: string, data: unknown): void {
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
}
