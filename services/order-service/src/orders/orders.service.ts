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
const MIN_GTD_LEAD_SECONDS = 60;
const CLAIM_TIMEOUT_MS = 30_000;
const CLOB_ACCEPTED_PREFIX = "clob:accepted:";
const CLOB_ACCEPTED_TTL_SECONDS = 86_400;

export interface OrderIntent {
  intentId: string;
  orderId?: string;
  userId: string;
  strategyId?: string;
  copyTradeId?: string;
  smartOrderId?: string;
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

export interface OrderBatchResult {
  processed: OrderIntent[];
  failed: Array<{ intent: OrderIntent; error: unknown }>;
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
  async processBatch(intents: OrderIntent[]): Promise<OrderBatchResult> {
    const batches = this.chunk(intents, MAX_BATCH_SIZE);
    const result: OrderBatchResult = { processed: [], failed: [] };

    for (const batch of batches) {
      const settled = await Promise.allSettled(
        batch.map(async (intent) => {
          await this.processIntent(intent);
          return intent;
        }),
      );

      settled.forEach((entry, index) => {
        if (entry.status === "fulfilled") {
          result.processed.push(entry.value);
          return;
        }

        result.failed.push({
          intent: batch[index],
          error: entry.reason,
        });
      });
    }

    return result;
  }

