import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "@polyforge/logger";
import { StrategyModule } from "./strategy/strategy.module";
import { InternalModule } from "./internal/internal.module";
import { HealthController } from "./health/health.controller";
import { StrategyRegistryService } from "./strategy/strategy-registry.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
    LoggerModule,
    StrategyModule,
    InternalModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
