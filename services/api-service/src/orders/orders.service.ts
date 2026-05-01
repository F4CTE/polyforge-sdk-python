import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { BETA_LIMITS } from "../common/beta-limits.config";
import { getMonthlyConfirmedVolume } from "../common/monthly-volume";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { PosthogService } from "@polyforge/shared-posthog";
import { assertCurrentUsRailTermsAccepted } from "../common/us-rail-terms";
import {
  paginate,
  PaginatedResponse,
  PaginationDto,
} from "../common/dto/pagination.dto";
import { ClosePositionDto } from "./dto/close-position.dto";
import { PlaceOrderDto } from "./dto/place-order.dto";
import { RedeemPositionDto } from "./dto/redeem-position.dto";
import { RedeemPositionResponseDto } from "./dto/redeem-position-response.dto";
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
    private readonly posthog: PosthogService,
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

    // Atomic close-once guard: transition UNRESOLVED → RESOLVING.
    // A double-click will see count=0 and get a 409 Conflict.
    const claimed = await this.prisma.position.updateMany({
      where: {
        id: position.id,
        userId,
        resolutionStatus: ResolutionStatus.UNRESOLVED,
      },
      data: { resolutionStatus: ResolutionStatus.RESOLVING },
    });
    if (claimed.count === 0) {
      throw new ConflictException({
        code: "POSITION_ALREADY_CLOSING",
        message: "This position is already being closed",
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
      expiration: "0",
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

  async redeemPosition(
    userId: string,
    dto: RedeemPositionDto,
  ): Promise<RedeemPositionResponseDto> {
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
        issuer: "api-service",
        expiresIn: "30s",
        algorithm: "HS256",
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
        issuer: "api-service",
        expiresIn: "30s",
        algorithm: "HS256",
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

  async placeBatch(
    userId: string,
    dto: { orders: PlaceOrderDto[] },
  ): Promise<{
    results: Array<{ orderId: string; intentId: string; status: string }>;
  }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.polymarketConnected) {
      throw new ForbiddenException({
        code: "WALLET_NOT_CONNECTED",
        message: "Connect your Polymarket wallet first",
      });
    }

    if (dto.orders.length > 15) {
      throw new BadRequestException({
        code: "BATCH_LIMIT_EXCEEDED",
        message: "Maximum 15 orders per batch",
      });
    }

    const totalSize = dto.orders.reduce((sum, o) => sum + Number(o.size), 0);

    const currentMonthlyVolume = await getMonthlyConfirmedVolume(
      this.prisma,
      this.redis,
      userId,
    );
    if (currentMonthlyVolume + totalSize > BETA_LIMITS.maxMonthlyVolumeUsdc) {
      throw new UnprocessableEntityException({
        code: "MONTHLY_VOLUME_EXCEEDED",
        message: `Beta limit: monthly trade volume cap exceeded by batch total.`,
      });
    }

    const results: Array<{
      orderId: string;
      intentId: string;
      status: string;
    }> = [];

    for (const orderDto of dto.orders) {
      const token = await this.prisma.token.findUniqueOrThrow({
        where: { id: orderDto.tokenId },
        include: { market: true },
      });

      const intentId = randomUUID();
      await this.redis.xadd("stream:orders", {
        intentId,
        userId,
        strategyId: "",
        marketId: token.marketId,
        tokenId: orderDto.tokenId,
        side: orderDto.side,
        outcome: orderDto.outcome,
        size: String(orderDto.size),
        price: String(orderDto.price),
        orderType: orderDto.orderType || "GTC",
      });

      const order = await this.prisma.order.create({
        data: {
          intentId,
          userId,
          strategyId: null,
          marketId: token.marketId,
          tokenId: orderDto.tokenId,
          side: orderDto.side as OrderSide,
          outcome: orderDto.outcome,
          size: String(orderDto.size),
          price: String(orderDto.price),
          orderType: (orderDto.orderType || "GTC") as OrderType,
          status: OrderStatus.PENDING,
        },
      });

      results.push({ orderId: order.id, intentId, status: "PENDING" });
    }

    return { results };
  }

  async cancelBulk(
    userId: string,
    dto: { orderIds: string[] },
  ): Promise<{
    cancelled: string[];
    errors: Array<{ orderId: string; reason: string }>;
  }> {
    if (dto.orderIds.length > 3000) {
      throw new BadRequestException({
        code: "BULK_CANCEL_LIMIT_EXCEEDED",
        message: "Maximum 3000 orders per bulk cancel",
      });
    }

    const cancelled: string[] = [];
    const errors: Array<{ orderId: string; reason: string }> = [];

    for (const orderId of dto.orderIds) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
        });

        if (!order) {
          errors.push({ orderId, reason: "NOT_FOUND" });
          continue;
        }
        if (order.userId !== userId) {
          errors.push({ orderId, reason: "FORBIDDEN" });
          continue;
        }
        if (!["PENDING", "SUBMITTED", "LIVE"].includes(order.status)) {
          errors.push({ orderId, reason: `NOT_CANCELLABLE_${order.status}` });
          continue;
        }

        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.CANCELLED },
        });

        if (order.clobOrderId) {
          await this.redis.xadd("stream:cancellations", {
            orderId,
            clobOrderId: order.clobOrderId,
            userId,
          });
        }

        cancelled.push(orderId);
      } catch {
        errors.push({ orderId, reason: "INTERNAL_ERROR" });
      }
    }

    return { cancelled, errors };
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
    if ((user as any).country === "US" && (user as any).polymarketUsConnected) {
      assertCurrentUsRailTermsAccepted(user as any);
    }

    // 2a. Enforce max position size per order
    const orderSize = Number(dto.size);
    if (orderSize > BETA_LIMITS.maxPositionSizeUsdc) {
      throw new UnprocessableEntityException({
        code: "POSITION_SIZE_EXCEEDED",
        message: `Beta limit: maximum position size is $${BETA_LIMITS.maxPositionSizeUsdc} USDC per order.`,
      });
    }

    // 2b. Enforce monthly volume cap (cached in Redis with 60s TTL)
    const currentMonthlyVolume = await getMonthlyConfirmedVolume(
      this.prisma,
      this.redis,
      userId,
    );
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

    this.posthog.capture(userId, "order_placed", {
      orderId: order.id,
      marketId: token.marketId,
      side: dto.side,
      amount: dto.size,
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

  async updateJournal(
    userId: string,
    orderId: string,
    dto: { mood: string; note?: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.userId !== userId) throw new ForbiddenException("Not your order");

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        mood: dto.mood,
        ...(dto.note !== undefined && { note: dto.note }),
      },
    });

    this.posthog.capture(userId, "journal_entry_added", { entryId: orderId });

    return updated;
  }

  async cancelOrder(userId: string, orderId: string) {
    // Atomic status-guarded cancel — only transitions from cancellable states.
    // Prevents race with trade-reconciler moving the order to CONFIRMED/MATCHED.
    const updated = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        userId,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.LIVE],
        },
      },
      data: { status: OrderStatus.CANCELLED },
    });

    if (updated.count === 0) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });
      if (!order) throw new NotFoundException("Order not found");
      if (order.userId !== userId)
        throw new ForbiddenException("Not your order");
      throw new ConflictException({
        code: "ORDER_NOT_CANCELLABLE",
        message: `Order is already in ${order.status} state`,
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (order?.clobOrderId) {
      await this.redis.xadd("stream:cancellations", {
        orderId,
        clobOrderId: order.clobOrderId,
        userId,
      });
    }

    return { orderId, status: "CANCELLED" };
  }
}
