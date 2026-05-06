import { Injectable, Logger, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { OrderOutcome, OrderStatus } from ".prisma/client";
import { logCloudWatchMetric } from "@polyforge/logger";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { SignerClientService } from "../signer-client/signer-client.service";
import { ClobClientService } from "../clob-client/clob-client.service";
import { EventsService } from "../events/events.service";
import {
  hasAcceptedCurrentUsRailTerms,
  parseFiniteDecimal,
  type VenueId,
} from "@polyforge/shared-types";
import { VenueRouter } from "../venue/venue-router";

const MAX_BATCH_SIZE = 15;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_000;
const DLQ_STREAM = "stream:orders:dlq";

export interface OrderIntent {
  intentId: string;
  orderId?: string;
  userId: string;
  strategyId?: string;
  copyTradeId?: string;
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

export interface CancellationIntent {
  orderId: string;
  userId: string;
  clobOrderId?: string;
  venueOrderId?: string;
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
    const startedAt = Date.now();
    const orderId = intent.orderId ?? randomUUID();
    const requestedVenue = intent.venue ?? "polymarket";
    const targetVenue = await this.resolveTargetVenue(intent);
    const prismaVenue = this.toPrismaVenue(targetVenue);
    const strategyId = this.normalizeStrategyId(intent.strategyId);

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

    const intentSize = parseFiniteDecimal(intent.size);
    const intentPrice = parseFiniteDecimal(intent.price);

    if (intentSize === null || intentPrice === null) {
      const hasBlankNumericInput = [intent.size, intent.price].some(
        (value) => String(value).trim() === "",
      );
      this.logger.warn(
        `Invalid numeric order intent ${intent.intentId} — rejecting before order creation`,
      );
      await this.moveToDlq(
        intent,
        hasBlankNumericInput
          ? "INVALID_NUMERIC_ORDER_INTENT"
          : "INVALID_ORDER_NUMERIC",
      );
      return;
    }

    if (intentSize <= 0 || intentPrice < 0) {
      this.logger.warn(
        `Invalid numeric order intent ${intent.intentId} — rejecting before order creation`,
      );
      await this.moveToDlq(intent, "INVALID_NUMERIC_ORDER_INTENT");
      return;
    }

    if (targetVenue === "polymarket_us") {
      const hasAcceptedTerms = await this.hasCurrentUsRailTerms(intent.userId);

      if (!hasAcceptedTerms) {
        this.logger.warn(
          `US rail terms required for intent ${intent.intentId} — rejecting before order creation`,
        );
        await this.moveToDlq(intent, "US_RAIL_TERMS_REQUIRED");
        return;
      }
    }

    // Create DB record in PENDING state
    try {
      await this.prisma.order.create({
        data: {
          id: orderId,
          intentId: intent.intentId,
          venue: prismaVenue,
          userId: intent.userId,
          strategyId,
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
        {
          event: "ORDER_CREATE_FAILED",
          intentId: intent.intentId,
          userId: intent.userId,
          err,
        },
        "Failed to create order record",
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
        const venue = targetVenue === "best" ? requestedVenue : targetVenue;
        let authContext: Record<string, unknown> = {};

        if (venue === "polymarket" || venue === "best") {
          const signed = await this.signer.signOrder({
            userId: intent.userId,
            requestId: orderId,
            tokenId: intent.tokenId,
            side: intent.side,
            size: intentSize,
            price: intentPrice,
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
          size: intentSize,
          price: intentPrice,
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

      const filledAt = this.isFilledStatus(venueStatus) ? new Date() : null;

      // Single DB update: PENDING → final status (consolidates 2 updates into 1)
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          clobOrderId: venueOrderId,
          venueOrderId,
          venue: prismaVenue,
          clobStatus: venueStatus,
          status: this.mapClobStatus(venueStatus) as OrderStatus,
          placedAt: new Date(),
          ...(filledAt
            ? {
                fillPrice: intent.price,
                fillSize: intent.size,
                fee: "0",
                filledAt,
              }
            : {}),
        },
      });

      if (intent.copyTradeId) {
        await this.prisma.copyTrade.update({
          where: { id: intent.copyTradeId },
          data: { orderId },
        });
      }

      await this.events.emitOrderPlaced(
        intent.userId,
        orderId,
        intent.intentId,
      );
      if (this.isFilledStatus(venueStatus)) {
        await this.events.emitOrderFilled(
          intent.userId,
          orderId,
          intent.price,
          intent.size,
          "0",
          intent.copyTradeId,
        );
      }
      this.logger.log(
        {
          event: "ORDER_PLACED",
          orderId,
          venueOrderId,
          intentId: intent.intentId,
          strategyId: intent.strategyId,
          userId: intent.userId,
          venue: targetVenue,
        },
        "Order placed",
      );
      logCloudWatchMetric(this.logger, {
        name: "OrderLatencyMs",
        value: Date.now() - startedAt,
        unit: "Milliseconds",
        dimensions: {
          Service: "order-service",
          Venue: targetVenue,
        },
        properties: {
          orderId,
          intentId: intent.intentId,
          strategyId: intent.strategyId,
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        {
          event: "ORDER_ATTEMPT_FAILED",
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          intentId: intent.intentId,
          strategyId: intent.strategyId,
          userId: intent.userId,
          err,
        },
        "Order attempt failed",
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
        .catch((updateErr) => {
          this.logger.error(
            {
              event: "ORDER_FAILED_STATUS_UPDATE_FAILED",
              orderId,
              intentId: intent.intentId,
              err: updateErr,
            },
            "Failed to mark order as failed",
          );
        });

      await this.events.emitOrderFailed(intent.userId, orderId, errMsg);
      await this.moveToDlq(intent, errMsg);
    }
  }

  async processCancellation(intent: CancellationIntent): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: intent.orderId },
    });

    if (!order || order.userId !== intent.userId) {
      this.logger.warn(
        `Cancellation ignored for unknown order ${intent.orderId}`,
      );
      return;
    }

    const venueOrderId =
      intent.venueOrderId ??
      intent.clobOrderId ??
      order.venueOrderId ??
      order.clobOrderId;
    if (!venueOrderId) {
      await this.markCancelled(order.id, order.userId);
      return;
    }

    const venue = this.fromPrismaVenue(
      (order as { venue?: string | null }).venue,
    );
    if (this.venueRouter && venue !== "polymarket") {
      const adapter = this.venueRouter.resolve(venue);
      await adapter.cancelOrder(
        venueOrderId,
        await this.buildCancelAuthContext(venue, order),
      );
    } else {
      await this.signer.cancelPolymarketOrder(order.userId, venueOrderId);
    }

    await this.markCancelled(order.id, order.userId);
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
      intentId: randomUUID(),
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

  private async resolveTargetVenue(
    intent: OrderIntent,
  ): Promise<VenueId | "best"> {
    const venue = intent.venue ?? "polymarket";

    if (!this.venueRouter) return venue;

    try {
      if (venue === "best") {
        const adapter = await this.venueRouter.resolveBest(intent.tokenId);
        return adapter.venueId as VenueId;
      }

      return this.venueRouter.resolve(venue).venueId as VenueId;
    } catch {
      return venue;
    }
  }

  private normalizeStrategyId(strategyId: string | undefined): string | null {
    const trimmed = strategyId?.trim();
    return trimmed ? trimmed : null;
  }

  private toPrismaVenue(
    venue: VenueId | "best",
  ): "POLYMARKET" | "POLYMARKET_US" | "KALSHI" {
    switch (venue) {
      case "polymarket_us":
        return "POLYMARKET_US";
      case "kalshi":
        return "KALSHI";
      default:
        return "POLYMARKET";
    }
  }

  private fromPrismaVenue(venue: string | null | undefined): VenueId {
    switch (venue) {
      case "POLYMARKET_US":
        return "polymarket_us";
      case "KALSHI":
        return "kalshi";
      default:
        return "polymarket";
    }
  }

  private isFilledStatus(status: string): boolean {
    const normalized = status.toUpperCase();
    return normalized === "FILLED" || normalized === "MATCHED";
  }

  private async buildCancelAuthContext(
    venue: VenueId,
    order: {
      userId: string;
      marketId: string;
    },
  ): Promise<Record<string, unknown>> {
    if (venue === "polymarket_us") {
      const usCreds = await this.signer.getPolymarketUsCredentials(
        order.userId,
      );
      return {
        venue: "polymarket_us",
        keyId: usCreds.keyId,
        secretKey: usCreds.secretKey,
        marketSlug: order.marketId,
      };
    }
    if (venue === "kalshi") {
      return { userId: order.userId };
    }
    return {};
  }

  private async markCancelled(orderId: string, userId: string): Promise<void> {
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        clobStatus: "CANCELLED",
      },
    });
    const copyTrade = await this.prisma.copyTrade.findFirst({
      where: { orderId },
      select: { id: true },
    });
    await this.events.emitOrderCancelled(userId, orderId, copyTrade?.id);
  }

  private async hasCurrentUsRailTerms(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        usRailTermsAcceptedAt: true,
        usRailTermsVersion: true,
      } as any,
    });

    return hasAcceptedCurrentUsRailTerms(user as any);
  }

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
      const dlqDepth = await this.redis
        .getClient()
        .xlen(DLQ_STREAM)
        .catch(() => undefined);
      logCloudWatchMetric(this.logger, {
        name: "OrderDlqDepth",
        value: dlqDepth ?? 1,
        unit: "Count",
        dimensions: { Service: "order-service", Stream: DLQ_STREAM },
        properties: { intentId: intent.intentId, reason },
      });
    } catch (dlqErr) {
      this.logger.error(
        {
          event: "ORDER_DLQ_WRITE_FAILED",
          stream: DLQ_STREAM,
          intentId: intent.intentId,
          reason,
          err: dlqErr,
        },
        "Failed to write order intent to DLQ",
      );
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
