import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule } from "@polyforge/shared-redis";
import { LoggerModule } from "@polyforge/logger";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./common/health.controller";

@Module({
  imports: [
    LoggerModule,
    SharedDbModule,
    RedisModule,
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 900000, limit: 10 }] }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
