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
import { PriceCacheService } from "./price-cache/price-cache.service";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    LoggerModule,
    SharedDbModule,
    RedisModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PolymarketWsService,
    PolymarketUserWsService,
    GammaApiService,
    PriceCacheService,
  ],
  exports: [PolymarketUserWsService],
})
export class AppModule {}
