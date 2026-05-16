import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { parseFiniteDecimal } from "@polyforge/shared-types";
import {
  OrderSide,
  OrderOutcome,
  OrderType,
  OrderStatus,
} from ".prisma/client";

interface BookLevel {
  price: string;
  size: string;
}

interface BookData {
  asks?: BookLevel[];
  bids?: BookLevel[];
}

interface PriceData {
  price?: string;
}

export interface OrderIntent {
  intentId: string;
  userId: string;
  strategyId: string;
  marketId: string;
  tokenId: string;
  side: string; // BUY | SELL
  outcome: string; // YES | NO
  size: string;
  price: string;
  orderType: string;
  expiration: string;
}

const PAPER_PNL_KEY = (userId: string) => `paper:${userId}:pnl`;
const PNL_DEDUP_KEY = (intentId: string) => `paper:pnl:applied:${intentId}`;
const PNL_DEDUP_TTL = 604800;
const EVENT_DEDUP_KEY = (intentId: string) => `paper:event:emitted:${intentId}`;
const EVENT_DEDUP_TTL = 604800;
const SERIALIZABLE_TRANSACTION = { isolationLevel: "Serializable" as const };
const MAX_SERIALIZABLE_RETRIES = 3;

const ATOMIC_PNL_SCRIPT = `
  local dedupKey = KEYS[1]
  local pnlKey = KEYS[2]
  local realizedPnl = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])

  if redis.call('EXISTS', dedupKey) == 1 then
    return 0
  end
  if realizedPnl ~= 0 then
    redis.call('INCRBYFLOAT', pnlKey, realizedPnl)
  end
  redis.call('SET', dedupKey, '1', 'EX', ttl)
  return 1
`;

const ATOMIC_EVENT_SCRIPT = `
  local dedupKey = KEYS[1]
  local streamKey = KEYS[2]
  local ttl = tonumber(ARGV[1])

  if redis.call('EXISTS', dedupKey) == 1 then
    return 0
  end

  -- Collect field pairs from remaining ARGV (even count expected)
  local fieldCount = #ARGV - 1
  local xaddArgs = {'*'}
  for i = 2, #ARGV do
    xaddArgs[#xaddArgs + 1] = ARGV[i]
  end

  local result = redis.call('XADD', streamKey, unpack(xaddArgs))
  redis.call('SET', dedupKey, '1', 'EX', ttl)
  return result
`;

type PrismaTx = Pick<PrismaService, "paperOrder" | "paperPosition">;

