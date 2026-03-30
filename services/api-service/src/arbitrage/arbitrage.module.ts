import { Module } from "@nestjs/common";
import { ArbitrageController } from "./arbitrage.controller";
import { ArbitrageService } from "./arbitrage.service";

@Module({
  controllers: [ArbitrageController],
  providers: [ArbitrageService],
})
export class ArbitrageModule {}
