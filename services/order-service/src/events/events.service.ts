import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "@polyforge/shared-redis";

const STREAM = "stream:events";

/**
 * Publishes order lifecycle events to stream:events.
 * Consumed by: api-service (WebSocket), notification-service, admin-api-service.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly redis: RedisService) {}

  async emitOrderPlaced(
    userId: string,
    orderId: string,
    intentId: string,
  ): Promise<void> {
    await this.redis.xadd(STREAM, {
      type: "ORDER_PLACED",
      userId,
      orderId,
      intentId,
      ts: String(Date.now()),
    });
  }

  async emitOrderFilled(
    userId: string,
    orderId: string,
    fillPrice: string,
    fillSize: string,
    pnl: string,
  ): Promise<void> {
    await this.redis.xadd(STREAM, {
      type: "ORDER_FILLED",
      userId,
      orderId,
      fillPrice,
      fillSize,
      pnl,
      ts: String(Date.now()),
    });
  }

  async emitOrderCancelled(userId: string, orderId: string): Promise<void> {
    await this.redis.xadd(STREAM, {
      type: "ORDER_CANCELLED",
      userId,
      orderId,
      ts: String(Date.now()),
    });
  }

  async emitOrderFailed(
    userId: string,
    orderId: string,
    reason: string,
  ): Promise<void> {
    await this.redis.xadd(STREAM, {
      type: "ORDER_FAILED",
      userId,
      orderId,
      reason,
      ts: String(Date.now()),
    });
  }
}
