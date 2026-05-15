import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { BetaLimitsConfigService } from "@polyforge/shared-redis";
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
  Prisma,
} from "@prisma/client";

export interface OrderQueryDto extends PaginationDto {
  status?: string;
  strategyId?: string;
  marketId?: string;
  from?: string;
  to?: string;
}

type CancelledOrderRow = {
  id: string;
  status: OrderStatus;
  clobOrderId: string | null;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly posthog: PosthogService,
    private readonly betaLimits: BetaLimitsConfigService,
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
    const orderId = randomUUID();
    const size = dto.size ?? String(position.size);

    // Publish close intent to stream:orders
    await this.redis.xadd("stream:orders", {
      intentId,
      orderId,
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

    return { orderId, intentId, status: "PENDING" };
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
    const maxMonthly = await this.betaLimits.getLimit("maxMonthlyVolumeUsdc");
    if (currentMonthlyVolume + totalSize > maxMonthly) {
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

    const requestedTokenIds = [...new Set(dto.orders.map((o) => o.tokenId))];
    const preloadedTokens = await this.prisma.token.findMany({
      where: { id: { in: requestedTokenIds } },
      include: { market: true },
    });
    const preloadedTokenById = new Map(preloadedTokens.map((t) => [t.id, t]));
    const missingTokenIds = requestedTokenIds.filter(
      (id) => !preloadedTokenById.has(id),
    );
    if (missingTokenIds.length > 0) {
      throw new NotFoundException({
        code: "TOKEN_NOT_FOUND",
        message: `Token not found: ${missingTokenIds[0]}`,
      });
    }

    for (const orderDto of dto.orders) {
      const token = preloadedTokenById.get(orderDto.tokenId)!;

      const intentId = randomUUID();
      const orderId = randomUUID();
      await this.redis.xadd("stream:orders", {
        intentId,
        orderId,
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

      results.push({ orderId, intentId, status: "PENDING" });
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

    const requestedOrderIds = [...new Set(dto.orderIds)];
    const cancellableStatuses = [
      OrderStatus.PENDING,
      OrderStatus.SUBMITTED,
      OrderStatus.LIVE,
    ];
    const cancellableStatusSet = new Set<OrderStatus>(cancellableStatuses);

    const preloadedOrders = await this.prisma.order.findMany({
      where: { id: { in: requestedOrderIds } },
      select: { id: true, status: true, clobOrderId: true, userId: true },
    });
    const preloadedById = new Map(
      preloadedOrders.map((order) => [order.id, order]),
    );
    const cancellableOrderIds = preloadedOrders
      .filter(
        (order) =>
          order.userId === userId && cancellableStatusSet.has(order.status),
      )
      .map((order) => order.id);

    const transitionedOrders =
      cancellableOrderIds.length > 0
        ? await this.prisma.$queryRaw<CancelledOrderRow[]>(
            Prisma.sql`
              UPDATE "orders"
              SET "status" = ${OrderStatus.CANCELLED}::"OrderStatus"
              WHERE "id" IN (${Prisma.join(cancellableOrderIds)})
                AND "userId" = ${userId}
                AND "status" IN (${Prisma.join(
                  cancellableStatuses.map(
                    (status) => Prisma.sql`${status}::"OrderStatus"`,
                  ),
                )})
              RETURNING "id", "status", "clobOrderId"
            `,
          )
        : [];
    const transitionedById = new Map(
      transitionedOrders.map((order) => [order.id, order]),
    );

    const skippedCancellableIds = cancellableOrderIds.filter(
      (orderId) => !transitionedById.has(orderId),
    );

    let skippedById = new Map<string, { id: string; status: OrderStatus }>();
    try {
      if (skippedCancellableIds.length > 0) {
        const skippedOrders = await this.prisma.order.findMany({
          where: { id: { in: skippedCancellableIds }, userId },
          select: { id: true, status: true },
        });
        skippedById = new Map(skippedOrders.map((order) => [order.id, order]));
      }
    } catch {
      // skippedById stays empty Map on error; cancellations already persisted
    }

    const errorsById = new Map<string, string>();

    for (const orderId of requestedOrderIds) {
      const order = preloadedById.get(orderId);
      if (!order) {
        errorsById.set(orderId, "NOT_FOUND");
      } else if (order.userId !== userId) {
        errorsById.set(orderId, "FORBIDDEN");
      } else if (!cancellableStatusSet.has(order.status)) {
        errorsById.set(orderId, `NOT_CANCELLABLE_${order.status}`);
      }
    }

    for (const orderId of skippedCancellableIds) {
      const order = skippedById.get(orderId);
      if (order) {
        errorsById.set(orderId, `NOT_CANCELLABLE_${order.status}`);
      } else {
        errorsById.set(orderId, "INTERNAL_ERROR");
      }
    }

    const xaddOrders = transitionedOrders.filter((o) => o.clobOrderId);
    if (xaddOrders.length > 0) {
      const pipeline = this.redis.getClient().pipeline();
      for (const order of xaddOrders) {
        pipeline.xadd(
          "stream:cancellations",
          "*",
          "orderId",
          order.id,
          "clobOrderId",
          order.clobOrderId!,
          "userId",
          userId,
        );
      }
      try {
        const results = await pipeline.exec();
        if (results) {
          for (let i = 0; i < results.length; i++) {
            const [err] = results[i];
            if (err) {
              errorsById.set(xaddOrders[i].id, "INTERNAL_ERROR");
            }
          }
        }
      } catch {
        for (const order of xaddOrders) {
          errorsById.set(order.id, "INTERNAL_ERROR");
        }
      }
    }

    return {
      cancelled: requestedOrderIds.filter(
        (orderId) => transitionedById.has(orderId) && !errorsById.has(orderId),
      ),
      errors: requestedOrderIds
        .filter((orderId) => errorsById.has(orderId))
        .map((orderId) => ({
          orderId,
          reason: errorsById.get(orderId)!,
        })),
    };
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
      assertCurrentUsRailTermsAccepted(user);
    }

    // 2a. Enforce max position size per order
    const orderSize = Number(dto.size);
    const maxPosition = await this.betaLimits.getLimit("maxPositionSizeUsdc");
    if (orderSize > maxPosition) {
      throw new UnprocessableEntityException({
        code: "POSITION_SIZE_EXCEEDED",
        message: `Beta limit: maximum position size is $${maxPosition} USDC per order.`,
      });
    }

    // 2b. Enforce monthly volume cap (cached in Redis with 60s TTL)
    const currentMonthlyVolume = await getMonthlyConfirmedVolume(
      this.prisma,
      this.redis,
      userId,
    );
    const maxMonthly = await this.betaLimits.getLimit("maxMonthlyVolumeUsdc");
    if (currentMonthlyVolume + orderSize > maxMonthly) {
      const remaining = Math.max(0, maxMonthly - currentMonthlyVolume);
      throw new UnprocessableEntityException({
        code: "MONTHLY_VOLUME_EXCEEDED",
        message: `Beta limit: monthly trade volume cap of $${maxMonthly} USDC reached. Remaining this month: $${remaining.toFixed(2)}.`,
      });
    }

    // 3. Find the token and its market
    const token = await this.prisma.token.findUniqueOrThrow({
      where: { id: dto.tokenId },
      include: { market: true },
    });

    // 5. Create intent
    const intentId = randomUUID();
    const orderId = randomUUID();
    const intent = {
      intentId,
      orderId,
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

    this.posthog.capture(userId, "order_placed", {
      orderId,
      marketId: token.marketId,
      side: dto.side,
      amount: dto.size,
    });

    return { orderId, intentId, status: "PENDING" };
  }

  async exportCsv(
    userId: string,
  ): Promise<{ csv: string; truncated: boolean }> {
    const BATCH_SIZE = 1000;
    const MAX_EXPORT_ROWS = 10_000;
    const header =
      "Market ID,Side,Outcome,Size,Price,Type,Status,Fill Price,Date\n";
    const rows: string[] = [];
    let cursor: { createdAt: Date; id: string } | undefined;
    let truncated = false;

    while (true) {
      const batch = await this.prisma.order.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: BATCH_SIZE,
        ...(cursor
          ? { cursor: { createdAt: cursor.createdAt, id: cursor.id }, skip: 1 }
          : {}),
      });

      if (batch.length === 0) break;

      for (const o of batch) {
        if (rows.length >= MAX_EXPORT_ROWS) {
          truncated = true;
          break;
        }
        rows.push(
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
      }

      if (truncated) break;

      const last = batch[batch.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };

      if (batch.length < BATCH_SIZE) break;
    }

    return { csv: header + rows.join("\n"), truncated };
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