  async processIntent(intent: OrderIntent, attempt = 1): Promise<void> {
    const startedAt = Date.now();
    let orderId = intent.orderId ?? randomUUID();
    let skipDbCreate = false;
    const requestedVenue = intent.venue ?? "polymarket";
    const targetVenue = await this.resolveTargetVenue(intent);
    const prismaVenue = this.toPrismaVenue(targetVenue);
    const strategyId = this.normalizeStrategyId(intent.strategyId);

    // Idempotency guard — check first so redelivered already-processed
    // intents (including GTD orders whose expiration window has passed)
    // are skipped rather than misclassified into the DLQ.
    const existingOrder = await this.prisma.order.findFirst({
      where: { intentId: intent.intentId },
      select: {
        id: true,
        status: true,
        clobOrderId: true,
        venueOrderId: true,
        updatedAt: true,
      },
    });
    if (existingOrder) {
      // A FAILED order from a prior processing attempt means the DLQ write
      // that follows update-to-FAILED likely threw. The stream
      // entry was left unacked for redelivery but the FAILED row would
      // otherwise be treated as "already processed", causing the entry to
      // be XACKed without ever reaching the DLQ. Retry DLQ persistence here.
      if (existingOrder.status === OrderStatus.FAILED) {
        const dlqSentinel = `dlq:written:${intent.intentId}`;
        const alreadyWritten = await this.redis
          .get(dlqSentinel)
          .catch(() => null);
        if (alreadyWritten) {
          this.logger.warn(
            `Intent ${intent.intentId} DLQ write succeeded on prior attempt — skipping duplicate`,
          );
        } else {
          const errCode = `PREVIOUS_DLQ_WRITE_FAILED:${existingOrder.id}`;
          try {
            await this.moveToDlq(intent, errCode);
          } catch {
            throw new Error(
              `Failed order ${existingOrder.id} DLQ write retry failed for intent ${intent.intentId}`,
            );
          }
        }
        return;
      }

      if (existingOrder.status === OrderStatus.SUBMITTED) {
        // SUBMITTED with no venue ids and claim expired → stale claim, reclaim
        const hasNoVenueIds =
          !existingOrder.clobOrderId && !existingOrder.venueOrderId;
        const claimAge =
          Date.now() - new Date(existingOrder.updatedAt).getTime();
        if (hasNoVenueIds && claimAge > CLAIM_TIMEOUT_MS) {
          // Check CLOB-accepted sentinel before re-submitting. If the
          // original processor submitted to CLOB successfully but crashed
          // before persisting to DB, the sentinel prevents a duplicate.
          const clobAcceptedKey = `${CLOB_ACCEPTED_PREFIX}${intent.intentId}`;
          const clobAcceptedVenueOrderId = await this.redis
            .get(clobAcceptedKey)
            .catch(() => null);

          if (clobAcceptedVenueOrderId) {
            this.logger.warn(
              `Order ${existingOrder.id} already accepted by venue (sentinel found: ${clobAcceptedVenueOrderId}) — updating DB without re-submitting`,
            );
            // Persist the known venue order id and mark as SUBMITTED so
            // downstream monitoring can reconcile the true CLOB status.
            await this.prisma.order
              .update({
                where: { id: existingOrder.id },
                data: {
                  clobOrderId: clobAcceptedVenueOrderId,
                  venueOrderId: clobAcceptedVenueOrderId,
                },
              })
              .catch((err) => {
                this.logger.error(
                  {
                    event: "CLOB_ACCEPTED_SENTINEL_DB_UPDATE_FAILED",
                    orderId: existingOrder.id,
                    venueOrderId: clobAcceptedVenueOrderId,
                    intentId: intent.intentId,
                    err,
                  },
                  "Failed to persist venue order id from sentinel",
                );
              });
            await this.redis.del(clobAcceptedKey).catch(() => {});
            return;
          }

          this.logger.warn(
            `Order ${existingOrder.id} has stale SUBMITTED claim (${claimAge}ms, no venue ids) — reclaiming to PENDING`,
          );
          await this.releaseOrderClaim(existingOrder.id);
          orderId = existingOrder.id;
          skipDbCreate = true;
          // Fall through to GTD / numeric / terms validations then CLOB submit
        } else if (!hasNoVenueIds) {
          // SUBMITTED with venue ids → already submitted, terminal
          this.logger.warn(
            `Duplicate intent ${intent.intentId} — skipping (already submitted as order ${existingOrder.id})`,
          );
          return;
        } else {
          // SUBMITTED with no venue ids but claim not yet stale → still processing
          this.logger.warn(
            `Order ${existingOrder.id} SUBMITTED claim still fresh (${claimAge}ms) — not reclaiming`,
          );
          return;
        }
      } else if (existingOrder.status === OrderStatus.PENDING) {
        // PENDING: DB record exists but CLOB submission may have completed
        // (e.g. crash after venue accepted but before claim persisted).
        // Check the CLOB-accepted sentinel to avoid double-submission.
        const clobAcceptedKey = `${CLOB_ACCEPTED_PREFIX}${intent.intentId}`;
        const clobAcceptedVenueOrderId = await this.redis
          .get(clobAcceptedKey)
          .catch(() => null);

        if (clobAcceptedVenueOrderId) {
          this.logger.warn(
            `Order ${existingOrder.id} already accepted by venue (sentinel found: ${clobAcceptedVenueOrderId}) — updating DB without re-submitting`,
          );
          await this.prisma.order
            .update({
              where: { id: existingOrder.id },
              data: {
                clobOrderId: clobAcceptedVenueOrderId,
                venueOrderId: clobAcceptedVenueOrderId,
                status: OrderStatus.SUBMITTED,
              },
            })
            .catch((err) => {
              this.logger.error(
                {
                  event: "CLOB_ACCEPTED_SENTINEL_DB_UPDATE_FAILED",
                  orderId: existingOrder.id,
                  venueOrderId: clobAcceptedVenueOrderId,
                  intentId: intent.intentId,
                  err,
                },
                "Failed to persist venue order id from sentinel (PENDING path)",
              );
            });
          await this.redis.del(clobAcceptedKey).catch(() => {});
          return;
        }

        this.logger.warn(
          `Order ${existingOrder.id} exists in PENDING — retrying CLOB submission for intent ${intent.intentId}`,
        );
        orderId = existingOrder.id;
        skipDbCreate = true;
        // Fall through to GTD / numeric / terms validations then CLOB submit
      } else {
        // Terminal state (LIVE, MATCHED, CANCELLED, etc.) —
        // already fully processed, nothing to do.
        this.logger.warn(
          `Duplicate intent ${intent.intentId} — skipping (already processed as order ${existingOrder.id} with status ${existingOrder.status})`,
        );
        return;
      }
    }

    if (this.isExpiredGtdIntent(intent)) {
      this.logger.warn(
        `GTD intent ${intent.intentId} expired before submission window`,
      );
      await this.moveToDlq(intent, "GTD_EXPIRED_BEFORE_SUBMISSION");
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
    if (!skipDbCreate) {
      try {
        await this.prisma.order.create({
          data: {
            id: orderId,
            intentId: intent.intentId,
            venue: prismaVenue,
            userId: intent.userId,
            strategyId,
            smartOrderId: intent.smartOrderId,
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
    }

    // ── Phase 1: Atomic claim + venue submission ───────────────────────────
    // Claim prevents concurrent processors from double-submitting the same order.
    const claimed = await this.claimOrder(orderId);
    if (!claimed) {
      this.logger.warn(
        `Order ${orderId} could not be claimed — likely already claimed by another processor`,
      );
      return;
    }

    let venueOrderId: string;
    let venueStatus: string;

    try {
      if (this.venueRouter) {
        const venue = targetVenue === "best" ? requestedVenue : targetVenue;
        let authContext: Record<string, unknown> = {};

        if (venue === "polymarket" || venue === "best") {
          const signed = await this.signer.signOrder({
            userId: intent.userId,
            requestId: orderId,
            tokenId: intent.tokenId,
            side: intent.side,
            size: intent.size,
            price: intent.price,
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
        const { order, builderHeaders } = await this.signer.signOrder({
          userId: intent.userId,
          requestId: orderId,
          tokenId: intent.tokenId,
          side: intent.side,
          size: intent.size,
          price: intent.price,
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
    } catch (err) {
      // Phase 1 failure: venue rejected or unreachable — release claim and retry
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
        "Order attempt failed (phase 1: sign/venue)",
      );

      await this.releaseOrderClaim(orderId);

      if (attempt < MAX_ATTEMPTS) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        return this.scheduleRetry(intent, attempt + 1, delay);
      }

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

      await this.events.emitOrderFailed(
        intent.userId,
        orderId,
        errMsg,
        undefined,
        intent.copyTradeId,
        OrderStatus.FAILED,
      );
      await this.moveToDlq(intent, errMsg);
      return;
    }

    // ── Phase 1.5: Venue accepted sentinel ─────────────────────────────────
    // Write a durable sentinel BEFORE any DB persistence so that if the
    // process crashes or persistence fails after venue accepted, a subsequent
    // stale-claim recovery does NOT re-submit the same order to the venue.
    const clobAcceptedKey = `${CLOB_ACCEPTED_PREFIX}${intent.intentId}`;
    await this.redis
      .set(clobAcceptedKey, venueOrderId, CLOB_ACCEPTED_TTL_SECONDS)
      .catch((redisErr) => {
        this.logger.error(
          {
            event: "CLOB_ACCEPTED_SENTINEL_FAILED",
            orderId,
            venueOrderId,
            intentId: intent.intentId,
            err: redisErr,
          },
          "Failed to write CLOB-accepted sentinel — stale-claim recovery may re-submit",
        );
      });

    // ── Phase 2: Venue accepted — persist result + emit events ─────────────
    // DO NOT re-submit to venue on failure here; the venue already has the order.
    // Retry only DB persistence and events.
    const finalStatus = this.mapClobStatus(venueStatus) as OrderStatus;
    const filledAt = this.isFilledStatus(venueStatus) ? new Date() : null;

    try {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          clobOrderId: venueOrderId,
          venueOrderId,
          venue: prismaVenue,
          clobStatus: venueStatus,
          status: finalStatus,
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

      // Clean up the CLOB-accepted sentinel now that persistence succeeded.
      // Non-fatal if it fails — TTL will eventually expire it.
      await this.redis.del(clobAcceptedKey).catch(() => {});
    } catch (err) {
      // Phase 2 failure: venue accepted but persistence/events failed.
      // Retry DB update + events (not venue submission).
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        {
          event: "ORDER_PERSISTENCE_FAILED",
          orderId,
          venueOrderId,
          intentId: intent.intentId,
          err,
        },
        "Order placed at venue but persistence/events failed — retrying",
      );

      if (attempt < MAX_ATTEMPTS) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        const retryIntent: OrderIntent = {
          ...intent,
          orderId,
        };
        return new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            this.retryPersistence(
              retryIntent,
              venueOrderId,
              venueStatus,
              prismaVenue,
              targetVenue,
              startedAt,
              attempt + 1,
            ).then(resolve, reject);
          }, delay);
        });
      }

      // All persistence retries exhausted — keep the venue order id in DB
      await this.prisma.order
        .update({
          where: { id: orderId },
          data: {
            clobOrderId: venueOrderId,
            venueOrderId,
            clobStatus: venueStatus,
            status: finalStatus,
            placedAt: new Date(),
          },
        })
        .catch((updateErr) => {
          this.logger.error(
            {
              event: "ORDER_FINAL_PERSISTENCE_FAILED",
              orderId,
              venueOrderId,
              intentId: intent.intentId,
              err: updateErr,
            },
            "Critical: unable to persist venue order id after all retries",
          );
        });

      await this.events.emitOrderFailed(
        intent.userId,
        orderId,
        errMsg,
        undefined,
        intent.copyTradeId,
        finalStatus,
      );
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

  // ─── Claim / Release Helpers ────────────────────────────────────────────

  /**
   * Atomically claim an order row from PENDING → SUBMITTED, only when
   * no venue ids have been stored yet. Returns true if this processor
   * won the claim.
   */
  private async claimOrder(orderId: string): Promise<boolean> {
    const result = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.PENDING,
        clobOrderId: null,
        venueOrderId: null,
      },
      data: { status: OrderStatus.SUBMITTED },
    });
    return result.count === 1;
  }

  /**
   * Release a SUBMITTED claim back to PENDING. Only resets rows where
   * no venue ids have been stored (i.e. the claim was never fulfilled).
   */
  private async releaseOrderClaim(orderId: string): Promise<void> {
    await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.SUBMITTED,
        clobOrderId: null,
        venueOrderId: null,
      },
      data: { status: OrderStatus.PENDING },
    });
  }

