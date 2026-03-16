import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '@polyforge/shared-redis';
import { EventsGateway } from './events.gateway';

const STREAM = 'stream:events';
const GROUP = 'api-service';
const CONSUMER = `api-${process.pid}`;

/**
 * Consumes stream:events from Redis and dispatches to connected WebSocket clients.
 *
 * Also reads cache:price:* to forward price updates to PRICE subscriptions.
 * Note: price updates come from stream:events type == PRICE_UPDATE or from a
 * separate market-data sub-channel. For now, we relay any events in stream:events
 * that match the WebSocket protocol.
 */
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(EventsService.name);
    private running = false;
    private loopPromise: Promise<void> | null = null;

    constructor(
        private readonly redis: RedisService,
        private readonly gateway: EventsGateway,
    ) {}

    async onModuleInit() {
        await this.ensureGroup();
        this.running = true;
        this.loopPromise = this.consumeLoop();
    }

    async onModuleDestroy() {
        this.running = false;
        await this.loopPromise;
    }

    private async ensureGroup() {
        try {
            await (this.redis as any).client.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM');
        } catch (err: any) {
            if (!err.message?.includes('BUSYGROUP')) throw err;
        }
    }

    private async consumeLoop() {
        while (this.running) {
            try {
                const results = await (this.redis as any).client.xreadgroup(
                    'GROUP', GROUP, CONSUMER,
                    'COUNT', '100',
                    'BLOCK', '2000',
                    'STREAMS', STREAM, '>',
                );

                if (!results) continue;

                for (const [, messages] of results) {
                    for (const [id, fields] of messages) {
                        const event = this.parseFields(fields);
                        this.dispatch(event);
                        await (this.redis as any).client.xack(STREAM, GROUP, id);
                    }
                }
            } catch (err: any) {
                if (this.running) {
                    this.logger.error('stream:events consume error', err?.message);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
    }

    private parseFields(fields: string[]): Record<string, string> {
        const obj: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
            obj[fields[i]] = fields[i + 1];
        }
        return obj;
    }

    private dispatch(event: Record<string, string>) {
        const { type, strategyId, userId, orderId, tokenId, reason, ...rest } = event;
        if (!type) return;

        switch (type) {
            case 'PRICE_UPDATE':
                if (tokenId) {
                    this.gateway.pushPriceUpdate(tokenId, parseFloat(rest.price ?? '0'), parseInt(rest.ts ?? '0', 10));
                }
                break;

            case 'STRATEGY_STARTED':
            case 'STRATEGY_STOPPED':
            case 'STRATEGY_PAUSED':
            case 'STRATEGY_RESUMED':
            case 'STRATEGY_ERROR':
                if (strategyId && userId) {
                    this.gateway.pushStrategyEvent(strategyId, userId, type, { reason });
                }
                break;

            case 'ORDER_PLACED':
            case 'ORDER_SUBMITTED':
            case 'ORDER_FILLED':
            case 'ORDER_PARTIAL':
            case 'ORDER_CANCELLED':
            case 'ORDER_FAILED':
            case 'ORDER_ERROR':
                if (userId) {
                    this.gateway.pushOrderEvent(userId, type, { orderId, ...rest });
                }
                break;

            case 'BACKTEST_PROGRESS':
            case 'BACKTEST_COMPLETED':
            case 'BACKTEST_FAILED':
                if (userId) {
                    this.gateway.pushOrderEvent(userId, type, rest);
                }
                break;

            case 'PRICE_ALERT_TRIGGERED':
                if (userId) {
                    this.gateway.pushOrderEvent(userId, type, { tokenId, ...rest });
                }
                break;

            case 'NOTIFICATION':
                if (userId) {
                    this.gateway.pushNotification(userId, rest);
                }
                break;

            default:
                // Unknown event types are silently ignored
                break;
        }
    }
}
