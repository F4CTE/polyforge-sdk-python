import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PortfolioController } from "./portfolio.controller";
import { PortfolioService } from "./portfolio.service";
import { PositionReconcilerService } from "./position-reconciler.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PortfolioController],
  providers: [PortfolioService, PositionReconcilerService],
})
export class PortfolioModule {}
