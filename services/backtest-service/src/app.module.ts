import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { SentryModule, SentryGlobalFilter } from "@sentry/nestjs/setup";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule } from "@polyforge/shared-redis";
import { LoggerModule } from "@polyforge/logger";
import { HealthController } from "./health/health.controller";
import { BacktestModule } from "./backtest/backtest.module";
import { StreamModule } from "./stream/stream.module";

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    LoggerModule,
    SharedDbModule,
    RedisModule,
    BacktestModule,
    StreamModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
