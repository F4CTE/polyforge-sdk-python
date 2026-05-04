import { describe, expect, it } from "vitest";
import {
  MAX_SSE_SUBSCRIBERS_PER_USER_STRATEGY,
  StrategyEventsService,
  TooManyStrategyEventSubscribersError,
} from "./strategy-events.service";

describe("StrategyEventsService", () => {
  it("fans out events to subscribed handlers", () => {
    const service = new StrategyEventsService();
    const events: unknown[] = [];

    const unsubscribe = service.subscribe("strategy-1", "user-1", (event) => {
      events.push(event);
    });

    service.emit("strategy-1", "STRATEGY_STARTED", { ok: true });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "STRATEGY_STARTED",
      strategyId: "strategy-1",
      data: { ok: true },
    });

    unsubscribe();
  });

  it("enforces a per-user per-strategy subscriber cap", () => {
    const service = new StrategyEventsService();
    const unsubs: Array<() => void> = [];

    for (let i = 0; i < MAX_SSE_SUBSCRIBERS_PER_USER_STRATEGY; i += 1) {
      unsubs.push(service.subscribe("strategy-1", "user-1", () => undefined));
    }

    expect(() =>
      service.subscribe("strategy-1", "user-1", () => undefined),
    ).toThrow(TooManyStrategyEventSubscribersError);

    unsubs.forEach((unsubscribe) => unsubscribe());

    expect(() =>
      service.subscribe("strategy-1", "user-1", () => undefined),
    ).not.toThrow();
  });
});
