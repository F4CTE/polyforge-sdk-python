import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { LogsService } from "./logs.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";

@UseGuards(AdminJwtGuard)
@Controller("logs")
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get("audit")
  getAuditLogs(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("adminId") adminId?: string,
    @Query("action") action?: string,
    @Query("targetType") targetType?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.logs.getAuditLogs({
      page,
      limit,
      adminId,
      action,
      targetType,
      from,
      to,
    });
  }

  @Get("events")
  getEventLogs(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("userId") userId?: string,
    @Query("eventType") eventType?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.logs.getEventLogs({ page, limit, userId, eventType, from, to });
  }

  @Get("logins")
  getLoginHistory(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.logs.getLoginHistory({ page, limit, userId, from, to });
  }

  @Get("notifications")
  getNotificationHistory(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("userId") userId?: string,
    @Query("channel") channel?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.logs.getNotificationHistory({
      page,
      limit,
      userId,
      channel,
      from,
      to,
    });
  }
}
