import { Module } from "@nestjs/common";
import { MarketsController } from "./markets.controller";
import { MarketsService } from "./markets.service";
import { ClobReadService } from "../common/services/clob-read.service";
import { ComboMarketsController } from "./combo-markets.controller";
import { KalshiReadService } from "./kalshi-read.service";

@Module({
  controllers: [MarketsController, ComboMarketsController],
  providers: [MarketsService, ClobReadService, KalshiReadService],
})
export class MarketsModule {}
