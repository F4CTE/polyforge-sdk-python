import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ArbitrageController } from "./arbitrage.controller";
import { ArbitrageService } from "./arbitrage.service";
import { MarketMatchService } from "./market-match.service";
import { CrossVenueArbitrageService } from "./cross-venue-arbitrage.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ArbitrageController],
  providers: [ArbitrageService, MarketMatchService, CrossVenueArbitrageService],
  exports: [MarketMatchService, CrossVenueArbitrageService],
})
export class ArbitrageModule {}
