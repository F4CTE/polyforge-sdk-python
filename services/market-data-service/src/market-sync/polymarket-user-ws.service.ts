import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";
import { MAX_VENUE_WS_FRAME_BYTES } from "@polyforge/shared-types";
import WebSocket from "ws";

const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
const NORMAL_CLOSE_CODES = new Set([1000, 1001]);

interface UserConnection {
  ws: WebSocket;
  walletAddress: string;
  attempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

@Injectable()
export class PolymarketUserWsService implements OnModuleDestroy {
  private readonly logger = new Logger(PolymarketUserWsService.name);
  private connections = new Map<string, UserConnection>();
  private readonly MAX_CONNECTIONS = 500;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  subscribeUser(userId: string, walletAddress: string): void {
    if (this.connections.has(userId)) return;
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      this.logger.warn(
        `Max user WS connections (${this.MAX_CONNECTIONS}) reached, skipping ${userId}`,
      );
      return;
    }

    this.connect(userId, walletAddress, 0);
  }

  unsubscribeUser(userId: string): void {
    const conn = this.connections.get(userId);
    if (conn) {
      if (conn.reconnectTimer !== null) clearTimeout(conn.reconnectTimer);
      conn.ws.close();
      this.connections.delete(userId);
    }
  }

  onModuleDestroy() {
    for (const [, conn] of this.connections) {
      if (conn.reconnectTimer !== null) clearTimeout(conn.reconnectTimer);
      conn.ws.close();
    }
    this.connections.clear();
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private connect(
    userId: string,
    walletAddress: string,
    attempts: number,
  ): void {
    const wsUrl =
      this.config.get<string>("CLOB_WS_URL") ??
      "wss://ws-subscriptions-clob.polymarket.com/ws/user";

    const ws = new WebSocket(`${wsUrl}?address=${walletAddress}`, {
      maxPayload: MAX_VENUE_WS_FRAME_BYTES,
    });

    const conn: UserConnection = {
      ws,
      walletAddress,
      attempts,
      reconnectTimer: null,
    };
    this.connections.set(userId, conn);

    ws.on("message", (data: Buffer) => {
      if (data.length > MAX_VENUE_WS_FRAME_BYTES) {
        this.logger.warn(
          `User WS oversized frame dropped for ${userId} (${data.length} bytes)`,
        );
        return;
      }

      (async () => {
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
      })().catch((err: unknown) => {
        this.logger.error("User WS message handler error", err);
      });
    });

    ws.on("close", (code: number) => {
      // Only reconnect on abnormal close (not explicit unsubscribe)
      const current = this.connections.get(userId);
      if (!current || current.ws !== ws) return;

      this.connections.delete(userId);

      if (NORMAL_CLOSE_CODES.has(code)) return;

      const nextAttempts = attempts + 1;
      if (nextAttempts > RECONNECT_DELAYS_MS.length) {
        this.logger.warn(
          `User WS ${userId}: max reconnect attempts reached, giving up`,
        );
        return;
      }

      const delay =
        RECONNECT_DELAYS_MS[attempts] ??
        RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1];
      this.logger.log(
        `User WS ${userId}: scheduling reconnect in ${delay}ms (attempt ${nextAttempts})`,
      );

      // Store a placeholder so unsubscribeUser can cancel the pending reconnect
      const placeholder: UserConnection = {
        ws,
        walletAddress,
        attempts: nextAttempts,
        reconnectTimer: null,
      };
      this.connections.set(userId, placeholder);

      placeholder.reconnectTimer = setTimeout(() => {
        // Guard: user may have been manually re-subscribed or unsubscribed
        if (this.connections.get(userId) !== placeholder) return;
        this.connections.delete(userId);
        this.connect(userId, walletAddress, nextAttempts);
      }, delay);
    });

    ws.on("error", (err) => {
      this.logger.error(`User WS error for ${userId}: ${err.message}`);
    });
  }
}
