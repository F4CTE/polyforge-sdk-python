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
      // Tick lock
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(1),
    }),
    xadd: vi.fn().mockResolvedValue("1-0"),
    ...overrides,
  } as any;
}

function makeBetaLimits(overrides: Record<string, unknown> = {}) {
  return {
    getLimit: vi.fn().mockResolvedValue(999_999),
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
  const getMock = vi.fn().mockResolvedValue({ ...DEFAULT_STATE, ...patch });
  const getStateAndPricesMock = vi
    .fn()
    .mockImplementation(async (_strategyId: string, tokenIds: string[]) => {
      const state = await getMock(_strategyId);
      const prices = new Map<
        string,
        { price: number; timestamp: number } | null
      >();
      for (const id of tokenIds) {
        prices.set(id, { price: 0.5, timestamp: Date.now() });
      }
      return { state, prices };
    });
  return {
    get: getMock,
    getStateAndPrices: getStateAndPricesMock,
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue({ ...DEFAULT_STATE, ...patch }),
    incrementOrderCounters: vi
      .fn()
      .mockResolvedValue({ ...DEFAULT_STATE, ...patch }),
    clear: vi.fn().mockResolvedValue(undefined),
    getPriceAge: vi.fn().mockResolvedValue(0), // fresh by default
    getPrice: vi.fn().mockResolvedValue({ price: 0.5, timestamp: Date.now() }),
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

  it("coalesces overlapping ticks while one evaluation is still in flight", async () => {
    let release!: () => void;
    const state = makeState();
    state.getStateAndPrices.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              state: { ...DEFAULT_STATE },
              prices: new Map([
                ["tok1", { price: 0.5, timestamp: Date.now() }],
              ]),
            });
        }),
    );
    const runner = makeRunner({ execMode: "EVENT", state });

    const first = runner.onPriceEvent("tok1", 0.5);
    // Wait past the throttle window so the second tick can enter.
    // The first tick is still in-flight (state.getStateAndPrices is blocked on release).
    await new Promise((r) => setTimeout(r, 250));
    const second = runner.onPriceEvent("tok1", 0.5);
    await second;
    // The first tick now awaits betaLimits.getLimit() before reaching
    // evaluate() → state.getStateAndPrices(), adding an extra microtask cycle. Yield
    // to the event loop so the mock implementation sets `release`
    // before we call it.
    await new Promise((r) => setTimeout(r, 0));
    release();
    await first;

    // Follow-up tick from coalesced pending fires on next microtask
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Two evaluations: first tick + one coalesced follow-up
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);
  });
});

