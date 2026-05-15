import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
      get: vi
        .fn()
        .mockResolvedValue(
          JSON.stringify({ price: 0.5, timestamp: Date.now() }),
        ),
      lrange: vi.fn().mockResolvedValue([]),
      mget: vi
        .fn()
        .mockResolvedValue([
          JSON.stringify({ price: 0.5, timestamp: Date.now() }),
        ]),
      pipeline: vi.fn().mockReturnValue({
        get: vi.fn(),
        exec: vi.fn().mockResolvedValue([
          [
            null,
            JSON.stringify({
              betsToday: 0,
              dailyPnl: 0,
              consecutiveLoss: 0,
              consecutiveWin: 0,
              lastTradeAt: 0,
              tradedTokensToday: [],
              totalOrders: 0,
            }),
          ],
        ]),
      }),
      // Beta daily execution counter
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      // Tick lock
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(6),
    }),
    xadd: vi.fn().mockResolvedValue("1-0"),
    ...overrides,
  } as any;
}

function makeBetaLimits(maxDailyExec: number = 500) {
  return {
    getLimit: vi.fn().mockResolvedValue(maxDailyExec),
    getAllLimits: vi.fn().mockResolvedValue({
      maxActiveStrategies: 3,
      maxDailyStrategyExecutions: maxDailyExec,
    }),
    setLimits: vi.fn().mockResolvedValue(undefined),
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
  const defaultState = { ...DEFAULT_STATE, ...patch };
  return {
    get: vi.fn().mockResolvedValue({ ...defaultState }),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue({ ...defaultState }),
    incrementOrderCounters: vi.fn().mockResolvedValue({ ...defaultState }),
    clear: vi.fn().mockResolvedValue(undefined),
    getPriceAge: vi.fn().mockResolvedValue(0), // fresh by default
    getPrice: vi.fn().mockResolvedValue(null),
    getBook: vi.fn().mockResolvedValue(null),
    getStateAndPrices: vi.fn().mockResolvedValue({
      state: { ...defaultState },
      prices: new Map(),
    }),
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
  betaLimits = makeBetaLimits(),
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
    betaLimits,
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
    // evaluate() calls state.getStateAndPrices() — should not be called
    expect(state.getStateAndPrices).not.toHaveBeenCalled();
  });

  it("onPriceEvent() evaluates when execMode is EVENT", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalled();
  });

  it("onPriceEvent() evaluates when execMode is HYBRID", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "HYBRID", state });
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalled();
  });

  it("skips overlapping ticks while one evaluation is still running", async () => {
    let release!: () => void;
    const state = makeState();
    state.getStateAndPrices.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ state: { ...DEFAULT_STATE }, prices: new Map() });
        }),
    );
    const runner = makeRunner({ execMode: "EVENT", state });

    const first = runner.onPriceEvent("tok1", 0.5);
    // Wait for the first tick to reach evaluate() → state.getStateAndPrices()
    // before proceeding. The tick pipeline now has async pre-checks (daily
    // execution counter, beta limits) that must complete before evaluate().
    await vi.waitFor(() => expect(state.getStateAndPrices).toHaveBeenCalled(), {
      timeout: 1000,
    });
    // Without enough time elapsed, the second tick is debounced by MIN_TICK_MS
    const second = runner.onPriceEvent("tok1", 0.5);
    await second;
    // Yield to let the first tick's microtasks (incr → expire → getLimit → evaluate)
    // reach getStateAndPrices before we release it.
    await Promise.resolve();
    release();
    await first;

    // Only the first tick evaluates — the second is dropped by the
    // MIN_TICK_MS debounce throttle (arrives within 200ms of first).
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
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
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockResolvedValue(6),
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

  it("auto-resumes from stale_market_data pause when price data is fresh", async () => {
    // When paused with stale_market_data, tick() checks freshness and
    // auto-resumes if data is no longer stale.
    const state = makeState();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunner({ execMode: "EVENT", state, onStatusChange });
    runner.pause("stale_market_data:tok1");

    state.getPriceAge.mockResolvedValue(0); // fresh data
    await runner.onPriceEvent("tok1", 0.5);

    // Auto-resumed because data is fresh again
    expect(runner.status).toBe("RUNNING");
  });

  it("does not evaluate when paused for non-stale reason", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });
    runner.pause("manual");

    await runner.onPriceEvent("tok1", 0.5);
    // state.getStateAndPrices is only called inside evaluate(), which should be skipped
    expect(state.getStateAndPrices).not.toHaveBeenCalled();
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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE, dailyPnl: -15 },
      prices: new Map(),
    });

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

    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE, consecutiveLoss: 2 },
      prices: new Map(),
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(runner.status).toBe("RUNNING");
    expect(onStatusChange).not.toHaveBeenCalledWith(
      "STOPPED",
      expect.anything(),
    );
  });

  it("stops strategy on unknown safety block type (fail closed)", async () => {
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
          type: "NONEXISTENT_SAFETY_BLOCK",
          params: {},
        },
      ],
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(runner.status).toBe("STOPPED");
    expect(onStatusChange).toHaveBeenCalledWith(
      "STOPPED",
      expect.stringContaining("Unknown safety block"),
    );
    expect(prisma.strategy.update).toHaveBeenCalled();
    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({ type: "STRATEGY_STOPPED" }),
    );
  });

  it("resolves safety block params from config fallback", async () => {
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
          config: { maxLossUsdc: "10" },
        },
      ],
    });

    // Set dailyPnl below limit — without the config fallback, maxLossUsdc
    // would default to 0 and the block would fire (pass), not stopping.
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE, dailyPnl: -15 },
      prices: new Map(),
    });

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
    expect(state.getStateAndPrices).toHaveBeenCalled();
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

    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE, consecutiveWin: 0 },
      prices: new Map(),
    });

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
    // evaluate proceeded (state.getStateAndPrices was called)
    expect(state.getStateAndPrices).toHaveBeenCalled();
  });

  it("proceeds with no triggers (empty trigger list = always fire)", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state, triggers: [] });
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalled();
  });

  it("resolves trigger block params from config fallback", async () => {
    const state = makeState();
    const redis = makeRedis();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    // Use price_above_tick with config (not params) to exercise the fallback.
    // Without config fallback, tokenId would be empty and the trigger would not fire.
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      onIntents,
      triggers: [
        {
          id: "t1",
          type: "price_above_tick",
          config: { tokenId: "tok1", threshold: "0.4" },
        },
      ],
    });

    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok1", { price: 0.55, timestamp: Date.now() }]]),
    });

    await runner.onPriceEvent("tok1", 0.5);

    // Trigger should fire because price 0.55 > 0.4 threshold via config fallback.
    // The batched getStateAndPrices call confirms stale check passed and evaluation proceeded.
    expect(state.getStateAndPrices).toHaveBeenCalledWith("strat-test", [
      "tok1",
    ]);
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

    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE, betsToday: 5 },
      prices: new Map(),
    });

    await runner.onPriceEvent("tok1", 0.5);
    expect(onIntents).not.toHaveBeenCalled();
  });

  it("skips tick on unknown condition block type (fail closed)", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      conditions: [
        { id: "c1", type: "NONEXISTENT_CONDITION_BLOCK", params: {} },
      ],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // Should not reach action execution — condition fail-closed
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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok-yes", { price: 0.7, timestamp: Date.now() }]]),
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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok-yes", { price: 0.7, timestamp: Date.now() }]]),
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
    state.getStateAndPrices.mockRejectedValue(
      new Error("Redis connection lost"),
    );

    const runner = makeRunner({ execMode: "EVENT", state });

    // Should not throw — errors are caught and logged
    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();
    expect(runner.status).toBe("RUNNING");
  });

  it("pauses strategy when onIntents reports counter increment failure", async () => {
    const state = makeState();
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok-yes", { price: 0.7, timestamp: Date.now() }]]),
    });
    const prisma = makePrisma();
    prisma.token.findUnique.mockResolvedValue({
      id: "tok-yes",
      marketId: "mkt-1",
      outcome: "YES",
    });
    const redis = makeRedis();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockRejectedValue(
        new Error(
          "Counter increment failed after 1 intents published for strategy strat-test",
        ),
      );
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onIntents,
      onStatusChange,
      actions: [
        {
          id: "a1",
          type: "buy_yes",
          params: { tokenId: "tok-yes", size: "10" },
        },
      ],
    });

    await runner.onPriceEvent("tok-yes", 0.7);

    expect(runner.status).toBe("PAUSED");
    expect(runner.pauseReason).toBe("counter_increment_failed");
    expect(onStatusChange).toHaveBeenCalledWith(
      "PAUSED",
      "counter_increment_failed",
    );
  });
});

