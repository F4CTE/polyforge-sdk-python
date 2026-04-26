import { Module } from "@nestjs/common";
import { SentryModule } from "@sentry/nestjs/setup";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule, RedisService } from "@polyforge/shared-redis";
import { LoggerModule } from "@polyforge/logger";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./common/health.controller";

@Module({
  imports: [
    SentryModule.forRoot(),
    LoggerModule,
    SharedDbModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 900000, limit: 10 }],
        storage: new ThrottlerStorageRedisService(redis.getClient()),
      }),
    }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
