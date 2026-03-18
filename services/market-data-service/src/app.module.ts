import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule } from "@polyforge/shared-redis";
import { LoggerModule } from "@polyforge/logger";
import { PolymarketWsService } from "./market-sync/polymarket-ws.service";
import { GammaApiService } from "./market-sync/gamma-api.service";
import { PriceCacheService } from "./price-cache/price-cache.service";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    LoggerModule,
    SharedDbModule,
    RedisModule,
  ],
  controllers: [HealthController],
  providers: [PolymarketWsService, GammaApiService, PriceCacheService],
})
export class AppModule {}
