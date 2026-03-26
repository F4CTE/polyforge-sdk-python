import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
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
import { RedeemPositionDto } from "./dto/redeem-position.dto";
import { randomUUID } from "crypto";

export interface OrderQueryDto extends PaginationDto {
  status?: string;
  strategyId?: string;
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
    const { page, limit, status, strategyId, from, to } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) where.status = status;
    if (strategyId) where.strategyId = strategyId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
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

    return paginate(orders, total, page, limit);
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
        resolutionStatus: "UNRESOLVED" as any,
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
        side: "SELL" as any,
        outcome: position.outcome,
        size: size,
        price: "0.01",
        orderType: "FOK" as any,
        status: "PENDING" as any,
      },
    });

    return { orderId: order.id, intentId, status: "PENDING" };
  }

  async redeemPosition(
    userId: string,
    dto: RedeemPositionDto,
  ): Promise<any> {
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
    const where: any = { userId };
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
      data: { resolutionStatus: "REDEEMED" as any },
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
      this.config.get<string>("SIGNER_SERVICE_URL") ?? "http://signer-service:3012";

    // SECURITY: Use internal JWT auth for signer-service calls
    const internalToken = this.jwtService.sign(
      { sub: "api-service", jti: require("crypto").randomUUID() },
      { secret: this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"), audience: "signer-service", expiresIn: "30s" },
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
      this.config.get<string>("SIGNER_SERVICE_URL") ?? "http://signer-service:3012";

    const mergeToken = this.jwtService.sign(
      { sub: "api-service", jti: require("crypto").randomUUID() },
      { secret: this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"), audience: "signer-service", expiresIn: "30s" },
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
}
