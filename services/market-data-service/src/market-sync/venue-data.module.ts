import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtModule } from "@nestjs/jwt";
import { VenueDataRouter } from "./venue-data-router";
import { PolymarketPriceFeed } from "./polymarket-price-feed";
import { KalshiPriceFeed } from "./kalshi-price-feed";
import { KalshiFeedService } from "./kalshi-feed.service";
import type { VenuePriceFeed } from "./venue-data-router";

@Module({
  imports: [JwtModule.register({})],
  providers: [
    PolymarketPriceFeed,
    KalshiFeedService,
    KalshiPriceFeed,
    {
      provide: VenueDataRouter,
      useFactory: (
        polyFeed: PolymarketPriceFeed,
        kalshiFeed: KalshiPriceFeed,
        emitter: EventEmitter2,
        config: ConfigService,
      ) => {
        const feeds: VenuePriceFeed[] = [polyFeed];

        if (config.get<string>("KALSHI_ENABLED") === "true") {
          feeds.push(kalshiFeed);
        }

        return new VenueDataRouter(feeds, emitter);
      },
      inject: [
        PolymarketPriceFeed,
        KalshiPriceFeed,
        EventEmitter2,
        ConfigService,
      ],
    },
  ],
  exports: [VenueDataRouter, PolymarketPriceFeed, KalshiPriceFeed],
})
export class VenueDataModule {}