@Injectable()
export class FillsService {
  private readonly logger = new Logger(FillsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async simulate(intent: OrderIntent): Promise<void> {
    // ── Idempotency pre-check: handle duplicate/replayed intents ─────────────
    const existing = await this.prisma.paperOrder.findUnique({
      where: { intentId: intent.intentId },
    });

    if (existing?.fillCompletedAt && existing.redisEffectsApplied) {
      // Already fully processed — ACK silently
      return;
    }

    if (existing?.fillCompletedAt && !existing.redisEffectsApplied) {
      await this.recoverRedisEffects(existing, intent.intentId);
      return;
    }

    if (existing && !existing.fillCompletedAt) {
      // In-flight: order record exists but transaction was rolled back.
      // This should not happen with Serializable atomicity, but defensively
      // treat as an error to avoid double-processing.
      throw new Error(
        `Intent ${intent.intentId} has an incomplete order record (missing fillCompletedAt)`,
      );
    }

    // ── Normal path: no existing order ───────────────────────────────────────

    const fillPrice = await this.resolveFillPrice(intent);
    if (!Number.isFinite(fillPrice) || fillPrice < 0) {
      throw new Error("Invalid paper order numeric input");
    }

    const fillSize = parseFiniteDecimal(intent.size);
    if (fillSize === null || fillSize <= 0) {
      if (fillSize === null && String(intent.size).trim() !== "") {
        throw new Error(`Invalid paper fill size: ${intent.size}`);
      }
      throw new Error("Invalid paper order numeric input");
    }

    try {
      const { orderId, realizedPnl } = await this.withSerializableRetry(
        async (tx) => {
          const order = await tx.paperOrder.create({
            data: {
              userId: intent.userId,
              strategyId: intent.strategyId || null,
              marketId: intent.marketId,
              tokenId: intent.tokenId,
              side: intent.side as OrderSide,
              outcome: intent.outcome as OrderOutcome,
              size: intent.size,
              price: intent.price,
              orderType: intent.orderType as OrderType,
              status: OrderStatus.CONFIRMED,
              fillSize: String(fillSize),
              fillPrice: String(fillPrice),
              intentId: intent.intentId,
              fillCompletedAt: new Date(),
            },
          });

          const realized = await this.upsertPosition(
            tx,
            intent,
            fillPrice,
            fillSize,
          );

          await tx.paperOrder.update({
            where: { id: order.id },
            data: { realizedPnl: String(realized) },
          });

          return { orderId: order.id, realizedPnl: realized };
        },
      );

      // 3. Apply Redis side-effects (P&L counter + event emission)
      await this.applyRedisEffects(
        intent,
        orderId,
        fillPrice,
        fillSize,
        realizedPnl,
      );

      // 4. Mark Redis effects as applied
      await this.prisma.paperOrder.update({
        where: { id: orderId },
        data: { redisEffectsApplied: true },
      });

      this.logger.log(
        `Paper fill: ${intent.side} ${fillSize} ${intent.tokenId} @ ${fillPrice} for user ${intent.userId}`,
      );
    } catch (err: unknown) {
      // P2002 on intentId: another worker won the race — treat as idempotent
      if (this.isIntentIdDuplicate(err)) {
        const duplicate = await this.prisma.paperOrder.findUnique({
          where: { intentId: intent.intentId },
        });
        if (duplicate?.fillCompletedAt && duplicate.redisEffectsApplied) {
          return;
        }
        if (duplicate?.fillCompletedAt && !duplicate.redisEffectsApplied) {
          // Crash recovery for the winning worker's order
          await this.recoverRedisEffects(duplicate, intent.intentId);
          return;
        }
        // If still in-flight, re-throw so the message retries
      }
      throw err;
    }
  }

  // ─── Redis side-effects ────────────────────────────────────────────────────

  private async applyRedisEffects(
    intent: OrderIntent,
    orderId: string,
    fillPrice: number,
    fillSize: number,
    realizedPnl: number,
  ): Promise<void> {
    if (realizedPnl !== 0) {
      const dedupKey = PNL_DEDUP_KEY(intent.intentId);
      const pnlKey = PAPER_PNL_KEY(intent.userId);
      await this.redis
        .getClient()
        .eval(
          ATOMIC_PNL_SCRIPT,
          2,
          dedupKey,
          pnlKey,
          realizedPnl,
          PNL_DEDUP_TTL,
        );
    }

    await this.redis.getClient().eval(
      ATOMIC_EVENT_SCRIPT,
      2,
      EVENT_DEDUP_KEY(intent.intentId),
      "stream:events",
      EVENT_DEDUP_TTL,
      "type", "PAPER_ORDER_FILLED",
      "orderId", orderId,
      "intentId", intent.intentId,
      "userId", intent.userId,
      "strategyId", intent.strategyId ?? "",
      "tokenId", intent.tokenId,
      "side", intent.side,
      "fillSize", String(fillSize),
      "simulatedPrice", String(fillPrice),
      "ts", String(Date.now()),
    );
  }

  private async recoverRedisEffects(
    existing: { id: string; userId: string; strategyId: string | null; marketId: string; tokenId: string; side: string; outcome: string; fillPrice: unknown; fillSize: unknown; realizedPnl: unknown; orderType: string | null },
    intentId: string,
  ): Promise<void> {
    const fillPrice = parseFloat(String(existing.fillPrice ?? 0));
    const fillSize = parseFloat(String(existing.fillSize ?? 0));
    const realizedPnl = parseFloat(String(existing.realizedPnl ?? 0));

    const recoveryIntent: OrderIntent = {
      intentId,
      userId: existing.userId,
      strategyId: existing.strategyId ?? "",
      marketId: existing.marketId,
      tokenId: existing.tokenId,
      side: existing.side,
      outcome: existing.outcome,
      size: String(existing.fillSize ?? "0"),
      price: String(existing.fillPrice ?? "0"),
      orderType: existing.orderType ?? "LIMIT",
      expiration: "0",
    };

    await this.applyRedisEffects(
      recoveryIntent,
      existing.id,
      fillPrice,
      fillSize,
      realizedPnl,
    );

    await this.prisma.paperOrder.update({
      where: { intentId },
      data: { redisEffectsApplied: true },
    });

    this.logger.log(
      `Recovered Redis effects for intent ${intentId} (order ${existing.id})`,
    );
  }

  // ─── Price resolution with best-ask/bid improvement ──────────────────────

  private async resolveFillPrice(intent: OrderIntent): Promise<number> {
    const bookRaw = await this.redis.get(`cache:book:${intent.tokenId}`);
    const intentPrice = parseFiniteDecimal(intent.price);
    if (intentPrice === null) {
      throw new Error(`Invalid paper fill price: ${intent.price}`);
    }

    if (!bookRaw) {
      // No book data — fall back to current price cache or intent price
      const priceRaw = await this.redis.get(`cache:price:${intent.tokenId}`);
      if (priceRaw) {
        const priceData = JSON.parse(priceRaw) as PriceData;
        return parseFiniteDecimal(priceData.price) ?? intentPrice;
      }
      return intentPrice;
    }

    const book = JSON.parse(bookRaw) as BookData;

    if (intent.side === "BUY") {
      // Buying: if best ask is lower than our limit price, fill at best ask (price improvement)
      const bestAsk = book.asks?.[0]?.price;
      if (bestAsk) {
        const ask = parseFiniteDecimal(bestAsk);
        if (ask === null) return intentPrice;
        return ask < intentPrice ? ask : intentPrice;
      }
    } else {
      // Selling: if best bid is higher than our limit price, fill at best bid (price improvement)
      const bestBid = book.bids?.[0]?.price;
      if (bestBid) {
        const bid = parseFiniteDecimal(bestBid);
        if (bid === null) return intentPrice;
        return bid > intentPrice ? bid : intentPrice;
      }
    }

    return intentPrice;
  }

  // ─── Position accounting ──────────────────────────────────────────────────

  private async upsertPosition(
    tx: PrismaTx,
    intent: OrderIntent,
    fillPrice: number,
    fillSize: number,
  ): Promise<number> {
    const existing = await tx.paperPosition.findUnique({
      where: {
        userId_tokenId: { userId: intent.userId, tokenId: intent.tokenId },
      },
    });

    let realizedPnl = 0;

    if (!existing) {
      if (intent.side === "SELL") return 0; // No position to sell

      await tx.paperPosition.create({
        data: {
          userId: intent.userId,
          marketId: intent.marketId,
          tokenId: intent.tokenId,
          outcome: intent.outcome as OrderOutcome,
          size: String(fillSize),
          avgPrice: String(fillPrice),
          currentPrice: String(fillPrice),
          unrealizedPnl: "0",
          realizedPnl: "0",
        },
      });
    } else {
      const existingSize = parseFiniteDecimal(existing.size);
      const existingAvg = parseFiniteDecimal(existing.avgPrice);
      const existingReal = parseFiniteDecimal(existing.realizedPnl);
      if (
        existingSize === null ||
        existingAvg === null ||
        existingReal === null
      ) {
        throw new Error("Invalid existing paper position numeric value");
      }

      if (intent.side === "BUY") {
        // Add to position — weighted average price
        const newSize = existingSize + fillSize;
        if (newSize <= 0) {
          await this.prisma.paperPosition.delete({
            where: {
              userId_tokenId: {
                userId: intent.userId,
                tokenId: intent.tokenId,
              },
            },
          });
          return 0;
        }
        const newAvg =
          (existingSize * existingAvg + fillSize * fillPrice) / newSize;
        await tx.paperPosition.update({
          where: {
            userId_tokenId: { userId: intent.userId, tokenId: intent.tokenId },
          },
          data: {
            size: String(newSize),
            avgPrice: String(newAvg),
            currentPrice: String(fillPrice),
            unrealizedPnl: String((fillPrice - newAvg) * newSize),
          },
        });
      } else {
        // Reduce / close position
        const closedSize = Math.min(fillSize, existingSize);
        realizedPnl = (fillPrice - existingAvg) * closedSize;
        const newSize = existingSize - closedSize;

        if (newSize <= 0) {
          await tx.paperPosition.delete({
            where: {
              userId_tokenId: {
                userId: intent.userId,
                tokenId: intent.tokenId,
              },
            },
          });
        } else {
          await tx.paperPosition.update({
            where: {
              userId_tokenId: {
                userId: intent.userId,
                tokenId: intent.tokenId,
              },
            },
            data: {
              size: String(newSize),
              currentPrice: String(fillPrice),
              unrealizedPnl: String((fillPrice - existingAvg) * newSize),
              realizedPnl: String(existingReal + realizedPnl),
            },
          });
        }
      }
    }

    return realizedPnl;
  }

  private async withSerializableRetry<T>(
    operation: (tx: PrismaTx) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_SERIALIZABLE_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => operation(tx as PrismaTx),
          SERIALIZABLE_TRANSACTION,
        );
      } catch (err) {
        if (this.isSerializableConflict(err) && attempt < MAX_SERIALIZABLE_RETRIES) {
          continue;
        }
        throw err;
      }
    }

    throw new Error("Serializable transaction retry exhausted");
  }

  private isSerializableConflict(err: unknown): boolean {
    return (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: unknown }).code === "P2034"
    );
  }

  /** Handle P2002 (unique constraint) on intentId as idempotent duplicate success. */
  private isIntentIdDuplicate(err: unknown): boolean {
    if (
      !(typeof err === "object" && err !== null && "code" in err) ||
      (err as { code?: unknown }).code !== "P2002"
    ) {
      return false;
    }
    const meta = (err as { meta?: unknown }).meta;
    if (Array.isArray((meta as { target?: unknown })?.target)) {
      return (meta as { target: string[] }).target.includes("intentId");
    }
    return false;
  }
}
