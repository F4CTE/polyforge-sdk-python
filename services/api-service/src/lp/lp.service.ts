import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { randomUUID } from "crypto";
import { ProvideLiquidityDto } from "./dto/provide-liquidity.dto";

@Injectable()
export class LpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async provideLiquidity(
    userId: string,
    dto: ProvideLiquidityDto,
  ): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { polymarketConnected: true },
    });
    if (!user?.polymarketConnected) {
      throw new UnprocessableEntityException({
        code: "NOT_CONNECTED",
        message: "Polymarket credentials required",
      });
    }

    const market = await this.prisma.market.findUnique({
      where: { id: dto.marketId },
      include: { tokens: { select: { id: true, outcome: true, price: true } } },
    });
    if (!market)
      throw new NotFoundException({
        code: "MARKET_NOT_FOUND",
        message: "Market not found",
      });

    const yesToken = market.tokens.find(
      (t) => t.outcome?.toUpperCase() === "YES",
    );
    if (!yesToken) {
      throw new UnprocessableEntityException({
        code: "NO_YES_TOKEN",
        message: "No YES token found for this market",
      });
    }

    const spread = dto.targetSpread ?? 0.02;
    const yesPrice = parseFloat(String(yesToken.price ?? 0.5));
    const buyPrice = parseFloat(
      Math.max(0.01, yesPrice - spread / 2).toFixed(4),
    );
    const sellPrice = parseFloat(
      Math.min(0.99, yesPrice + spread / 2).toFixed(4),
    );
    const halfAmount = dto.amountUsdc / 2;

    // Place YES bid (buy YES at below-market price)
    const buyIntentId = randomUUID();
    const buyOrderId = randomUUID();
    const buySize = String(Math.max(1, Math.floor(halfAmount / buyPrice)));
    try {
      await this.redis.xadd("stream:orders", {
        intentId: buyIntentId,
        orderId: buyOrderId,
        userId,
        strategyId: "",
        marketId: dto.marketId,
        tokenId: yesToken.id,
        side: "BUY",
        outcome: "YES",
        size: buySize,
        price: String(buyPrice),
        orderType: "GTC",
        ts: String(Date.now()),
      });
    } catch {
      throw new UnprocessableEntityException({
        code: "LIQUIDITY_PUBLISH_FAILED",
        message: "Failed to publish buy order to order stream",
      });
    }

    // Place YES ask (sell YES at above-market price)
    const sellIntentId = randomUUID();
    const sellOrderId = randomUUID();
    const noToken = market.tokens.find(
      (t) => t.outcome?.toUpperCase() === "NO",
    );
    const sellTokenId = noToken?.id ?? yesToken.id;
    const sellSize = String(
      Math.max(1, Math.floor(halfAmount / (1 - sellPrice))),
    );
    try {
      await this.redis.xadd("stream:orders", {
        intentId: sellIntentId,
        orderId: sellOrderId,
        userId,
        strategyId: "",
        marketId: dto.marketId,
        tokenId: sellTokenId,
        side: "SELL",
        outcome: "YES",
        size: sellSize,
        price: String(sellPrice),
        orderType: "GTC",
        ts: String(Date.now()),
      });
    } catch {
      throw new UnprocessableEntityException({
        code: "LIQUIDITY_PUBLISH_FAILED",
        message: "Failed to publish sell order to order stream",
      });
    }

    return {
      id: randomUUID(),
      marketId: dto.marketId,
      amountDeployed: dto.amountUsdc,
      targetSpread: spread,
      currentPrice: yesPrice,
      buyQuote: buyPrice,
      sellQuote: sellPrice,
      buyOrderId,
      sellOrderId,
      status: "PENDING",
    };
  }
}
