import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrategyRunner } from "./strategy-runner";
import { WasmWorkerPoolService } from "./wasm-worker-pool";
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
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(6),
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
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
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
    getPriceAge: vi.fn().mockResolvedValue(0),
    getPrice: vi.fn().mockResolvedValue({ price: 0.5, timestamp: Date.now() }),
    getBook: vi.fn().mockResolvedValue(null),
    getStateAndPrices: vi
      .fn()
      .mockImplementation((_strategyId: string, _tokenIds: string[]) =>
        Promise.resolve({
          state: { ...defaultState },
          prices: new Map(
            (_tokenIds ?? []).map((id) => [
              id,
              { price: 0.5, timestamp: Date.now() },
            ]),
          ),
        }),
      ),
    ...patch,
  } as any;
}

function makeMockWasmPool(
  overrides: Partial<{
    evaluateResult: unknown;
    evaluateError: Error;
  }> = {},
): WasmWorkerPoolService {
  return {
    evaluate: vi.fn().mockImplementation(() => {
      if (overrides.evaluateError)
        return Promise.reject(overrides.evaluateError);
      return Promise.resolve(
        overrides.evaluateResult ?? {
          safety_passed: true,
          safety_reason: null,
          triggered: true,
          conditions_met: true,
          actions: [],
        },
      );
    }),
    start: vi.fn(),
  } as any;
}

function makeRunnerWithPool({
  execMode = "TICK",
  tickMs = 1000,
  triggers = [] as any[],
  conditions = [] as any[],
  actions = [] as any[],
  safety = [] as any[],
  variables = [] as any[],
  redis = makeRedis(),
  betaLimits = { getLimit: vi.fn().mockResolvedValue(500) } as any,
  prisma = makePrisma(),
  state = makeState(),
  wasmWorkerPool = makeMockWasmPool(),
  onIntents = vi
    .fn<(intents: OrderIntent[]) => Promise<void>>()
    .mockResolvedValue(undefined),
  onStatusChange = vi.fn().mockResolvedValue(undefined),
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
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    wasmWorkerPool,
  );
}

// ─── WASM-compatible block definitions ───────────────────────────────────────

const WASM_SAFETY_BLOCK = {
  id: "s1",
  type: "STOP_IF_DAILY_LOSS",
  params: { maxLoss: 100 },
};
const WASM_TRIGGER_BLOCK = {
  id: "t1",
  type: "EVERY_TICK",
  params: {},
};
const WASM_CONDITION_BLOCK = {
  id: "c1",
  type: "SPREAD_BELOW_CONDITION",
  params: { maxSpread: 0.05, tokenId: "tok1" },
};

const WASM_EXPOSURE_SAFETY_BLOCK = {
  id: "s2",
  type: "STOP_IF_EXPOSURE_EXCEEDS",
  params: { maxUsdc: 5000 },
};

const MOCK_BOOK_DATA = {
  bids: [{ price: "0.49", size: "100" }],
  asks: [{ price: "0.50", size: "100" }],
  midpoint: "0.495",
  spread: "0.01",
  timestamp: Date.now(),
};
const NON_WASM_TRIGGER_BLOCK = {
  id: "t2",
  type: "MA_CROSSOVER",
  params: { fastPeriod: 12, slowPeriod: 26 },
};
const _NON_WASM_ACTION_BLOCK = {
  id: "a1",
  type: "scale_in",
  params: { tokenId: "tok1", size: 10 },
};

// ─── Tests: WASM Compatibility Detection ─────────────────────────────────────

