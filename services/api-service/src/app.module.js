"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const api_key_throttler_guard_1 = require("./common/api-key-throttler.guard");
const jwt_1 = require("@nestjs/jwt");
const shared_db_1 = require("@polyforge/shared-db");
const shared_redis_1 = require("@polyforge/shared-redis");
const shared_auth_1 = require("@polyforge/shared-auth");
const logger_1 = require("@polyforge/logger");
const health_controller_1 = require("./health/health.controller");
const markets_module_1 = require("./markets/markets.module");
const strategies_module_1 = require("./strategies/strategies.module");
const discover_module_1 = require("./discover/discover.module");
const orders_module_1 = require("./orders/orders.module");
const portfolio_module_1 = require("./portfolio/portfolio.module");
const paper_module_1 = require("./paper/paper.module");
const backtests_module_1 = require("./backtests/backtests.module");
const alerts_module_1 = require("./alerts/alerts.module");
const tickets_module_1 = require("./tickets/tickets.module");
const profile_module_1 = require("./profile/profile.module");
const settings_module_1 = require("./settings/settings.module");
const events_module_1 = require("./gateway/events.module");
const whales_module_1 = require("./whales/whales.module");
const copy_module_1 = require("./copy/copy.module");
const news_module_1 = require("./news/news.module");
const scores_module_1 = require("./scores/scores.module");
const batch_module_1 = require("./batch/batch.module");
const actions_module_1 = require("./actions/actions.module");
const webhooks_module_1 = require("./webhooks/webhooks.module");
const ai_module_1 = require("./ai/ai.module");
const api_keys_module_1 = require("./api-keys/api-keys.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot({
                throttlers: [
                    {
                        ttl: 60000,
                        limit: process.env.NODE_ENV === "production" ? 120 : 1200, // 120 req/min prod, 1200 dev/test
                    },
                ],
            }),
            jwt_1.JwtModule.register({}),
            logger_1.LoggerModule,
            shared_db_1.SharedDbModule,
            shared_redis_1.RedisModule,
            shared_auth_1.SharedAuthModule,
            markets_module_1.MarketsModule,
            strategies_module_1.StrategiesModule,
            discover_module_1.DiscoverModule,
            orders_module_1.OrdersModule,
            portfolio_module_1.PortfolioModule,
            paper_module_1.PaperModule,
            backtests_module_1.BacktestsModule,
            alerts_module_1.AlertsModule,
            tickets_module_1.TicketsModule,
            profile_module_1.ProfileModule,
            settings_module_1.SettingsModule,
            events_module_1.EventsModule,
            whales_module_1.WhalesModule,
            copy_module_1.CopyModule,
            news_module_1.NewsModule,
            scores_module_1.ScoresModule,
            batch_module_1.BatchModule,
            actions_module_1.ActionsModule,
            webhooks_module_1.WebhooksModule,
            ai_module_1.AiModule,
            api_keys_module_1.ApiKeysModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [{ provide: core_1.APP_GUARD, useClass: api_key_throttler_guard_1.ApiKeyThrottlerGuard }],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map