import { Injectable, Logger, Optional } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { OrderOutcome, OrderStatus } from ".prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { SignerClientService } from "../signer-client/signer-client.service";
import { ClobClientService } from "../clob-client/clob-client.service";
import { EventsService } from "../events/events.service";
import type { VenueId } from "@polyforge/shared-types";
import { VenueRouter } from "../venue/venue-router";

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
  orderType: "GTC" | "FOK" | "GTD" | "FAK" | "POST_ONLY";
  expiration?: number;
  tickSize?: string;
  negRisk?: boolean;
  /** Target venue for this order. Defaults to POLYMARKET when absent. */
  venue?: VenueId | "best";
  /** Kalshi subaccount number (0 = primary). Passed through to Kalshi API for P&L attribution. */
  kalshiSubaccount?: number;
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
    @Optional() private readonly venueRouter?: VenueRouter,
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

    // SECURITY: Idempotency guard — skip if this intent was already processed
    const existingOrder = await this.prisma.order.findFirst({
      where: { intentId: intent.intentId },
      select: { id: true },
    });
    if (existingOrder) {
      this.logger.warn(
        `Duplicate intent ${intent.intentId} — skipping (already processed as order ${existingOrder.id})`,
      );
      return;
    }

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
    } catch (err: any) {
      // Handle unique constraint violation (P2002) for intentId
      if (err?.code === "P2002") {
        this.logger.warn(
          `Duplicate intent ${intent.intentId} — skipping (unique constraint)`,
        );
        return;
      }
      this.logger.error(
        `Failed to create order record for intent ${intent.intentId}`,
        err,
      );
      await this.moveToDlq(intent, "DB_CREATE_FAILED");
      return;
    }

    try {
      let venueOrderId: string;
      let venueStatus: string;

      if (this.venueRouter) {
        // ── Venue-routed path ─────────────────────────────────────────────────
        // For Polymarket, pre-sign and pass auth context. For other venues
        // (e.g. Kalshi), the adapter handles its own auth via authContext.
        const venue = intent.venue ?? "polymarket";
        let authContext: Record<string, unknown> = {};

        if (venue === "polymarket" || venue === "best") {
          const signed = await this.signer.signOrder({
            userId: intent.userId,
            requestId: orderId,
            tokenId: intent.tokenId,
            side: intent.side,
            size: parseFloat(intent.size),
            price: parseFloat(intent.price),
            orderType: intent.orderType,
            expiration: intent.expiration,
            tickSize: intent.tickSize,
            negRisk: intent.negRisk,
          });
          authContext = {
            order: signed.order,
            builderHeaders: signed.builderHeaders,
          };
        } else if (venue === "polymarket_us") {
          // Phase 2 (POLA-957) adds GET /internal/v1/credentials/:userId/us to signer-service.
          const usCreds = await this.signer.getPolymarketUsCredentials(
            intent.userId,
          );
          authContext = {
            venue: "polymarket_us",
            keyId: usCreds.keyId,
            secretKey: usCreds.secretKey,
          };
        } else if (venue === "kalshi" && intent.kalshiSubaccount != null) {
          authContext = { subaccount: intent.kalshiSubaccount };
        }

        const resp = await this.venueRouter.route(venue, {
          venueMarketId: intent.marketId,
          venueOutcomeId: intent.tokenId,
          side: intent.side,
          size: intent.size,
          price: intent.price,
          orderType: intent.orderType,
          expiration: intent.expiration,
          authContext,
        });

        venueOrderId = resp.venueOrderId;
        venueStatus = resp.status;
      } else {
        // ── Legacy CLOB path (backward compat, no VenueRouter injected) ───────
        const { order, builderHeaders } = await this.signer.signOrder({
          userId: intent.userId,
          requestId: orderId,
          tokenId: intent.tokenId,
          side: intent.side,
          size: parseFloat(intent.size),
          price: parseFloat(intent.price),
          orderType: intent.orderType,
          expiration: intent.expiration,
          tickSize: intent.tickSize,
          negRisk: intent.negRisk,
        });
        const clobResponse = await this.clob.submitOrder({
          order,
          builderHeaders,
        });
        venueOrderId = clobResponse.orderID;
        venueStatus = clobResponse.status;
      }

      // Single DB update: PENDING → final status (consolidates 2 updates into 1)
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          clobOrderId: venueOrderId,
          venueOrderId,
          clobStatus: venueStatus,
          status: this.mapClobStatus(venueStatus) as OrderStatus,
          placedAt: new Date(),
        },
      });

      await this.events.emitOrderPlaced(
        intent.userId,
        orderId,
        intent.intentId,
      );
      this.logger.log(
        `Order placed: ${orderId} (venue order: ${venueOrderId})`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Order attempt ${attempt}/${MAX_ATTEMPTS} failed for intent ${intent.intentId}: ${errMsg}`,
      );

      if (attempt < MAX_ATTEMPTS) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        return this.scheduleRetry(intent, attempt + 1, delay);
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
      price: "0.01", // FOK below current market -- gets best fill
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
      case "DELAYED":
        return "DELAYED";
      case "MINED":
        return "MINED";
      case "CONFIRMED":
        return "CONFIRMED";
      case "RETRYING":
        return "SUBMITTED"; // retrying = still in progress
      case "UNMATCHED":
        return "LIVE"; // unmatched = resting on book
      case "FAILED":
        return "FAILED";
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

  /** Visible for testing -- resolves when the delayed retry completes. */
  scheduleRetry(
    intent: OrderIntent,
    nextAttempt: number,
    delayMs: number,
  ): Promise<void> {
    this.logger.log(
      `Scheduling retry ${nextAttempt}/${MAX_ATTEMPTS} for intent ${intent.intentId} in ${delayMs}ms`,
    );
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        this.processIntent(intent, nextAttempt).then(resolve, resolve);
      }, delayMs);
    });
  }
}
