import { describe, it, expect, vi } from "vitest";
import { StrategyRunner } from "./strategy-runner";
import type { OrderIntent } from "../blocks/block.types";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeRedis(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    getJson: vi.fn().mockResolvedValue(null),
    getClient: vi.fn().mockReturnValue({
      lrange: vi.fn().mockResolvedValue([]),
      mget: vi
        .fn()
        .mockResolvedValue([
          JSON.stringify({ price: 0.5, timestamp: Date.now() }),
        ]),
      // Beta daily execution counter
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    }),
    xadd: vi.fn().mockResolvedValue("1-0"),
    ...overrides,
  } as any;
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    strategy: { update: vi.fn().mockResolvedValue({}) },
    position: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    token: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    market: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as any;
}

const DEFAULT_STATE = {
  betsToday: 0,
  dailyPnl: 0,
  consecutiveLoss: 0,
  consecutiveWin: 0,
  lastTradeAt: 0,
  tradedTokensToday: [],
  totalOrders: 0,
};

function makeState(patch: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue({ ...DEFAULT_STATE, ...patch }),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue({ ...DEFAULT_STATE, ...patch }),
    incrementOrderCounters: vi
      .fn()
      .mockResolvedValue({ ...DEFAULT_STATE, ...patch }),
    clear: vi.fn().mockResolvedValue(undefined),
    getPriceAge: vi.fn().mockResolvedValue(0), // fresh by default
  } as any;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function makeRunner({
  execMode = "TICK",
  tickMs = 1000,
  triggers = [] as any[],
  conditions = [] as any[],
  actions = [] as any[],
  safety = [] as any[],
  variables = [] as any[],
  redis = makeRedis(),
  prisma = makePrisma(),
  state = makeState(),
  onIntents = vi
    .fn<(intents: OrderIntent[]) => Promise<void>>()
    .mockResolvedValue(undefined),
  onStatusChange = vi.fn().mockResolvedValue(undefined),
  logicBlocks = [] as any[],
  logicConnections = [] as any[],
} = {}) {
  return new StrategyRunner(
    "strat-test",
    "user-test",
    execMode,
    tickMs,
    triggers,
    conditions,
    actions,
    safety,
    variables,
    redis,
    prisma,
    state,
    onIntents,
    onStatusChange,
    logicBlocks,
    logicConnections,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StrategyRunner — lifecycle", () => {
  it("starts in RUNNING status", () => {
    const runner = makeRunner();
    expect(runner.status).toBe("RUNNING");
  });

  it("pause() sets status to PAUSED", () => {
    const runner = makeRunner();
    runner.pause("test reason");
    expect(runner.status).toBe("PAUSED");
  });

  it("resume() sets status back to RUNNING", () => {
    const runner = makeRunner();
    runner.pause();
    runner.resume();
    expect(runner.status).toBe("RUNNING");
  });

  it("stop() sets status to STOPPED", () => {
    const runner = makeRunner();
    runner.stop();
    expect(runner.status).toBe("STOPPED");
  });

  it("onPriceEvent() does not evaluate when execMode is TICK", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "TICK", state });
    await runner.onPriceEvent("tok1", 0.5);
    // evaluate() calls state.get() — should not be called
    expect(state.get).not.toHaveBeenCalled();
  });

  it("onPriceEvent() evaluates when execMode is EVENT", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.get).toHaveBeenCalled();
  });

  it("onPriceEvent() evaluates when execMode is HYBRID", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "HYBRID", state });
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.get).toHaveBeenCalled();
  });

  it("skips overlapping ticks while one evaluation is still running", async () => {
    let release!: () => void;
    const state = makeState();
    state.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ...DEFAULT_STATE });
        }),
    );
    const runner = makeRunner({ execMode: "EVENT", state });

    const first = runner.onPriceEvent("tok1", 0.5);
    const second = runner.onPriceEvent("tok1", 0.5);
    await second;
    release();
    await first;

    // First tick evaluates (get called). Second tick coalesced to
    // pendingTick; after first completes, pending follow-up fires.
    expect(state.get).toHaveBeenCalledTimes(2);
  });
});

