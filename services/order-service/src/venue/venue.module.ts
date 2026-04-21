import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VenueRouter } from "./venue-router";
import { PolymarketAdapter } from "./polymarket-adapter";
import { ClobClientModule } from "../clob-client/clob-client.module";
import { ClobClientService } from "../clob-client/clob-client.service";
import { KalshiClientModule } from "../kalshi-client/kalshi-client.module";
import { KalshiAdapterService } from "../kalshi-client/kalshi-adapter.service";
import type { VenueAdapter } from "@polyforge/shared-types";

@Module({
  imports: [ClobClientModule, KalshiClientModule],
  providers: [
    PolymarketAdapter,
    {
      provide: VenueRouter,
      useFactory: (
        clob: ClobClientService,
        config: ConfigService,
        kalshi: KalshiAdapterService,
      ) => {
        const adapters: VenueAdapter[] = [new PolymarketAdapter(clob)];

        if (config.get<string>("KALSHI_ENABLED") === "true") {
          adapters.push(kalshi);
        }

        return new VenueRouter(adapters);
      },
      inject: [ClobClientService, ConfigService, KalshiAdapterService],
    },
  ],
  exports: [VenueRouter],
})
export class VenueModule {}
