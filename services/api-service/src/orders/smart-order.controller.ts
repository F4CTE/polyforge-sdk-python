import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiHeader } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  JwtAuthGuard,
  CurrentUser,
  RequireScopes,
  ApiKeyScopeGuard,
} from "@polyforge/shared-auth";
import { GeoBlockGuard } from "../common/guards/geo.guard";
import { IdempotencyInterceptor } from "../common/interceptors/idempotency.interceptor";
import { SmartOrderService } from "./smart-order.service";
import { PlaceSmartOrderDto } from "./dto/place-smart-order.dto";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("smart-orders")
@ApiBearerAuth("jwt")
@Controller("orders/smart")
@UseGuards(JwtAuthGuard)
export class SmartOrderController {
  constructor(private readonly smart: SmartOrderService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.smart.list(user.sub);
  }

  @Post()
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 10 : 10000,
      ttl: 60000,
    },
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", minLength: 8, maxLength: 128 },
  })
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @RequireScopes("TRADE")
  create(@CurrentUser() user: JwtPayload, @Body() dto: PlaceSmartOrderDto) {
    return this.smart.create(user.sub, dto);
  }

  @Delete(":id")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 20 : 10000,
      ttl: 60_000,
    },
  })
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.smart.cancel(user.sub, id);
  }
}
