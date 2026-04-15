import { Injectable, Logger } from "@nestjs/common";
import { Interval, Cron } from "@nestjs/schedule";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { type ConditionalOrder } from "@prisma/client";
import { randomUUID } from "crypto";

const STREAM_ORDERS = "stream:orders";
const STREAM_EVENTS = "stream:events";

@Injectable()
export class ConditionalEvaluatorService {
  private readonly logger = new Logger(ConditionalEvaluatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Interval(5000)
  async evaluate(): Promise<void> {
    try {
      await this.processOrders();
    } catch (err) {
      this.logger.error("Conditional evaluator tick failed", err);
    }
  }

  async processOrders(): Promise<void> {
    const pendingOrders = await this.prisma.conditionalOrder.findMany({
      where: { status: "PENDING" },
      take: 100,
    });

    if (pendingOrders.length === 0) return;

    // Batch fetch all prices in one MGET instead of N sequential GETs
    const tokenIds = [...new Set(pendingOrders.map((o) => o.tokenId))];

    const priceKeys = tokenIds.map((id) => `cache:price:${id}`);
    const priceValues = await this.redis.getClient().mget(...priceKeys);
    const priceMap = new Map<string, number>();
    tokenIds.forEach((id, i) => {
      if (priceValues[i]) priceMap.set(id, parseFloat(priceValues[i]));
    });

    for (const order of pendingOrders) {
      const currentPrice = priceMap.get(order.tokenId);
      if (currentPrice === undefined) continue;
      const triggerPrice = parseFloat(String(order.triggerPrice));

      // PEGGED orders: re-price on every tick without triggering
      if (order.type === "PEGGED") {
        await this.handlePegged(order, currentPrice);
        continue;
      }

      // TRAILING_STOP: track peak and check drop
      if (order.type === "TRAILING_STOP") {
        await this.handleTrailingStop(order, currentPrice);
        continue;
      }

      // Evaluate trigger condition
      const shouldTrigger = this.shouldTrigger(
        order.type as string,
        order.side as string,
        currentPrice,
        triggerPrice,
      );

      if (shouldTrigger) {
        await this.triggerOrder(order);
      }
    }
  }

  shouldTrigger(
    type: string,
    side: string,
    currentPrice: number,
    triggerPrice: number,
  ): boolean {
    const isBuyYes = side === "BUY";

    switch (type) {
      case "TAKE_PROFIT":
        return isBuyYes
          ? currentPrice >= triggerPrice
          : currentPrice <= triggerPrice;

      case "STOP_LOSS":
        return isBuyYes
          ? currentPrice <= triggerPrice
          : currentPrice >= triggerPrice;

      case "LIMIT":
        return isBuyYes
          ? currentPrice <= triggerPrice
          : currentPrice >= triggerPrice;

      default:
        return false;
    }
  }

  async handleTrailingStop(
    order: ConditionalOrder,
    currentPrice: number,
  ): Promise<void> {
    const trailingPct = parseFloat(String(order.trailingPct));
    const currentPeak = order.peakPrice
      ? parseFloat(String(order.peakPrice))
      : currentPrice;

    const isBuyYes = order.side === "BUY";

    // For BUY YES positions, track the highest price
    // For BUY NO positions, track the lowest price
    const newPeak = isBuyYes
      ? Math.max(currentPeak, currentPrice)
      : Math.min(currentPeak, currentPrice);

    // Update peak if changed
    if (newPeak !== currentPeak) {
      await this.prisma.conditionalOrder.update({
        where: { id: order.id },
        data: { peakPrice: newPeak },
      });
    }

    // Check if price has dropped (or risen for NO) by trailingPct from peak
    const triggered = isBuyYes
      ? ((newPeak - currentPrice) / newPeak) * 100 >= trailingPct
      : ((currentPrice - newPeak) / newPeak) * 100 >= trailingPct;

    if (triggered) {
      await this.triggerOrder(order);
    }
  }

  async handlePegged(
    order: ConditionalOrder,
    currentPrice: number,
  ): Promise<void> {
    const offset = parseFloat(String(order.triggerPrice));
    const newLimitPrice = Math.max(0.01, Math.min(0.99, currentPrice + offset));

    // Skip DB write if price hasn't changed materially (avoids write on every tick)
    const existingLimit = order.limitPrice
      ? parseFloat(String(order.limitPrice))
      : null;
    if (
      existingLimit !== null &&
      Math.abs(newLimitPrice - existingLimit) < 0.0001
    )
      return;

    await this.prisma.conditionalOrder.update({
      where: { id: order.id },
      data: { limitPrice: newLimitPrice },
    });
  }

  async triggerOrder(order: ConditionalOrder): Promise<void> {
    const intentId = randomUUID();

    // Publish OrderIntent to stream:orders
    await this.redis.xadd(STREAM_ORDERS, {
      intentId,
      userId: order.userId,
      strategyId: "",
      marketId: order.marketId,
      tokenId: order.tokenId,
      side: order.side,
      outcome: order.outcome,
      size: String(order.size),
      price: order.limitPrice
        ? String(order.limitPrice)
        : String(order.triggerPrice),
      orderType: "GTC",
      expiration: "",
      ts: String(Date.now()),
    });

    // Update status to TRIGGERED
    await this.prisma.conditionalOrder.update({
      where: { id: order.id },
      data: {
        status: "TRIGGERED",
        triggeredAt: new Date(),
        orderId: intentId,
      },
    });

    // Emit notification
    await this.redis.xadd(STREAM_EVENTS, {
      type: "ORDER_CONDITIONAL_TRIGGERED",
      userId: order.userId,
      conditionalOrderId: order.id,
      conditionalType: order.type,
      tokenId: order.tokenId,
      triggerPrice: String(order.triggerPrice),
      size: String(order.size),
      side: order.side,
      ts: String(Date.now()),
    });

    this.logger.log(
      `Conditional order ${order.id} (${order.type}) triggered — intent ${intentId}`,
    );
  }

  // L-03: Separate expiration check on its own schedule (every 30 seconds)
  @Cron("*/30 * * * * *")
  async checkExpiredOrders(): Promise<void> {
    try {
      // Single updateMany instead of sequential updates per order
      const { count } = await this.prisma.conditionalOrder.updateMany({
        where: {
          status: "PENDING",
          expiresAt: { not: null, lte: new Date() },
        },
        data: { status: "CANCELLED" },
      });
      if (count > 0)
        this.logger.log(`Cancelled ${count} expired conditional order(s)`);
    } catch (err) {
      this.logger.error("Expiration check failed", err);
    }
  }
}
