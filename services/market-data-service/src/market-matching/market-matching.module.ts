import { Module } from "@nestjs/common";
import { MarketMatchService } from "./market-match.service";
import { MarketMatchScheduler } from "./market-match.scheduler";
import { MarketMatchController } from "./market-match.controller";
import { ArbitrageService } from "./arbitrage.service";
import { ArbitrageScheduler } from "./arbitrage.scheduler";

@Module({
  controllers: [MarketMatchController],
  providers: [
    MarketMatchService,
    MarketMatchScheduler,
    ArbitrageService,
    ArbitrageScheduler,
  ],
  exports: [MarketMatchService, ArbitrageService],
})
export class MarketMatchingModule {}