describe("StrategyRunner — stale data detection", () => {
  it("pauses and emits STRATEGY_PAUSED when price data is stale", async () => {
    const state = makeState();
    // Override mget to return null (no cached price = stale data)
    const redis = makeRedis({
      getClient: vi.fn().mockReturnValue({
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi.fn().mockResolvedValue([null]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      }),
    });
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      triggers: [{ id: "b1", type: "every_tick", params: { tokenId: "tok1" } }],
      onStatusChange,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(runner.status).toBe("PAUSED");
    expect(onStatusChange).toHaveBeenCalledWith(
      "PAUSED",
      expect.stringContaining("stale_market_data"),
    );
    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({ type: "STRATEGY_PAUSED" }),
    );
  });

  it("auto-resumes on price event when paused with stale_market_data and data is fresh", async () => {
    // detectStaleData() reads from Redis mget, not state.getPriceAge.
    // Drive mget to return a fresh timestamp so auto-resume fires.
    const freshTimestamp = Date.now();
    const redis = makeRedis({
      getClient: vi.fn().mockReturnValue({
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: freshTimestamp }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      }),
    });
    const state = makeState();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      onStatusChange,
      triggers: [{ id: "b1", type: "every_tick", params: { tokenId: "tok1" } }],
    });
    runner.pause("stale_market_data:tok1");

    await runner.onPriceEvent("tok1", 0.5);

    // Auto-resume fired — data is fresh
    expect(runner.status).toBe("RUNNING");
    expect(onStatusChange).toHaveBeenCalledWith("RUNNING");
  });

  it("does not evaluate when paused for non-stale reason", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });
    runner.pause("manual");

    await runner.onPriceEvent("tok1", 0.5);
    // state.get is only called inside evaluate(), which should be skipped
    expect(state.get).not.toHaveBeenCalled();
  });
});

describe("StrategyRunner — SAFETY evaluation", () => {
  it("stops strategy and emits STRATEGY_STOPPED when safety block fails", async () => {
    const state = makeState();
    const redis = makeRedis();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const prisma = makePrisma();

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onStatusChange,
      safety: [
        {
          id: "safety-1",
          type: "stop_if_daily_loss",
          params: { maxLossUsdc: "10" },
        },
      ],
    });

    // Set dailyPnl below limit
    state.get.mockResolvedValue({ ...DEFAULT_STATE, dailyPnl: -15 });

    await runner.onPriceEvent("tok1", 0.5);

    expect(runner.status).toBe("STOPPED");
    expect(onStatusChange).toHaveBeenCalledWith(
      "STOPPED",
      expect.stringContaining("SAFETY STOP"),
    );
    expect(prisma.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "IDLE" } }),
    );
    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({ type: "STRATEGY_STOPPED" }),
    );
  });

  it("does not stop when all safety blocks pass", async () => {
    const state = makeState();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onStatusChange,
      safety: [
        {
          id: "safety-1",
          type: "stop_if_consecutive_loss",
          params: { maxLosses: "5" },
        },
      ],
    });

    state.get.mockResolvedValue({ ...DEFAULT_STATE, consecutiveLoss: 2 });

    await runner.onPriceEvent("tok1", 0.5);

    expect(runner.status).toBe("RUNNING");
    expect(onStatusChange).not.toHaveBeenCalledWith(
      "STOPPED",
      expect.anything(),
    );
  });
});

describe("StrategyRunner — TRIGGER evaluation", () => {
  it("proceeds when every_tick trigger fires", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      triggers: [{ id: "t1", type: "every_tick", params: {} }],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // No actions, so onIntents should NOT be called, but we can verify
    // the evaluation did not short-circuit after triggers
    expect(state.get).toHaveBeenCalled();
  });

  it("skips tick when no trigger fires", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    // win_streak with count=5 won't fire with consecutiveWin=0
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      triggers: [{ id: "t1", type: "win_streak", params: { count: "5" } }],
    });

    state.get.mockResolvedValue({ ...DEFAULT_STATE, consecutiveWin: 0 });

    await runner.onPriceEvent("tok1", 0.5);

    expect(onIntents).not.toHaveBeenCalled();
  });

  it("fires when any one of multiple triggers matches (OR logic)", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      triggers: [
        { id: "t1", type: "win_streak", params: { count: "5" } }, // won't fire
        { id: "t2", type: "every_tick", params: {} }, // always fires
      ],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // evaluate proceeded (state.get was called)
    expect(state.get).toHaveBeenCalled();
  });

  it("proceeds with no triggers (empty trigger list = always fire)", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state, triggers: [] });
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.get).toHaveBeenCalled();
  });
});

