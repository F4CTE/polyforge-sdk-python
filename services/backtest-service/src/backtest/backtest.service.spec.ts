import { describe, it, expect, vi, beforeEach } from "vitest";
import { BacktestService } from "./backtest.service";
import { MetricsService, FillRecord } from "./metrics.service";
import { createSimState, SimFill } from "./evaluator";
import { Prisma } from "@prisma/client";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Minimal Redis mock matching the shape used by BacktestService:
 *   - getClient().set() for progress keys
 *   - xadd() for event stream
 */
function makeRedisMock() {
  const innerClient = {
    xadd: vi.fn().mockResolvedValue("1-0"),
    set: vi.fn().mockResolvedValue("OK"),
  };
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    getJson: vi.fn().mockResolvedValue(null),
    xadd: vi.fn().mockResolvedValue("1-0"),
    getClient: vi.fn().mockReturnValue(innerClient),
  } as any;
}

/**
 * Minimal Prisma mock covering all methods called by BacktestService.
 */
function makePrismaMock() {
  return {
    backtestRun: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({
        userId: "user-1",
        strategyId: "strat-1",
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0), // 0 concurrent running jobs by default
    },
    strategy: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(null),
    },
    dataGap: {
      count: vi.fn().mockResolvedValue(0),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    backtestOrder: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  } as any;
}

function makeBetaLimitsMock() {
  return {
    getLimit: vi.fn().mockResolvedValue(3),
    getAllLimits: vi.fn().mockResolvedValue({
      maxActiveStrategies: 3,
      maxConcurrentBacktests: 3,
      maxBacktestHistoryDays: 90,
      maxMonthlyVolumeUsdc: 5000,
      maxPositionSizeUsdc: 500,
      marketDataRateLimitPerMinute: 100,
      maxMarketplaceListings: 2,
      maxDailyStrategyExecutions: 500,
    }),
    setLimits: vi.fn().mockResolvedValue(undefined),
  } as any;
}

const defaultBetaLimits = makeBetaLimitsMock();

function makeMetricsMock(
  overrides: Partial<ReturnType<MetricsService["compute"]>> = {},
) {
  return {
    compute: vi.fn().mockReturnValue({
      totalPnl: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      ...overrides,
    }),
  } as unknown as MetricsService;
}

// ─── Shared minimal run/strategy records ─────────────────────────────────────

const BASE_RUN = {
  id: "run-1",
  userId: "user-1",
  strategyId: "strat-1",
  dateRangeStart: new Date("2024-01-01"),
  dateRangeEnd: new Date("2024-01-31"),
};

const EMPTY_STRATEGY = {
  safety: [],
  triggers: [],
  conditions: [],
  actions: [],
};

// ─── extractTokenIds (tested indirectly via run()) ────────────────────────────

