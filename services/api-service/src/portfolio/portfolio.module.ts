import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PortfolioController } from "./portfolio.controller";
import { PortfolioService } from "./portfolio.service";
import { PositionReconcilerService } from "./position-reconciler.service";
import { DrawdownCircuitBreakerService } from "./drawdown-circuit-breaker.service";
import { PolymarketDataApiService } from "./polymarket-data-api.service";
import { EventsModule } from "../gateway/events.module";

@Module({
  imports: [ScheduleModule.forRoot(), EventsModule],
  controllers: [PortfolioController],
  providers: [
    PortfolioService,
    PositionReconcilerService,
    DrawdownCircuitBreakerService,
    PolymarketDataApiService,
  ],
})
export class PortfolioModule {}
