import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { JwtPayload } from "@polyforge/shared-types";
import { NotificationsService } from "./notifications.service";
import { PaginationDto } from "../common/dto/pagination.dto";

@ApiTags("notifications")
@ApiBearerAuth("jwt")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.notifications.list(user.sub, query.page, query.limit);
  }
}
