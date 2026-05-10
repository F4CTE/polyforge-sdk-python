import { Module } from "@nestjs/common";
import { SharedUserDbModule } from "@polyforge/shared-db";
import { SharedAuthModule } from "@polyforge/shared-auth";
import { FeeCalculatorService } from "./fee-calculator.service";
import { FeesController } from "./fees.controller";

@Module({
  imports: [SharedUserDbModule, SharedAuthModule],
  controllers: [FeesController],
  providers: [FeeCalculatorService],
  exports: [FeeCalculatorService],
})
export class FeesModule {}