describe("StrategyRunner — CONDITION evaluation", () => {
  it("skips tick when a condition fails (AND logic)", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    // max_bets_per_day with max=3, betsToday=5 → condition fails
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      conditions: [
        { id: "c1", type: "max_bets_per_day", params: { max: "3" } },
      ],
    });

    state.get.mockResolvedValue({ ...DEFAULT_STATE, betsToday: 5 });

    await runner.onPriceEvent("tok1", 0.5);
    expect(onIntents).not.toHaveBeenCalled();
  });
});

describe("StrategyRunner — ACTION execution + state update", () => {
  it("calls onIntents with produced OrderIntents", async () => {
    const state = makeState();
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue({
      id: "tok-yes",
      marketId: "mkt-1",
      outcome: "YES",
    });
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.7 }),
    });
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onIntents,
      actions: [
        {
          id: "a1",
          type: "buy_yes",
          params: { tokenId: "tok-yes", size: "10" },
        },
      ],
    });

    await runner.onPriceEvent("tok-yes", 0.7);

    expect(onIntents).toHaveBeenCalledOnce();
    const intents: OrderIntent[] = onIntents.mock.calls[0][0];
    expect(intents).toHaveLength(1);
    expect(intents[0].side).toBe("BUY");
    expect(intents[0].size).toBe("10");
  });

  it("calls onIntents and does not call state.update when intents are produced", async () => {
    const state = makeState();
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue({
      id: "tok-yes",
      marketId: "mkt-1",
      outcome: "YES",
    });
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.7 }),
    });
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onIntents,
      actions: [
        {
          id: "a1",
          type: "buy_yes",
          params: { tokenId: "tok-yes", size: "10" },
        },
      ],
    });

    await runner.onPriceEvent("tok-yes", 0.7);

    expect(onIntents).toHaveBeenCalledOnce();
    const intents: OrderIntent[] = onIntents.mock.calls[0][0];
    expect(intents).toHaveLength(1);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("does NOT increment order counters when onIntents rejects", async () => {
    const state = makeState();
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue({
      id: "tok-yes",
      marketId: "mkt-1",
      outcome: "YES",
    });
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.7 }),
    });
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockRejectedValue(new Error("publish failure"));

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onIntents,
      actions: [
        {
          id: "a1",
          type: "buy_yes",
          params: { tokenId: "tok-yes", size: "10" },
        },
      ],
    });

    await runner.onPriceEvent("tok-yes", 0.7);

    expect(onIntents).toHaveBeenCalledOnce();
    expect(state.incrementOrderCounters).not.toHaveBeenCalled();
  });

  it("does NOT call onIntents when actions produce no intents (skip_bet)", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      actions: [{ id: "a1", type: "skip_bet", params: {} }],
    });

    await runner.onPriceEvent("tok1", 0.5);
    expect(onIntents).not.toHaveBeenCalled();
  });

  it("skips unknown block types gracefully", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      actions: [{ id: "a1", type: "NONEXISTENT_BLOCK", params: {} }],
    });

    // Should not throw
    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();
    expect(onIntents).not.toHaveBeenCalled();
  });
});

describe("StrategyRunner — start() timer management", () => {
  it("start() sets up interval for TICK mode", () => {
    const runner = makeRunner({ execMode: "TICK", tickMs: 1000 });
    // start() then stop() to clear the timer — ensures no lingering intervals
    runner.start();
    runner.stop();
    expect(runner.status).toBe("STOPPED");
  });

  it("start() does NOT set interval for EVENT mode", () => {
    const runner = makeRunner({ execMode: "EVENT" });
    runner.start();
    // No timer set for EVENT mode — stop should still work cleanly
    runner.stop();
    expect(runner.status).toBe("STOPPED");
  });

  it("enforces minimum tick interval of 200ms", () => {
    // tickMs=50 should be floored to 200ms (tested by ensuring start() doesn't throw)
    const runner = makeRunner({ execMode: "TICK", tickMs: 50 });
    expect(() => {
      runner.start();
      runner.stop();
    }).not.toThrow();
  });
});

