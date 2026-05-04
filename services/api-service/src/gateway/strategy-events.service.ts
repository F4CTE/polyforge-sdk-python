import { Injectable } from "@nestjs/common";
import { EventEmitter } from "events";

export const MAX_SSE_SUBSCRIBERS_PER_STRATEGY = 100;
export const MAX_SSE_SUBSCRIBERS_PER_USER_STRATEGY = 3;

export interface StrategyEventPayload {
  type: string;
  strategyId: string;
  data: unknown;
  timestamp: number;
}

export class TooManyStrategyEventSubscribersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TooManyStrategyEventSubscribersError";
  }
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
  private readonly strategySubscriberCounts = new Map<string, number>();
  private readonly userStrategySubscriberCounts = new Map<string, number>();

  constructor() {
    this.emitter.setMaxListeners(MAX_SSE_SUBSCRIBERS_PER_STRATEGY + 1);
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
  subscribe(
    strategyId: string,
    userId: string,
    handler: (event: StrategyEventPayload) => void,
  ): () => void {
    const key = `s:${strategyId}`;
    const userKey = `${userId}:${strategyId}`;
    const strategyCount = this.strategySubscriberCounts.get(strategyId) ?? 0;
    const userStrategyCount =
      this.userStrategySubscriberCounts.get(userKey) ?? 0;

    if (strategyCount >= MAX_SSE_SUBSCRIBERS_PER_STRATEGY) {
      throw new TooManyStrategyEventSubscribersError(
        "Too many subscribers for this strategy",
      );
    }
    if (userStrategyCount >= MAX_SSE_SUBSCRIBERS_PER_USER_STRATEGY) {
      throw new TooManyStrategyEventSubscribersError(
        "Too many subscribers for this user and strategy",
      );
    }

    this.strategySubscriberCounts.set(strategyId, strategyCount + 1);
    this.userStrategySubscriberCounts.set(userKey, userStrategyCount + 1);
    this.emitter.on(key, handler);
    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.emitter.off(key, handler);
      this.decrement(this.strategySubscriberCounts, strategyId);
      this.decrement(this.userStrategySubscriberCounts, userKey);
    };
  }

  private decrement(map: Map<string, number>, key: string): void {
    const next = (map.get(key) ?? 0) - 1;
    if (next > 0) {
      map.set(key, next);
    } else {
      map.delete(key);
    }
  }
}
