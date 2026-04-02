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
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  JwtAuthGuard,
  CurrentUser,
  RequireScopes,
  ApiKeyScopeGuard,
} from "@polyforge/shared-auth";
import { GeoBlockGuard } from "../common/guards/geo.guard";
import { SmartOrderService } from "./smart-order.service";
import { PlaceSmartOrderDto } from "./dto/place-smart-order.dto";

@ApiTags("smart-orders")
@ApiBearerAuth("jwt")
@Controller("orders/smart")
@UseGuards(JwtAuthGuard)
export class SmartOrderController {
  constructor(private readonly smart: SmartOrderService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.smart.list(user.sub);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ApiKeyScopeGuard, GeoBlockGuard)
  @RequireScopes("TRADE")
  create(@CurrentUser() user: any, @Body() dto: PlaceSmartOrderDto) {
    return this.smart.create(user.sub, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: any, @Param("id") id: string) {
    return this.smart.cancel(user.sub, id);
  }
}