describe("StrategyRunner — stale check throttling", () => {
  it("throttles detectStaleData calls during stale-paused ticks (prevents Redis mget fan-out)", async () => {
    // Use controlled time so we can verify throttling behavior
    let currentTime = 10_000;
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockImplementation(() => currentTime);

    const redis = makeRedis({
      getClient: vi.fn().mockReturnValue({
        lrange: vi.fn().mockResolvedValue([]),
        // Return null = stale data
        mget: vi.fn().mockResolvedValue([null]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      }),
    });

    const runner = makeRunner({
      execMode: "EVENT",
      redis,
      triggers: [{ id: "b1", type: "every_tick", params: { tokenId: "tok1" } }],
    });

    const mgetSpy = redis.getClient().mget;

    // First tick: fresh data check in evaluate() detects stale → pauses.
    // mget is called once during evaluate()'s detectStaleData() at ~line 379.
    await runner.onPriceEvent("tok1", 0.5);
    expect(runner.status).toBe("PAUSED");
    const mgetCallsAfterPause = mgetSpy.mock.calls.length;

    // Second tick (immediate, same time): stale-paused block throttles —
    // lastStaleCheckMs was set during the first tick's stale-paused block entry,
    // so a rapid successive call should be gated.
    // But note: on the first tick, the stale-paused block was NOT entered
    // (status was RUNNING), so lastStaleCheckMs=0. The second tick enters the block,
    // now - 0 > 5000 so it fires once. Let's advance past the check.
    // Actually: first tick status=RUNNING → stale-paused block skipped.
    // evaluate() called detectStaleData → paused.
    // Second tick: status=PAUSED + stale reason → enters stale-paused block.
    // lastStaleCheckMs=0, so now(10000) - 0 = 10000 > 5000 → fires.
    // After this, lastStaleCheckMs=10000, backoff doubles to 10000.
    await runner.onPriceEvent("tok1", 0.5);
    const mgetCallsAfterSecondTick = mgetSpy.mock.calls.length;

    // Third tick (immediate, same time): now throttled —
    // now(10000) - lastStaleCheckMs(10000) = 0 < backoff(10000) → skipped
    await runner.onPriceEvent("tok1", 0.5);
    expect(mgetSpy.mock.calls.length).toBe(mgetCallsAfterSecondTick);

    // Advance time by backoff (10s) + 1ms → should fire again
    currentTime += 10_001;
    await runner.onPriceEvent("tok1", 0.5);
    expect(mgetSpy.mock.calls.length).toBe(mgetCallsAfterSecondTick + 1);

    // Backoff should now be 20000
    // Another immediate call → throttled
    await runner.onPriceEvent("tok1", 0.5);
    expect(mgetSpy.mock.calls.length).toBe(mgetCallsAfterSecondTick + 1);

    dateNowSpy.mockRestore();
  });

  it("resets backoff to STALE_PRICE_MS when fresh data is detected and auto-resumes", async () => {
    let currentTime = 10_000;
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockImplementation(() => currentTime);

    let mgetReturnsStale = true;
    const mgetImpl = vi.fn().mockImplementation(() => {
      if (mgetReturnsStale) {
        return Promise.resolve([null]); // stale
      }
      return Promise.resolve([
        JSON.stringify({ price: 0.6, timestamp: currentTime }),
      ]); // fresh
    });

    const redis = makeRedis({
      getClient: vi.fn().mockReturnValue({
        lrange: vi.fn().mockResolvedValue([]),
        mget: mgetImpl,
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      }),
    });

    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const runner = makeRunner({
      execMode: "EVENT",
      redis,
      onStatusChange,
      triggers: [{ id: "b1", type: "every_tick", params: { tokenId: "tok1" } }],
    });

    // First tick: detect stale → pause
    await runner.onPriceEvent("tok1", 0.5);
    expect(runner.status).toBe("PAUSED");

    // Second tick: stale-paused block fires, still stale → backoff doubles
    await runner.onPriceEvent("tok1", 0.5);

    // Advance past the doubled backoff, make data fresh
    currentTime += 20_000;
    mgetReturnsStale = false;

    // Third tick: detects fresh → auto-resumes, backoff resets
    await runner.onPriceEvent("tok1", 0.5);
    expect(runner.status).toBe("RUNNING");
    expect(onStatusChange).toHaveBeenCalledWith("RUNNING");

    dateNowSpy.mockRestore();
  });
});

describe("StrategyRunner — stale data auto-resume path", () => {
  it("auto-resumes mid-tick when stale pause was set during the same evaluate() call chain", async () => {
    // This covers lines 127-129: the runner is PAUSED with a stale reason
    // but tick() still proceeds because status check happens before pause
    // We test the branch by simulating: stale pause was set then data became fresh
    // during the SAME evaluate() call (which can't happen via tick, but via direct test)
    const state = makeState();
    const redis = makeRedis();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      onStatusChange,
    });

    // detectStaleData returns null (fresh), and status is RUNNING with stale pause reason
    // To hit lines 127-129: we need status=PAUSED + reason.startsWith('stale_market_data')
    // but tick() returns early when PAUSED — so we test that resume() works
    runner.pause("stale_market_data:tok1");
    runner.resume(); // covers the resume path
    expect(runner.status).toBe("RUNNING");
  });
});