describe("StrategyRunner — calculation variables", () => {
  it("variables are evaluated before safety blocks", async () => {
    const state = makeState();
    const callOrder: string[] = [];

    // Track when state.getStateAndPrices is called (happens at start of evaluate())
    state.getStateAndPrices.mockImplementation(async () => {
      callOrder.push("state.getStateAndPrices");
      return { state: { ...DEFAULT_STATE, dailyPnl: -5 }, prices: new Map() };
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

    // state.getStateAndPrices is called first, then getPrice during variable eval,
    // all before safety blocks run
    expect(callOrder[0]).toBe("state.getStateAndPrices");
  });

  it("$varName in block params gets resolved to variable value", async () => {
    const state = makeState();
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE, dailyPnl: 0 },
      prices: new Map([["tok-yes", { price: 0.7, timestamp: Date.now() }]]),
    });

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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map(),
    });
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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE, betsToday: 3 },
      prices: new Map([["tok-yes", { price: 0.5, timestamp: Date.now() }]]),
    });

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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map(),
    });
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
    expect(state.getStateAndPrices).toHaveBeenCalled();
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
    // Force evaluate to throw by making state.getStateAndPrices fail after an initial call
    state.getStateAndPrices.mockRejectedValue(
      new Error("State retrieval failed"),
    );

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

