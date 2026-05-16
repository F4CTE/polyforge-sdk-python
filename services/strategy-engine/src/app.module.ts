import { Module } from "@nestjs/common";
import { SentryModule } from "@sentry/nestjs/setup";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "@polyforge/logger";
import { RedisModule, RedisService } from "@polyforge/shared-redis";
import { StrategyModule } from "./strategy/strategy.module";
import { InternalModule } from "./internal/internal.module";
import { HealthController } from "./health/health.controller";
@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60000, limit: 200 }],
        storage: new ThrottlerStorageRedisService(redis.getClient()),
      }),
    }),
    LoggerModule,
    RedisModule,
    StrategyModule,
    InternalModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