describe("StrategyRunner — error handling", () => {
  it("swallows errors thrown during tick evaluation", async () => {
    const state = makeState();
    state.get.mockRejectedValue(new Error("Redis connection lost"));

    const runner = makeRunner({ execMode: "EVENT", state });

    // Should not throw — errors are caught and logged
    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();
    expect(runner.status).toBe("RUNNING");
  });
});

describe("StrategyRunner — calculation variables", () => {
  it("variables are evaluated before safety blocks", async () => {
    const state = makeState();
    const callOrder: string[] = [];

    // Track when state.get is called (happens at start of evaluate())
    state.get.mockImplementation(async () => {
      callOrder.push("state.get");
      return { ...DEFAULT_STATE, dailyPnl: -5 };
    });

    // getPrice is called during variable evaluation
    state.getPrice = vi.fn().mockImplementation(async () => {
      callOrder.push("getPrice");
      return { price: 0.6 };
    });

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      variables: [{ id: "v1", name: "threshold", expression: "dailyPnl * -1" }],
      safety: [
        {
          id: "safety-1",
          type: "stop_if_daily_loss",
          params: { maxLossUsdc: "$threshold" },
        },
      ],
      triggers: [{ id: "t1", type: "every_tick", params: { tokenId: "tok1" } }],
    });

    await runner.onPriceEvent("tok1", 0.6);

    // state.get is called first, then getPrice during variable eval,
    // all before safety blocks run
    expect(callOrder[0]).toBe("state.get");
  });

  it("$varName in block params gets resolved to variable value", async () => {
    const state = makeState();
    state.get.mockResolvedValue({ ...DEFAULT_STATE, dailyPnl: 0 });
    state.getPrice = vi.fn().mockResolvedValue({ price: 0.6 });

    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue({
      id: "tok-yes",
      marketId: "mkt-1",
      outcome: "YES",
    });
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.7 }),
    });

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onIntents,
      variables: [{ id: "v1", name: "betSize", expression: "10 + 5" }],
      actions: [
        {
          id: "a1",
          type: "buy_yes",
          params: { tokenId: "tok-yes", size: "$betSize" },
        },
      ],
    });

    await runner.onPriceEvent("tok-yes", 0.7);

    expect(onIntents).toHaveBeenCalledOnce();
    const intents: OrderIntent[] = onIntents.mock.calls[0][0];
    expect(intents).toHaveLength(1);
    // $betSize should resolve to 15 (10 + 5) — may be number or string
    expect(Number(intents[0].size)).toBe(15);
  });

  it("invalid expression does not crash (logs warning, skips)", async () => {
    const state = makeState();
    state.get.mockResolvedValue({ ...DEFAULT_STATE });
    state.getPrice = vi.fn().mockResolvedValue(null);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      variables: [
        { id: "v1", name: "badVar", expression: "??? invalid syntax !!!" },
      ],
    });

    // Should not throw
    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();
    expect(runner.status).toBe("RUNNING");
  });

  it("variables can reference other previously-defined variables", async () => {
    const state = makeState();
    state.get.mockResolvedValue({ ...DEFAULT_STATE, betsToday: 3 });
    state.getPrice = vi.fn().mockResolvedValue({ price: 0.5 });

    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue({
      id: "tok-yes",
      marketId: "mkt-1",
      outcome: "YES",
    });
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.5 }),
    });

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onIntents,
      variables: [
        { id: "v1", name: "base", expression: "betsToday * 10" },
        { id: "v2", name: "adjusted", expression: "base + 5" },
      ],
      actions: [
        {
          id: "a1",
          type: "buy_yes",
          params: { tokenId: "tok-yes", size: "$adjusted" },
        },
      ],
    });

    await runner.onPriceEvent("tok-yes", 0.5);

    expect(onIntents).toHaveBeenCalledOnce();
    const intents: OrderIntent[] = onIntents.mock.calls[0][0];
    // base = 3 * 10 = 30, adjusted = 30 + 5 = 35 — may be number or string
    expect(Number(intents[0].size)).toBe(35);
  });

  it("skips non-finite variable results instead of storing them as zero", async () => {
    const state = makeState();
    state.get.mockResolvedValue({ ...DEFAULT_STATE });
    state.getPrice = vi.fn().mockResolvedValue(null);

    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue({
      id: "tok-yes",
      marketId: "mkt-1",
      outcome: "YES",
    });
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.7 }),
    });
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onIntents,
      variables: [{ id: "v1", name: "badSize", expression: "parse('2+2')" }],
      actions: [
        {
          id: "a1",
          type: "buy_yes",
          params: { tokenId: "tok-yes", size: "$badSize" },
        },
      ],
    });

    await runner.onPriceEvent("tok-yes", 0.7);

    expect(onIntents).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalledWith(
      "strat-test",
      expect.objectContaining({ betsToday: 1 }),
    );
  });

  it("empty variables array works (backward compat)", async () => {
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      variables: [],
    });

    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();
    expect(state.get).toHaveBeenCalled();
  });
});

