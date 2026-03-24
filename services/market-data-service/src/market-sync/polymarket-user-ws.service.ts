import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";
import WebSocket from "ws";

@Injectable()
export class PolymarketUserWsService implements OnModuleDestroy {
  private readonly logger = new Logger(PolymarketUserWsService.name);
  private connections = new Map<string, WebSocket>();

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  subscribeUser(userId: string, walletAddress: string): void {
    if (this.connections.has(userId)) return;

    const wsUrl =
      this.config.get<string>("CLOB_WS_URL") ??
      "wss://ws-subscriptions-clob.polymarket.com/ws/user";

    const ws = new WebSocket(`${wsUrl}?address=${walletAddress}`);

    ws.on("message", async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "ORDER_FILL") {
          await this.redis.xadd("stream:events", {
            type: "ORDER_FILLED",
            userId,
            tokenId: msg.asset,
            fillPrice: String(msg.price ?? ""),
            fillSize: String(msg.size ?? ""),
            side: String(msg.side ?? ""),
            ts: String(Date.now()),
          });
          this.logger.debug(`Fill event for user ${userId}: ${msg.asset}`);
        }

        if (msg.type === "ORDER_CANCELLED") {
          await this.redis.xadd("stream:events", {
            type: "ORDER_CANCELLED",
            userId,
            orderId: String(msg.orderId ?? ""),
            ts: String(Date.now()),
          });
        }
      } catch (err) {
        this.logger.warn(`User WS parse error: ${(err as Error).message}`);
      }
    });

    ws.on("close", () => {
      this.connections.delete(userId);
      setTimeout(() => {
        if (!this.connections.has(userId)) {
          this.subscribeUser(userId, walletAddress);
        }
      }, 5000);
    });

    ws.on("error", (err) => {
      this.logger.error(`User WS error for ${userId}: ${err.message}`);
    });

    this.connections.set(userId, ws);
  }

  unsubscribeUser(userId: string): void {
    const ws = this.connections.get(userId);
    if (ws) {
      ws.close();
      this.connections.delete(userId);
    }
  }

  onModuleDestroy() {
    for (const [, ws] of this.connections) {
      ws.close();
    }
    this.connections.clear();
  }
}