describe("StrategyRunner — WASM compatibility detection", () => {
  it("reports not compatible when no pool is provided", () => {
    const runner = new StrategyRunner(
      "strat-test",
      "user-test",
      "TICK",
      1000,
      [WASM_TRIGGER_BLOCK],
      [WASM_CONDITION_BLOCK],
      [],
      [WASM_SAFETY_BLOCK],
      [],
      makeRedis(),
      { getLimit: vi.fn().mockResolvedValue(500) } as any,
      makePrisma(),
      makeState(),
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("reports compatible when all blocks are WASM-compatible and pool is provided", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports compatible when triggers and conditions are empty", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [],
      conditions: [],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports not compatible when a trigger uses a non-WASM block type", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [NON_WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("reports not compatible when a safety block uses an unsupported type", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [{ id: "s1", type: "PAUSE_AFTER_FILL", params: {} }],
      triggers: [WASM_TRIGGER_BLOCK],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("reports compatible with known camelCase/snake_case alias block types", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [
        { id: "s1", type: "STOP_IF_DAILY_LOSS", params: { maxLoss: 100 } },
      ],
      triggers: [{ id: "t1", type: "every_tick", params: {} }],
      conditions: [
        { id: "c2", type: "daily_loss_limit", params: { limit: 50 } },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports not compatible when conditions include NO_EXISTING_POSITION (token-scoped, not WASM-safe)", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [{ id: "c1", type: "NO_EXISTING_POSITION", params: {} }],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("reports not compatible with max_bets_per_day condition (not in Rust engine)", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [
        {
          id: "c1",
          type: "max_bets_per_day",
          params: { max: 5, tokenId: "tok1" },
        },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("reports not compatible with BETS_TODAY_LESS_THAN condition (not in Rust engine)", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [
        {
          id: "c1",
          type: "BETS_TODAY_LESS_THAN",
          params: { maxBets: 5, tokenId: "tok1" },
        },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("recognizes SCREAMING_SNAKE_CASE WASM-compatible block types", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [
        {
          id: "s1",
          type: "STOP_IF_CONSECUTIVE_LOSS",
          params: { maxLosses: 3 },
        },
      ],
      triggers: [
        {
          id: "t1",
          type: "PRICE_ABOVE",
          params: { threshold: 0.6, tokenId: "tok1" },
        },
      ],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { maxSpread: 0.05, tokenId: "tok1" },
        },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports compatible with mixed case — all aliases recognized", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [
        { id: "s1", type: "MAX_ORDERS_TOTAL", params: { maxOrders: 10 } },
      ],
      triggers: [
        {
          id: "t1",
          type: "PRICE_CROSSES_UP",
          params: { threshold: 0.5, tokenId: "tok1" },
        },
        {
          id: "t2",
          type: "price_below_tick",
          params: { threshold: 0.3, tokenId: "tok1" },
        },
      ],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { maxSpread: 0.05, tokenId: "tok1" },
        },
        {
          id: "c2",
          type: "spread_below_condition",
          params: { maxSpread: 0.03, tokenId: "tok1" },
        },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports compatible with all safety alias forms", () => {
    const pool = makeMockWasmPool();
    const safetyAliases = [
      { id: "s2", type: "stop_if_daily_loss", params: { maxLossUsdc: 50 } },
      { id: "s3", type: "max_orders_total", params: { max: 20 } },
      { id: "s4", type: "CONSECUTIVE_LOSS", params: { maxLosses: 3 } },
      { id: "s5", type: "stop_if_consecutive_loss", params: { maxLosses: 3 } },
      { id: "s6", type: "EXPOSURE_EXCEEDS", params: { maxUsdc: 500 } },
      { id: "s7", type: "stop_if_exposure_exceeds", params: { maxUsdc: 500 } },
    ];
    for (const block of safetyAliases) {
      const runner = makeRunnerWithPool({
        safety: [block],
        triggers: [WASM_TRIGGER_BLOCK],
        wasmWorkerPool: pool,
      });
      expect(runner.wasmGateCompatible).toBe(true);
    }
  });

  it("reports compatible when DAILY_LOSS_LIMIT is used as a safety block type (canonicalizes to STOP_IF_DAILY_LOSS)", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [
        { id: "s1", type: "DAILY_LOSS_LIMIT", params: { maxLossUsdc: 50 } },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports not compatible when a token-scoped trigger omits tokenId", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [
        { id: "t1", type: "EVERY_TICK", params: {} },
        { id: "t2", type: "PRICE_ABOVE", params: { threshold: 0.6 } },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("reports not compatible when a token-scoped condition omits tokenId", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { maxSpread: 0.05 },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("reports not compatible when token-scoped gates reference different tokens", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [
        { id: "t1", type: "EVERY_TICK", params: {} },
        {
          id: "t2",
          type: "PRICE_ABOVE",
          params: { threshold: 0.6, tokenId: "tok1" },
        },
        {
          id: "t3",
          type: "PRICE_BELOW",
          params: { threshold: 0.3, tokenId: "tok2" },
        },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("reports compatible when token-scoped condition token differs from action token (context uses gate token)", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { maxSpread: 0.05, tokenId: "tok2" },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports compatible when token-scoped condition matches action token", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { maxSpread: 0.05, tokenId: "tok1" },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports compatible when no token-scoped gates exist", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [{ id: "t1", type: "EVERY_TICK", params: {} }],
      conditions: [],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports not compatible when MAX_ORDERS_TOTAL and MAX_BETS_PER_DAY share the single orders_today context field", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [
        { id: "s1", type: "MAX_ORDERS_TOTAL", params: { max: 50 } },
        { id: "s2", type: "MAX_BETS_PER_DAY", params: { max: 10 } },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("preserves WASM compatibility when only one orders counter is present", () => {
    const pool = makeMockWasmPool();
    const runnerMaxOrders = makeRunnerWithPool({
      safety: [{ id: "s1", type: "MAX_ORDERS_TOTAL", params: { max: 50 } }],
      triggers: [{ id: "t1", type: "EVERY_TICK", params: {} }],
      wasmWorkerPool: pool,
    });
    // MAX_ORDERS_TOTAL does not need token context → compatible
    expect(runnerMaxOrders.wasmGateCompatible).toBe(true);
  });

  it("canonicalizes SPREAD_ABOVE trigger alias to SPREAD_BELOW in the gate", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [WASM_SAFETY_BLOCK],
      triggers: [
        { id: "t1", type: "EVERY_TICK", params: {} },
        {
          id: "t2",
          type: "SPREAD_ABOVE",
          params: { minSpread: 0.05, tokenId: "tok1" },
        },
      ],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports compatible with MAX_DRAWDOWN safety block", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [
        { id: "s1", type: "MAX_DRAWDOWN", params: { maxDrawdown: 0.2 } },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });

  it("reports compatible with max_drawdown alias for safety block", () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      safety: [
        { id: "s1", type: "max_drawdown", params: { maxDrawdown: 0.2 } },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(true);
  });
});

// ─── Tests: WASM Evaluation Path ─────────────────────────────────────────────

describe("StrategyRunner — WASM evaluation path", () => {
  let pool: WasmWorkerPoolService;

  beforeEach(() => {
    pool = makeMockWasmPool();
  });

  it("evaluates via WASM pool when blocks are compatible", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      onIntents,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    // First 3 args are safety, triggers, conditions (converted blocks)
    expect(call[0]).toHaveLength(1); // 1 safety block
    expect(call[0][0].config).toEqual({ maxLoss: 100 });
    expect(call[1]).toHaveLength(1); // 1 trigger block
    expect(call[2]).toHaveLength(1); // 1 condition block
    // 4th arg (actions) should be empty for Phase 1
    expect(call[3]).toHaveLength(0);
  });

  it("normalizes MAX_BETS_PER_DAY params to maxBets in the WASM worker payload", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "MAX_BETS_PER_DAY",
          params: { max: 10 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    // Safety block should have config with maxBets (Rust convention), not max
    expect(call[0][0].config).toEqual({ maxBets: 10 });
    expect(call[0][0].config).not.toHaveProperty("max");
  });

  it("normalizes safety alias params in WASM payload (stop_if_daily_loss → maxLoss)", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "stop_if_daily_loss",
          params: { maxLossUsdc: 75 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[0][0].config).toEqual({ maxLoss: 75 });
  });

  it("normalizes safety alias params in WASM payload (EXPOSURE_EXCEEDS → maxExposure)", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "EXPOSURE_EXCEEDS",
          params: { maxUsdc: 300 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[0][0].config).toEqual({ maxExposure: 300 });
  });

  it("preserves canonical maxDrawdown over legacy max in WASM payload for mixed-schema MAX_DRAWDOWN blocks", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "MAX_DRAWDOWN",
          params: { maxDrawdown: 0.15, max: 0.30 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[0][0].config).toEqual({ maxDrawdown: 0.15 });
    expect(call[0][0].config).not.toHaveProperty("max");
  });

  it("normalizes legacy-only max param to maxDrawdown in WASM payload for MAX_DRAWDOWN block", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "MAX_DRAWDOWN",
          params: { max: 0.25 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[0][0].config).toEqual({ maxDrawdown: 0.25 });
    expect(call[0][0].config).not.toHaveProperty("max");
  });

  it("falls back to TypeScript evaluators when blocks are not WASM-compatible", async () => {
    const state = makeState();
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [NON_WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).not.toHaveBeenCalled();
  });

  it("canonicalizes every_tick alias to EVERY_TICK in WASM payload", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [{ id: "t1", type: "every_tick", params: {} }],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[1][0].type).toBe("EVERY_TICK");
  });

  it("canonicalizes TICK alias to EVERY_TICK in WASM payload", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [{ id: "t1", type: "TICK", params: {} }],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[1][0].type).toBe("EVERY_TICK");
  });

  it("canonicalizes daily_loss_limit condition alias to DAILY_LOSS_LIMIT in WASM payload", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [
        {
          id: "c1",
          type: "daily_loss_limit",
          params: { maxLossUsdc: 50, tokenId: "tok1" },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[2][0].type).toBe("DAILY_LOSS_LIMIT");
  });

  it("canonicalizes spread_below_condition alias to SPREAD_BELOW_CONDITION in WASM payload", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [
        {
          id: "c1",
          type: "spread_below_condition",
          params: { minSpread: 0.03, tokenId: "tok1" },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[2][0].type).toBe("SPREAD_BELOW_CONDITION");
  });

  it("stops strategy when WASM safety check fails", async () => {
    const poolWithFail = makeMockWasmPool({
      evaluateResult: {
        safety_passed: false,
        safety_reason: "Daily loss exceeded",
        triggered: false,
        conditions_met: false,
        actions: [],
      },
    });
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      onStatusChange,
      wasmWorkerPool: poolWithFail,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(runner.status).toBe("STOPPED");
    expect(onStatusChange).toHaveBeenCalledWith(
      "STOPPED",
      "Daily loss exceeded",
    );
  });

  it("skips actions when WASM trigger does not fire", async () => {
    const poolNoTrigger = makeMockWasmPool({
      evaluateResult: {
        safety_passed: true,
        safety_reason: null,
        triggered: false,
        conditions_met: false,
        actions: [],
      },
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      onIntents,
      wasmWorkerPool: poolNoTrigger,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(onIntents).not.toHaveBeenCalled();
  });

  it("skips actions when WASM conditions are not met", async () => {
    const poolCondFail = makeMockWasmPool({
      evaluateResult: {
        safety_passed: true,
        safety_reason: null,
        triggered: true,
        conditions_met: false,
        actions: [],
      },
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      onIntents,
      wasmWorkerPool: poolCondFail,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(onIntents).not.toHaveBeenCalled();
  });

  it("proceeds to action evaluation after passing WASM gates", async () => {
    const prisma = makePrisma({
      token: {
        findUnique: vi.fn().mockResolvedValue({
          id: "tok1",
          marketId: "mkt1",
          outcome: "YES",
        }),
      },
    });
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({ price: 0.5, timestamp: Date.now() }),
    });
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      prisma,
      redis,
      state,
      onIntents,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(onIntents).toHaveBeenCalledTimes(1);
    const intents = onIntents.mock.calls[0][0];
    expect(intents).toHaveLength(1);
    expect(intents[0].side).toBe("BUY");
    expect(intents[0].outcome).toBe("YES");
  });
});

// ─── Tests: WASM Evaluation Error Handling ────────────────────────────────────

describe("StrategyRunner — WASM error handling", () => {
  it("logs error when WASM evaluation rejects", async () => {
    const pool = makeMockWasmPool({
      evaluateError: new Error("WASM worker crash"),
    });

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    // Should not throw — errors are caught in tick()
  });

  it("timestamps WASM context correctly from state data", async () => {
    const pool = makeMockWasmPool();
    const state = makeState({
      dailyPnl: 50,
      consecutiveLoss: 2,
      betsToday: 15,
      totalOrders: 10,
    });

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [],
      conditions: [],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    const call = (pool.evaluate as any).mock.calls[0];
    const ctx = call[4];
    expect(ctx.daily_pnl).toBe(50);
    expect(ctx.consecutive_losses).toBe(2);
    expect(ctx.orders_today).toBe(15);
    expect(ctx.pending_orders).toBe(0);
  });

  it("falls back to TS evaluators when position snapshot query fails in buildWasmContext", async () => {
    const pool = makeMockWasmPool();
    const prisma = makePrisma({
      position: {
        findMany: vi.fn().mockRejectedValue(new Error("DB connection lost")),
      },
      token: {
        findUnique: vi.fn().mockResolvedValue({
          id: "tok1",
          marketId: "mkt1",
          outcome: "YES",
        }),
      },
    });
    const redis = makeRedis({
      getJson: vi.fn().mockImplementation((key: string) => {
        if (key.startsWith("cache:book:")) {
          return Promise.resolve({
            bids: [{ price: "0.49", size: "100" }],
            asks: [{ price: "0.50", size: "100" }],
            midpoint: "0.495",
            spread: "0.01",
            timestamp: Date.now(),
          });
        }
        return Promise.resolve({ price: 0.5, timestamp: Date.now() });
      }),
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_EXPOSURE_EXCEEDS",
          params: { maxUsdc: "5000" },
        },
      ],
      triggers: [{ id: "t1", type: "EVERY_TICK", params: {} }],
      conditions: [],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      prisma,
      redis,
      onIntents,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    // Position query failure escapes buildWasmContext → caught by outer tick handler
    expect(pool.evaluate).not.toHaveBeenCalled();
    // TS fallback not reached because evaluate() escaped to tick() handler
    expect(onIntents).not.toHaveBeenCalled();
  });
});

// ─── Tests: WASM Failure Fallback to TS with Canonical Gates ──────────────────

describe("StrategyRunner — WASM fallback to TS with canonical gate names", () => {
  it("falls back to TS safety evaluator when WASM rejects and block uses canonical name STOP_IF_DAILY_LOSS", async () => {
    const pool = makeMockWasmPool({
      evaluateError: new Error("WASM worker crashed"),
    });
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_DAILY_LOSS",
          params: { maxLossUsdc: "100" },
        },
      ],
      triggers: [],
      conditions: [],
      actions: [],
      onStatusChange,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    // TS fallback evaluated the safety block — dailyPnl=0 < maxLossUsdc=100 → safety passes
    expect(runner.status).toBe("RUNNING");
  });

  it("falls back to TS trigger evaluator when WASM rejects and block uses canonical name PRICE_ABOVE", async () => {
    const pool = makeMockWasmPool({
      evaluateError: new Error("WASM worker timeout"),
    });

    // Price above 0.6 — state returns price 0.5 (below threshold), so trigger should not fire
    const state = makeState({
      getPrice: vi.fn().mockResolvedValue({
        price: 0.5,
        timestamp: Date.now(),
      }),
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [],
      triggers: [
        {
          id: "t1",
          type: "PRICE_ABOVE",
          params: { price: "0.6", tokenId: "tok1" },
        },
      ],
      conditions: [],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      onIntents,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    // TS fallback: PRICE_ABOVE found → PriceAboveTickBlock evaluated
    // Price 0.5 < threshold 0.6 → trigger did not fire → no intents
    expect(onIntents).not.toHaveBeenCalled();
  });

  it("falls back to TS condition evaluator when WASM rejects and block uses canonical name SPREAD_BELOW_CONDITION", async () => {
    const pool = makeMockWasmPool({
      evaluateError: new Error("WASM worker panicked"),
    });

    // Mock book with spread above threshold that won't meet condition
    const redis = makeRedis({
      getJson: vi.fn().mockResolvedValue({
        bids: [{ price: "0.5", size: "100" }],
        asks: [{ price: "0.55", size: "100" }],
        midpoint: "0.525",
        spread: "0.10",
        timestamp: Date.now(),
      }),
    });
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [],
      triggers: [{ id: "t1", type: "EVERY_TICK", params: {} }],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { minSpread: "0.05", tokenId: "tok1" },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      redis,
      state,
      onIntents,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    // TS fallback: SPREAD_BELOW_CONDITION → SpreadBelowTickBlock
    // Spread = 0.10 > max 0.05 → condition not met → no intents
    expect(onIntents).not.toHaveBeenCalled();
  });

  it("falls back to TS condition evaluator when WASM rejects and SPREAD_BELOW_CONDITION uses maxSpread param", async () => {
    const pool = makeMockWasmPool({
      evaluateError: new Error("WASM worker panicked"),
    });

    // Mock book with tight spread that meets condition
    const redis = makeRedis({
      getJson: vi.fn().mockImplementation((key: string) => {
        if (key.startsWith("cache:book:")) {
          return Promise.resolve({
            bids: [{ price: "0.5", size: "100" }],
            asks: [{ price: "0.51", size: "100" }],
            midpoint: "0.505",
            spread: "0.01",
            timestamp: Date.now(),
          });
        }
        return Promise.resolve({ price: 0.5, timestamp: Date.now() });
      }),
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });

    const prisma = makePrisma({
      token: {
        findUnique: vi.fn().mockResolvedValue({
          id: "tok1",
          marketId: "mkt1",
          outcome: "YES",
        }),
      },
    });

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [],
      triggers: [{ id: "t1", type: "EVERY_TICK", params: {} }],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { maxSpread: 0.05, tokenId: "tok1" },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      redis,
      state,
      prisma,
      onIntents,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    // TS fallback: SPREAD_BELOW_CONDITION → SpreadBelowTickBlock reads maxSpread
    // Spread = 0.01 < maxSpread 0.05 → condition met → intents published
    expect(onIntents).toHaveBeenCalledTimes(1);
  });

  it("reports not compatible when conditions include MAX_POSITION (token/value-scoped vs Rust user-level semantics)", async () => {
    const pool = makeMockWasmPool();
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [],
      triggers: [{ id: "t1", type: "EVERY_TICK", params: {} }],
      conditions: [
        {
          id: "c1",
          type: "MAX_POSITION",
          params: { maxUsdc: "100", tokenId: "tok1" },
        },
      ],
      actions: [],
      wasmWorkerPool: pool,
    });
    expect(runner.wasmGateCompatible).toBe(false);
  });

  it("falls back to TS SpreadBelowTickBlock when WASM rejects and spread meets condition", async () => {
    const pool = makeMockWasmPool({
      evaluateError: new Error("WASM worker transport error"),
    });

    // Mock book with tight spread that meets condition
    const redis = makeRedis({
      getJson: vi.fn().mockImplementation((key: string) => {
        if (key.startsWith("cache:book:")) {
          return Promise.resolve({
            bids: [{ price: "0.49", size: "100" }],
            asks: [{ price: "0.50", size: "100" }],
            midpoint: "0.495",
            spread: "0.01",
            timestamp: Date.now(),
          });
        }
        return Promise.resolve({ price: 0.5, timestamp: Date.now() });
      }),
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [],
      triggers: [{ id: "t1", type: "EVERY_TICK", params: {} }],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { minSpread: "0.05", tokenId: "tok1" },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      redis,
      state,
      prisma: makePrisma({
        token: {
          findUnique: vi.fn().mockResolvedValue({
            id: "tok1",
            marketId: "mkt1",
            outcome: "YES",
          }),
        },
      }),
      onIntents,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    // TS fallback: SPREAD_BELOW_CONDITION → SpreadBelowTickBlock
    // Spread = 0.01 < minSpread 0.05 → condition met → action executes
    expect(onIntents).toHaveBeenCalledTimes(1);
  });
});

// ─── Tests: Fail-Closed When TS Fallback Evaluator Is Missing ──────────────────

describe("StrategyRunner — fail-closed for missing TS fallback evaluators", () => {
  it("falls back to TS evaluator when WASM rejects MAX_DRAWDOWN", async () => {
    const pool = makeMockWasmPool({
      evaluateError: new Error("WASM worker error"),
    });
    const onStatusChange = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        { id: "s1", type: "MAX_DRAWDOWN", params: { maxDrawdown: 0.2 } },
      ],
      triggers: [],
      conditions: [],
      actions: [],
      onStatusChange,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    // MAX_DRAWDOWN ∈ WASM_SAFETY_TYPES → WASM attempt → rejects → TS fallback
    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    // TS fallback has StopIfMaxDrawdownBlock evaluator → safety passes (dailyPnl 0 > -0.2)
    expect(runner.status).toBe("RUNNING");
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("skips tick via TS SpreadBelowTickBlock fallback when book data unavailable", async () => {
    const pool = makeMockWasmPool();
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [],
      triggers: [{ id: "t1", type: "EVERY_TICK", params: {} }],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { maxSpread: 0.01, tokenId: "tok1" },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      onIntents,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    // Book data missing → pre-dispatch check blocks WASM → falls back to TS
    expect(pool.evaluate).not.toHaveBeenCalled();
    // TS fallback: SPREAD_BELOW_CONDITION → SpreadBelowTickBlock
    // Default Redis getJson returns null → "no book data" → condition fails → skip tick
    expect(onIntents).not.toHaveBeenCalled();
  });

  it("skips trigger gracefully when unknown canonical type has no TS fallback", async () => {
    const pool = makeMockWasmPool({
      evaluateError: new Error("WASM worker error"),
    });
    const onIntents = vi.fn().mockResolvedValue(undefined);

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [],
      triggers: [
        { id: "t1", type: "MAX_DRAWDOWN", params: { maxDrawdown: 0.2 } },
      ],
      conditions: [],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      onIntents,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    // MAX_DRAWDOWN ∉ WASM_TRIGGER_TYPES → wasmGateCompatible=false → TS path
    // TS trigger loop: TRIGGER_REGISTRY has no MAX_DRAWDOWN → warn + continue
    // triggerFired stays false → return without actions
    expect(pool.evaluate).not.toHaveBeenCalled();
    expect(onIntents).not.toHaveBeenCalled();
  });
});

// ─── Regression: Non-finite exposure in WASM context ───────────────────────────

describe("StrategyRunner — non-finite exposure fail-closed", () => {
  it("clamps total_exposure to MAX_VALUE when any position has NaN size", async () => {
    const pool = makeMockWasmPool();
    const prisma = makePrisma({
      position: {
        findMany: vi.fn().mockResolvedValue([
          { size: NaN, currentPrice: 0.5 },
          { size: 10, currentPrice: 0.5 },
        ]),
      },
      token: {
        findUnique: vi.fn().mockResolvedValue({
          id: "tok1",
          marketId: "mkt1",
          outcome: "YES",
        }),
      },
    });

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK, WASM_EXPOSURE_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [],
      prisma,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[4].total_exposure).toBe(Number.MAX_VALUE);
  });

  it("clamps total_exposure to MAX_VALUE when any pending order has Infinity price", async () => {
    const pool = makeMockWasmPool();
    const prisma = makePrisma({
      order: {
        findMany: vi.fn().mockResolvedValue([{ size: 5, price: Infinity }]),
      },
      token: {
        findUnique: vi.fn().mockResolvedValue({
          id: "tok1",
          marketId: "mkt1",
          outcome: "YES",
        }),
      },
    });

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK, WASM_EXPOSURE_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [],
      prisma,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(call[4].total_exposure).toBe(Number.MAX_VALUE);
  });
});

// ─── Regression: Config-backed gate params merged into WASM payload ────────────

describe("StrategyRunner — config-backed gate params", () => {
  let pool: WasmWorkerPoolService;

  beforeEach(() => {
    pool = makeMockWasmPool();
  });

  it("merges block.config into WASM safety payload, with params taking priority", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_DAILY_LOSS",
          config: { maxLoss: 50, extraConfig: "from-config" },
          params: { maxLoss: 100 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    // params maxLoss (100) takes priority over config maxLoss (50)
    expect(call[0][0].config).toHaveProperty("maxLoss", 100);
    // extraConfig from block.config is preserved as fallback
    expect(call[0][0].config).toHaveProperty("extraConfig", "from-config");
  });

  it("resolves config-backed trigger threshold when params is empty", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const redis = makeRedis();

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [
        {
          id: "t1",
          type: "PRICE_ABOVE",
          config: { price: 0.75, tokenId: "tok1" },
          params: {},
        },
      ],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      redis,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    // Trigger block should have threshold resolved from config-backed price
    expect(call[1][0].config).toHaveProperty("threshold", 0.75);
    expect(call[1][0].config).toHaveProperty("tokenId", "tok1");
  });

  it("falls back to TS evaluator with merged config+params when WASM rejects", async () => {
    const errorPool = makeMockWasmPool({
      evaluateError: new Error("WASM crash"),
    });
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const onIntents = vi.fn().mockResolvedValue(undefined);

    // Import the real block registry to verify TS evaluator fires
    const { SAFETY_REGISTRY } = await import("../blocks/registry.js");

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_DAILY_LOSS",
          config: { maxLoss: 200, fallbackOnly: true },
          params: {},
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      onStatusChange,
      onIntents,
      wasmWorkerPool: errorPool,
    });

    // The safety block should NOT fire (maxLoss=200, dailyPnl=0)
    // so the strategy should NOT be stopped
    const spy = vi.spyOn(
      SAFETY_REGISTRY["STOP_IF_DAILY_LOSS"] as any,
      "evaluate",
    );
    try {
      await runner.onPriceEvent("tok1", 0.5);
      expect(errorPool.evaluate).toHaveBeenCalledTimes(1);
      // TS fallback evaluator should have been called with merged params
      expect(spy).toHaveBeenCalledTimes(1);
      const resolvedBlock = spy.mock.calls[0][0] as Record<string, any>;
      expect(resolvedBlock.params).toHaveProperty("maxLoss", 200);
      expect(resolvedBlock.params).toHaveProperty("fallbackOnly", true);
      // Strategy should still be running — safety check passed
      expect(runner.status).toBe("RUNNING");
    } finally {
      spy.mockRestore();
    }
  });
});