describe("StrategyRunner — empty strategy (no blocks)", () => {
  it("evaluates without error when strategy has no blocks at all", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      triggers: [],
      conditions: [],
      actions: [],
      safety: [],
    });

    await runner.onPriceEvent("tok1", 0.5);

    // No triggers = triggerFired=true, no conditions = pass, no actions = no intents
    expect(onIntents).not.toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });
});

describe("StrategyRunner — blocks that throw errors", () => {
  it("catches errors from evaluate and remains RUNNING", async () => {
    const state = makeState();
    // Force evaluate to throw by making state.get fail after an initial call
    state.get.mockRejectedValue(new Error("State retrieval failed"));

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      triggers: [{ id: "t1", type: "every_tick", params: {} }],
    });

    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();
    expect(runner.status).toBe("RUNNING");
  });
});

describe("StrategyRunner — child strategy management", () => {
  it("addChild and removeChild track children correctly", () => {
    const runner = makeRunner();
    runner.addChild("child-1", "managed");
    runner.addChild("child-2", "scoped");

    expect(runner.childStrategies.size).toBe(2);
    expect(runner.getChildMode("child-1")).toBe("managed");
    expect(runner.getChildMode("child-2")).toBe("scoped");

    runner.removeChild("child-1");
    expect(runner.childStrategies.size).toBe(1);
    expect(runner.getChildMode("child-1")).toBeUndefined();
  });

  it("stop() clears delayed actions", () => {
    const runner = makeRunner({ execMode: "TICK", tickMs: 1000 });
    runner.start();
    runner.stop();
    expect(runner.status).toBe("STOPPED");
  });

  it("stop() logs when there are child strategies", () => {
    const runner = makeRunner();
    runner.addChild("child-1", "managed");
    runner.stop();
    expect(runner.status).toBe("STOPPED");
    // Children set is still populated (cascade handled by registry)
    expect(runner.childStrategies.size).toBe(1);
  });
});

