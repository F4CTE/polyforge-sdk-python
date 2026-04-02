import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
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

@Injectable()
export class FillsService {
  private readonly logger = new Logger(FillsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async simulate(intent: OrderIntent): Promise<void> {
    const fillPrice = await this.resolveFillPrice(intent);
    const fillSize = parseFloat(intent.size);

    // 1. Write paper_order record
    const order = await this.prisma.paperOrder.create({
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
      },
    });

    // 2. Upsert paper_position
    const realizedPnl = await this.upsertPosition(intent, fillPrice, fillSize);

    // 3. Update running Redis P&L counter (real-time)
    if (realizedPnl !== 0) {
      await this.redis
        .getClient()
        .incrbyfloat(PAPER_PNL_KEY(intent.userId), realizedPnl);
    }

    // 4. Emit PAPER_ORDER_FILLED to stream:events
    await this.redis.xadd("stream:events", {
      type: "PAPER_ORDER_FILLED",
      orderId: order.id,
      intentId: intent.intentId,
      userId: intent.userId,
      strategyId: intent.strategyId,
      tokenId: intent.tokenId,
      side: intent.side,
      fillSize: String(fillSize),
      simulatedPrice: String(fillPrice),
      ts: String(Date.now()),
    });

    this.logger.log(
      `Paper fill: ${intent.side} ${fillSize} ${intent.tokenId} @ ${fillPrice} for user ${intent.userId}`,
    );
  }

  // ─── Price resolution with best-ask/bid improvement ──────────────────────

  private async resolveFillPrice(intent: OrderIntent): Promise<number> {
    const bookRaw = await this.redis.get(`cache:book:${intent.tokenId}`);
    const intentPrice = parseFloat(intent.price);

    if (!bookRaw) {
      // No book data — fall back to current price cache or intent price
      const priceRaw = await this.redis.get(`cache:price:${intent.tokenId}`);
      if (priceRaw) {
        const priceData = JSON.parse(priceRaw) as PriceData;
        return parseFloat(priceData.price ?? String(intentPrice));
      }
      return intentPrice;
    }

    const book = JSON.parse(bookRaw) as BookData;

    if (intent.side === "BUY") {
      // Buying: if best ask is lower than our limit price, fill at best ask (price improvement)
      const bestAsk = book.asks?.[0]?.price;
      if (bestAsk) {
        const ask = parseFloat(bestAsk);
        return ask < intentPrice ? ask : intentPrice;
      }
    } else {
      // Selling: if best bid is higher than our limit price, fill at best bid (price improvement)
      const bestBid = book.bids?.[0]?.price;
      if (bestBid) {
        const bid = parseFloat(bestBid);
        return bid > intentPrice ? bid : intentPrice;
      }
    }

    return intentPrice;
  }

  // ─── Position accounting ──────────────────────────────────────────────────

  private async upsertPosition(
    intent: OrderIntent,
    fillPrice: number,
    fillSize: number,
  ): Promise<number> {
    const existing = await this.prisma.paperPosition.findUnique({
      where: {
        userId_tokenId: { userId: intent.userId, tokenId: intent.tokenId },
      },
    });

    let realizedPnl = 0;

    if (!existing) {
      if (intent.side === "SELL") return 0; // No position to sell

      await this.prisma.paperPosition.create({
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
      const existingSize = parseFloat(String(existing.size));
      const existingAvg = parseFloat(String(existing.avgPrice));
      const existingReal = parseFloat(String(existing.realizedPnl));

      if (intent.side === "BUY") {
        // Add to position — weighted average price
        const newSize = existingSize + fillSize;
        const newAvg =
          (existingSize * existingAvg + fillSize * fillPrice) / newSize;
        await this.prisma.paperPosition.update({
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
          await this.prisma.paperPosition.delete({
            where: {
              userId_tokenId: {
                userId: intent.userId,
                tokenId: intent.tokenId,
              },
            },
          });
        } else {
          await this.prisma.paperPosition.update({
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
}
