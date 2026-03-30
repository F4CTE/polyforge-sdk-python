export interface StrategyEventPayload {
    type: string;
    strategyId: string;
    data: unknown;
    timestamp: number;
}
/**
 * In-process fan-out for strategy execution events.
 *
 * EventsService feeds this emitter whenever a relevant event arrives from
 * the Redis stream. StrategiesController SSE endpoints subscribe here and
 * forward payloads to connected clients.
 */
export declare class StrategyEventsService {
    private readonly emitter;
    constructor();
    /** Emit an event for a specific strategy (called from EventsService). */
    emit(strategyId: string, type: string, data: unknown): void;
    /**
     * Subscribe to events for a strategy.
     * Returns an unsubscribe function — call it when the SSE connection closes.
     */
    subscribe(strategyId: string, handler: (event: StrategyEventPayload) => void): () => void;
}
//# sourceMappingURL=strategy-events.service.d.ts.map