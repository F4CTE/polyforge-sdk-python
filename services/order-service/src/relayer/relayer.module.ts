import { Module } from "@nestjs/common";
import { PolymarketRelayerService } from "./relayer.service";

@Module({
  providers: [PolymarketRelayerService],
  exports: [PolymarketRelayerService],
})
export class RelayerModule {}