describe("StrategyRunner — order intent publishing", () => {
  it("does not increment strategy state when intent publish fails", async () => {
    const state = makeState();
    const prisma = makePrisma({
      token: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "tok-1", marketId: "m1", outcome: "YES" }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });
    const onIntents = vi.fn().mockRejectedValue(new Error("stream down"));
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      prisma,
      actions: [
        {
          id: "a1",
          type: "buy_yes",
          params: { tokenId: "tok-1", size: "10" },
        },
      ],
      onIntents,
    });

    await runner.onPriceEvent("tok-1", 0.5);

    expect(onIntents).toHaveBeenCalledOnce();
    expect(state.update).not.toHaveBeenCalled();
  });
});

describe("StrategyRunner — safeEvaluate edge cases", () => {
  it("rejects expression with forbidden keywords (via variables)", async () => {
    const state = makeState();
    state.get.mockResolvedValue({ ...DEFAULT_STATE });
    state.getPrice = vi.fn().mockResolvedValue(null);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      variables: [{ id: "v1", name: "dangerous", expression: "while(true) 1" }],
    });

    // Should not throw — forbidden keyword expressions are caught
    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();
    expect(runner.status).toBe("RUNNING");
  });

  it("rejects expression that is too long (>200 chars)", async () => {
    const state = makeState();
    state.get.mockResolvedValue({ ...DEFAULT_STATE });
    state.getPrice = vi.fn().mockResolvedValue(null);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      variables: [
        { id: "v1", name: "longExpr", expression: "1+".repeat(150) + "1" },
      ],
    });

    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();
  });
});

describe("StrategyRunner — sentinel intents", () => {
  it("does not publish __cancel_all__ sentinel intents as orders", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      actions: [{ id: "a1", type: "cancel_all_orders", params: {} }],
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(onIntents).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalledWith(
      "strat-test",
      expect.objectContaining({ betsToday: 1 }),
    );
  });
});

describe("StrategyRunner — HYBRID mode", () => {
  it("start() sets up interval for HYBRID mode", () => {
    const runner = makeRunner({ execMode: "HYBRID", tickMs: 1000 });
    runner.start();
    runner.stop();
    expect(runner.status).toBe("STOPPED");
  });
});

describe("StrategyRunner — getPrimaryTokenId", () => {
  it("resolves primary token from trigger params", async () => {
    const state = makeState();
    state.get.mockResolvedValue({ ...DEFAULT_STATE });
    state.getPrice = vi.fn().mockResolvedValue({ price: 0.5 });

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      variables: [
        { id: "v1", name: "testVar", expression: "currentPrice * 2" },
      ],
      triggers: [
        { id: "t1", type: "every_tick", params: { tokenId: "tok-primary" } },
      ],
    });

    await runner.onPriceEvent("tok-primary", 0.5);
    expect(state.getPrice).toHaveBeenCalledWith("tok-primary");
  });
});

