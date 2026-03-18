import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { LoggerModule } from "@polyforge/logger";
import { StrategyModule } from "./strategy/strategy.module";
import { InternalModule } from "./internal/internal.module";
import { HealthController } from "./health/health.controller";
import { StrategyRegistryService } from "./strategy/strategy-registry.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    LoggerModule,
    StrategyModule,
    InternalModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