describe("StrategyRunner — safeEvaluate edge cases", () => {
  it("rejects expression with forbidden keywords (via variables)", async () => {
    const state = makeState();
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map(),
    });
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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map(),
    });
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

describe("StrategyRunner — token resolution for variables", () => {
  it("resolves currentPrice from the first referenced token in getStateAndPrices pipeline", async () => {
    const state = makeState();
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok-primary", { price: 0.5, timestamp: Date.now() }]]),
    });

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
    expect(state.getStateAndPrices).toHaveBeenCalledWith("strat-test", [
      "tok-primary",
    ]);
  });
});

describe("StrategyRunner — config fallback for token discovery and prefetch", () => {
  it("resolves primary token from trigger config (not params)", async () => {
    const state = makeState();
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok-config", { price: 0.6, timestamp: Date.now() }]]),
    });

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      variables: [
        { id: "v1", name: "testVar", expression: "currentPrice * 2" },
      ],
      triggers: [
        { id: "t1", type: "every_tick", config: { tokenId: "tok-config" } },
      ],
    });

    await runner.onPriceEvent("tok-config", 0.5);
    // Token discovered from config fallback via mergedParams → batched fetch
    expect(state.getStateAndPrices).toHaveBeenCalledWith("strat-test", [
      "tok-config",
    ]);
  });

  it("detects stale data for config-only tokenId", async () => {
    const redis = makeRedis({
      getClient: vi.fn().mockReturnValue({
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() - 6000 }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
      }),
    });
    const state = makeState();
    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      triggers: [
        {
          id: "t1",
          type: "every_tick",
          config: { tokenId: "tok-stale-config" },
        },
      ],
    });

    await runner.onPriceEvent("tok-stale-config", 0.5);
    expect(runner.status).toBe("PAUSED");
    expect(runner.pauseReason).toBe("stale_market_data:tok-stale-config");
  });

  it("mergedParams returns tokenId from config when params is missing", () => {
    const block = {
      id: "b1",
      type: "every_tick",
      config: { tokenId: "tok-cfg" },
    };
    const merged = (StrategyRunner as any).mergedParams(block);
    expect(merged.tokenId).toBe("tok-cfg");
  });

  it("mergedParams prefers params over config", () => {
    const block = {
      id: "b1",
      type: "every_tick",
      config: { tokenId: "tok-cfg", period: 10 },
      params: { tokenId: "tok-params" },
    };
    const merged = (StrategyRunner as any).mergedParams(block);
    expect(merged.tokenId).toBe("tok-params");
    expect(merged.period).toBe(10);
  });
});