  /**
   * Retry DB persistence + events after venue already accepted the order.
   * Never re-submits to the venue. Attempts up to MAX_ATTEMPTS.
   */
  private async retryPersistence(
    intent: OrderIntent,
    venueOrderId: string,
    venueStatus: string,
    prismaVenue: "POLYMARKET" | "POLYMARKET_US" | "KALSHI",
    targetVenue: string,
    startedAt: number,
    attempt: number,
  ): Promise<void> {
    const orderId = intent.orderId!;
    const finalStatus = this.mapClobStatus(venueStatus) as OrderStatus;
    const filledAt = this.isFilledStatus(venueStatus) ? new Date() : null;

    try {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          clobOrderId: venueOrderId,
          venueOrderId,
          venue: prismaVenue,
          clobStatus: venueStatus,
          status: finalStatus,
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
        "Order placed (after persistence retry)",
      );
      logCloudWatchMetric(this.logger, {
        name: "OrderLatencyMs",
        value: Date.now() - startedAt,
        unit: "Milliseconds",
        dimensions: { Service: "order-service", Venue: targetVenue },
        properties: {
          orderId,
          intentId: intent.intentId,
          strategyId: intent.strategyId,
        },
      });

      await this.redis
        .del(`${CLOB_ACCEPTED_PREFIX}${intent.intentId}`)
        .catch(() => {});
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Retrying persistence for order ${orderId} (attempt ${attempt}/${MAX_ATTEMPTS}) in ${delay}ms`,
        );
        return new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            this.retryPersistence(
              intent,
              venueOrderId,
              venueStatus,
              prismaVenue,
              targetVenue,
              startedAt,
              attempt + 1,
            ).then(resolve, reject);
          }, delay);
        });
      }

      this.logger.error(
        {
          event: "ORDER_PERSISTENCE_EXHAUSTED",
          orderId,
          venueOrderId,
          intentId: intent.intentId,
          err,
        },
        "All persistence retries exhausted after venue accepted",
      );
      await this.events.emitOrderFailed(
        intent.userId,
        orderId,
        errMsg,
        undefined,
        intent.copyTradeId,
        finalStatus,
      );
    }
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
        return adapter.venueId;
      }

      return this.venueRouter.resolve(venue).venueId;
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

    return hasAcceptedCurrentUsRailTerms(user);
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

  private isExpiredGtdIntent(intent: OrderIntent): boolean {
    if (intent.orderType !== "GTD") return false;
    if (intent.expiration == null) return true;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return intent.expiration <= nowSeconds + MIN_GTD_LEAD_SECONDS;
  }

  private async moveToDlq(intent: OrderIntent, reason: string): Promise<void> {
    try {
      await this.redis.xadd(
        DLQ_STREAM,
        {
          ...Object.fromEntries(
            Object.entries(intent).map(([k, v]) => [k, String(v ?? "")]),
          ),
          failedAt: String(Date.now()),
          reason,
        },
        10_000,
      );
      await this.redis
        .set(`dlq:written:${intent.intentId}`, "1", 86400)
        .catch(() => {
          /* best-effort sentinel — non-fatal if write fails */
        });
      const dlqClient =
        typeof this.redis.getClient === "function"
          ? this.redis.getClient()
          : undefined;
      const dlqDepth = await dlqClient?.xlen(DLQ_STREAM).catch(() => undefined);
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
      throw dlqErr;
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
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        this.processIntent(intent, nextAttempt).then(resolve, reject);
      }, delayMs);
    });
  }
}
