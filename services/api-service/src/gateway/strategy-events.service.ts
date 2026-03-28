import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

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
@Injectable()
export class StrategyEventsService {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Allow many concurrent SSE subscribers per strategy
    this.emitter.setMaxListeners(500);
  }

  /** Emit an event for a specific strategy (called from EventsService). */
  emit(strategyId: string, type: string, data: unknown): void {
    const payload: StrategyEventPayload = {
      type,
      strategyId,
      data: data ?? null,
      timestamp: Date.now(),
    };
    this.emitter.emit(`s:${strategyId}`, payload);
  }

  /**
   * Subscribe to events for a strategy.
   * Returns an unsubscribe function — call it when the SSE connection closes.
   */
  subscribe(strategyId: string, handler: (event: StrategyEventPayload) => void): () => void {
    const key = `s:${strategyId}`;
    this.emitter.on(key, handler);
    return () => this.emitter.off(key, handler);
  }
}
