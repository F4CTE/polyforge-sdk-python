import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { ArbPositionStatus, Venue } from "@prisma/client";
import { randomUUID } from "crypto";
import { CrossVenueArbitrageService } from "./cross-venue-arbitrage.service";

const STREAM = "stream:orders";
const MAX_SLIPPAGE_PCT = 5;
const DEFAULT_SLIPPAGE_PCT = 0.5;

export interface ArbExecutionRequest {
  matchId: string;
  size: number;
  maxSlippagePct?: number;
}

export interface ArbExecutionResult {
  arbPositionId: string;
  buyLeg: { venue: string; intentId: string; tokenId: string; price: number };
  sellLeg: { venue: string; intentId: string; tokenId: string; price: number };
  entrySpreadPct: number;
  status: string;
}

@Injectable()
export class ArbExecutionService {
  private readonly logger = new Logger(ArbExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crossVenue: CrossVenueArbitrageService,
  ) {}

  async execute(
    userId: string,
    req: ArbExecutionRequest,
  ): Promise<ArbExecutionResult> {
    const slippage = Math.min(
      req.maxSlippagePct ?? DEFAULT_SLIPPAGE_PCT,
      MAX_SLIPPAGE_PCT,
    );

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        polymarketConnected: true,
        kalshiConnected: true,
      },
    });

    if (!user.polymarketConnected || !user.kalshiConnected) {
      throw new ForbiddenException({
        code: "VENUES_NOT_CONNECTED",
        message:
          "Both Polymarket and Kalshi wallets must be connected for cross-venue arbitrage",
      });
    }

    const match = await this.prisma.marketMatch.findUnique({
      where: { id: req.matchId },
    });
    if (!match) {
      throw new NotFoundException({
        code: "MATCH_NOT_FOUND",
        message: `Market match ${req.matchId} not found`,
      });
    }

    const comparison = await this.crossVenue.getComparison(req.matchId);
    if (!comparison) {
      throw new UnprocessableEntityException({
        code: "COMPARISON_UNAVAILABLE",
        message: "Unable to fetch live price comparison for this match",
      });
    }

    if (comparison.spreadPct < 1) {
      throw new UnprocessableEntityException({
        code: "SPREAD_TOO_LOW",
        message: `Current spread ${comparison.spreadPct}% is below minimum 1% for execution`,
      });
    }

    const polyYes = comparison.polymarket.yesPrice;
    const kalshiYes = comparison.kalshi.yesPrice;

    const buyVenue: Venue =
      polyYes < kalshiYes ? Venue.POLYMARKET : Venue.KALSHI;
    const sellVenue: Venue =
      polyYes < kalshiYes ? Venue.KALSHI : Venue.POLYMARKET;

    const buyMarket =
      buyVenue === Venue.POLYMARKET ? comparison.polymarket : comparison.kalshi;
    const sellMarket =
      buyVenue === Venue.POLYMARKET ? comparison.kalshi : comparison.polymarket;

    const buyPrice = buyMarket.yesPrice;
    const sellPrice = sellMarket.yesPrice;

    const buyTokenId = await this.resolveYesTokenId(buyMarket.marketId);
    const sellTokenId = await this.resolveYesTokenId(sellMarket.marketId);

    if (!buyTokenId || !sellTokenId) {
      throw new UnprocessableEntityException({
        code: "TOKEN_RESOLUTION_FAILED",
        message: "Could not resolve YES token IDs for one or both venues",
      });
    }

    const buySlippagePrice = Math.min(buyPrice * (1 + slippage / 100), 0.999);
    const sellSlippagePrice = Math.max(sellPrice * (1 - slippage / 100), 0.001);

    const arbPosition = await this.prisma.arbPosition.create({
      data: {
        userId,
        matchId: req.matchId,
        status: ArbPositionStatus.PENDING,
        buyVenue,
        buyTokenId,
        buyPrice: buySlippagePrice,
        buySize: req.size,
        sellVenue,
        sellTokenId,
        sellPrice: sellSlippagePrice,
        sellSize: req.size,
        entrySpreadPct: comparison.spreadPct,
      },
    });

    const buyIntentId = randomUUID();
    const sellIntentId = randomUUID();

    const buyIntent = {
      intentId: buyIntentId,
      userId,
      strategyId: "",
      marketId: buyMarket.marketId,
      tokenId: buyTokenId,
      side: "BUY",
      outcome: "YES",
      size: String(req.size),
      price: String(buySlippagePrice),
      orderType: "FOK",
      venue: buyVenue === Venue.POLYMARKET ? "polymarket" : "kalshi",
      arbPositionId: arbPosition.id,
    };

    const sellIntent = {
      intentId: sellIntentId,
      userId,
      strategyId: "",
      marketId: sellMarket.marketId,
      tokenId: sellTokenId,
      side: "SELL",
      outcome: "YES",
      size: String(req.size),
      price: String(sellSlippagePrice),
      orderType: "FOK",
      venue: sellVenue === Venue.POLYMARKET ? "polymarket" : "kalshi",
      arbPositionId: arbPosition.id,
    };

    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.xadd(STREAM, "*", ...this.flattenIntent(buyIntent));
    pipeline.xadd(STREAM, "*", ...this.flattenIntent(sellIntent));
    await pipeline.exec();

    this.logger.log(
      `Arb initiated: ${arbPosition.id} buy@${buyVenue}(${buySlippagePrice}) sell@${sellVenue}(${sellSlippagePrice}) spread=${comparison.spreadPct}%`,
    );

    return {
      arbPositionId: arbPosition.id,
      buyLeg: {
        venue: buyVenue,
        intentId: buyIntentId,
        tokenId: buyTokenId,
        price: buySlippagePrice,
      },
      sellLeg: {
        venue: sellVenue,
        intentId: sellIntentId,
        tokenId: sellTokenId,
        price: sellSlippagePrice,
      },
      entrySpreadPct: comparison.spreadPct,
      status: "PENDING",
    };
  }

  async listPositions(
    userId: string,
    opts: { status?: ArbPositionStatus; limit?: number; offset?: number },
  ) {
    const where: Record<string, unknown> = { userId };
    if (opts.status) where.status = opts.status;

    const [positions, total] = await Promise.all([
      this.prisma.arbPosition.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
      this.prisma.arbPosition.count({ where }),
    ]);

    return { positions, total };
  }

  async getPosition(userId: string, positionId: string) {
    const position = await this.prisma.arbPosition.findFirst({
      where: { id: positionId, userId },
    });
    if (!position) {
      throw new NotFoundException({
        code: "ARB_POSITION_NOT_FOUND",
        message: `Arb position ${positionId} not found`,
      });
    }
    return position;
  }

  async closePosition(userId: string, positionId: string) {
    const position = await this.prisma.arbPosition.findFirst({
      where: { id: positionId, userId },
    });

    if (!position) {
      throw new NotFoundException({
        code: "ARB_POSITION_NOT_FOUND",
        message: `Arb position ${positionId} not found`,
      });
    }

    if (position.status !== ArbPositionStatus.OPEN) {
      throw new UnprocessableEntityException({
        code: "INVALID_STATUS",
        message: `Cannot close position in ${position.status} status`,
      });
    }

    const closeIntentBuy = randomUUID();
    const closeIntentSell = randomUUID();

    const sellBuyLeg = {
      intentId: closeIntentBuy,
      userId,
      strategyId: "",
      marketId: "",
      tokenId: position.buyTokenId,
      side: "SELL",
      outcome: "YES",
      size: String(position.buyFillSize ?? position.buySize),
      price: "0.001",
      orderType: "GTC",
      venue: position.buyVenue === Venue.POLYMARKET ? "polymarket" : "kalshi",
      arbPositionId: positionId,
    };

    const buySellLeg = {
      intentId: closeIntentSell,
      userId,
      strategyId: "",
      marketId: "",
      tokenId: position.sellTokenId,
      side: "BUY",
      outcome: "YES",
      size: String(position.sellFillSize ?? position.sellSize),
      price: "0.999",
      orderType: "GTC",
      venue: position.sellVenue === Venue.POLYMARKET ? "polymarket" : "kalshi",
      arbPositionId: positionId,
    };

    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    pipeline.xadd(STREAM, "*", ...this.flattenIntent(sellBuyLeg));
    pipeline.xadd(STREAM, "*", ...this.flattenIntent(buySellLeg));
    await pipeline.exec();

    await this.prisma.arbPosition.update({
      where: { id: positionId },
      data: { status: ArbPositionStatus.CLOSING },
    });

    return { status: "CLOSING", positionId };
  }

  private async resolveYesTokenId(marketId: string): Promise<string | null> {
    const token = await this.prisma.token.findFirst({
      where: { marketId, outcome: "YES" },
      select: { id: true },
    });
    return token?.id ?? null;
  }

  private flattenIntent(intent: Record<string, unknown>): string[] {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(intent)) {
      if (value !== undefined && value !== null) {
        pairs.push(key, String(value));
      }
    }
    return pairs;
  }
}
