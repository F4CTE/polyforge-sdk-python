import { Module } from "@nestjs/common";
import { SentryModule } from "@sentry/nestjs/setup";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "@polyforge/logger";
import { RedisModule, RedisService } from "@polyforge/shared-redis";
import { EncryptionModule } from "./encryption/encryption.module";
import { CredentialsModule } from "./credentials/credentials.module";
import { SigningModule } from "./signing/signing.module";
import { CanaryModule } from "./canary/canary.module";
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
        throttlers: [{ ttl: 60000, limit: 120 }],
        storage: new ThrottlerStorageRedisService(redis.getClient()),
      }),
    }),
    LoggerModule,
    RedisModule,
    EncryptionModule,
    CredentialsModule,
    SigningModule,
    CanaryModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
