import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VenueRouter, type RailMode } from "./venue-router";
import { PolymarketAdapter } from "./polymarket-adapter";
import { PolymarketUsAdapter } from "./polymarket-us-adapter";
import { ClobClientModule } from "../clob-client/clob-client.module";
import { ClobClientService } from "../clob-client/clob-client.service";
import { KalshiClientModule } from "../kalshi-client/kalshi-client.module";
import { KalshiAdapterService } from "../kalshi-client/kalshi-adapter.service";
import { PolymarketUsClientModule } from "../polymarket-us-client/polymarket-us-client.module";
import { PolymarketUsClientService } from "../polymarket-us-client/polymarket-us-client.service";
import type { VenueAdapter } from "@polyforge/shared-types";
import { getVenueConfig } from "@polyforge/shared-types";

@Module({
  imports: [ClobClientModule, KalshiClientModule, PolymarketUsClientModule],
  providers: [
    PolymarketAdapter,
    PolymarketUsAdapter,
    {
      provide: VenueRouter,
      useFactory: (
        clob: ClobClientService,
        config: ConfigService,
        kalshi: KalshiAdapterService,
        polyUs: PolymarketUsClientService,
      ) => {
        const adapters: VenueAdapter[] = [];

        const polyConfig = getVenueConfig("polymarket");
        if (!polyConfig || polyConfig.enabled) {
          adapters.push(new PolymarketAdapter(clob));
        }

        const kalshiConfig = getVenueConfig("kalshi");
        const kalshiEnabled =
          config.get<string>("KALSHI_ENABLED") === "true" ||
          kalshiConfig?.enabled === true;
        if (kalshiEnabled) {
          adapters.push(kalshi);
        }

        const polyUsEnabled =
          config.get<string>("POLYMARKET_US_ENABLED") === "true";
        if (polyUsEnabled) {
          adapters.push(new PolymarketUsAdapter(polyUs));
        }

        const rawRail = config.get<string>("POLYMARKET_RAIL") ?? "auto";
        const railMode: RailMode =
          rawRail === "global" || rawRail === "us" ? rawRail : "auto";

        return new VenueRouter(adapters, railMode);
      },
      inject: [
        ClobClientService,
        ConfigService,
        KalshiAdapterService,
        PolymarketUsClientService,
      ],
    },
  ],
  exports: [VenueRouter],
})
export class VenueModule {}
