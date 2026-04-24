import { Module } from "@nestjs/common";
import { MarketsController } from "./markets.controller";
import { MarketsService } from "./markets.service";
import { ClobReadService } from "../common/services/clob-read.service";

@Module({
  controllers: [MarketsController],
  providers: [MarketsService, ClobReadService],
})
export class MarketsModule {}