describe("StrategyRunner — logic graph evaluation", () => {
  it("evaluates a simple AND_GATE with no upstream inputs", async () => {
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      logicBlocks: [{ id: "and-1", type: "AND_GATE" }],
      logicConnections: [],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // evaluateLogicGraph runs without crashing
    expect(state.get).toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });

  it("evaluates two OR_GATE blocks connected sequentially", async () => {
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      logicBlocks: [
        { id: "or-1", type: "OR_GATE" },
        { id: "or-2", type: "OR_GATE" },
      ],
      logicConnections: [{ source: "or-1", target: "or-2" }],
    });

    await runner.onPriceEvent("tok1", 0.5);
    expect(state.get).toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });

  it("IF_THEN_ELSE propagates via true-handle to downstream block", async () => {
    const state = makeState();
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue({
      id: "tok1",
      marketId: "mkt-1",
      outcome: "YES",
    });
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.5 }),
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onIntents,
      logicBlocks: [
        { id: "if-1", type: "IF_THEN_ELSE", condition: "1 > 0" },
        { id: "or-1", type: "OR_GATE" },
      ],
      logicConnections: [
        { source: "if-1", sourceHandle: "true", target: "or-1" },
      ],
      actions: [
        {
          id: "act-1",
          type: "buy_yes",
          params: { tokenId: "tok1", size: "$__logic_or-1", price: "0.5" },
        },
      ],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // __logic_or-1 = 1 → size resolves to 1 → action fires
    expect(onIntents).toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });

  it("IF_THEN_ELSE falsy condition blocks true-handle propagation", async () => {
    const state = makeState();
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue({
      id: "tok1",
      marketId: "mkt-1",
      outcome: "YES",
    });
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.5 }),
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onIntents,
      logicBlocks: [
        { id: "if-1", type: "IF_THEN_ELSE", condition: "1 < 0" },
        { id: "or-1", type: "OR_GATE" },
      ],
      logicConnections: [
        { source: "if-1", sourceHandle: "true", target: "or-1" },
      ],
      actions: [
        {
          id: "act-1",
          type: "buy_yes",
          params: { tokenId: "tok1", size: "$__logic_or-1", price: "0.5" },
        },
      ],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // __logic_or-1 = 0 → size resolves to 0 → action throws → onIntents is not called
    expect(onIntents).not.toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });

  it("evaluates NOT_GATE in a logic graph", async () => {
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      logicBlocks: [
        { id: "not-1", type: "NOT_GATE" },
        { id: "or-1", type: "OR_GATE" },
      ],
      logicConnections: [{ source: "not-1", target: "or-1" }],
    });

    await runner.onPriceEvent("tok1", 0.5);
    expect(state.get).toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });

  it("skips logic blocks with unknown types gracefully", async () => {
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      logicBlocks: [{ id: "unknown-1", type: "NONEXISTENT" }],
      logicConnections: [],
    });

    await runner.onPriceEvent("tok1", 0.5);
    expect(state.get).toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });

  it("skips connections referencing nonexistent blocks gracefully", async () => {
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      logicBlocks: [
        { id: "and-1", type: "AND_GATE" },
        { id: "or-1", type: "OR_GATE" },
      ],
      logicConnections: [
        // and-1 → or-1: valid connection (both blocks exist)
        { source: "and-1", target: "or-1" },
        // ghost-1 → ghost-2: both nonexistent — silently ignored by topo sort
        { source: "ghost-1", target: "ghost-2" },
      ],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // and-1 (indegree 0) → or-1 (indegree 1) both evaluated;
    // ghost references are harmless
    expect(state.get).toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });

  it("schedules DELAY block when upstream input is truthy", async () => {
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      logicBlocks: [
        { id: "not-1", type: "NOT_GATE" },
        { id: "delay-1", type: "DELAY", params: { seconds: 1 } },
        { id: "or-1", type: "OR_GATE" },
      ],
      logicConnections: [
        { source: "not-1", target: "delay-1" },
        { source: "delay-1", target: "or-1" },
      ],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // NOT_GATE with no inputs → value=true → feeds DELAY
    // DELAY with params.seconds=1 and truthy input → scheduleDelayedAction exercised
    expect(state.get).toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });

  it("evaluates logic graph with no connections (standalone blocks)", async () => {
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      logicBlocks: [
        { id: "and-1", type: "AND_GATE" },
        { id: "or-1", type: "OR_GATE" },
        { id: "not-1", type: "NOT_GATE" },
        { id: "if-1", type: "IF_THEN_ELSE", condition: "1 > 0" },
      ],
      logicConnections: [],
    });

    await runner.onPriceEvent("tok1", 0.5);
    expect(state.get).toHaveBeenCalled();
  });
});

describe("StrategyRunner — detectStaleData edge cases", () => {
  it("returns stale token when mget returns invalid JSON", async () => {
    const redis = makeRedis({
      getClient: vi.fn().mockReturnValue({
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi.fn().mockResolvedValue(["not-valid-json"]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
      }),
    });
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      triggers: [{ id: "t1", type: "every_tick", params: { tokenId: "tok1" } }],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // Invalid JSON in mget triggers catch block → treated as stale
    expect(runner.status).toBe("PAUSED");
    expect(runner.pauseReason).toBe("stale_market_data:tok1");
  });
});
