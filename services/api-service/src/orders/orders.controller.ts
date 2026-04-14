import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
type Response = FastifyReply;
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  JwtAuthGuard,
  CurrentUser,
  RequireScopes,
  ApiKeyScopeGuard,
} from "@polyforge/shared-auth";
import {
  IsOptional,
  IsString,
  IsNotEmpty,
  IsNumberString,
  MaxLength,
} from "class-validator";
import { OrdersService } from "./orders.service";
import { ClosePositionDto } from "./dto/close-position.dto";
import { PlaceOrderDto } from "./dto/place-order.dto";
import { RedeemPositionDto } from "./dto/redeem-position.dto";
import { GeoBlockGuard } from "../common/guards/geo.guard";
import { PaginationDto } from "../common/dto/pagination.dto";

class OrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  strategyId?: string;

  @IsOptional()
  @IsString()
  marketId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

class SplitPositionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tokenId!: string;

  @IsNumberString({}, { message: "amount must be a valid positive number" })
  @IsNotEmpty()
  amount!: string;
}

class MergePositionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tokenId!: string;

  @IsNumberString({}, { message: "amount must be a valid positive number" })
  @IsNotEmpty()
  amount!: string;
}

@ApiTags("orders")
@ApiBearerAuth("jwt")
@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: any, @Query() query: OrderQueryDto) {
    return this.orders.list(user.sub, query);
  }

  @Post("close-position")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 30 : 10000,
      ttl: 60000,
    },
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes("TRADE")
  closePosition(@CurrentUser() user: any, @Body() dto: ClosePositionDto) {
    return this.orders.closePosition(user.sub, dto);
  }

  @Post("redeem")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes("TRADE")
  redeemPosition(@CurrentUser() user: any, @Body() dto: RedeemPositionDto) {
    return this.orders.redeemPosition(user.sub, dto);
  }

  /** Split USDC.e into Yes + No outcome tokens */
  @Post("split")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 30 : 10000,
      ttl: 60000,
    },
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes("TRADE")
  splitPosition(@CurrentUser() user: any, @Body() dto: SplitPositionDto) {
    return this.orders.splitPosition(user.sub, dto);
  }

  /** Merge Yes + No outcome tokens back into USDC.e */
  @Post("merge")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 30 : 10000,
      ttl: 60000,
    },
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes("TRADE")
  mergePosition(@CurrentUser() user: any, @Body() dto: MergePositionDto) {
    return this.orders.mergePosition(user.sub, dto);
  }

  @Post("place")
  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 30 : 10000,
      ttl: 60000,
    },
  })
  async placeOrder(
    @Req() req: { user: { sub: string } },
    @Body() dto: PlaceOrderDto,
  ) {
    return this.orders.placeOrder(req.user.sub, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async cancelOrder(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
  ) {
    return this.orders.cancelOrder(req.user.sub, id);
  }

  @Get("export/csv")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("READ")
  async exportCsv(@CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.orders.exportCsv(user.sub);
    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", 'attachment; filename="orders.csv"');
    res.send(csv);
  }
}
