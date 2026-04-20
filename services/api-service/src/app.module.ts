import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { ApiKeyThrottlerGuard } from "./common/api-key-throttler.guard";
import { JwtModule } from "@nestjs/jwt";
import { SharedDbModule } from "@polyforge/shared-db";
import { RedisModule, RedisService } from "@polyforge/shared-redis";
import { SharedAuthModule } from "@polyforge/shared-auth";
import { LoggerModule } from "@polyforge/logger";
import { HealthController, StatusController } from "./health/health.controller";
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
import { WhalesModule } from "./whales/whales.module";
import { CopyModule } from "./copy/copy.module";
import { NewsModule } from "./news/news.module";
import { ScoresModule } from "./scores/scores.module";
import { BatchModule } from "./batch/batch.module";
import { ActionsModule } from "./actions/actions.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { AiModule } from "./ai/ai.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { ArbitrageModule } from "./arbitrage/arbitrage.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { WatchlistModule } from "./watchlist/watchlist.module";
import { AccuracyModule } from "./accuracy/accuracy.module";
import { LpModule } from "./lp/lp.module";
import { RewardsModule } from "./rewards/rewards.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [
          {
            ttl: 60000,
            limit: process.env.NODE_ENV === "production" ? 120 : 1200,
          },
        ],
        storage: new ThrottlerStorageRedisService(redis.getClient()),
      }),
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
    WhalesModule,
    CopyModule,
    NewsModule,
    ScoresModule,
    BatchModule,
    ActionsModule,
    WebhooksModule,
    AiModule,
    ApiKeysModule,
    ArbitrageModule,
    MarketplaceModule,
    WatchlistModule,
    AccuracyModule,
    LpModule,
    RewardsModule,
  ],
  controllers: [HealthController, StatusController],
  providers: [{ provide: APP_GUARD, useClass: ApiKeyThrottlerGuard }],
})
export class AppModule {}
