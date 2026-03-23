import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { IsOptional, IsString } from "class-validator";
import { PrismaService } from "@polyforge/shared-db";
import { PaginationDto, paginate } from "../common/dto/pagination.dto";
import { CreateConditionalOrderDto } from "./dto/create-conditional-order.dto";

class ConditionalOrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
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
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateConditionalOrderDto,
  ) {
    const order = await this.prisma.conditionalOrder.create({
      data: {
        userId: user.sub,
        marketId: dto.marketId,
        tokenId: dto.tokenId,
        type: dto.type as any,
        side: dto.side as any,
        outcome: dto.outcome as any,
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
    @CurrentUser() user: any,
    @Query() query: ConditionalOrderQueryDto,
  ) {
    const { page, limit, status, type } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId: user.sub };
    if (status) where.status = status;
    if (type) where.type = type;

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
  async detail(@CurrentUser() user: any, @Param("id") id: string) {
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
  @HttpCode(HttpStatus.OK)
  async cancel(@CurrentUser() user: any, @Param("id") id: string) {
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
