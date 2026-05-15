import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { SentryModule, SentryGlobalFilter } from "@sentry/nestjs/setup";
import { SharedUserDbModule } from "@polyforge/shared-db";
import { RedisModule, RedisService } from "@polyforge/shared-redis";
import { LoggerModule } from "@polyforge/logger";
import { HealthController } from "./health/health.controller";
import { BotModule } from "./bot/bot.module";

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60000, limit: 200 }],
        storage: new ThrottlerStorageRedisService(redis.getClient()),
      }),
    }),
    LoggerModule,
    SharedUserDbModule,
    RedisModule,
    JwtModule.register({}),
    BotModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
