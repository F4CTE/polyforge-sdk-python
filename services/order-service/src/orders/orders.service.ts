import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { OrderOutcome, OrderStatus } from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { SignerClientService } from "../signer-client/signer-client.service";
import { ClobClientService } from "../clob-client/clob-client.service";
import { EventsService } from "../events/events.service";

const MAX_BATCH_SIZE = 15;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_000;
const DLQ_STREAM = "stream:orders:dlq";

export interface OrderIntent {
  intentId: string;
  userId: string;
  strategyId: string;
  marketId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  outcome: string;
  size: string;
  price: string;
  orderType: "GTC" | "FOK" | "GTD";
  expiration?: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly signer: SignerClientService,
    private readonly clob: ClobClientService,
    private readonly events: EventsService,
  ) {}

  /**
   * Process a batch of OrderIntents for a single user.
   * Enforces MAX_BATCH_SIZE. Each intent is attempted up to MAX_ATTEMPTS
   * times with exponential backoff. Failed intents go to the DLQ.
   */
  async processBatch(intents: OrderIntent[]): Promise<void> {
    const batches = this.chunk(intents, MAX_BATCH_SIZE);

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map((intent) => this.processIntent(intent)),
      );
    }
  }

  async processIntent(intent: OrderIntent, attempt = 1): Promise<void> {
    const orderId = uuidv4();

    // Create DB record in PENDING state
    try {
      await this.prisma.order.create({
        data: {
          id: orderId,
          intentId: intent.intentId,
          userId: intent.userId,
          strategyId: intent.strategyId,
          marketId: intent.marketId,
          tokenId: intent.tokenId,
          side: intent.side,
          outcome: intent.outcome as OrderOutcome,
          size: intent.size,
          price: intent.price,
          orderType: intent.orderType,
          status: OrderStatus.PENDING,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to create order record for intent ${intent.intentId}`,
        err,
      );
      await this.moveToDlq(intent, "DB_CREATE_FAILED");
      return;
    }

    try {
      // Sign the order via signer-service
      const { order, builderHeaders } = await this.signer.signOrder({
        userId: intent.userId,
        requestId: orderId,
        tokenId: intent.tokenId,
        side: intent.side,
        size: parseFloat(intent.size),
        price: parseFloat(intent.price),
        orderType: intent.orderType,
        expiration: intent.expiration,
      });

      // Update to SUBMITTED
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SUBMITTED, placedAt: new Date() },
      });

      // Submit to CLOB
      const clobResponse = await this.clob.submitOrder({
        order,
        builderHeaders,
      });

      // Update with CLOB order ID and set to LIVE
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          clobOrderId: clobResponse.orderID,
          clobStatus: clobResponse.status,
          status: this.mapClobStatus(clobResponse.status) as OrderStatus,
        },
      });

      await this.events.emitOrderPlaced(
        intent.userId,
        orderId,
        intent.intentId,
      );
      this.logger.log(
        `Order placed: ${orderId} (CLOB: ${clobResponse.orderID})`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Order attempt ${attempt}/${MAX_ATTEMPTS} failed for intent ${intent.intentId}: ${errMsg}`,
      );

      if (attempt < MAX_ATTEMPTS) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        return this.processIntent(intent, attempt + 1);
      }

      // All retries exhausted
      await this.prisma.order
        .update({
          where: { id: orderId },
          data: { status: OrderStatus.FAILED },
        })
        .catch(() => {});

      await this.events.emitOrderFailed(intent.userId, orderId, errMsg);
      await this.moveToDlq(intent, errMsg);
    }
  }

  async closePosition(
    userId: string,
    tokenId: string,
    marketId: string,
    size: string,
    strategyId?: string,
  ): Promise<void> {
    // Close = FOK SELL at current market price (price ~0 = market order)
    const intent: OrderIntent = {
      intentId: uuidv4(),
      userId,
      strategyId: strategyId ?? "manual-close",
      marketId,
      tokenId,
      side: "SELL",
      outcome: "YES", // TokenId uniquely identifies outcome
      size,
      price: "0.01", // FOK below current market — gets best fill
      orderType: "FOK",
    };

    await this.processIntent(intent);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private mapClobStatus(clobStatus: string): string {
    switch (clobStatus?.toUpperCase()) {
      case "MATCHED":
        return "MATCHED";
      case "LIVE":
        return "LIVE";
      case "FILLED":
        return "CONFIRMED";
      case "CANCELLED":
        return "CANCELLED";
      default:
        return "SUBMITTED";
    }
  }

  private async moveToDlq(intent: OrderIntent, reason: string): Promise<void> {
    try {
      await this.redis.xadd(DLQ_STREAM, {
        ...Object.fromEntries(
          Object.entries(intent).map(([k, v]) => [k, String(v ?? "")]),
        ),
        failedAt: String(Date.now()),
        reason,
      });
    } catch (dlqErr) {
      this.logger.error("Failed to write to DLQ", dlqErr);
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
