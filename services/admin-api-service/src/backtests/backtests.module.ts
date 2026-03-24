import { Module } from "@nestjs/common";
import { RedisModule } from "@polyforge/shared-redis";
import { BacktestsService } from "./backtests.service";
import { BacktestsController } from "./backtests.controller";

@Module({
  imports: [RedisModule],
  providers: [BacktestsService],
  controllers: [BacktestsController],
})
export class BacktestsModule {}
