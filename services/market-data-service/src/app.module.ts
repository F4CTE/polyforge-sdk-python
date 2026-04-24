import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule } from "@polyforge/shared-redis";
import { LoggerModule } from "@polyforge/logger";
import { PolymarketWsService } from "./market-sync/polymarket-ws.service";
import { PolymarketUserWsService } from "./market-sync/polymarket-user-ws.service";
import { GammaApiService } from "./market-sync/gamma-api.service";
import { PolymarketSportsWsService } from "./market-sync/polymarket-sports-ws.service";
import { PolymarketRtdsWsService } from "./market-sync/polymarket-rtds-ws.service";
import { PriceCacheService } from "./price-cache/price-cache.service";
import { VenueDataModule } from "./market-sync/venue-data.module";
import { MarketMatchingModule } from "./market-matching/market-matching.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    LoggerModule,
    SharedDbModule,
    RedisModule,
    VenueDataModule,
    MarketMatchingModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PolymarketWsService,
    PolymarketUserWsService,
    PolymarketSportsWsService,
    PolymarketRtdsWsService,
    GammaApiService,
    PriceCacheService,
  ],
  exports: [PolymarketUserWsService],
})
export class AppModule {}
