"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EventsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const shared_redis_1 = require("@polyforge/shared-redis");
const events_gateway_1 = require("./events.gateway");
const strategy_events_service_1 = require("./strategy-events.service");
const STREAM = "stream:events";
const GROUP = "api-service";
const CONSUMER = `api-${process.pid}`;
/**
 * Consumes stream:events from Redis and dispatches to connected WebSocket clients.
 *
 * Also reads cache:price:* to forward price updates to PRICE subscriptions.
 * Note: price updates come from stream:events type == PRICE_UPDATE or from a
 * separate market-data sub-channel. For now, we relay any events in stream:events
 * that match the WebSocket protocol.
 */
let EventsService = EventsService_1 = class EventsService {
    redis;
    gateway;
    strategyEvents;
    logger = new common_1.Logger(EventsService_1.name);
    running = false;
    loopPromise = null;
    constructor(redis, gateway, strategyEvents) {
        this.redis = redis;
        this.gateway = gateway;
        this.strategyEvents = strategyEvents;
    }
    async onModuleInit() {
        await this.ensureGroup();
        this.running = true;
        this.loopPromise = this.consumeLoop();
    }
    async onModuleDestroy() {
        this.running = false;
        await this.loopPromise;
    }
    async ensureGroup() {
        try {
            await this.redis.client.xgroup("CREATE", STREAM, GROUP, "$", "MKSTREAM");
        }
        catch (err) {
            if (!err.message?.includes("BUSYGROUP"))
                throw err;
        }
    }
    async consumeLoop() {
        while (this.running) {
            try {
                const results = await this.redis.client.xreadgroup("GROUP", GROUP, CONSUMER, "COUNT", "100", "BLOCK", "2000", "STREAMS", STREAM, ">");
                if (!results)
                    continue;
                for (const [, messages] of results) {
                    for (const [id, fields] of messages) {
                        const event = this.parseFields(fields);
                        this.dispatch(event);
                        await this.redis.client.xack(STREAM, GROUP, id);
                    }
                }
            }
            catch (err) {
                if (this.running) {
                    this.logger.error("stream:events consume error", err?.message);
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
        }
    }
    parseFields(fields) {
        const obj = {};
        for (let i = 0; i < fields.length; i += 2) {
            obj[fields[i]] = fields[i + 1];
        }
        return obj;
    }
    dispatch(event) {
        const { type, strategyId, userId, orderId, tokenId, reason, ...rest } = event;
        if (!type)
            return;
        // Fan-out to SSE strategy-event subscribers for any event that carries a strategyId
        if (strategyId) {
            this.strategyEvents.emit(strategyId, type, {
                userId, orderId, tokenId, reason, ...rest,
            });
        }
        switch (type) {
            case "PRICE_UPDATE":
                if (tokenId) {
                    this.gateway.pushPriceUpdate(tokenId, parseFloat(rest.price ?? "0"), parseInt(rest.ts ?? "0", 10));
                }
                break;
            case "STRATEGY_STARTED":
            case "STRATEGY_STOPPED":
            case "STRATEGY_PAUSED":
            case "STRATEGY_RESUMED":
            case "STRATEGY_ERROR":
                if (strategyId && userId) {
                    this.gateway.pushStrategyEvent(strategyId, userId, type, { reason });
                }
                break;
            case "ORDER_PLACED":
            case "ORDER_SUBMITTED":
            case "ORDER_FILLED":
            case "ORDER_PARTIAL":
            case "ORDER_CANCELLED":
            case "ORDER_FAILED":
            case "ORDER_ERROR":
                if (userId) {
                    this.gateway.pushOrderEvent(userId, type, { orderId, ...rest });
                }
                break;
            case "BACKTEST_PROGRESS":
            case "BACKTEST_COMPLETED":
            case "BACKTEST_FAILED":
                if (userId) {
                    this.gateway.pushOrderEvent(userId, type, rest);
                }
                break;
            case "PRICE_ALERT_TRIGGERED":
                if (userId) {
                    this.gateway.pushOrderEvent(userId, type, { tokenId, ...rest });
                }
                break;
            case "WHALE_TRADE":
                this.gateway.pushWhaleTrade({ ...rest, walletAddress: rest.walletAddress });
                break;
            case "NEWS_SIGNAL":
                this.gateway.pushNewsSignal(rest);
                break;
            case "NOTIFICATION":
                if (userId) {
                    this.gateway.pushNotification(userId, rest);
                }
                break;
            default:
                // Unknown event types are silently ignored
                break;
        }
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = EventsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_redis_1.RedisService,
        events_gateway_1.EventsGateway,
        strategy_events_service_1.StrategyEventsService])
], EventsService);
//# sourceMappingURL=events.service.js.map