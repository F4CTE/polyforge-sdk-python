import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiHeader } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  ApiKeyScopeGuard,
  CurrentUser,
  JwtAuthGuard,
  RequireScopes,
} from "@polyforge/shared-auth";
import { IsOptional, IsIn } from "class-validator";
import { PrismaService } from "@polyforge/shared-db";
import {
  Prisma,
  ConditionalOrderType,
  ConditionalOrderStatus,
  OrderSide,
  OrderOutcome,
} from "@prisma/client";
import { PaginationDto, paginate } from "../common/dto/pagination.dto";
import { CreateConditionalOrderDto } from "./dto/create-conditional-order.dto";
import { IdempotencyInterceptor } from "../common/interceptors/idempotency.interceptor";
import { JwtPayload } from "@polyforge/shared-types";

class ConditionalOrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(["PENDING", "TRIGGERED", "CANCELLED", "EXPIRED"])
  status?: string;

  @IsOptional()
  @IsIn(["TAKE_PROFIT", "STOP_LOSS", "TRAILING_STOP", "LIMIT", "PEGGED"])
  type?: string;
}

@ApiTags("orders")
@ApiBearerAuth("jwt")
@Controller("orders/conditional")
@UseGuards(JwtAuthGuard)
export class ConditionalController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", minLength: 8, maxLength: 128 },
  })
  @UseInterceptors(IdempotencyInterceptor)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("TRADE")
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConditionalOrderDto,
  ) {
    // H-01: Enforce per-user cap on pending conditional orders
    const count = await this.prisma.conditionalOrder.count({
      where: { userId: user.sub, status: "PENDING" },
    });
    if (count >= 50) {
      throw new UnprocessableEntityException({
        code: "CONDITIONAL_ORDER_LIMIT",
        message: "Maximum 50 pending conditional orders",
      });
    }

    const order = await this.prisma.conditionalOrder.create({
      data: {
        userId: user.sub,
        marketId: dto.marketId,
        tokenId: dto.tokenId,
        type: dto.type as ConditionalOrderType,
        side: dto.side as OrderSide,
        outcome: dto.outcome as OrderOutcome,
        size: dto.size,
        triggerPrice: dto.triggerPrice,
        limitPrice: dto.limitPrice ?? null,
        trailingPct: dto.trailingPct ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return order;
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ConditionalOrderQueryDto,
  ) {
    const { page, limit, status, type } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ConditionalOrderWhereInput = { userId: user.sub };
    if (status) where.status = { equals: status as ConditionalOrderStatus };
    if (type) where.type = { equals: type as ConditionalOrderType };

    const [orders, total] = await Promise.all([
      this.prisma.conditionalOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.conditionalOrder.count({ where }),
    ]);

    return paginate(orders, total, page, limit);
  }

  @Get(":id")
  async detail(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const order = await this.prisma.conditionalOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Conditional order not found",
      });
    }

    if (order.userId !== user.sub) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Not your order",
      });
    }

    return order;
  }

  @Delete(":id")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 20 : 10000,
      ttl: 60_000,
    },
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("TRADE")
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const order = await this.prisma.conditionalOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Conditional order not found",
      });
    }

    if (order.userId !== user.sub) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Not your order",
      });
    }

    const updated = await this.prisma.conditionalOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return updated;
  }
}
