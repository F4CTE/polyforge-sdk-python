import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VenueRouter } from "./venue-router";
import { PolymarketAdapter } from "./polymarket-adapter";
import { ClobClientModule } from "../clob-client/clob-client.module";
import { ClobClientService } from "../clob-client/clob-client.service";

@Module({
  imports: [ClobClientModule],
  providers: [
    PolymarketAdapter,
    {
      provide: VenueRouter,
      useFactory: (clob: ClobClientService, config: ConfigService) => {
        const polyAdapter = new PolymarketAdapter(clob);
        const adapters = [polyAdapter];

        if (config.get<string>("KALSHI_ENABLED") === "true") {
          // KalshiAdapter will be registered here once Phase 2 is complete.
          // The VenueRouter is designed to accept it without any changes.
        }

        return new VenueRouter(adapters);
      },
      inject: [ClobClientService, ConfigService],
    },
  ],
  exports: [VenueRouter],
})
export class VenueModule {}
