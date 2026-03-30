import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { PlaceSmartOrderDto, SmartOrderTypeDto } from "./dto/place-smart-order.dto";

const STREAM_ORDERS = "stream:orders";

@Injectable()
export class SmartOrderService {
  private readonly logger = new Logger(SmartOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: PlaceSmartOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { polymarketConnected: true },
    });
    if (!user?.polymarketConnected) {
      throw new UnprocessableEntityException({
        code: "NOT_CONNECTED",
        message: "Connect your Polymarket wallet first",
      });
    }

    const token = await this.prisma.token.findUnique({
      where: { id: dto.tokenId },
      select: { marketId: true },
    });
    if (!token) {
      throw new NotFoundException({ code: "TOKEN_NOT_FOUND", message: "Token not found" });
    }

    const config = this.buildConfig(dto);
    const slicesTotal = dto.type === "TWAP" || dto.type === "DCA"
      ? (dto.slices ?? 1)
      : dto.type === "BRACKET"
      ? 3 // entry + TP + SL
      : 2; // OCO: leg A + leg B

    const nextExecuteAt = new Date(); // start immediately for TWAP/DCA first slice

    const smart = await this.prisma.smartOrder.create({
      data: {
        userId,
        type: dto.type as any,
        status: "PENDING" as any,
        marketId: token.marketId,
        tokenId: dto.tokenId,
        outcome: dto.outcome as any,
        side: dto.side as any,
        totalSize: dto.totalSize,
        config: config as Prisma.InputJsonValue,
        slicesTotal,
        nextExecuteAt,
      },
    });

    // For BRACKET and OCO, publish all legs immediately
    if (dto.type === "BRACKET") {
      await this.executeBracket(smart.id, userId, token.marketId, dto);
    } else if (dto.type === "OCO") {
      await this.executeOco(smart.id, userId, token.marketId, dto);
    }
    // TWAP/DCA: first slice runs on next @Interval tick

    return { smartOrderId: smart.id, type: dto.type, status: "PENDING", slicesTotal };
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancel(userId: string, smartOrderId: string) {
    const smart = await this.prisma.smartOrder.findFirst({
      where: { id: smartOrderId, userId },
    });
    if (!smart) throw new NotFoundException({ code: "NOT_FOUND", message: "Smart order not found" });
    if (!["PENDING", "ACTIVE"].includes(smart.status)) {
      throw new UnprocessableEntityException({ code: "NOT_CANCELLABLE", message: "Cannot cancel a completed or failed order" });
    }

    // Cancel any child orders that are still pending
    const pendingChildren = await this.prisma.order.findMany({
      where: { smartOrderId, status: { in: ["PENDING" as any, "SUBMITTED" as any] } },
    });
    for (const child of pendingChildren) {
      await this.redis.xadd("stream:cancellations", {
        intentId: child.intentId,
        userId,
        reason: "SMART_ORDER_CANCELLED",
      });
    }

    await this.prisma.smartOrder.update({
      where: { id: smartOrderId },
      data: { status: "CANCELLED" as any, completedAt: new Date() },
    });
    return { cancelled: true };
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async list(userId: string) {
    return this.prisma.smartOrder.findMany({
      where: { userId },
      include: {
        orders: {
          select: { id: true, status: true, fillSize: true, fillPrice: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  // ── Scheduler: execute TWAP/DCA slices ───────────────────────────────────

  @Interval(30_000) // check every 30s
  async executeSlices(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.smartOrder.findMany({
      where: {
        status: { in: ["PENDING" as any, "ACTIVE" as any] },
        type: { in: ["TWAP" as any, "DCA" as any] },
        nextExecuteAt: { lte: now },
      },
      take: 50,
    });

    await Promise.allSettled(
      due.map((so) =>
        this.executeNextSlice(so).catch((err: unknown) =>
          this.logger.warn(`Slice execution failed for ${so.id}: ${(err as Error).message}`),
        ),
      ),
    );
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private async executeNextSlice(smart: {
    id: string;
    userId: string;
    marketId: string;
    tokenId: string;
    outcome: any;
    side: any;
    totalSize: any;
    config: any;
    slicesFilled: number;
    slicesTotal: number;
  }) {
    const config = smart.config as Record<string, unknown>;
    const intervalMs = parseInt(String(config.intervalMinutes ?? 1)) * 60_000;
    const sliceSize = parseFloat(String(smart.totalSize)) / smart.slicesTotal;
    const limitPrice = config.limitPrice ? parseFloat(String(config.limitPrice)) : 0;

    const intentId = randomUUID();
    const intent: Record<string, string> = {
      intentId,
      userId: smart.userId,
      strategyId: "",
      marketId: smart.marketId,
      tokenId: smart.tokenId,
      side: smart.side,
      outcome: smart.outcome,
      size: sliceSize.toFixed(6),
      price: limitPrice > 0 ? limitPrice.toFixed(6) : "0",
      orderType: limitPrice > 0 ? "GTC" : "FOK",
    };

    await this.redis.xadd(STREAM_ORDERS, intent);
    await this.prisma.order.create({
      data: {
        intentId,
        userId: smart.userId,
        smartOrderId: smart.id,
        marketId: smart.marketId,
        tokenId: smart.tokenId,
        side: smart.side,
        outcome: smart.outcome,
        size: sliceSize.toFixed(6),
        price: limitPrice > 0 ? limitPrice.toFixed(6) : "0",
        orderType: (limitPrice > 0 ? "GTC" : "FOK") as any,
        status: "PENDING" as any,
      },
    });

    const nextFilled = smart.slicesFilled + 1;
    const done = nextFilled >= smart.slicesTotal;

    await this.prisma.smartOrder.update({
      where: { id: smart.id },
      data: {
        status: done ? ("COMPLETED" as any) : ("ACTIVE" as any),
        slicesFilled: nextFilled,
        nextExecuteAt: done ? null : new Date(Date.now() + intervalMs),
        completedAt: done ? new Date() : null,
      },
    });
  }

  private async executeBracket(
    smartOrderId: string,
    userId: string,
    marketId: string,
    dto: PlaceSmartOrderDto,
  ) {
    const legs: Array<{ side: string; price: number; label: string }> = [
      { side: dto.side, price: dto.entryPrice!, label: "ENTRY" },
      // Opposite side for TP/SL (selling after buying)
      { side: dto.side === "BUY" ? "SELL" : "BUY", price: dto.takeProfitPrice!, label: "TAKE_PROFIT" },
      { side: dto.side === "BUY" ? "SELL" : "BUY", price: dto.stopLossPrice!, label: "STOP_LOSS" },
    ];

    for (const leg of legs) {
      const intentId = randomUUID();
      await this.redis.xadd(STREAM_ORDERS, {
        intentId,
        userId,
        strategyId: "",
        marketId,
        tokenId: dto.tokenId,
        side: leg.side,
        outcome: dto.outcome,
        size: String(dto.totalSize),
        price: leg.price.toFixed(6),
        orderType: leg.label === "ENTRY" ? "GTC" : "GTC",
        bracketLeg: leg.label,
      });
      await this.prisma.order.create({
        data: {
          intentId,
          userId,
          smartOrderId,
          marketId,
          tokenId: dto.tokenId,
          side: leg.side as any,
          outcome: dto.outcome as any,
          size: String(dto.totalSize),
          price: leg.price.toFixed(6),
          orderType: "GTC" as any,
          status: "PENDING" as any,
        },
      });
    }

    await this.prisma.smartOrder.update({
      where: { id: smartOrderId },
      data: { status: "ACTIVE" as any, slicesFilled: 0 },
    });
  }

  private async executeOco(
    smartOrderId: string,
    userId: string,
    marketId: string,
    dto: PlaceSmartOrderDto,
  ) {
    for (const [price, leg] of [[dto.priceA!, "LEG_A"], [dto.priceB!, "LEG_B"]] as const) {
      const intentId = randomUUID();
      await this.redis.xadd(STREAM_ORDERS, {
        intentId,
        userId,
        strategyId: "",
        marketId,
        tokenId: dto.tokenId,
        side: dto.side,
        outcome: dto.outcome,
        size: String(dto.totalSize),
        price: price.toFixed(6),
        orderType: "GTC",
        ocoLeg: leg,
        smartOrderId,
      });
      await this.prisma.order.create({
        data: {
          intentId,
          userId,
          smartOrderId,
          marketId,
          tokenId: dto.tokenId,
          side: dto.side as any,
          outcome: dto.outcome as any,
          size: String(dto.totalSize),
          price: price.toFixed(6),
          orderType: "GTC" as any,
          status: "PENDING" as any,
        },
      });
    }

    await this.prisma.smartOrder.update({
      where: { id: smartOrderId },
      data: { status: "ACTIVE" as any },
    });
  }

  private buildConfig(dto: PlaceSmartOrderDto): Record<string, unknown> {
    switch (dto.type) {
      case SmartOrderTypeDto.TWAP:
      case SmartOrderTypeDto.DCA:
        return {
          slices: dto.slices,
          intervalMinutes: dto.intervalMinutes,
          limitPrice: dto.limitPrice ?? null,
        };
      case SmartOrderTypeDto.BRACKET:
        return {
          entryPrice: dto.entryPrice,
          takeProfitPrice: dto.takeProfitPrice,
          stopLossPrice: dto.stopLossPrice,
        };
      case SmartOrderTypeDto.OCO:
        return {
          priceA: dto.priceA,
          priceB: dto.priceB,
        };
    }
  }
}
