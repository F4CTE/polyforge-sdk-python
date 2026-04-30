import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags, ApiBearerAuth, ApiHeader } from "@nestjs/swagger";
import {
  JwtAuthGuard,
  ApiKeyScopeGuard,
  RequireScopes,
  CurrentUser,
} from "@polyforge/shared-auth";
import { LpService } from "./lp.service";
import { ProvideLiquidityDto } from "./dto/provide-liquidity.dto";
import { IdempotencyInterceptor } from "../common/interceptors/idempotency.interceptor";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("lp")
@ApiBearerAuth("jwt")
@Controller("lp")
@UseGuards(JwtAuthGuard)
export class LpController {
  constructor(private readonly lp: LpService) {}

  @Post("provide")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 10 : 10000,
      ttl: 60000,
    },
  })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", minLength: 8, maxLength: 128 },
  })
  @UseGuards(ApiKeyScopeGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @RequireScopes("TRADE")
  provideLiquidity(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ProvideLiquidityDto,
  ) {
    return this.lp.provideLiquidity(user.sub, dto);
  }
}