describe("BacktestService — extractTokenIds", () => {
  it("finalizes immediately with empty fills when no blocks have a tokenId", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue(EMPTY_STRATEGY);
    prisma.dataGap.count.mockResolvedValue(0);

    await svc.run("run-1");

    // No token → no price query → metrics.compute called with []
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(metrics.compute).toHaveBeenCalledWith([]);
  });

  it("queries price data once per unique tokenId", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue({
      ...EMPTY_STRATEGY,
      triggers: [{ type: "price_above", config: { tokenId: "tok-a" } }],
      actions: [
        { type: "buy_yes", config: { tokenId: "tok-a", size: "10" } }, // duplicate
        { type: "buy_yes", config: { tokenId: "tok-b", size: "10" } }, // distinct
      ],
    });
    prisma.dataGap.count.mockResolvedValue(0);
    prisma.$queryRaw.mockResolvedValue([]);

    await svc.run("run-1");

    // 2 unique tokens (tok-a, tok-b) → $queryRaw called twice
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("ignores blocks whose config.tokenId is absent or empty", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue({
      ...EMPTY_STRATEGY,
      triggers: [
        { type: "every_tick", config: {} }, // no tokenId
        { type: "price_above", config: { tokenId: " " } }, // whitespace-only
      ],
    });
    prisma.dataGap.count.mockResolvedValue(0);

    await svc.run("run-1");

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

// ─── applyFill position accounting (tested via private method cast) ───────────

describe("BacktestService — applyFill", () => {
  let svc: any;

  beforeEach(() => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits) as any;
  });

  it("BUY creates a new position with correct size and avgPrice", () => {
    const state = createSimState();
    const positions = new Map();
    const fill: SimFill = {
      side: "BUY",
      outcome: "YES",
      size: 10,
      price: 0.5,
      tokenId: "tok-a",
      type: "buy_yes",
    };

    const rec = svc.applyFill(fill, positions, state, 0, new Date());

    expect(positions.get("tok-a")).toEqual({ size: 10, avgPrice: 0.5 });
    expect(rec.side).toBe("BUY");
    expect(rec.pnl).toBe(0);
    expect(rec.equityCurve).toBe(0); // unchanged on buy
  });

  it("BUY increments betsToday and totalOrders", () => {
    const state = createSimState();
    const positions = new Map();
    const fill: SimFill = {
      side: "BUY",
      outcome: "YES",
      size: 5,
      price: 0.6,
      tokenId: "tok-a",
      type: "buy_yes",
    };

    svc.applyFill(fill, positions, state, 0, new Date());

    expect(state.betsToday).toBe(1);
    expect(state.totalOrders).toBe(1);
  });

  it("second BUY averages position cost correctly", () => {
    const state = createSimState();
    const positions = new Map();
    const simAt = new Date();

    // 20 shares @ 0.50
    svc.applyFill(
      {
        side: "BUY",
        outcome: "YES",
        size: 20,
        price: 0.5,
        tokenId: "tok-a",
        type: "buy_yes",
      },
      positions,
      state,
      0,
      simAt,
    );
    // 10 shares @ 0.80
    svc.applyFill(
      {
        side: "BUY",
        outcome: "YES",
        size: 10,
        price: 0.8,
        tokenId: "tok-a",
        type: "buy_yes",
      },
      positions,
      state,
      0,
      simAt,
    );

    const pos = positions.get("tok-a");
    expect(pos.size).toBeCloseTo(30, 6);
    // avgPrice = (20*0.5 + 10*0.8) / 30 = 18/30 = 0.6
    expect(pos.avgPrice).toBeCloseTo(0.6, 6);
  });

  it("BUY deletes an invalid zero-net position instead of storing Infinity avgPrice", () => {
    const state = createSimState();
    const positions = new Map([["tok-a", { size: -10, avgPrice: 0.5 }]]);

    svc.applyFill(
      {
        side: "BUY",
        outcome: "YES",
        size: 10,
        price: 0.5,
        tokenId: "tok-a",
        type: "buy_yes",
      },
      positions,
      state,
      0,
      new Date(),
    );

    expect(positions.has("tok-a")).toBe(false);
  });

  it("SELL computes realized PnL = (price - avgPrice) * size", () => {
    const state = createSimState();
    const positions = new Map([["tok-a", { size: 10, avgPrice: 0.5 }]]);

    const fill: SimFill = {
      side: "SELL",
      outcome: "YES",
      size: 10,
      price: 0.7,
      tokenId: "tok-a",
      type: "scale_out",
    };
    const rec = svc.applyFill(fill, positions, state, 0, new Date());

    // pnl = (0.7 - 0.5) * 10 = 2.0
    expect(rec.pnl).toBeCloseTo(2.0, 6);
    expect(rec.equityCurve).toBeCloseTo(2.0, 6);
  });

  it("SELL adds pnl to prevCumPnl to produce equityCurve", () => {
    const state = createSimState();
    const positions = new Map([["tok-a", { size: 10, avgPrice: 0.4 }]]);

    const fill: SimFill = {
      side: "SELL",
      outcome: "YES",
      size: 10,
      price: 0.6,
      tokenId: "tok-a",
      type: "scale_out",
    };
    const rec = svc.applyFill(fill, positions, state, 50, new Date());

    // pnl = (0.6-0.4)*10 = 2; equityCurve = 50 + 2 = 52
    expect(rec.equityCurve).toBeCloseTo(52, 6);
  });

  it("SELL removes position when remaining size ≤ 0.0001", () => {
    const state = createSimState();
    const positions = new Map([["tok-a", { size: 10, avgPrice: 0.5 }]]);

    svc.applyFill(
      {
        side: "SELL",
        outcome: "YES",
        size: 10,
        price: 0.7,
        tokenId: "tok-a",
        type: "scale_out",
      },
      positions,
      state,
      0,
      new Date(),
    );

    expect(positions.has("tok-a")).toBe(false);
  });

  it("SELL reduces position size when partially sold", () => {
    const state = createSimState();
    const positions = new Map([["tok-a", { size: 10, avgPrice: 0.5 }]]);

    svc.applyFill(
      {
        side: "SELL",
        outcome: "YES",
        size: 4,
        price: 0.7,
        tokenId: "tok-a",
        type: "scale_out",
      },
      positions,
      state,
      0,
      new Date(),
    );

    const pos = positions.get("tok-a")!;
    expect(pos.size).toBeCloseTo(6, 6);
    expect(pos.avgPrice).toBeCloseTo(0.5, 6); // avgPrice unchanged on partial sell
  });

  it("SELL with no existing position produces pnl=0 and unchanged equityCurve", () => {
    const state = createSimState();
    const positions = new Map(); // no position

    const fill: SimFill = {
      side: "SELL",
      outcome: "YES",
      size: 5,
      price: 0.7,
      tokenId: "tok-x",
      type: "scale_out",
    };
    const rec = svc.applyFill(fill, positions, state, 100, new Date());

    expect(rec.pnl).toBe(0);
    expect(rec.equityCurve).toBe(100);
  });

  it("losing SELL increments consecutiveLoss", () => {
    const state = createSimState();
    const positions = new Map([["tok-a", { size: 10, avgPrice: 0.8 }]]);

    svc.applyFill(
      {
        side: "SELL",
        outcome: "YES",
        size: 10,
        price: 0.5,
        tokenId: "tok-a",
        type: "scale_out",
      },
      positions,
      state,
      0,
      new Date(),
    );

    expect(state.consecutiveLoss).toBe(1);
  });

  it("winning SELL resets consecutiveLoss to 0", () => {
    const state = createSimState();
    state.consecutiveLoss = 3;
    const positions = new Map([["tok-a", { size: 10, avgPrice: 0.4 }]]);

    svc.applyFill(
      {
        side: "SELL",
        outcome: "YES",
        size: 10,
        price: 0.7,
        tokenId: "tok-a",
        type: "scale_out",
      },
      positions,
      state,
      0,
      new Date(),
    );

    expect(state.consecutiveLoss).toBe(0);
  });
});

// ─── finalize() ──────────────────────────────────────────────────────────────

describe("BacktestService — finalize()", () => {
  it("calls metrics.compute with all fill records", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock({
      totalPnl: 42,
      winRate: 0.75,
      maxDrawdown: 5,
      sharpeRatio: 1.2,
    });
    const svc = new BacktestService(
      prisma,
      redis,
      metrics,
      defaultBetaLimits,
    ) as any;

    const fills: FillRecord[] = [
      { side: "SELL", pnl: 10, equityCurve: 10, simulatedAt: new Date() },
      { side: "SELL", pnl: 32, equityCurve: 42, simulatedAt: new Date() },
    ];

    await svc.finalize("run-final", "user-1", fills, false);

    expect(metrics.compute).toHaveBeenCalledWith(fills);
  });

  it("updates DB run with COMPLETED status and computed metrics", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock({
      totalPnl: 42,
      winRate: 0.75,
      maxDrawdown: 5,
      sharpeRatio: 1.2,
    });
    const svc = new BacktestService(
      prisma,
      redis,
      metrics,
      defaultBetaLimits,
    ) as any;

    const fills: FillRecord[] = [
      { side: "SELL", pnl: 42, equityCurve: 42, simulatedAt: new Date() },
    ];

    await svc.finalize("run-final", "user-1", fills, false);

    expect(prisma.backtestRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-final" },
        data: expect.objectContaining({
          status: "COMPLETED",
          progress: 100,
          totalOrders: fills.length,
          filledOrders: fills.length,
          hasDataGaps: false,
        }),
      }),
    );
  });

  it("passes hasDataGaps=true when data gaps were found", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(
      prisma,
      redis,
      metrics,
      defaultBetaLimits,
    ) as any;

    await svc.finalize("run-gaps", "user-1", [], true);

    expect(prisma.backtestRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasDataGaps: true }),
      }),
    );
  });

  it("sets progress to 100 in Redis via getClient().set()", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(
      prisma,
      redis,
      metrics,
      defaultBetaLimits,
    ) as any;

    await svc.finalize("run-final", "user-1", [], false);

    expect(redis.getClient().set).toHaveBeenCalledWith(
      "backtest:run-final:progress",
      "100",
      "EX",
      3600,
    );
  });

  it("emits BACKTEST_PROGRESS event with progress=100 to stream:events", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(
      prisma,
      redis,
      metrics,
      defaultBetaLimits,
    ) as any;

    await svc.finalize("run-final", "user-1", [], false);

    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({
        type: "BACKTEST_PROGRESS",
        progress: "100",
        runId: "run-final",
      }),
    );
  });

  it("stores Decimal metrics with correct fixed precision", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock({
      totalPnl: 12.3456789,
      winRate: 0.6666,
      maxDrawdown: 3.141592,
      sharpeRatio: 1.23456,
    });
    const svc = new BacktestService(
      prisma,
      redis,
      metrics,
      defaultBetaLimits,
    ) as any;

    await svc.finalize("run-prec", "user-1", [], false);

    const callArg = prisma.backtestRun.update.mock.calls[0][0];
    // totalPnl: 6 decimal places
    expect(callArg.data.totalPnl).toBeInstanceOf(Prisma.Decimal);
    expect(callArg.data.totalPnl.toString()).toBe("12.345679");
    // winRate: 4 decimal places
    expect(callArg.data.winRate.toString()).toBe("0.6666");
  });

  it("totalOrders and filledOrders equal the number of fills passed", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(
      prisma,
      redis,
      metrics,
      defaultBetaLimits,
    ) as any;

    const fills: FillRecord[] = Array.from({ length: 5 }, (_, i) => ({
      side: "SELL" as const,
      pnl: i * 2,
      equityCurve: i * 2,
      simulatedAt: new Date(),
    }));

    await svc.finalize("run-count", "user-1", fills, false);

    const callArg = prisma.backtestRun.update.mock.calls[0][0];
    expect(callArg.data.totalOrders).toBe(5);
    expect(callArg.data.filledOrders).toBe(5);
  });
});