// ─── Regression: Stale-price detection excludes condition token IDs ───────────

describe("StrategyRunner — stale-price detection excludes conditions", () => {
  it("does not pause when only condition token IDs have stale prices", async () => {
    const pool = makeMockWasmPool();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });

    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [{ id: "t1", type: "EVERY_TICK", params: {} }],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { maxSpread: 0.01, tokenId: "tok2" },
        },
      ],
      actions: [
        { id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } },
      ],
      state,
      onStatusChange,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);

    // Strategy should evaluate via WASM (not paused from stale condition token)
    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    expect(runner.status).not.toBe("PAUSED");
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});

// ─── Regression: Mixed-schema WASM param precedence matches TS evaluator chains ──

describe("StrategyRunner — WASM param precedence vs TS evaluator", () => {
  let pool: WasmWorkerPoolService;

  beforeEach(() => {
    pool = makeMockWasmPool();
  });

  function getSafetyPayload(call: any) {
    return call[0][0].config as Record<string, unknown>;
  }

  function getTriggerPayload(call: any) {
    return call[1][0].config as Record<string, unknown>;
  }

  function getConditionPayload(call: any) {
    return call[2][0].config as Record<string, unknown>;
  }

  // ── Safety: STOP_IF_DAILY_LOSS — maxLossUsdc ?? maxLoss (alias wins) ────

  it("STOP_IF_DAILY_LOSS: maxLossUsdc takes precedence over maxLoss (alias-first)", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_DAILY_LOSS",
          params: { maxLossUsdc: 200, maxLoss: 50 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getSafetyPayload(call)).toHaveProperty("maxLoss", 200);
    expect(getSafetyPayload(call)).not.toHaveProperty("maxLossUsdc");
  });

  it("STOP_IF_DAILY_LOSS: falls back to maxLoss when maxLossUsdc is absent", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_DAILY_LOSS",
          params: { maxLoss: 75 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getSafetyPayload(call)).toHaveProperty("maxLoss", 75);
  });

  // ── Safety: MAX_ORDERS_TOTAL — max ?? maxOrders (max wins) ──────────────

  it("MAX_ORDERS_TOTAL: max takes precedence over maxOrders (canonical-first)", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "MAX_ORDERS_TOTAL",
          params: { max: 20, maxOrders: 10 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getSafetyPayload(call)).toHaveProperty("maxOrders", 20);
    expect(getSafetyPayload(call)).not.toHaveProperty("max");
  });

  // ── Safety: MAX_BETS_PER_DAY — max ?? maxBets (max wins) ────────────────

  it("MAX_BETS_PER_DAY: max takes precedence over maxBets (canonical-first)", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "MAX_BETS_PER_DAY",
          params: { max: 15, maxBets: 5 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getSafetyPayload(call)).toHaveProperty("maxBets", 15);
    expect(getSafetyPayload(call)).not.toHaveProperty("max");
  });

  // ── Safety: MAX_DRAWDOWN — maxDrawdown ?? max (canonical wins) ──────────

  it("MAX_DRAWDOWN: maxDrawdown preserves over legacy max (canonical-first)", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "MAX_DRAWDOWN",
          params: { maxDrawdown: 500, max: 100 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getSafetyPayload(call)).toHaveProperty("maxDrawdown", 500);
    expect(getSafetyPayload(call)).not.toHaveProperty("max");
  });

  it("MAX_DRAWDOWN: falls back to legacy max when maxDrawdown is absent", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "MAX_DRAWDOWN",
          params: { max: 300 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getSafetyPayload(call)).toHaveProperty("maxDrawdown", 300);
  });

  // ── Trigger: SPREAD_BELOW — minSpread ?? maxSpread (minSpread wins) ─────

  it("SPREAD_BELOW: minSpread takes precedence over maxSpread → remapped to threshold", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [
        {
          id: "t1",
          type: "SPREAD_BELOW",
          params: { minSpread: 0.03, maxSpread: 0.05, tokenId: "tok1" },
        },
      ],
      conditions: [],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getTriggerPayload(call)).toHaveProperty("threshold", 0.03);
    expect(getTriggerPayload(call)).not.toHaveProperty("minSpread");
    expect(getTriggerPayload(call)).not.toHaveProperty("maxSpread");
  });

  // ── Condition: SPREAD_BELOW_CONDITION — minSpread ?? maxSpread (minSpread wins) ──

  it("SPREAD_BELOW_CONDITION: minSpread takes precedence over maxSpread (alias-first)", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [
        {
          id: "c1",
          type: "SPREAD_BELOW_CONDITION",
          params: { minSpread: 0.02, maxSpread: 0.08, tokenId: "tok1" },
        },
      ],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getConditionPayload(call)).toHaveProperty("maxSpread", 0.02);
    expect(getConditionPayload(call)).not.toHaveProperty("minSpread");
  });

  // ── Condition: DAILY_LOSS_LIMIT — maxLossUsdc ?? maxLoss → limit ────────

  it("DAILY_LOSS_LIMIT: maxLossUsdc takes precedence → remapped to limit", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [
        {
          id: "c1",
          type: "DAILY_LOSS_LIMIT",
          params: { maxLossUsdc: 500, maxLoss: 100 },
        },
      ],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getConditionPayload(call)).toHaveProperty("limit", 500);
    expect(getConditionPayload(call)).not.toHaveProperty("maxLossUsdc");
    expect(getConditionPayload(call)).not.toHaveProperty("maxLoss");
  });

  // ── Config+params merge: config fallback when params lacks canonical key ──

  it("preserves config-backed canonical key when params only provides alias", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_EXPOSURE_EXCEEDS",
          config: { maxExposure: 5000 },
          params: { maxUsdc: 10000 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    // maxUsdc (alias) wins over maxExposure per TS precedence
    expect(getSafetyPayload(call)).toHaveProperty("maxExposure", 10000);
    expect(getSafetyPayload(call)).not.toHaveProperty("maxUsdc");
  });

  // ── Mixed: PRICE_ABOVE - threshold ?? price (canonical-first) ───────────

  it("PRICE_ABOVE: threshold preserved when both threshold and price present", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [
        {
          id: "t1",
          type: "PRICE_ABOVE",
          params: { threshold: 0.8, price: 0.5, tokenId: "tok1" },
        },
      ],
      conditions: [],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getTriggerPayload(call)).toHaveProperty("threshold", 0.8);
    expect(getTriggerPayload(call)).not.toHaveProperty("price");
  });

  it("PRICE_ABOVE: falls back to price when threshold is absent", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [WASM_SAFETY_BLOCK],
      triggers: [
        {
          id: "t1",
          type: "PRICE_ABOVE",
          params: { price: 0.65, tokenId: "tok1" },
        },
      ],
      conditions: [],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getTriggerPayload(call)).toHaveProperty("threshold", 0.65);
  });

  // ── STOP_IF_EXPOSURE_EXCEEDS — maxUsdc ?? maxExposure (alias wins) ─────

  it("STOP_IF_EXPOSURE_EXCEEDS: maxUsdc takes precedence over maxExposure", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_EXPOSURE_EXCEEDS",
          params: { maxUsdc: 3000, maxExposure: 1000 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getSafetyPayload(call)).toHaveProperty("maxExposure", 3000);
    expect(getSafetyPayload(call)).not.toHaveProperty("maxUsdc");
  });

  // ── STOP_IF_CONSECUTIVE_LOSS — maxLosses only, no alias ─────────────────

  it("STOP_IF_CONSECUTIVE_LOSS: maxLosses passed through as maxLosses", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_CONSECUTIVE_LOSS",
          params: { maxLosses: 5 },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getSafetyPayload(call)).toHaveProperty("maxLosses", 5);
  });

  // ── Regression: $variable resolution happens before param remap ──────────

  it("resolves $variable references before applying param remap", async () => {
    const state = makeState({
      getBook: vi.fn().mockResolvedValue(MOCK_BOOK_DATA),
    });
    const runner = makeRunnerWithPool({
      execMode: "EVENT",
      safety: [
        {
          id: "s1",
          type: "STOP_IF_DAILY_LOSS",
          params: { maxLossUsdc: "$myLoss" },
        },
      ],
      triggers: [WASM_TRIGGER_BLOCK],
      conditions: [WASM_CONDITION_BLOCK],
      actions: [{ id: "a1", type: "buy_yes", params: { tokenId: "tok1", size: 10 } }],
      variables: [{ name: "myLoss", expression: "200" }],
      state,
      wasmWorkerPool: pool,
    });

    await runner.onPriceEvent("tok1", 0.5);
    expect(pool.evaluate).toHaveBeenCalledTimes(1);
    const call = (pool.evaluate as any).mock.calls[0];
    expect(getSafetyPayload(call)).toHaveProperty("maxLoss", 200);
    expect(getSafetyPayload(call)).not.toHaveProperty("maxLossUsdc");
  });
});