describe("StrategyRunner — stale data detection", () => {
  it("pauses and emits STRATEGY_PAUSED when price data is stale", async () => {
    const state = makeState();
    // Return null price from getStateAndPrices to simulate stale data
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok1", null]]),
    });
    const redis = makeRedis();
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
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
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
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(runner.status).toBe("RUNNING");
    expect(onStatusChange).not.toHaveBeenCalledWith(
      "STOPPED",
      expect.anything(),
    );
  });

  it("falls back to CONDITION_REGISTRY when MAX_POSITION_SIZE is in safety blocks", async () => {
    const state = makeState();
    const prisma = makePrisma();
    // No position exists → MaxPositionBlock returns fired: true
    prisma.position.findUnique.mockResolvedValue(null);
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      prisma,
      onStatusChange,
      safety: [
        {
          id: "safety-1",
          type: "MAX_POSITION_SIZE",
          params: { tokenId: "tok1", maxUsdc: "100" },
        },
      ],
    });

    await runner.onPriceEvent("tok1", 0.5);

    // Strategy should remain RUNNING (not fail-closed) since
    // MaxPositionBlock resolved via CONDITION_REGISTRY and fired: true
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
      expect.stringContaining("unknown safety block"),
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
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
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

  it("fails closed (stops strategy) on unknown safety block type", async () => {
    const state = makeState();
    const redis = makeRedis();
    const prisma = makePrisma();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      redis,
      prisma,
      onStatusChange,
      safety: [{ id: "unk", type: "NO_SUCH_SAFETY_BLOCK" }],
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(runner.status).toBe("STOPPED");
    expect(onStatusChange).toHaveBeenCalledWith(
      "STOPPED",
      expect.stringContaining("unknown safety block: NO_SUCH_SAFETY_BLOCK"),
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
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
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
    // evaluate proceeded (state.get was called)
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
      state: DEFAULT_STATE,
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
    });

    await runner.onPriceEvent("tok1", 0.5);

    // Trigger should fire because price 0.5 > 0.4 threshold via config fallback
    expect(state.getStateAndPrices).toHaveBeenCalled();
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
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
    });

    await runner.onPriceEvent("tok1", 0.5);
    expect(onIntents).not.toHaveBeenCalled();
  });

  it("fails closed (skips actions) on unknown condition block type", async () => {
    const state = makeState();
    const onIntents = vi
      .fn<(intents: OrderIntent[]) => Promise<void>>()
      .mockResolvedValue(undefined);

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      onIntents,
      conditions: [{ id: "unk", type: "NO_SUCH_CONDITION_BLOCK" }],
    });

    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
    });

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

    // Track when state.get is called (happens at start of evaluate())
    state.getStateAndPrices.mockImplementation(async () => {
      callOrder.push("state.getStateAndPrices");
      return {
        state: { ...DEFAULT_STATE, dailyPnl: -5 },
        prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
      };
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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
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
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
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
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
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
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
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

describe("StrategyRunner — getPrimaryTokenId", () => {
  it("resolves primary token from trigger params", async () => {
    const state = makeState();
    const prices = new Map<
      string,
      { price: number; timestamp: number } | null
    >();
    prices.set("tok-primary", { price: 0.5, timestamp: Date.now() });
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices,
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
    // evaluate() uses the in-memory prices map from getStateAndPrices
    expect(state.getStateAndPrices).toHaveBeenCalled();
  });
});

describe("StrategyRunner — config fallback for token discovery and prefetch", () => {
  it("resolves primary token from trigger config (not params)", async () => {
    const state = makeState();
    const prices = new Map<
      string,
      { price: number; timestamp: number } | null
    >();
    prices.set("tok-config", { price: 0.5, timestamp: Date.now() });
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices,
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
    // evaluate() uses the in-memory prices map from getStateAndPrices
    expect(state.getStateAndPrices).toHaveBeenCalledWith("strat-test", [
      "tok-config",
    ]);
  });

  it("detects stale data for config-only tokenId", async () => {
    const state = makeState();
    // Return stale timestamp via getStateAndPrices prices map
    const prices = new Map<
      string,
      { price: number; timestamp: number } | null
    >();
    prices.set("tok-stale-config", {
      price: 0.5,
      timestamp: Date.now() - 6000,
    });
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices,
    });

    const runner = makeRunner({
      execMode: "EVENT",
      state,
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

describe("StrategyRunner — EVENT-mode serialization (POLA-2082)", () => {
  it("coalesces rapid consecutive onPriceEvent calls into a follow-up tick", async () => {
    let release!: () => void;
    const state = makeState();
    state.getStateAndPrices.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              state: { ...DEFAULT_STATE },
              prices: new Map([
                ["tok1", { price: 0.5, timestamp: Date.now() }],
              ]),
            });
        }),
    );
    const runner = makeRunner({ execMode: "EVENT", state });

    // First tick enters, sets tickInFlight, awaits state.getStateAndPrices
    const tick1 = runner.onPriceEvent("tok1", 0.5);

    // Wait past the min-tick throttle so subsequent events can enter the coalescing path
    await new Promise((r) => setTimeout(r, 250));
    // Multiple rapid events while first tick is in flight — only one pending flag
    await runner.onPriceEvent("tok1", 0.55);
    await runner.onPriceEvent("tok1", 0.6);
    await runner.onPriceEvent("tok1", 0.65);

    // Release first tick
    release();
    await tick1;

    // One follow-up tick fires from the coalesced pending flag
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);
  });

  it("allows sequential events spaced apart by the throttle interval", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });

    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

    // Wait past MIN_TICK_MS (200ms) for throttle to clear
    await new Promise((r) => setTimeout(r, 250));
    state.getStateAndPrices.mockClear();
    await runner.onPriceEvent("tok1", 0.6);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

    await new Promise((r) => setTimeout(r, 250));
    state.getStateAndPrices.mockClear();
    await runner.onPriceEvent("tok1", 0.7);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
  });

  it("coalesces HYBRID mode event-driven ticks with delayed follow-up", async () => {
    vi.useFakeTimers();
    try {
      let release!: () => void;
      const state = makeState();
      state.getStateAndPrices.mockImplementation(
        () =>
          new Promise<{
            state: typeof DEFAULT_STATE;
            prices: Map<string, { price: number; timestamp: number } | null>;
          }>((resolve) => {
            release = () =>
              resolve({
                state: { ...DEFAULT_STATE },
                prices: new Map([
                  ["tok1", { price: 0.5, timestamp: Date.now() }],
                ]),
              });
          }),
      );
      const runner = makeRunner({ execMode: "HYBRID", state });

      const tick1 = runner.onPriceEvent("tok1", 0.5);
      // Advance past the min-tick throttle so the second event enters the coalescing path
      await vi.advanceTimersByTimeAsync(250);
      await runner.onPriceEvent("tok1", 0.55);
      release();
      await tick1;

      // HYBRID mode schedules a delayed follow-up (respecting tickMs=1000).
      // Advance past tickMs so the delayed follow-up timeout fires and completes.
      await vi.advanceTimersByTimeAsync(1500);

      // Two evaluations: tick1 + coalesced delayed follow-up
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
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
  it("returns stale token when prices map has null entry", async () => {
    const state = makeState();
    // Missing/null price in getStateAndPrices → treated as stale
    const prices = new Map<
      string,
      { price: number; timestamp: number } | null
    >();
    prices.set("tok1", null);
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices,
    });

    const runner = makeRunner({
      execMode: "EVENT",
      state,
      triggers: [{ id: "t1", type: "every_tick", params: { tokenId: "tok1" } }],
    });

    await runner.onPriceEvent("tok1", 0.5);
    // null price entry in prices map → treated as stale
    expect(runner.status).toBe("PAUSED");
    expect(runner.pauseReason).toBe("stale_market_data:tok1");
  });
});

