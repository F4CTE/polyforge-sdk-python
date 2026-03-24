import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { BacktestsService } from "./backtests.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";

@UseGuards(AdminJwtGuard)
@Controller("backtests")
export class BacktestsController {
  constructor(private readonly backtests: BacktestsService) {}

  @Get()
  findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("userId") userId?: string,
    @Query("status") status?: string,
  ) {
    return this.backtests.findAll({ page, limit, userId, status });
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  cancel(@Param("id", ParseUUIDPipe) id: string) {
    return this.backtests.cancel(id);
  }
}
