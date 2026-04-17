import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { BETA_LIMITS } from "../common/beta-limits.config";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import {
  paginate,
  PaginatedResponse,
  PaginationDto,
} from "../common/dto/pagination.dto";
import { ClosePositionDto } from "./dto/close-position.dto";
import { PlaceOrderDto } from "./dto/place-order.dto";
import { RedeemPositionDto } from "./dto/redeem-position.dto";
import { randomUUID } from "crypto";
import {
  OrderSide,
  OrderType,
  OrderStatus,
  ResolutionStatus,
} from "@prisma/client";

export interface OrderQueryDto extends PaginationDto {
  status?: string;
  strategyId?: string;
  marketId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async list(
    userId: string,
    query: OrderQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const { page, limit, status, strategyId, marketId, from, to } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (status) {
      const statuses = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (strategyId) where.strategyId = strategyId;
    if (marketId) where.marketId = marketId;
    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.gte = new Date(from);
      if (to) createdAt.lte = new Date(to);
      where.createdAt = createdAt;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    // Resolve market titles for display
    const marketIds = [...new Set(orders.map((o) => o.marketId))];
    const markets =
      marketIds.length > 0
        ? await this.prisma.market.findMany({
            where: { id: { in: marketIds } },
            select: { id: true, title: true, category: true },
          })
        : [];
    const marketMap = new Map(markets.map((m) => [m.id, m]));
    const enriched = orders.map((o) => ({
      ...o,
      marketQuestion: marketMap.get(o.marketId)?.title ?? null,
      marketCategory: marketMap.get(o.marketId)?.category ?? null,
    }));

    return paginate(enriched, total, page, limit);
  }

  async closePosition(userId: string, dto: ClosePositionDto): Promise<any> {
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

    // Find open position (unresolved)
    const position = await this.prisma.position.findFirst({
      where: {
        userId,
        tokenId: dto.tokenId,
        resolutionStatus: ResolutionStatus.UNRESOLVED,
      },
    });
    if (!position) {
      throw new NotFoundException({
        code: "POSITION_NOT_FOUND",
        message: "No open position found for this token",
      });
    }

    const intentId = randomUUID();
    const size = dto.size ?? String(position.size);

    // Publish close intent to stream:orders
    await this.redis.xadd("stream:orders", {
      intentId,
      userId,
      strategyId: "",
      marketId: position.marketId,
      tokenId: dto.tokenId,
      side: "SELL",
      outcome: "YES",
      size,
      price: "0.01",
      orderType: "FOK",
      expiration: "",
      ts: String(Date.now()),
    });

    // Create a pending order record
    const order = await this.prisma.order.create({
      data: {
        intentId,
        userId,
        strategyId: null,
        marketId: position.marketId,
        tokenId: dto.tokenId,
        side: OrderSide.SELL,
        outcome: position.outcome,
        size: size,
        price: "0.01",
        orderType: OrderType.FOK,
        status: OrderStatus.PENDING,
      },
    });

    return { orderId: order.id, intentId, status: "PENDING" };
  }

  async redeemPosition(userId: string, dto: RedeemPositionDto): Promise<any> {
    if (!dto.positionId && !dto.marketId) {
      throw new UnprocessableEntityException({
        code: "MISSING_PARAM",
        message: "Either positionId or marketId is required",
      });
    }

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

    // Find the resolved position
    const where: Record<string, string> = { userId };
    if (dto.positionId) where.id = dto.positionId;
    if (dto.marketId) where.marketId = dto.marketId;

    const position = await this.prisma.position.findFirst({ where });
    if (!position) {
      throw new NotFoundException({
        code: "POSITION_NOT_FOUND",
        message: "Position not found",
      });
    }

    if (position.resolutionStatus !== "RESOLVED") {
      throw new UnprocessableEntityException({
        code: "MARKET_NOT_RESOLVED",
        message: "Market has not been resolved yet",
      });
    }

    // Publish redemption intent to stream:redemptions
    const intentId = randomUUID();
    await this.redis.xadd("stream:redemptions", {
      intentId,
      userId,
      tokenId: position.tokenId,
      positionId: position.id,
      ts: String(Date.now()),
    });

    // Update position status to REDEEMED
    await this.prisma.position.update({
      where: { id: position.id },
      data: { resolutionStatus: "REDEEMED" as ResolutionStatus },
    });

    return { positionId: position.id, intentId, status: "REDEEMED" };
  }

  /**
   * Split USDC.e into Yes + No outcome tokens via signer-service.
   */
  async splitPosition(
    userId: string,
    dto: { tokenId: string; amount: string },
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

    const signerUrl =
      this.config.get<string>("SIGNER_SERVICE_URL") ??
      "http://signer-service:3012";

    // SECURITY: Use internal JWT auth for signer-service calls
    const internalToken = this.jwtService.sign(
      { sub: "api-service", jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"),
        audience: "signer-service",
        expiresIn: "30s",
      },
    );
    const res = await fetch(`${signerUrl}/internal/split-position`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${internalToken}`,
      },
      body: JSON.stringify({
        userId,
        tokenId: dto.tokenId,
        amount: dto.amount,
      }),
    });

    if (!res.ok) {
      throw new UnprocessableEntityException({
        code: "SPLIT_FAILED",
        message: `Split position failed: ${res.status}`,
      });
    }

    return res.json();
  }

  /**
   * Merge Yes + No outcome tokens back into USDC.e via signer-service.
   */
  async mergePosition(
    userId: string,
    dto: { tokenId: string; amount: string },
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

    const signerUrl =
      this.config.get<string>("SIGNER_SERVICE_URL") ??
      "http://signer-service:3012";

    const mergeToken = this.jwtService.sign(
      { sub: "api-service", jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"),
        audience: "signer-service",
        expiresIn: "30s",
      },
    );
    const res = await fetch(`${signerUrl}/internal/merge-position`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mergeToken}`,
      },
      body: JSON.stringify({
        userId,
        tokenId: dto.tokenId,
        amount: dto.amount,
      }),
    });