// ─── run() error handling ─────────────────────────────────────────────────────

describe("BacktestService — run() error handling", () => {
  it("marks run as FAILED when an unexpected error is thrown", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockRejectedValue(
      new Error("DB is down"),
    );

    await svc.run("run-fail");

    const failCall = prisma.backtestRun.update.mock.calls.find(
      (c: any[]) => c[0].data?.status === "FAILED",
    );
    expect(failCall).toBeDefined();
    expect(failCall![0].data.errorMessage).toBe("DB is down");
  });

  it("sets status to RUNNING before any processing", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    // Fail immediately after the first update to observe it
    prisma.backtestRun.findUniqueOrThrow.mockRejectedValue(new Error("stop"));

    await svc.run("run-init");

    const firstCall = prisma.backtestRun.update.mock.calls[0][0];
    expect(firstCall.data.status).toBe("RUNNING");
  });

  it('marks run FAILED with "Unknown error" when error has no message', async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockRejectedValue({});

    await svc.run("run-null-err");

    const failCall = prisma.backtestRun.update.mock.calls.find(
      (c: any[]) => c[0].data?.status === "FAILED",
    );
    expect(failCall).toBeDefined();
    expect(failCall![0].data.errorMessage).toBe("Unknown error");
  });

  it("finalizes with hasDataGaps=true when dataGap.count > 0 and no ticks exist", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue({
      ...EMPTY_STRATEGY,
      triggers: [{ type: "price_above", config: { tokenId: "tok-a" } }],
    });
    prisma.dataGap.count.mockResolvedValue(3);
    prisma.$queryRaw.mockResolvedValue([]); // no ticks → early finalize

    await svc.run("run-gaps");

    expect(prisma.backtestRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasDataGaps: true }),
      }),
    );
  });
});

