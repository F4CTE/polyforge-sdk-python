import { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { RedisService } from "@polyforge/shared-redis";
import { EventsGateway } from "./events.gateway";
import { StrategyEventsService } from "./strategy-events.service";
/**
 * Consumes stream:events from Redis and dispatches to connected WebSocket clients.
 *
 * Also reads cache:price:* to forward price updates to PRICE subscriptions.
 * Note: price updates come from stream:events type == PRICE_UPDATE or from a
 * separate market-data sub-channel. For now, we relay any events in stream:events
 * that match the WebSocket protocol.
 */
export declare class EventsService implements OnModuleInit, OnModuleDestroy {
    private readonly redis;
    private readonly gateway;
    private readonly strategyEvents;
    private readonly logger;
    private running;
    private loopPromise;
    constructor(redis: RedisService, gateway: EventsGateway, strategyEvents: StrategyEventsService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private ensureGroup;
    private consumeLoop;
    private parseFields;
    private dispatch;
}
//# sourceMappingURL=events.service.d.ts.map