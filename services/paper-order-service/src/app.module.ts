import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule } from "@polyforge/shared-redis";
import { LoggerModule } from "@polyforge/logger";
import { HealthController } from "./health/health.controller";
import { FillsModule } from "./fills/fills.module";
import { StreamModule } from "./stream/stream.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    LoggerModule,
    SharedDbModule,
    RedisModule,
    FillsModule,
    StreamModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