// ─── TA trigger integration ────────────────────────────────────────────────────

describe("BacktestService — TA trigger integration", () => {
  it("fires ma_crossover trigger when priceHistory satisfies crossover condition", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue({
      safety: [],
      triggers: [
        {
          type: "ma_crossover",
          config: {
            tokenId: "tok-a",
            fastPeriod: 3,
            slowPeriod: 10,
            maType: "sma",
          },
        },
      ],
      conditions: [],
      actions: [{ type: "buy_yes", config: { tokenId: "tok-a", size: "10" } }],
    });
    prisma.dataGap.count.mockResolvedValue(0);

    // Build tick history: 10 flat bars at 0.5, then a spike to 0.9 on the 11th tick
    // causing fast SMA(3) > slow SMA(10) crossover
    const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
    const ticks = Array.from({ length: 11 }, (_, i) => ({
      time: new Date(baseTime + i * 60_000),
      tokenId: "tok-a",
      open: "0.5",
      high: i === 10 ? "0.91" : "0.51",
      low: i === 10 ? "0.89" : "0.49",
      close: i === 10 ? "0.9" : "0.5",
    }));

    prisma.$queryRaw.mockResolvedValue(ticks);

    await svc.run("run-ta");

    expect(prisma.backtestOrder.createMany).toHaveBeenCalled();
    // The last call should contain at least one order from the fired trigger
    const lastCreateCall =
      prisma.backtestOrder.createMany.mock.calls[
        prisma.backtestOrder.createMany.mock.calls.length - 1
      ][0];
    expect(lastCreateCall.data.length).toBeGreaterThanOrEqual(1);
  });

  it("does not fire ma_crossover when priceHistory is insufficient", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue({
      safety: [],
      triggers: [
        {
          type: "ma_crossover",
          config: {
            tokenId: "tok-a",
            fastPeriod: 5,
            slowPeriod: 20,
            maType: "sma",
          },
        },
      ],
      conditions: [],
      actions: [{ type: "buy_yes", config: { tokenId: "tok-a", size: "10" } }],
    });
    prisma.dataGap.count.mockResolvedValue(0);

    // Only 5 ticks — insufficient for slowPeriod 20 + 1
    const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
    const ticks = Array.from({ length: 5 }, (_, i) => ({
      time: new Date(baseTime + i * 60_000),
      tokenId: "tok-a",
      open: "0.5",
      high: "0.51",
      low: "0.49",
      close: "0.5",
    }));

    prisma.$queryRaw.mockResolvedValue(ticks);

    await svc.run("run-ta-insufficient");

    // No orders should be created since trigger never fires
    expect(prisma.backtestOrder.createMany).not.toHaveBeenCalled();
  });

  it("does not fire trigger for token A on a token B tick", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue({
      safety: [],
      triggers: [
        {
          type: "price_above",
          config: { tokenId: "tok-a", threshold: "0.7" },
        },
      ],
      conditions: [],
      actions: [{ type: "buy_yes", config: { tokenId: "tok-a", size: "10" } }],
    });
    prisma.dataGap.count.mockResolvedValue(0);

    // Tick 1: tok-a price 0.8 (above threshold) → trigger fires, buy executes
    // Tick 2: tok-b → tok-a trigger should NOT fire again (gated by tokenId)
    const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
    const ticks = [
      {
        time: new Date(baseTime),
        tokenId: "tok-a",
        open: "0.8",
        high: "0.81",
        low: "0.79",
        close: "0.8",
      },
      {
        time: new Date(baseTime + 60_000),
        tokenId: "tok-b",
        open: "0.5",
        high: "0.51",
        low: "0.49",
        close: "0.5",
      },
    ];

    prisma.$queryRaw.mockResolvedValue(ticks);

    await svc.run("run-gated");

    // Should only create orders once (on tok-a tick), NOT twice
    const orderCalls = prisma.backtestOrder.createMany.mock.calls;
    const totalOrders = orderCalls.reduce(
      (sum: number, call: any) => sum + call[0].data.length,
      0,
    );
    expect(totalOrders).toBe(1);
  });

  it("fires ma_crossover when fastPeriod > slowPeriod with correct lookback", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue({
      safety: [],
      triggers: [
        {
          type: "ma_crossover",
          config: {
            tokenId: "tok-a",
            fastPeriod: 20,
            slowPeriod: 10,
            maType: "sma",
          },
        },
      ],
      conditions: [],
      actions: [{ type: "buy_yes", config: { tokenId: "tok-a", size: "10" } }],
    });
    prisma.dataGap.count.mockResolvedValue(0);

    // 21 ticks with a price pattern that causes a crossover at tick 21.
    // The old computeMaxLookback used slowPeriod+1=11, capping history
    // below fastPeriod=20 and producing NaN MAs (trigger never fires).
    // With the fix, maxLookback=21, so history is large enough for the
    // fast SMA to compute and the crossover to fire.
    const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
    const ticks = Array.from({ length: 21 }, (_, i) => {
      const close =
        i < 10 ? "0.85" : i < 20 ? "0.9" : "0.4";
      return {
        time: new Date(baseTime + i * 60_000),
        tokenId: "tok-a",
        open: "0.5",
        high: "0.5",
        low: "0.5",
        close,
      };
    });

    prisma.$queryRaw.mockResolvedValue(ticks);

    await svc.run("run-ta-fast-gt-slow");

    // At least one order should be created from the trigger firing
    expect(prisma.backtestOrder.createMany).toHaveBeenCalled();
    const lastCreateCall =
      prisma.backtestOrder.createMany.mock.calls[
        prisma.backtestOrder.createMany.mock.calls.length - 1
      ][0];
    expect(lastCreateCall.data.length).toBeGreaterThanOrEqual(1);
  });

  it("fires every_tick on every tick regardless of configured tokenId", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue({
      safety: [],
      triggers: [
        { type: "every_tick", config: { tokenId: "tok-a" } },
      ],
      conditions: [],
      actions: [{ type: "buy_yes", config: { tokenId: "tok-b", size: "10" } }],
    });
    prisma.dataGap.count.mockResolvedValue(0);

    // Two ticks for tok-b — every_tick is configured with tokenId=tok-a
    // but should still fire because every_tick is exempt from token gating.
    const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
    const ticks = [
      {
        time: new Date(baseTime),
        tokenId: "tok-b",
        open: "0.5",
        high: "0.51",
        low: "0.49",
        close: "0.5",
      },
      {
        time: new Date(baseTime + 60_000),
        tokenId: "tok-b",
        open: "0.5",
        high: "0.51",
        low: "0.49",
        close: "0.5",
      },
    ];

    // extractTokenIds picks tok-a (trigger) then tok-b (action),
    // so fetchTicks queries tok-a first, then tok-b.
    prisma.$queryRaw
      .mockResolvedValueOnce([]) // tok-a query: no ticks for this token
      .mockResolvedValueOnce(ticks); // tok-b query: two ticks

    await svc.run("run-every-tick-gated");

    // Should execute buy_yes on both ticks
    const orderCalls = prisma.backtestOrder.createMany.mock.calls;
    const totalOrders = orderCalls.reduce(
      (sum: number, call: any) => sum + call[0].data.length,
      0,
    );
    expect(totalOrders).toBe(2);
  });

  it("completes correctly for non-TA strategies without accumulating priceHistory", async () => {
    const prisma = makePrismaMock();
    const redis = makeRedisMock();
    const metrics = makeMetricsMock();
    const svc = new BacktestService(prisma, redis, metrics, defaultBetaLimits);

    prisma.backtestRun.findUniqueOrThrow.mockResolvedValue(BASE_RUN);
    prisma.strategy.findUniqueOrThrow.mockResolvedValue({
      safety: [],
      triggers: [
        {
          type: "price_above",
          config: { tokenId: "tok-a", threshold: "0.5" },
        },
      ],
      conditions: [],
      actions: [{ type: "buy_yes", config: { tokenId: "tok-a", size: "10" } }],
    });
    prisma.dataGap.count.mockResolvedValue(0);

    // Many ticks — no TA triggers means priceHistory should *not* accumulate
    // boundlessly. If the fix regresses, this test balloons memory/time.
    const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
    const ticks = Array.from({ length: 200 }, (_, i) => ({
      time: new Date(baseTime + i * 60_000),
      tokenId: "tok-a",
      open: "0.8",
      high: "0.81",
      low: "0.79",
      close: "0.8",
    }));

    prisma.$queryRaw.mockResolvedValue(ticks);

    await svc.run("run-no-ta");

    // Every tick has price above threshold → one order per tick
    const orderCalls = prisma.backtestOrder.createMany.mock.calls;
    const totalOrders = orderCalls.reduce(
      (sum: number, call: any) => sum + call[0].data.length,
      0,
    );
    expect(totalOrders).toBe(200);
  });
});
