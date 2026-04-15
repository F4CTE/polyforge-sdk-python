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
import { AlertsService } from "./alerts.service";
import { CreateAlertDto } from "./dto/create-alert.dto";
import { JwtPayload } from "@polyforge/shared-types";

@ApiTags("alerts")
@ApiBearerAuth("jwt")
@Controller("alerts")
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.alerts.list(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAlertDto) {
    return this.alerts.create(user.sub, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes("WRITE")
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.alerts.remove(id, user.sub);
  }
}
