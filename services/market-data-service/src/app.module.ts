import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule } from "@polyforge/shared-redis";
import { LoggerModule } from "@polyforge/logger";
import { PolymarketWsService } from "./market-sync/polymarket-ws.service";
import { PolymarketUserWsService } from "./market-sync/polymarket-user-ws.service";
import { GammaApiService } from "./market-sync/gamma-api.service";
import { PriceCacheService } from "./price-cache/price-cache.service";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    LoggerModule,
    SharedDbModule,
    RedisModule,
  ],
  controllers: [HealthController],
  providers: [
    PolymarketWsService,
    PolymarketUserWsService,
    GammaApiService,
    PriceCacheService,
  ],
  exports: [PolymarketUserWsService],
})
export class AppModule {}
