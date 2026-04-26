import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  JwtAuthGuard,
  CurrentUser,
  RequireScopes,
  ApiKeyScopeGuard,
} from "@polyforge/shared-auth";
import { WebhooksService } from "./webhooks.service";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("webhooks")
@ApiBearerAuth("jwt")
@Controller("webhooks")
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WEBHOOK")
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.webhooks.list(user.sub);
  }

  @Delete(":id")
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === "production" ? 20 : 10000,
      ttl: 60_000,
    },
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WEBHOOK")
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.webhooks.remove(id, user.sub);
  }

  @Post(":id/test")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WEBHOOK")
  test(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.webhooks.test(id, user.sub);
  }
}
