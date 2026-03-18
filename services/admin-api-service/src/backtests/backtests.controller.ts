import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
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
}
