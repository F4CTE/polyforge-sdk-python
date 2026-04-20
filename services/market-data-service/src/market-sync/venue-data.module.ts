import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { VenueDataRouter } from "./venue-data-router";
import { PolymarketPriceFeed } from "./polymarket-price-feed";

@Module({
  providers: [
    PolymarketPriceFeed,
    {
      provide: VenueDataRouter,
      useFactory: (
        polyFeed: PolymarketPriceFeed,
        emitter: EventEmitter2,
        config: ConfigService,
      ) => {
        const feeds = [polyFeed];

        if (config.get<string>("KALSHI_ENABLED") === "true") {
          // KalshiPriceFeed will be registered here once Phase 2 is complete.
        }

        return new VenueDataRouter(feeds, emitter);
      },
      inject: [PolymarketPriceFeed, EventEmitter2, ConfigService],
    },
  ],
  exports: [VenueDataRouter, PolymarketPriceFeed],
})
export class VenueDataModule {}
