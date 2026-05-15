import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { SentryModule, SentryGlobalFilter } from "@sentry/nestjs/setup";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { SharedUserDbModule } from "@polyforge/shared-db";
import { RedisModule, RedisService } from "@polyforge/shared-redis";
import { SharedAuthModule } from "@polyforge/shared-auth";
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
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60000, limit: 300 }],
        storage: new ThrottlerStorageRedisService(redis.getClient()),
      }),
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    LoggerModule,
    SharedUserDbModule,
    RedisModule,
    SharedAuthModule,
    VenueDataModule,
    MarketMatchingModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
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
