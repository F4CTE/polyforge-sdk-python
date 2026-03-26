import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard, CurrentUser, RequireScopes, ApiKeyScopeGuard } from "@polyforge/shared-auth";
import { IsOptional, IsString, IsNotEmpty, IsNumberString, MaxLength } from "class-validator";
import { OrdersService } from "./orders.service";
import { ClosePositionDto } from "./dto/close-position.dto";
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes('TRADE')
  closePosition(@CurrentUser() user: any, @Body() dto: ClosePositionDto) {
    return this.orders.closePosition(user.sub, dto);
  }

  @Post("redeem")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes('TRADE')
  redeemPosition(@CurrentUser() user: any, @Body() dto: RedeemPositionDto) {
    return this.orders.redeemPosition(user.sub, dto);
  }

  /** Split USDC.e into Yes + No outcome tokens */
  @Post("split")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes('TRADE')
  splitPosition(@CurrentUser() user: any, @Body() dto: SplitPositionDto) {
    return this.orders.splitPosition(user.sub, dto);
  }

  /** Merge Yes + No outcome tokens back into USDC.e */
  @Post("merge")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes('TRADE')
  mergePosition(@CurrentUser() user: any, @Body() dto: MergePositionDto) {
    return this.orders.mergePosition(user.sub, dto);
  }
}