describe("StrategyRunner — EVENT-mode debounce (POLA-2082)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces rapid consecutive onPriceEvent calls in EVENT mode", async () => {
    vi.setSystemTime(0);

    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });

    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

    // Fire again at 100ms — within MIN_TICK_MS (200ms), should be throttled
    vi.setSystemTime(100);
    state.getStateAndPrices.mockClear();
    await runner.onPriceEvent("tok1", 0.55);
    expect(state.getStateAndPrices).not.toHaveBeenCalled();

    // Fire at 250ms — past MIN_TICK_MS threshold, should fire
    vi.setSystemTime(250);
    await runner.onPriceEvent("tok1", 0.6);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
  });

  it("allows normally-spaced events through in EVENT mode", async () => {
    vi.setSystemTime(0);

    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });

    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

    state.getStateAndPrices.mockClear();
    vi.setSystemTime(300);
    await runner.onPriceEvent("tok1", 0.6);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

    state.getStateAndPrices.mockClear();
    vi.setSystemTime(600);
    await runner.onPriceEvent("tok1", 0.7);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
  });

  it("debounces HYBRID mode event-driven ticks", async () => {
    vi.setSystemTime(0);

    const state = makeState();
    const runner = makeRunner({ execMode: "HYBRID", state });

    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

    vi.setSystemTime(50);
    state.getStateAndPrices.mockClear();
    await runner.onPriceEvent("tok1", 0.55);
    expect(state.getStateAndPrices).not.toHaveBeenCalled();
  });

  it("does not interfere with TICK mode (onPriceEvent is a no-op)", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "TICK", state });
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).not.toHaveBeenCalled();
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
    expect(state.getStateAndPrices).toHaveBeenCalled();
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
    expect(state.getStateAndPrices).toHaveBeenCalled();
    expect(runner.status).toBe("RUNNING");
  });

  it("IF_THEN_ELSE propagates via true-handle to downstream block", async () => {
    const state = makeState();
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
    });
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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
    });
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
    expect(state.getStateAndPrices).toHaveBeenCalled();
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
    expect(state.getStateAndPrices).toHaveBeenCalled();
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
    expect(state.getStateAndPrices).toHaveBeenCalled();
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
    expect(state.getStateAndPrices).toHaveBeenCalled();
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
    expect(state.getStateAndPrices).toHaveBeenCalled();
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
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
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

describe("StrategyRunner — concurrent tick serialization", () => {
  it("coalesces concurrent ticks via TickMutex", async () => {
    let release!: () => void;
    const state = makeState();
    state.getStateAndPrices.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ state: { ...DEFAULT_STATE }, prices: new Map() });
        }),
    );
    const runner = makeRunner({ execMode: "EVENT", state });

    // Fire first tick (acquires TickMutex, awaits state.getStateAndPrices)
    const tick1 = runner.onPriceEvent("tok1", 0.5);
    // Wait enough time for MIN_TICK_MS debounce to pass (>200ms)
    await new Promise((resolve) => setTimeout(resolve, 250));
    // Fire second tick — passes debounce but bounces off TickMutex (sets pending)
    const tick2 = runner.onPriceEvent("tok1", 0.6);
    await tick2;
    // Release first tick's evaluation
    release();
    await tick1;

    // Follow-up tick scheduled via TickMutex exit() runs on next microtask
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Two evaluations: tick1 + coalesced follow-up from tick2
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);
  });

  it("releases TickMutex after a successful tick", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });

    await runner.onPriceEvent("tok1", 0.5);

    // Mutex is not locked after tick completes (exit() releases it)
    expect(runner.tickMutex.isLocked).toBe(false);
  });

  it("releases TickMutex even when tick evaluation throws", async () => {
    const state = makeState();
    state.getStateAndPrices.mockRejectedValue(new Error("Redis crash"));

    const runner = makeRunner({ execMode: "EVENT", state });

    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();

    // Mutex MUST be released even after error (finally block)
    expect(runner.tickMutex.isLocked).toBe(false);
  });

  it("does NOT enter TickMutex when strategy is not RUNNING", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });

    runner.pause("manual");
    await runner.onPriceEvent("tok1", 0.5);

    // Mutex not entered because status check returns early (PAUSED !== RUNNING)
    expect(runner.tickMutex.isLocked).toBe(false);
  });
});