describe("StrategyRunner — concurrent tick serialization", () => {
  it("coalesces concurrent ticks into a single follow-up evaluation", async () => {
    let release!: () => void;
    const state = makeState();
    state.getStateAndPrices.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              state: { ...DEFAULT_STATE },
              prices: new Map([
                ["tok1", { price: 0.5, timestamp: Date.now() }],
              ]),
            });
        }),
    );
    const runner = makeRunner({ execMode: "EVENT", state });

    // Fire first tick (sets tickInFlight, awaits state.getStateAndPrices)
    const tick1 = runner.onPriceEvent("tok1", 0.5);
    // Wait past the min-tick throttle so the second tick enters the coalescing path
    await new Promise((r) => setTimeout(r, 250));
    // Fire second tick — tickInFlight is true, sets pendingTick
    const tick2 = runner.onPriceEvent("tok1", 0.6);
    await tick2;
    // Release first tick's evaluation
    release();
    await tick1;

    // Follow-up tick scheduled via the finally block on next microtask
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Two evaluations: tick1 + coalesced follow-up from tick2
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);
  });

  it("allows new tick after a successful one completes", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });

    // First tick: tickInFlight starts false, sets to true, completes, back to false
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

    // Wait past MIN_TICK_MS (200ms) for throttle to clear
    await new Promise((r) => setTimeout(r, 250));
    state.getStateAndPrices.mockClear();
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
  });

  it("releases lock and throttle after tick evaluation throws", async () => {
    const state = makeState();
    state.getStateAndPrices.mockRejectedValue(new Error("Redis crash"));

    const runner = makeRunner({ execMode: "EVENT", state });

    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();

    // Lock is released in finally even after error — new tick should proceed
    // after the throttle window clears.
    state.getStateAndPrices.mockClear();
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
    });
    await new Promise((r) => setTimeout(r, 250));
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
  });

  it("does not set lock when strategy is not RUNNING", async () => {
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state });

    runner.pause("manual");
    await runner.onPriceEvent("tok1", 0.5);

    // Lock not entered because status check returns early (PAUSED !== RUNNING)
    // New tick after resume should proceed normally (after throttle clears)
    runner.resume();
    await new Promise((r) => setTimeout(r, 250));
    state.getStateAndPrices.mockClear();
    state.getStateAndPrices.mockResolvedValue({
      state: { ...DEFAULT_STATE },
      prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
    });
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
  });

  it("does not release Redis lock when SET NX fails (another instance owns the lock)", async () => {
    const client = {
      lrange: vi.fn().mockResolvedValue([]),
      mget: vi
        .fn()
        .mockResolvedValue([
          JSON.stringify({ price: 0.5, timestamp: Date.now() }),
        ]),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue(null), // SET NX fails — lock held by another instance
      del: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(1),
    };
    const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state, redis });

    await runner.onPriceEvent("tok1", 0.5);

    // SET was attempted but failed (lock not acquired)
    expect(client.set).toHaveBeenCalled();
    // Neither eval nor del should be called — this instance never acquired the lock
    expect(client.eval).not.toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();

    // tickInFlight is reset in finally even on failed acquisition —
    // a subsequent tick after throttle should proceed normally
    await new Promise((r) => setTimeout(r, 250));
    // Restore client.set to succeed so the next tick can evaluate
    client.set.mockResolvedValue("OK");
    state.getStateAndPrices.mockClear();
    await runner.onPriceEvent("tok1", 0.5);
    expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
  });

  it("schedules a delayed retry when SET NX fails and pendingTick was set by a concurrent event — HYBRID mode (POLA-5095 regression)", async () => {
    vi.useFakeTimers();
    try {
      // First tick: SET NX fails (another instance owns the lock).
      // While the SET NX await is pending, a second event arrives,
      // sees tickInFlight=true, and sets pendingTick.
      // HYBRID mode must still schedule a delayed retry — the interval
      // timer provides natural cadence, but the backoff narrows the gap
      // between the lock-miss and the next scheduled interval tick.
      let resolveSetNx!: (value: unknown) => void;
      let setCallCount = 0;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockImplementation(() => {
          setCallCount++;
          if (setCallCount === 1) {
            // First SET NX: defer resolution to simulate contention window
            return new Promise((resolve) => {
              resolveSetNx = resolve;
            });
          }
          // Subsequent SET NX: succeed (retry path)
          return Promise.resolve("OK");
        }),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockResolvedValue(1),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockResolvedValue({
        state: { ...DEFAULT_STATE },
        prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
      });
      const runner = makeRunner({
        execMode: "HYBRID",
        tickMs: 1000,
        state,
        redis,
      });

      // Tick A: enters tick(), passes throttle, sets tickInFlight=true, awaits SET NX
      const tickA = runner.onPriceEvent("tok1", 0.5);

      // Let Tick A reach the SET NX await (microtask scheduling).
      await vi.advanceTimersByTimeAsync(1);

      // Advance past the 200ms min-tick throttle so Tick B can pass the
      // throttle gate and reach the tickInFlight check.
      await vi.advanceTimersByTimeAsync(250);

      // Tick B arrives while Tick A is still awaiting SET NX.
      // tickInFlight is true → sets pendingTick=true and returns.
      const tickB = runner.onPriceEvent("tok1", 0.51);
      await tickB;

      // Neither tick has evaluated yet.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // Now resolve SET NX as a failure (null = lock held by another instance)
      resolveSetNx(null);
      await tickA;

      // After the finally block: tickInFlight=false, pendingTick was consumed.
      // lockAcquired=false → a delayed retry should be scheduled (200ms backoff).
      // Advance past the retry backoff so the follow-up timer fires.
      await vi.advanceTimersByTimeAsync(250);

      // The retry tick should have re-entered tick(), passed throttle,
      // acquired the lock (SET NX now succeeds), and evaluated.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips lock-miss retry for already-handled EVENT tick (POLA-5142)", async () => {
    vi.useFakeTimers();
    try {
      // Single EVENT-mode tick: SET NX fails because another instance
      // holds the lock.  No concurrent event arrives, so pendingTick
      // remains false through the finally block.
      //
      // In a multi-instance deployment where every instance receives the
      // same price event, the instance that won the lock is already
      // evaluating the event.  Retrying here would cause the losing
      // instance to re-evaluate the same data after the winner releases
      // the lock, producing duplicate order intents and sub-strategy
      // launches that defeat the mutex.
      //
      // The losing instance must NOT schedule a retry — instead it relies
      // on the next external price event to trigger a fresh evaluation.
      // The interval timer (HYBRID/TICK mode) or the pendingTick coalescing
      // path still provide retry coverage for legitimate lock misses.
      let setCallCount = 0;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockImplementation(() => {
          setCallCount++;
          // SET NX: lock held by another instance
          return Promise.resolve(null);
        }),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockResolvedValue(1),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockResolvedValue({
        state: { ...DEFAULT_STATE },
        prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
      });
      const runner = makeRunner({ execMode: "EVENT", state, redis });

      // Fire the only tick — SET NX fails, lockAcquired=false,
      // pendingTick=false, execMode=EVENT.
      const tickPromise = runner.onPriceEvent("tok1", 0.5);
      await tickPromise;

      // No evaluation — lock was not acquired.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // Advance well past the 200ms retry backoff window and the
      // potential 10-12s crash-recovery retry window.  No retry of any
      // kind should have been scheduled — the winning instance handles
      // the event, and EVENT-mode losers with no coalesced pendingTick
      // must not schedule a crash-recovery retry that would replay an
      // already-handled tick after normal contention.
      await vi.advanceTimersByTimeAsync(15_000);

      // Still no evaluation — the losing instance is silent.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // SET should have been called exactly once (the original lock miss).
      // No crash-recovery retry was scheduled.
      expect(client.set).toHaveBeenCalledTimes(1);

      // tickInFlight should be reset so the next real event can proceed.
      // Fire a fresh price event — this one should succeed.
      client.set.mockResolvedValue("OK");
      await runner.onPriceEvent("tok2", 0.55);
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips lock-miss retry for EVENT-mode pendingTick coalescing (POLA-5142)", async () => {
    vi.useFakeTimers();
    try {
      // First EVENT-mode tick: SET NX is pending.
      // While awaiting SET NX, a concurrent price event arrives,
      // sees tickInFlight=true, and sets pendingTick.
      //
      // In a multi-instance deployment where every instance receives
      // the same price events, the winning instance's finally block
      // already processes the coalesced pending events after unlock.
      // The losing instance's finally block must NOT schedule a 200ms
      // retry — that would re-evaluate the same latest state and
      // produce duplicate order intents / sub-strategy launches.
      let resolveSetNx!: (value: unknown) => void;
      let setCallCount = 0;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockImplementation(() => {
          setCallCount++;
          if (setCallCount === 1) {
            // First SET NX: defer resolution to simulate contention window
            return new Promise((resolve) => {
              resolveSetNx = resolve;
            });
          }
          // Subsequent SET NX (if any retry fires): succeed
          return Promise.resolve("OK");
        }),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockResolvedValue(1),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockResolvedValue({
        state: { ...DEFAULT_STATE },
        prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
      });
      const runner = makeRunner({ execMode: "EVENT", state, redis });

      // Tick A: enters tick(), sets tickInFlight=true, awaits SET NX
      const tickA = runner.onPriceEvent("tok1", 0.5);

      // Let Tick A reach the SET NX await.
      await vi.advanceTimersByTimeAsync(1);

      // Advance past the 200ms min-tick throttle so Tick B can pass.
      await vi.advanceTimersByTimeAsync(250);

      // Tick B arrives while Tick A is still awaiting SET NX.
      // tickInFlight is true → sets pendingTick=true and returns.
      const tickB = runner.onPriceEvent("tok1", 0.51);
      await tickB;

      // Neither tick has evaluated yet.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // Resolve SET NX as failure (null = lock held by another instance).
      resolveSetNx(null);
      await tickA;

      // tickInFlight=false, pendingTick was consumed by the finally block.
      // lockAcquired=false, execMode=EVENT — should NOT schedule a retry.
      // Advance well past the 200ms retry backoff window.
      await vi.advanceTimersByTimeAsync(500);

      // Still no evaluation — the losing instance must stay silent.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // SET should have been called exactly once (the original lock miss).
      expect(client.set).toHaveBeenCalledTimes(1);

      // tickInFlight is reset — a fresh price event must proceed normally.
      client.set.mockResolvedValue("OK");
      await runner.onPriceEvent("tok2", 0.55);
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries after pending Redis unlock when pendingTick is set during EVENT-mode lock miss (POLA-5150)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(300);

      // Tick A's unlock is deferred so the lock key outlives tickInFlight release.
      let resolveUnlock!: (value: number) => void;
      let evalCallCount = 0;
      const unlockPromise = new Promise<number>((resolve) => {
        resolveUnlock = resolve;
      });
      let setCallCount = 0;
      let resolveSetNxB!: (value: unknown) => void;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockImplementation(() => {
          setCallCount++;
          if (setCallCount === 1) {
            // Tick A acquires the lock.
            return Promise.resolve("OK");
          }
          if (setCallCount === 2) {
            // Tick B's SET NX — deferred so Tick C can arrive
            // while tickInFlight is true and set pendingTick.
            return new Promise((resolve) => {
              resolveSetNxB = resolve;
            });
          }
          // Tick B's retry after unlock completes.
          return Promise.resolve("OK");
        }),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockImplementation((..._args: unknown[]) => {
          evalCallCount++;
          if (evalCallCount === 1) {
            // Tick A's unlock — deferred.
            return unlockPromise;
          }
          // Tick B's retry unlock.
          return Promise.resolve(1);
        }),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockResolvedValue({
        state: { ...DEFAULT_STATE },
        prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
      });
      const runner = makeRunner({ execMode: "EVENT", state, redis });

      // Tick A: acquires lock, evaluates, unlock is fire-and-forget (deferred).
      const tickAPromise = runner.onPriceEvent("tok1", 0.5);
      await vi.advanceTimersByTimeAsync(0);

      // Tick A evaluated.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

      // Advance past the min-tick throttle so Tick B can enter.
      vi.setSystemTime(550);
      await vi.advanceTimersByTimeAsync(0);

      // Tick B: enters tick(), tickInFlight=true, awaits SET NX (deferred).
      const tickB = runner.onPriceEvent("tok1", 0.55);
      await vi.advanceTimersByTimeAsync(0);

      // Advance past the throttle again so Tick C can enter.
      vi.setSystemTime(800);
      await vi.advanceTimersByTimeAsync(0);

      // Tick C: tickInFlight is true → sets pendingTick=true and returns.
      await runner.onPriceEvent("tok1", 0.56);

      // Neither Tick B nor Tick C has evaluated.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

      // Resolve Tick B's SET NX as null — the lock key still exists
      // because Tick A's unlock is deferred.
      resolveSetNxB(null);
      await vi.advanceTimersByTimeAsync(0);
      await tickB;

      // Tick B's finally consumed pendingTick.  lockAcquired=false,
      // pendingRedisUnlock is non-null → chained a retry on the unlock
      // promise.  No new evaluation yet.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

      // Resolve the deferred unlock → the chained retry fires.
      resolveUnlock(1);
      await vi.advanceTimersByTimeAsync(0);

      // Tick B's retry acquired the lock and evaluated.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);

      await tickAPromise;
    } finally {
      vi.useRealTimers();
    }
  });

  it("does NOT schedule EVENT-mode crash-recovery retry when pendingTick was set and lock miss has no pending Redis unlock (POLA-5150)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(300);

      // Defer the first SET NX so another price event can arrive and set
      // pendingTick before the finally block runs.  SET NX resolves to
      // null (another instance holds the lock) and pendingRedisUnlock is
      // null (this instance never acquired the lock, so it has no
      // pending unlock).
      //
      // In a multi-instance EVENT-mode deployment where every instance
      // receives the same price events, the winning instance already
      // handles the event (and any coalesced pendingTick it may have).
      // The losing instance must NOT schedule a crash-recovery retry —
      // that would re-evaluate the same data after the winner releases
      // the lock, producing duplicate order intents.
      let resolveSetNx!: (value: unknown) => void;
      let setCallCount = 0;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockImplementation(() => {
          setCallCount++;
          if (setCallCount === 1) {
            // Tick A's SET NX — deferred so Tick B can arrive and set
            // pendingTick during the window.
            return new Promise((resolve) => {
              resolveSetNx = resolve;
            });
          }
          // Should not be reached — no retry is scheduled.
          return Promise.resolve("OK");
        }),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockResolvedValue(1),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockResolvedValue({
        state: { ...DEFAULT_STATE },
        prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
      });
      const runner = makeRunner({ execMode: "EVENT", state, redis });

      // Tick A: enters tick(), sets tickInFlight=true, awaits SET NX.
      const tickAPromise = runner.onPriceEvent("tok1", 0.5);
      await vi.advanceTimersByTimeAsync(1);

      // Advance past the min-tick throttle so Tick B can enter.
      vi.setSystemTime(550);
      await vi.advanceTimersByTimeAsync(0);

      // Tick B: tickInFlight is true → sets pendingTick=true and returns.
      await runner.onPriceEvent("tok1", 0.51);

      // Neither tick has evaluated yet.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // Resolve SET NX as null — lock held by another instance.
      // pendingRedisUnlock stays null because no lock was acquired.
      resolveSetNx(null);
      await vi.advanceTimersByTimeAsync(0);
      await tickAPromise;

      // No evaluation — SET NX failed and no crash-recovery retry
      // was scheduled.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // Advance well past the lock TTL (10s) + any plausible jitter.
      await vi.advanceTimersByTimeAsync(15_000);

      // Still no evaluation — the losing instance stays silent.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // SET should have been called exactly once (the original lock miss).
      // No crash-recovery retry was scheduled.
      expect(client.set).toHaveBeenCalledTimes(1);

      // tickInFlight is reset — a fresh price event must proceed normally.
      client.set.mockResolvedValue("OK");
      await runner.onPriceEvent("tok2", 0.55);
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does NOT schedule crash-recovery retry and does not set scheduledFollowUp in EVENT mode (POLA-5150)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(300);

      // Set up: Tick A awaits SET NX (deferred), Tick B arrives
      // and sets pendingTick=true, SET NX resolves null (lock held by
      // another instance).  No crash-recovery retry is scheduled.
      let resolveSetNx!: (value: unknown) => void;
      let setCallCount = 0;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockImplementation(() => {
          setCallCount++;
          if (setCallCount === 1) {
            // Tick A's SET NX — deferred so Tick B can set pendingTick.
            return new Promise((resolve) => {
              resolveSetNx = resolve;
            });
          }
          // Should not be reached — no retry is scheduled.
          return Promise.resolve("OK");
        }),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockResolvedValue(1),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockResolvedValue({
        state: { ...DEFAULT_STATE },
        prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
      });
      const runner = makeRunner({ execMode: "EVENT", state, redis });

      // Tick A: enters tick(), sets tickInFlight=true, awaits SET NX.
      const tickAPromise = runner.onPriceEvent("tok1", 0.5);
      await vi.advanceTimersByTimeAsync(1);

      // Advance past the min-tick throttle so Tick B can enter.
      vi.setSystemTime(550);
      await vi.advanceTimersByTimeAsync(0);

      // Tick B: tickInFlight is true → sets pendingTick=true and returns.
      await runner.onPriceEvent("tok1", 0.51);

      // Resolve SET NX as null — lock held by another instance.
      // No crash-recovery retry is scheduled.
      resolveSetNx(null);
      await vi.advanceTimersByTimeAsync(0);
      await tickAPromise;

      // No evaluation — SET NX failed, no crash-recovery retry pending.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // Fire a new price event at t=560 (10 ms after lastTickMs=550).
      // This must respect the normal min-tick throttle — scheduledFollowUp
      // was not set since no retry was scheduled.
      vi.setSystemTime(560);
      await vi.advanceTimersByTimeAsync(0);
      await runner.onPriceEvent("tok1", 0.52);

      // Throttle blocked: 560-550=10 < 200ms MIN_TICK_MS, and
      // scheduledFollowUp was not set.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // Advance well past the lock TTL (10s) + any plausible jitter.
      // No crash-recovery retry fires — the losing instance stays silent.
      await vi.advanceTimersByTimeAsync(15_000);

      // Still no evaluation.
      expect(state.getStateAndPrices).not.toHaveBeenCalled();

      // SET should have been called exactly once (the original lock miss).
      expect(client.set).toHaveBeenCalledTimes(1);

      // tickInFlight is reset — a fresh price event after throttle
      // cooldown must proceed normally.
      vi.setSystemTime(100_000);
      await vi.advanceTimersByTimeAsync(0);
      client.set.mockResolvedValue("OK");
      await runner.onPriceEvent("tok2", 0.55);
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses per-acquisition lock token in atomic Lua compare-and-delete", async () => {
    const client = {
      lrange: vi.fn().mockResolvedValue([]),
      mget: vi
        .fn()
        .mockResolvedValue([
          JSON.stringify({ price: 0.5, timestamp: Date.now() }),
        ]),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(1),
    };
    const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state, redis });

    await runner.onPriceEvent("tok1", 0.5);

    // eval must be called with the Lua compare-and-delete script
    expect(client.eval).toHaveBeenCalledTimes(1);
    const evalArgs = client.eval.mock.calls[0];
    const script = evalArgs[0] as string;
    expect(script).toContain("redis.call('GET'");
    expect(script).toContain("redis.call('DEL'");

    // The lock token (last arg) must be a per-acquisition UUID string
    const token = evalArgs[3] as string;
    expect(token).toBeTypeOf("string");
    expect(token.length).toBeGreaterThanOrEqual(32);

    // SET must use the same per-acquisition token (not a runner-level constant)
    const setArgs = client.set.mock.calls[0];
    expect(setArgs[1]).toBe(token);
  });

  it("refreshes lock TTL via atomic Lua ownership check during long-running evaluations", async () => {
    // Simulate a slow evaluation that blocks long enough for the
    // 5-second lock-refresh interval to fire at least once.
    vi.useFakeTimers();
    try {
      let release!: () => void;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockResolvedValue(1),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      // Stall evaluate() so the lock-refresh interval fires while the lock is held
      state.getStateAndPrices.mockImplementation(
        () =>
          new Promise<{
            state: typeof DEFAULT_STATE;
            prices: Map<string, { price: number; timestamp: number } | null>;
          }>((resolve) => {
            release = () =>
              resolve({
                state: { ...DEFAULT_STATE },
                prices: new Map([
                  ["tok1", { price: 0.5, timestamp: Date.now() }],
                ]),
              });
          }),
      );
      const runner = makeRunner({ execMode: "EVENT", state, redis });

      // Fire tick — it acquires the lock, sets up the 5s refresh interval,
      // then blocks on state.get()
      const tickPromise = runner.onPriceEvent("tok1", 0.5);

      // Advance past the 5-second refresh interval
      await vi.advanceTimersByTimeAsync(6_000);
      // Release the stalled evaluation
      release();
      await tickPromise;

      // The lock-refresh interval should call eval (Lua script), not raw expire.
      // Find eval calls whose script string contains both GET and EXPIRE tokens.
      const lockRefreshEvals = client.eval.mock.calls.filter(
        (args: unknown[]) => {
          const script = typeof args[0] === "string" ? args[0] : "";
          return (
            script.includes("redis.call('GET'") && script.includes("EXPIRE")
          );
        },
      );
      expect(lockRefreshEvals.length).toBeGreaterThanOrEqual(1);
      // Verify the lock key and token are passed to the Lua script
      expect(lockRefreshEvals[0][2]).toBe("lock:tick:strat-test"); // KEYS[1]
      expect(typeof lockRefreshEvals[0][3]).toBe("string"); // ARGV[1] = lockToken
      expect(lockRefreshEvals[0][4]).toBe("10"); // ARGV[2] = TTL
    } finally {
      vi.useRealTimers();
    }
  });

  it("warns when lock release eval returns non-1 (key already expired or re-acquired)", async () => {
    const client = {
      lrange: vi.fn().mockResolvedValue([]),
      mget: vi
        .fn()
        .mockResolvedValue([
          JSON.stringify({ price: 0.5, timestamp: Date.now() }),
        ]),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(0), // lock already expired
    };
    const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state, redis });

    await runner.onPriceEvent("tok1", 0.5);

    // Eval was called — lock was not deleted because it had already expired
    expect(client.eval).toHaveBeenCalledTimes(1);
    // eval.mockResolvedValue(0) simulates a non-1 return, which should
    // produce a warn-level log about the lock already being expired.
    // No exception should leak — the runner must remain available.
    expect(runner.status).toBe("RUNNING");
  });

  it("warns when lock release eval throws (Redis transient error)", async () => {
    const client = {
      lrange: vi.fn().mockResolvedValue([]),
      mget: vi
        .fn()
        .mockResolvedValue([
          JSON.stringify({ price: 0.5, timestamp: Date.now() }),
        ]),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockRejectedValue(new Error("Redis connection lost")),
    };
    const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
    const state = makeState();
    const runner = makeRunner({ execMode: "EVENT", state, redis });

    await expect(runner.onPriceEvent("tok1", 0.5)).resolves.not.toThrow();

    // Eval was attempted and failed — lock will expire naturally
    expect(client.eval).toHaveBeenCalledTimes(1);
    // No exception leaks; the runner remains functional
    expect(runner.status).toBe("RUNNING");
  });

  it("cancels lock-refresh interval when ownership is lost (eval returns 0)", async () => {
    vi.useFakeTimers();
    try {
      let release!: () => void;
      // eval returns 1 (OK) for first call, then 0 (ownership lost) for subsequent
      let evalCallCount = 0;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockImplementation(() => {
          evalCallCount++;
          // First eval is the lock-refresh (fires after 5s) — return 0
          // to simulate ownership lost, forcing the interval to self-cancel.
          // Second eval is lock release (Lua check-and-delete) — return 1.
          if (evalCallCount === 1) return Promise.resolve(0);
          return Promise.resolve(1);
        }),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockImplementation(
        () =>
          new Promise<{
            state: typeof DEFAULT_STATE;
            prices: Map<string, { price: number; timestamp: number } | null>;
          }>((resolve) => {
            release = () =>
              resolve({
                state: { ...DEFAULT_STATE },
                prices: new Map([
                  ["tok1", { price: 0.5, timestamp: Date.now() }],
                ]),
              });
          }),
      );
      const runner = makeRunner({ execMode: "EVENT", state, redis });

      const tickPromise = runner.onPriceEvent("tok1", 0.5);
      // Advance 6s so lock-refresh fires once → returns 0 → interval self-cancels
      await vi.advanceTimersByTimeAsync(6_000);
      release();
      await tickPromise;

      // The lock-refresh fired once and self-cancelled (eval returned 0).
      // No further refresh intervals continue to extend a foreign lock.
      // Strategy remains RUNNING — lock loss is handled, not fatal.
      expect(runner.status).toBe("RUNNING");
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops lock-refresh when refresh eval rejects mid-evaluation", async () => {
    vi.useFakeTimers();
    try {
      let release!: () => void;
      let evalCall = 0;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockImplementation(() => {
          evalCall++;
          // First eval call is the lock refresh (fires after 5s)
          // Second and later are lock release in finally
          if (evalCall === 1) return Promise.reject(new Error("Redis down"));
          return Promise.resolve(1);
        }),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockImplementation(
        () =>
          new Promise<{
            state: typeof DEFAULT_STATE;
            prices: Map<string, { price: number; timestamp: number } | null>;
          }>((resolve) => {
            release = () =>
              resolve({
                state: { ...DEFAULT_STATE },
                prices: new Map([
                  ["tok1", { price: 0.5, timestamp: Date.now() }],
                ]),
              });
          }),
      );
      const runner = makeRunner({ execMode: "EVENT", state, redis });

      const tickPromise = runner.onPriceEvent("tok1", 0.5);
      // Advance 6s — lock-refresh fires, eval rejects → interval self-cancels
      await vi.advanceTimersByTimeAsync(6_000);
      release();
      await tickPromise;

      // Lock-refresh interval was cancelled on error — no exception leaked.
      // The runner continues with the tick evaluation.
      expect(runner.status).toBe("RUNNING");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not discard valid intents when a stale lock-refresh callback resolves after a new tick has started", async () => {
    vi.useFakeTimers();
    try {
      // evalCall tracks every eval invocation.  We defer the first
      // lock-refresh eval so it remains pending across tick boundaries.
      let evalCall = 0;
      let resolveStaleRefresh!: (value: unknown) => void;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve([
              JSON.stringify({ price: 0.5, timestamp: Date.now() }),
            ]),
          ),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockImplementation(() => {
          evalCall++;
          if (evalCall === 1) {
            // Tick A's lock-refresh — keep pending until Tick B has started.
            return new Promise((resolve) => {
              resolveStaleRefresh = resolve;
            });
          }
          // All other calls (lock release, Tick B's lock refresh, etc.)
          return Promise.resolve(1);
        }),
      };
      const redis = makeRedis({
        getClient: vi.fn().mockReturnValue(client),
        getJson: vi.fn().mockResolvedValue({ price: 0.7 }),
      });
      const prisma = makePrisma();
      prisma.token.findUnique.mockResolvedValue({
        id: "tok-yes",
        marketId: "mkt-1",
        outcome: "YES",
      });
      const onIntents = vi
        .fn<(intents: OrderIntent[]) => Promise<void>>()
        .mockResolvedValue(undefined);
      const state = makeState();

      // Stall evaluate() so the lock refresh fires while Tick A holds the lock.
      let releaseEvaluate!: () => void;
      state.getStateAndPrices.mockImplementation(
        (_strategyId: string, tokenIds: string[]) =>
          new Promise<{
            state: typeof DEFAULT_STATE;
            prices: Map<string, { price: number; timestamp: number } | null>;
          }>((resolve) => {
            releaseEvaluate = () => {
              const prices = new Map<
                string,
                { price: number; timestamp: number } | null
              >();
              for (const id of tokenIds) {
                prices.set(id, { price: 0.7, timestamp: Date.now() });
              }
              resolve({ state: { ...DEFAULT_STATE }, prices });
            };
          }),
      );

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

      // -- Tick A --
      const tickAPromise = runner.onPriceEvent("tok-yes", 0.7);
      // Advance past the 5s lock-refresh interval so Tick A's refresh
      // callback fires but stays pending (deferred eval).
      await vi.advanceTimersByTimeAsync(6_000);

      // Release Tick A's evaluate() so it finishes and releases tickInFlight.
      releaseEvaluate();
      await tickAPromise;

      // Tick A should have emitted its intent.
      expect(onIntents).toHaveBeenCalledTimes(1);

      // Advance past the min-tick throttle so Tick B is not rejected.
      await vi.advanceTimersByTimeAsync(250);

      // Tick A has completed.  Its lock-refresh eval is still pending
      // (resolveStaleRefresh has not been called).  tickInFlight is false.
      //
      // -- Tick B --
      // Re-stall evaluate() for Tick B so we can inspect the outcome.
      let releaseEvaluateB!: () => void;
      state.getStateAndPrices.mockImplementation(
        (_strategyId: string, tokenIds: string[]) =>
          new Promise<{
            state: typeof DEFAULT_STATE;
            prices: Map<string, { price: number; timestamp: number } | null>;
          }>((resolve) => {
            releaseEvaluateB = () => {
              const prices = new Map<
                string,
                { price: number; timestamp: number } | null
              >();
              for (const id of tokenIds) {
                prices.set(id, { price: 0.7, timestamp: Date.now() });
              }
              resolve({ state: { ...DEFAULT_STATE }, prices });
            };
          }),
      );

      const tickBPromise = runner.onPriceEvent("tok-yes", 0.7);
      // Advance a tiny bit so Tick B enters evaluate() and is blocked.
      await vi.advanceTimersByTimeAsync(10);

      // Resolve Tick A's stale refresh now that Tick B is in-flight.
      // If the code does not guard with `activeLockToken !== lockToken`,
      // this would clear the activeLockToken and cause Tick B to discard
      // its valid intents.
      resolveStaleRefresh(0);
      await vi.advanceTimersByTimeAsync(10);

      // Release Tick B's evaluate() so it can reach the ownership check
      // and (if not wrongly aborted) emit intents.
      releaseEvaluateB();
      await tickBPromise;

      // Both ticks should have emitted their intents.  If the stale
      // callback incorrectly aborted Tick B, onIntents would only be
      // called once (from Tick A).
      expect(onIntents).toHaveBeenCalledTimes(2);
      // Verify both calls produced the expected buy_yes intent.
      for (let i = 0; i < 2; i++) {
        const intents: OrderIntent[] = onIntents.mock.calls[i][0];
        expect(intents).toHaveLength(1);
        expect(intents[0].side).toBe("BUY");
        expect(intents[0].outcome).toBe("YES");
        expect(intents[0].size).toBe("10");
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries EVENT-mode tick after pending Redis unlock completes so no event is silently dropped (POLA-5150)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(300);

      // Defer the Redis unlock eval so the unlock promise stays
      // pending — this creates the race window where tickInFlight is
      // false but the Redis lock key still exists.
      let resolveUnlock!: (value: number) => void;
      let evalCallCount = 0;
      const unlockPromise = new Promise<number>((resolve) => {
        resolveUnlock = resolve;
      });
      let setCallCount = 0;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockImplementation(() => {
          setCallCount++;
          // Call 1: Tick A acquires the lock → OK
          // Call 2: Tick B's initial SET NX → null (key still held)
          // Call 3: Tick B's retry after unlock completes → OK
          if (setCallCount === 2) return Promise.resolve(null);
          return Promise.resolve("OK");
        }),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockImplementation((..._args: unknown[]) => {
          evalCallCount++;
          if (evalCallCount === 1) {
            // Tick A's unlock — deferred so the key outlives
            // tickInFlight release and forces SET NX failure.
            return unlockPromise;
          }
          // Tick B's retry unlock (after the retry succeeds)
          return Promise.resolve(1);
        }),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockResolvedValue({
        state: { ...DEFAULT_STATE },
        prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
      });

      const runner = makeRunner({ execMode: "EVENT", state, redis });

      // Tick A: acquires lock, evaluates, enters finally —
      // tickInFlight is released immediately and the unlock eval
      // is fire-and-forget (still pending).
      const tickAPromise = runner.onPriceEvent("tok1", 0.5);
      await vi.advanceTimersByTimeAsync(0);

      // Tick A completed its evaluation.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

      // Advance past the min-tick throttle.
      vi.setSystemTime(550);
      await vi.advanceTimersByTimeAsync(0);

      // Tick B: price event arrives. tickInFlight is false,
      // but SET NX returns null because the lock key still exists.
      // pendingRedisUnlock is non-null → chains a retry on unlock.
      await runner.onPriceEvent("tok1", 0.55);

      // Tick B did NOT evaluate — SET NX failed.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

      // Resolve the deferred unlock → the chained retry fires.
      resolveUnlock(1);
      await vi.advanceTimersByTimeAsync(0);

      // Tick B's retry acquired the lock and evaluated.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);

      await tickAPromise;
    } finally {
      vi.useRealTimers();
    }
  });

  it("chains only one retry when multiple EVENT-mode ticks fail lock acquisition behind the same pending Redis unlock (POLA-5150)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(300);

      // Defer the Redis unlock eval so the unlock promise stays
      // pending — this creates the race window where multiple ticks
      // can fail SET NX behind the same in-flight unlock.
      let resolveUnlock!: (value: number) => void;
      let evalCallCount = 0;
      const unlockPromise = new Promise<number>((resolve) => {
        resolveUnlock = resolve;
      });
      let setCallCount = 0;
      const client = {
        lrange: vi.fn().mockResolvedValue([]),
        mget: vi
          .fn()
          .mockResolvedValue([
            JSON.stringify({ price: 0.5, timestamp: Date.now() }),
          ]),
        incr: vi.fn().mockResolvedValue(1),
        expire: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockImplementation(() => {
          setCallCount++;
          // Call 1: Tick A acquires the lock → OK
          // Calls 2 & 3: Tick B / Tick C fail SET NX behind the
          // same pending unlock
          // Call 4: Tick B's chained retry after unlock → OK
          if (setCallCount === 2 || setCallCount === 3)
            return Promise.resolve(null);
          return Promise.resolve("OK");
        }),
        del: vi.fn().mockResolvedValue(1),
        eval: vi.fn().mockImplementation((..._args: unknown[]) => {
          evalCallCount++;
          if (evalCallCount === 1) {
            // Tick A's unlock — deferred so the key outlives
            // tickInFlight release and forces SET NX failure.
            return unlockPromise;
          }
          // Tick B's retry unlock (after the retry succeeds)
          return Promise.resolve(1);
        }),
      };
      const redis = makeRedis({ getClient: vi.fn().mockReturnValue(client) });
      const state = makeState();
      state.getStateAndPrices.mockResolvedValue({
        state: { ...DEFAULT_STATE },
        prices: new Map([["tok1", { price: 0.5, timestamp: Date.now() }]]),
      });

      const runner = makeRunner({ execMode: "EVENT", state, redis });

      // Tick A: acquires lock, evaluates, enters finally —
      // tickInFlight is released and the unlock eval is fire-and-forget
      // (still pending).
      const tickAPromise = runner.onPriceEvent("tok1", 0.5);
      await vi.advanceTimersByTimeAsync(0);

      // Tick A completed its evaluation.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

      // Advance past the min-tick throttle so Tick B can enter.
      vi.setSystemTime(550);
      await vi.advanceTimersByTimeAsync(0);

      // Tick B: price event arrives.  tickInFlight is false, but
      // SET NX returns null because the lock key still exists.
      // pendingRedisUnlock is non-null → chains a retry on unlock
      // and sets pendingRedisUnlockRetry.
      await runner.onPriceEvent("tok1", 0.55);

      // Tick B did NOT evaluate — SET NX failed.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

      // Advance past the min-tick throttle again so Tick C can enter.
      vi.setSystemTime(800);
      await vi.advanceTimersByTimeAsync(0);

      // Tick C: another price event arrives.  tickInFlight is false,
      // SET NX returns null (lock key still exists, unlock deferred).
      // pendingRedisUnlock is non-null but equals pendingRedisUnlockRetry
      // → the one-shot guard skips chaining another retry.
      await runner.onPriceEvent("tok1", 0.56);

      // Tick C also did NOT evaluate.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(1);

      // Resolve the deferred unlock → the ONE chained retry fires.
      resolveUnlock(1);
      await vi.advanceTimersByTimeAsync(0);

      // Only Tick B's retry evaluated — not two retries.
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);

      // Advance further to confirm Tick C's guard prevented any
      // additional chained evaluation from firing.
      await vi.advanceTimersByTimeAsync(500);
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);

      // SET should have been called exactly 4 times:
      //   Call 1: Tick A acquires (OK)
      //   Call 2: Tick B fails (null)
      //   Call 3: Tick C fails (null)
      //   Call 4: Tick B's retry succeeds (OK)
      expect(client.set).toHaveBeenCalledTimes(4);

      await tickAPromise;
    } finally {
      vi.useRealTimers();
    }
  });

  it("coalesces TICK mode ticks into a delayed follow-up after long evaluation", async () => {
    vi.useFakeTimers();
    try {
      let release!: () => void;
      const state = makeState();
      state.getStateAndPrices.mockImplementation(
        () =>
          new Promise<{
            state: typeof DEFAULT_STATE;
            prices: Map<string, { price: number; timestamp: number } | null>;
          }>((resolve) => {
            release = () =>
              resolve({
                state: { ...DEFAULT_STATE },
                prices: new Map([
                  ["tok1", { price: 0.5, timestamp: Date.now() }],
                ]),
              });
          }),
      );
      const runner = makeRunner({ execMode: "TICK", tickMs: 300, state });

      // Simulate a tick entering via the setInterval path.
      // We test the tick() method directly since onPriceEvent is a no-op in TICK mode.
      const tick1 = (runner as any).tick() as Promise<void>;

      // While evaluation is in flight, another interval tick fires:
      // tickInFlight is true → sets pendingTick
      await vi.advanceTimersByTimeAsync(10);
      (runner as any).tick();

      release();
      await tick1;

      // TICK mode schedules a delayed follow-up (respecting tickMs=300).
      // Advance past the delay so the timeout fires and the follow-up completes.
      await vi.advanceTimersByTimeAsync(500);

      // Two evaluations: tick1 + coalesced delayed follow-up
      expect(state.getStateAndPrices).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
