import { Module } from "@nestjs/common";
import { PolymarketBridgeService } from "./bridge.service";

@Module({
  providers: [PolymarketBridgeService],
  exports: [PolymarketBridgeService],
})
export class BridgeModule {}
