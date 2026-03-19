import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { JwtModule } from "@nestjs/jwt";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule } from "@polyforge/shared-redis";
import { SharedAuthModule } from "@polyforge/shared-auth";
import { LoggerModule } from "@polyforge/logger";
import { HealthController } from "./health/health.controller";
import { MarketsModule } from "./markets/markets.module";
import { StrategiesModule } from "./strategies/strategies.module";
import { DiscoverModule } from "./discover/discover.module";
import { OrdersModule } from "./orders/orders.module";
import { PortfolioModule } from "./portfolio/portfolio.module";
import { PaperModule } from "./paper/paper.module";
import { BacktestsModule } from "./backtests/backtests.module";
import { AlertsModule } from "./alerts/alerts.module";
import { TicketsModule } from "./tickets/tickets.module";
import { ProfileModule } from "./profile/profile.module";
import { SettingsModule } from "./settings/settings.module";
import { EventsModule } from "./gateway/events.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: process.env.NODE_ENV === "production" ? 120 : 1200, // 120 req/min prod, 1200 dev/test
        },
      ],
    }),
    JwtModule.register({}),
    LoggerModule,
    SharedDbModule,
    RedisModule,
    SharedAuthModule,
    MarketsModule,
    StrategiesModule,
    DiscoverModule,
    OrdersModule,
    PortfolioModule,
    PaperModule,
    BacktestsModule,
    AlertsModule,
    TicketsModule,
    ProfileModule,
    SettingsModule,
    EventsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
