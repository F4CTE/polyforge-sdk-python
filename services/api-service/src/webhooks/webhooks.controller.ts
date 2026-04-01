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
import {
  JwtAuthGuard,
  CurrentUser,
  RequireScopes,
  ApiKeyScopeGuard,
} from "@polyforge/shared-auth";
import { WebhooksService } from "./webhooks.service";
import { CreateWebhookDto } from "./dto/create-webhook.dto";

@ApiTags("webhooks")
@ApiBearerAuth("jwt")
@Controller("webhooks")
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  create(@CurrentUser() user: any, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.webhooks.list(user.sub);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.webhooks.remove(id, user.sub);
  }

  @Post(":id/test")
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  test(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.webhooks.test(id, user.sub);
  }
}