    if (!res.ok) {
      throw new UnprocessableEntityException({
        code: "MERGE_FAILED",
        message: `Merge position failed: ${res.status}`,
      });
    }

    return res.json();
  }

  async placeOrder(userId: string, dto: PlaceOrderDto) {
    // 1. Find user and verify polymarketConnected
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.polymarketConnected) {
      throw new ForbiddenException({
        code: "WALLET_NOT_CONNECTED",
        message: "Connect your Polymarket wallet first",
      });
    }

    // 2a. Enforce max position size per order
    const orderSize = Number(dto.size);
    if (orderSize > BETA_LIMITS.maxPositionSizeUsdc) {
      throw new UnprocessableEntityException({
        code: "POSITION_SIZE_EXCEEDED",
        message: `Beta limit: maximum position size is $${BETA_LIMITS.maxPositionSizeUsdc} USDC per order.`,
      });
    }

    // 2b. Enforce monthly volume cap
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyVolumeAgg = await this.prisma.order.aggregate({
      where: {
        userId,
        status: OrderStatus.CONFIRMED,
        createdAt: { gte: monthStart },
      },
      _sum: { size: true },
    });
    const currentMonthlyVolume = Number(monthlyVolumeAgg._sum.size ?? 0);
    if (currentMonthlyVolume + orderSize > BETA_LIMITS.maxMonthlyVolumeUsdc) {
      const remaining = Math.max(
        0,
        BETA_LIMITS.maxMonthlyVolumeUsdc - currentMonthlyVolume,
      );
      throw new UnprocessableEntityException({
        code: "MONTHLY_VOLUME_EXCEEDED",
        message: `Beta limit: monthly trade volume cap of $${BETA_LIMITS.maxMonthlyVolumeUsdc} USDC reached. Remaining this month: $${remaining.toFixed(2)}.`,
      });
    }

    // 3. Find the token and its market
    const token = await this.prisma.token.findUniqueOrThrow({
      where: { id: dto.tokenId },
      include: { market: true },
    });

    // 5. Create intent
    const intentId = randomUUID();
    const intent = {
      intentId,
      userId,
      strategyId: "",
      marketId: token.marketId,
      tokenId: dto.tokenId,
      side: dto.side,
      outcome: dto.outcome,
      size: String(dto.size),
      price: String(dto.price),
      orderType: dto.orderType || "GTC",
    };

    // 6. Publish to Redis stream
    await this.redis.xadd("stream:orders", intent);

    // 7. Create order record
    const order = await this.prisma.order.create({
      data: {
        intentId,
        userId,
        strategyId: null,
        marketId: token.marketId,
        tokenId: dto.tokenId,
        side: dto.side as OrderSide,
        outcome: dto.outcome,
        size: String(dto.size),
        price: String(dto.price),
        orderType: (dto.orderType || "GTC") as OrderType,
        status: OrderStatus.PENDING,
      },
    });

    return { orderId: order.id, intentId, status: "PENDING" };
  }

  async exportCsv(userId: string): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const header =
      "Market ID,Side,Outcome,Size,Price,Type,Status,Fill Price,Date\n";
    const rows = orders.map((o) =>
      [
        `"${o.marketId}"`,
        o.side,
        o.outcome ?? "",
        o.size != null ? String(o.size) : "",
        o.price != null ? String(o.price) : "",
        o.orderType,
        o.status,
        o.fillPrice != null ? String(o.fillPrice) : "",
        o.createdAt.toISOString(),
      ].join(","),
    );
    return header + rows.join("\n");
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });

    if (order.userId !== userId) {
      throw new ForbiddenException("Not your order");
    }

    if (!["PENDING", "SUBMITTED", "LIVE"].includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel order in ${order.status} status`,
      );
    }

    // Update status to CANCELLED
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

    // If order has a CLOB ID, publish cancel to stream
    if (order.clobOrderId) {
      await this.redis.xadd("stream:cancellations", {
        orderId,
        clobOrderId: order.clobOrderId,
        userId,
      });
    }

    return { orderId, status: "CANCELLED" };
  }
}
