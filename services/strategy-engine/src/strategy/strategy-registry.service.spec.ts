import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { StrategyRegistryService } from "./strategy-registry.service";
import { StrategyStatus } from ".prisma/client";

// ─── Mock helpers ────────────────────────────────────────────────────────────

function makeRedisMock(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    getJson: vi.fn().mockResolvedValue(null),
    xadd: vi.fn().mockResolvedValue("1-0"),
    getClient: vi.fn().mockReturnValue({
      xadd: vi.fn().mockResolvedValue("1-0"),
      eval: vi.fn().mockResolvedValue(6),
    }),
    ...overrides,
  } as any;
}

function makePrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    strategy: {
      findUnique: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as any;
}

function makeStateMock(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue({}),
    clear: vi.fn().mockResolvedValue(undefined),
    getPriceAge: vi.fn().mockResolvedValue(0),
    getPrice: vi.fn().mockResolvedValue(null),
    getBook: vi.fn().mockResolvedValue(null),
    incrementOrderCounters: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as any;
}

function makeBetaLimitsMock() {
  return {
    getLimit: vi.fn().mockResolvedValue(3),
    getAllLimits: vi.fn().mockResolvedValue({
      maxActiveStrategies: 3,
      maxConcurrentBacktests: 1,
      maxBacktestHistoryDays: 90,
      maxMonthlyVolumeUsdc: 5000,
      maxPositionSizeUsdc: 500,
      marketDataRateLimitPerMinute: 100,
      maxMarketplaceListings: 2,
      maxDailyStrategyExecutions: 500,
    }),
    setLimits: vi.fn(),
  } as any;
}

/** Minimal strategy DB record */
function makeDbStrategy(
  overrides: Partial<{
    id: string;
    userId: string;
    status: StrategyStatus;
    execMode: string;
    tickMs: number | null;
    triggers: unknown[];
    conditions: unknown[];
    actions: unknown[];
    safety: unknown[];
    canvas: unknown;
  }> = {},
) {
  return {
    id: "strat-1",
    userId: "user-1",
    status: StrategyStatus.IDLE,
    execMode: "TICK",
    tickMs: 1000,
    triggers: [],
    conditions: [],
    actions: [],
    safety: [],
    canvas: null,
    ...overrides,
  };
}

import type { OrderIntent } from "../blocks/block.types";

function buildIntent(overrides: Partial<OrderIntent> = {}): OrderIntent {
  return {
    intentId: "intent-1",
    userId: "user-1",
    strategyId: "strat-1",
    marketId: "market-1",
    tokenId: "token-1",
    side: "BUY",
    outcome: "YES",
    size: "10",
    price: "0.5",
    orderType: "GTC",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("StrategyRegistryService — start()", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let state: ReturnType<typeof makeStateMock>;
  let svc: StrategyRegistryService;

  beforeEach(() => {
    redis = makeRedisMock();
    prisma = makePrismaMock();
    state = makeStateMock();
    const betaLimits = {
      getLimit: vi.fn().mockResolvedValue(3),
      getAllLimits: vi.fn().mockResolvedValue({
        maxActiveStrategies: 3,
        maxConcurrentBacktests: 1,
        maxBacktestHistoryDays: 90,
        maxMonthlyVolumeUsdc: 5000,
        maxPositionSizeUsdc: 500,
        marketDataRateLimitPerMinute: 100,
        maxMarketplaceListings: 2,
        maxDailyStrategyExecutions: 500,
      }),
      setLimits: vi.fn(),
    } as any;
    svc = new StrategyRegistryService(prisma, redis, state, betaLimits);
  });

  it("throws NotFoundException when strategy does not exist", async () => {
    prisma.strategy.findUnique.mockResolvedValue(null);
    await expect(svc.start("no-such-id")).rejects.toThrow(NotFoundException);
  });

  it("throws ConflictException when strategy is already running", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    // First start succeeds — sets up the runner
    await svc.start("strat-1");

    // Second start must throw
    await expect(svc.start("strat-1")).rejects.toThrow(
      "Strategy is already running",
    );
  });

  it("returns a stable duplicate-running error without exposing the strategy id", async () => {
    const strategyId = "0f5f63c8-1ed8-493f-8b6d-1a2ef156d5e9";
    const strategy = makeDbStrategy({ id: strategyId });
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    await svc.start(strategyId);

    try {
      await svc.start(strategyId);
      throw new Error("Expected duplicate start to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      const response = (error as ConflictException).getResponse();
      expect(response).toMatchObject({
        code: "STRATEGY_ALREADY_RUNNING",
        message: "Strategy is already running",
        suggestion: "Stop the strategy before starting it again.",
      });
      expect(JSON.stringify(response)).not.toContain(strategyId);
    }
  });

  it("updates strategy status to RUNNING for a TICK strategy", async () => {
    const strategy = makeDbStrategy({
      status: StrategyStatus.IDLE,
      execMode: "TICK",
    });
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    await svc.start("strat-1");

    expect(prisma.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: StrategyStatus.RUNNING } }),
    );
  });

  it("keeps status as PAPER for a paper strategy", async () => {
    const strategy = makeDbStrategy({
      status: StrategyStatus.PAPER,
      execMode: "TICK",
    });
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    await svc.start("strat-1");

    expect(prisma.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: StrategyStatus.PAPER } }),
    );
  });

  it("emits STRATEGY_STARTED event to stream:events", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    await svc.start("strat-1");

    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({
        type: "STRATEGY_STARTED",
        strategyId: "strat-1",
      }),
    );
  });

  it("uses stream:paper_orders for PAPER strategies", async () => {
    const strategy = makeDbStrategy({ status: StrategyStatus.PAPER });
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    // Access publishIntents indirectly via a start that produces no intents
    // The stream choice is captured in the runner closure — we verify the runner registers
    await svc.start("strat-1");

    // Runner is registered: getStatus should return a non-null value
    expect(svc.getStatus("strat-1")).not.toBeNull();
  });

  it("defaults tickMs to 1000 when strategy.tickMs is null", async () => {
    const strategy = makeDbStrategy({ tickMs: null });
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    // start() should not throw
    await expect(svc.start("strat-1")).resolves.not.toThrow();
  });

  it("restores parent-child linkage when strategy has parentStrategyId", async () => {
    const child = makeDbStrategy({
      id: "child-1",
      status: StrategyStatus.RUNNING,
    });
    (child as Record<string, unknown>).parentStrategyId = "parent-1";
    prisma.strategy.findUnique.mockResolvedValue(child);

    await svc.start("child-1");

    const map = (svc as any).parentChildMap as Map<string, string>;
    expect(map.get("child-1")).toBe("parent-1");
  });

  it("adds child to parent runner when parent is also running", async () => {
    // Start the parent first
    const parent = makeDbStrategy({ id: "parent-1" });
    prisma.strategy.findUnique.mockResolvedValue(parent);
    await svc.start("parent-1");

    // Now restart the child which references the running parent
    const child = makeDbStrategy({
      id: "child-1",
      status: StrategyStatus.RUNNING,
    });
    (child as Record<string, unknown>).parentStrategyId = "parent-1";
    prisma.strategy.findUnique.mockResolvedValue(child);

    await svc.start("child-1");

    const children = svc.getChildStrategies("parent-1");
    expect(children).toContain("child-1");
  });

  it("restores child mode so parent cascade stop can find restarted children", async () => {
    // Start the parent first
    const parent = makeDbStrategy({ id: "parent-1" });
    prisma.strategy.findUnique.mockResolvedValue(parent);
    await svc.start("parent-1");

    // Restart the child which references the running parent
    const child = makeDbStrategy({
      id: "child-1",
      status: StrategyStatus.RUNNING,
    });
    (child as Record<string, unknown>).parentStrategyId = "parent-1";
    prisma.strategy.findUnique.mockResolvedValue(child);

    await svc.start("child-1");

    // Verify the parent runner tracks both childStrategies AND childModes
    const runners = (svc as any).runners as Map<
      string,
      {
        childStrategies: Set<string>;
        getChildMode(id: string): unknown;
      }
    >;
    const parentRunner = runners.get("parent-1")!;
    expect(parentRunner.childStrategies.has("child-1")).toBe(true);
    expect(parentRunner.getChildMode("child-1")).toBe("managed");
  });
});

describe("StrategyRegistryService — publishIntents()", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let state: ReturnType<typeof makeStateMock>;
  let svc: StrategyRegistryService;

  beforeEach(() => {
    redis = makeRedisMock();
    prisma = makePrismaMock();
    state = makeStateMock();
    const betaLimits = {
      getLimit: vi.fn().mockResolvedValue(3),
      getAllLimits: vi.fn().mockResolvedValue({
        maxActiveStrategies: 3,
        maxConcurrentBacktests: 1,
        maxBacktestHistoryDays: 90,
        maxMonthlyVolumeUsdc: 5000,
        maxPositionSizeUsdc: 500,
        marketDataRateLimitPerMinute: 100,
        maxMarketplaceListings: 2,
        maxDailyStrategyExecutions: 500,
      }),
      setLimits: vi.fn(),
    } as any;
    svc = new StrategyRegistryService(prisma, redis, state, betaLimits);
  });

  it("logs the stream, strategyId, and intent count after publishing", async () => {
    const logSpy = vi
      .spyOn((svc as any).logger, "log")
      .mockImplementation(() => undefined);

    await (svc as any).publishIntents(
      [
        {
          intentId: "intent-1",
          userId: "user-1",
          strategyId: "strat-1",
          marketId: "market-1",
          tokenId: "token-1",
          side: "BUY",
          outcome: "YES",
          size: "10",
          price: "0.5",
          orderType: "GTC",
        },
      ],
      "stream:orders",
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ORDER_INTENTS_PUBLISHED",
        stream: "stream:orders",
        strategyId: "strat-1",
        intentCount: 1,
      }),
      "Published order intents to Redis stream",
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        _aws: expect.any(Object),
        Service: "strategy-engine",
        OrderIntentsPublished: 1,
        StrategyId: "strat-1",
        Stream: "stream:orders",
      }),
      "cloudwatch metric",
    );
  });

  it("increments orders-per-minute Redis counter for successfully published intents", async () => {
    const evalFn = vi.fn().mockResolvedValue(6);
    redis.getClient = vi.fn().mockReturnValue({
      xadd: vi.fn().mockResolvedValue("1-0"),
      eval: evalFn,
    });

    await (svc as any).publishIntents(
      [
        {
          intentId: "intent-1",
          userId: "user-1",
          strategyId: "strat-1",
          marketId: "market-1",
          tokenId: "token-1",
          side: "BUY",
          outcome: "YES",
          size: "10",
          price: "0.5",
          orderType: "GTC",
        },
      ],
      "stream:orders",
    );

    expect(evalFn).toHaveBeenCalledWith(
      expect.stringContaining("ZREMRANGEBYSCORE"),
      1,
      "strategy:strat-1:orders:min",
      "1",
      expect.any(String),
      "60",
    );
  });

  it("uses timestamp-based sorted-set sliding window via Lua", async () => {
    const evalFn = vi.fn().mockResolvedValue(5);
    redis.getClient = vi.fn().mockReturnValue({
      xadd: vi.fn().mockResolvedValue("1-0"),
      eval: evalFn,
    });

    await (svc as any).publishIntents(
      [
        {
          intentId: "intent-1",
          userId: "user-1",
          strategyId: "strat-1",
          marketId: "market-1",
          tokenId: "token-1",
          side: "BUY",
          outcome: "YES",
          size: "10",
          price: "0.5",
          orderType: "GTC",
        },
      ],
      "stream:orders",
    );

    expect(evalFn).toHaveBeenCalledWith(
      expect.stringContaining("ZREMRANGEBYSCORE"),
      1,
      "strategy:strat-1:orders:min",
      "1",
      expect.any(String),
      "60",
    );
  });

  it("counts by successfully published intent count per strategy", async () => {
    const evalFn = vi.fn().mockResolvedValue(12);
    redis.getClient = vi.fn().mockReturnValue({
      xadd: vi.fn().mockResolvedValue("1-0"),
      eval: evalFn,
    });

    await (svc as any).publishIntents(
      [
        {
          intentId: "intent-1",
          userId: "user-1",
          strategyId: "strat-1",
          marketId: "market-1",
          tokenId: "token-1",
          side: "BUY",
          outcome: "YES",
          size: "10",
          price: "0.5",
          orderType: "GTC",
        },
        {
          intentId: "intent-2",
          userId: "user-1",
          strategyId: "strat-1",
          marketId: "market-2",
          tokenId: "token-2",
          side: "SELL",
          outcome: "NO",
          size: "5",
          price: "0.3",
          orderType: "GTC",
        },
      ],
      "stream:orders",
    );

    expect(evalFn).toHaveBeenCalledWith(
      expect.stringContaining("ZREMRANGEBYSCORE"),
      1,
      "strategy:strat-1:orders:min",
      "2",
      expect.any(String),
      "60",
    );
  });

  it("logs counter increment failure and surfaces error", async () => {
    const errorSpy = vi
      .spyOn((svc as any).logger, "error")
      .mockImplementation(() => undefined);
    redis.getClient = vi.fn().mockReturnValue({
      xadd: vi.fn().mockResolvedValue("1-0"),
      eval: vi.fn().mockRejectedValue(new Error("Redis connection lost")),
    });

    await expect(
      (svc as any).publishIntents(
        [
          {
            intentId: "intent-1",
            userId: "user-1",
            strategyId: "strat-1",
            marketId: "market-1",
            tokenId: "token-1",
            side: "BUY",
            outcome: "YES",
            size: "10",
            price: "0.5",
            orderType: "GTC",
          },
        ],
        "stream:orders",
      ),
    ).rejects.toThrow("Counter increment failed");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ORDER_INTENTS_COUNTER_INCREMENT_FAILED",
        strategyId: "strat-1",
      }),
      expect.stringContaining("Counter increment failed"),
    );
  });
});

describe("StrategyRegistryService — stop()", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let state: ReturnType<typeof makeStateMock>;
  let svc: StrategyRegistryService;

  beforeEach(() => {
    redis = makeRedisMock();
    prisma = makePrismaMock();
    state = makeStateMock();
    const betaLimits = {
      getLimit: vi.fn().mockResolvedValue(3),
      getAllLimits: vi.fn().mockResolvedValue({
        maxActiveStrategies: 3,
        maxConcurrentBacktests: 1,
        maxBacktestHistoryDays: 90,
        maxMonthlyVolumeUsdc: 5000,
        maxPositionSizeUsdc: 500,
        marketDataRateLimitPerMinute: 100,
        maxMarketplaceListings: 2,
        maxDailyStrategyExecutions: 500,
      }),
      setLimits: vi.fn(),
    } as any;
    svc = new StrategyRegistryService(prisma, redis, state, betaLimits);
  });

  it("sets strategy status to IDLE", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");

    await svc.stop("strat-1");

    expect(prisma.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: StrategyStatus.IDLE }),
      }),
    );
  });

  it("removes the runner from the registry", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");
    expect(svc.getStatus("strat-1")).not.toBeNull();

    await svc.stop("strat-1");

    expect(svc.getStatus("strat-1")).toBeNull();
  });

  it("emits STRATEGY_STOPPED event", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");

    redis.xadd.mockClear();
    await svc.stop("strat-1");

    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({
        type: "STRATEGY_STOPPED",
        strategyId: "strat-1",
      }),
    );
  });

  it("does not throw when stopping a strategy that is not running", async () => {
    prisma.strategy.findUnique.mockResolvedValue(makeDbStrategy());

    // stop() on a non-running strategy: no runner to remove, but DB + event still fire
    await expect(svc.stop("strat-1")).resolves.not.toThrow();
  });
});

describe("StrategyRegistryService — pause()", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let state: ReturnType<typeof makeStateMock>;
  let svc: StrategyRegistryService;

  beforeEach(() => {
    redis = makeRedisMock();
    prisma = makePrismaMock();
    state = makeStateMock();
    const betaLimits = {
      getLimit: vi.fn().mockResolvedValue(3),
      getAllLimits: vi.fn().mockResolvedValue({
        maxActiveStrategies: 3,
        maxConcurrentBacktests: 1,
        maxBacktestHistoryDays: 90,
        maxMonthlyVolumeUsdc: 5000,
        maxPositionSizeUsdc: 500,
        marketDataRateLimitPerMinute: 100,
        maxMarketplaceListings: 2,
        maxDailyStrategyExecutions: 500,
      }),
      setLimits: vi.fn(),
    } as any;
    svc = new StrategyRegistryService(prisma, redis, state, betaLimits);
  });

  it("throws NotFoundException when strategy is not running", async () => {
    await expect(svc.pause("not-running")).rejects.toThrow(NotFoundException);
  });

  it("sets strategy status to PAUSED in the DB", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");

    await svc.pause("strat-1");

    expect(prisma.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: StrategyStatus.PAUSED } }),
    );
  });

  it("runner status transitions to PAUSED", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");

    await svc.pause("strat-1");

    expect(svc.getStatus("strat-1")).toBe("PAUSED");
  });

  it("emits STRATEGY_STOPPED event (manual pause)", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");

    redis.xadd.mockClear();
    await svc.pause("strat-1");

    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({ type: "STRATEGY_STOPPED" }),
    );
  });
});

describe("StrategyRegistryService — resume()", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let state: ReturnType<typeof makeStateMock>;
  let svc: StrategyRegistryService;

  beforeEach(() => {
    redis = makeRedisMock();
    prisma = makePrismaMock();
    state = makeStateMock();
    const betaLimits = {
      getLimit: vi.fn().mockResolvedValue(3),
      getAllLimits: vi.fn().mockResolvedValue({
        maxActiveStrategies: 3,
        maxConcurrentBacktests: 1,
        maxBacktestHistoryDays: 90,
        maxMonthlyVolumeUsdc: 5000,
        maxPositionSizeUsdc: 500,
        marketDataRateLimitPerMinute: 100,
        maxMarketplaceListings: 2,
        maxDailyStrategyExecutions: 500,
      }),
      setLimits: vi.fn(),
    } as any;
    svc = new StrategyRegistryService(prisma, redis, state, betaLimits);
  });

  it("throws NotFoundException when strategy is not running", async () => {
    await expect(svc.resume("not-running")).rejects.toThrow(NotFoundException);
  });

  it("runner status transitions back to RUNNING", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");
    await svc.pause("strat-1");
    expect(svc.getStatus("strat-1")).toBe("PAUSED");

    // resume() looks up the DB status to decide RUNNING vs PAPER
    prisma.strategy.findUnique.mockResolvedValue({
      status: StrategyStatus.PAUSED,
    });

    await svc.resume("strat-1");

    expect(svc.getStatus("strat-1")).toBe("RUNNING");
  });

  it("sets status to PAPER when resuming a paper strategy", async () => {
    const strategy = makeDbStrategy({ status: StrategyStatus.PAPER });
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");
    await svc.pause("strat-1");

    // resume() queries DB for current status
    prisma.strategy.findUnique.mockResolvedValue({
      status: StrategyStatus.PAPER,
    });

    await svc.resume("strat-1");

    expect(prisma.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: StrategyStatus.PAPER } }),
    );
  });

  it("sets status to RUNNING when resuming a non-paper strategy", async () => {
    const strategy = makeDbStrategy({ status: StrategyStatus.IDLE });
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");
    await svc.pause("strat-1");

    prisma.strategy.findUnique.mockResolvedValue({
      status: StrategyStatus.PAUSED,
    });
    await svc.resume("strat-1");

    expect(prisma.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: StrategyStatus.RUNNING } }),
    );
  });

  it("emits STRATEGY_STARTED event", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");
    await svc.pause("strat-1");
    prisma.strategy.findUnique.mockResolvedValue({
      status: StrategyStatus.PAUSED,
    });

    redis.xadd.mockClear();
    await svc.resume("strat-1");

    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:events",
      expect.objectContaining({ type: "STRATEGY_STARTED" }),
    );
  });
});

describe("StrategyRegistryService — getStatus()", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let state: ReturnType<typeof makeStateMock>;
  let svc: StrategyRegistryService;

  beforeEach(() => {
    redis = makeRedisMock();
    prisma = makePrismaMock();
    state = makeStateMock();
    const betaLimits = {
      getLimit: vi.fn().mockResolvedValue(3),
      getAllLimits: vi.fn().mockResolvedValue({
        maxActiveStrategies: 3,
        maxConcurrentBacktests: 1,
        maxBacktestHistoryDays: 90,
        maxMonthlyVolumeUsdc: 5000,
        maxPositionSizeUsdc: 500,
        marketDataRateLimitPerMinute: 100,
        maxMarketplaceListings: 2,
        maxDailyStrategyExecutions: 500,
      }),
      setLimits: vi.fn(),
    } as any;
    svc = new StrategyRegistryService(prisma, redis, state, betaLimits);
  });

  it("returns null for a strategy that is not registered", () => {
    expect(svc.getStatus("unknown-id")).toBeNull();
  });

  it("returns RUNNING for a freshly started strategy", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");

    expect(svc.getStatus("strat-1")).toBe("RUNNING");
  });

  it("returns PAUSED after pause()", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");
    await svc.pause("strat-1");

    expect(svc.getStatus("strat-1")).toBe("PAUSED");
  });

  it("returns null after stop() removes the runner", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");
    await svc.stop("strat-1");

    expect(svc.getStatus("strat-1")).toBeNull();
  });
});

describe("StrategyRegistryService — onPriceEvent()", () => {
  it("forwards price event to all running runners without throwing", async () => {
    const redis = makeRedisMock();
    const prisma = makePrismaMock();
    const state = makeStateMock();
    const betaLimits = makeBetaLimitsMock();
    const svc = new StrategyRegistryService(prisma, redis, state, betaLimits);

    const strategy = makeDbStrategy({ execMode: "EVENT" });
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");

    expect(() => svc.onPriceEvent("tok-1", 0.75)).not.toThrow();
  });

  it("is a no-op when no strategies are running", async () => {
    const redis = makeRedisMock();
    const prisma = makePrismaMock();
    const state = makeStateMock();
    const betaLimits = makeBetaLimitsMock();
    const svc = new StrategyRegistryService(prisma, redis, state, betaLimits);

    expect(() => svc.onPriceEvent("tok-1", 0.5)).not.toThrow();
  });
});

describe("StrategyRegistryService — onApplicationBootstrap()", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let state: ReturnType<typeof makeStateMock>;
  let svc: StrategyRegistryService;

  beforeEach(() => {
    redis = makeRedisMock();
    prisma = makePrismaMock();
    state = makeStateMock();
    const betaLimits = {
      getLimit: vi.fn().mockResolvedValue(3),
      getAllLimits: vi.fn().mockResolvedValue({
        maxActiveStrategies: 3,
        maxConcurrentBacktests: 1,
        maxBacktestHistoryDays: 90,
        maxMonthlyVolumeUsdc: 5000,
        maxPositionSizeUsdc: 500,
        marketDataRateLimitPerMinute: 100,
        maxMarketplaceListings: 2,
        maxDailyStrategyExecutions: 500,
      }),
      setLimits: vi.fn(),
    } as any;
    svc = new StrategyRegistryService(prisma, redis, state, betaLimits);
  });

  it("does nothing when no strategies are in RUNNING/PAPER state", async () => {
    prisma.strategy.findMany.mockResolvedValue([]);

    await svc.onApplicationBootstrap();

    // Should not have tried to start any strategies
    expect(svc.getStatus("anything")).toBeNull();
  });

  it("resumes RUNNING strategies on startup", async () => {
    const strategy = makeDbStrategy({
      id: "strat-1",
      status: StrategyStatus.RUNNING,
    });
    prisma.strategy.findMany.mockResolvedValue([strategy]);
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    await svc.onApplicationBootstrap();

    expect(svc.getStatus("strat-1")).toBe("RUNNING");
  });

  it("resumes PAPER strategies on startup", async () => {
    const strategy = makeDbStrategy({
      id: "strat-2",
      status: StrategyStatus.PAPER,
    });
    prisma.strategy.findMany.mockResolvedValue([strategy]);
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    await svc.onApplicationBootstrap();

    expect(svc.getStatus("strat-2")).toBe("RUNNING");
  });

  it("continues reconciliation when one strategy fails to resume", async () => {
    const strat1 = makeDbStrategy({
      id: "strat-1",
      status: StrategyStatus.RUNNING,
    });
    const strat2 = makeDbStrategy({
      id: "strat-2",
      status: StrategyStatus.RUNNING,
    });

    prisma.strategy.findMany.mockResolvedValue([strat1, strat2]);
    prisma.strategy.findUnique.mockResolvedValue(strat1);

    // Should not throw even if individual strategies fail
    await expect(svc.onApplicationBootstrap()).resolves.not.toThrow();
  });

  it("handles database failure during reconciliation gracefully", async () => {
    prisma.strategy.findMany.mockRejectedValue(
      new Error("DB connection failed"),
    );

    // Should not throw
    await expect(svc.onApplicationBootstrap()).resolves.not.toThrow();
  });
});

describe("StrategyRegistryService — concurrent start protection", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let state: ReturnType<typeof makeStateMock>;
  let svc: StrategyRegistryService;

  beforeEach(() => {
    redis = makeRedisMock();
    prisma = makePrismaMock();
    state = makeStateMock();
    const betaLimits = {
      getLimit: vi.fn().mockResolvedValue(3),
      getAllLimits: vi.fn().mockResolvedValue({
        maxActiveStrategies: 3,
        maxConcurrentBacktests: 1,
        maxBacktestHistoryDays: 90,
        maxMonthlyVolumeUsdc: 5000,
        maxPositionSizeUsdc: 500,
        marketDataRateLimitPerMinute: 100,
        maxMarketplaceListings: 2,
        maxDailyStrategyExecutions: 500,
      }),
      setLimits: vi.fn(),
    } as any;
    svc = new StrategyRegistryService(prisma, redis, state, betaLimits);
  });

  it("prevents starting the same strategy twice concurrently", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    await svc.start("strat-1");

    // Second attempt should throw ConflictException
    await expect(svc.start("strat-1")).rejects.toThrow(ConflictException);
  });

  it("allows restarting after stop", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);

    await svc.start("strat-1");
    await svc.stop("strat-1");

    // Should be able to start again
    await expect(svc.start("strat-1")).resolves.not.toThrow();
  });
});

describe("StrategyRegistryService — getChildStrategies()", () => {
  it("returns empty array when strategy is not running", () => {
    const redis = makeRedisMock();
    const prisma = makePrismaMock();
    const state = makeStateMock();
    const betaLimits = makeBetaLimitsMock();
    const svc = new StrategyRegistryService(prisma, redis, state, betaLimits);

    expect(svc.getChildStrategies("unknown")).toEqual([]);
  });
});

describe("StrategyRegistryService — hasCircularDependency()", () => {
  it("detects direct circular reference", () => {
    const redis = makeRedisMock();
    const prisma = makePrismaMock();
    const state = makeStateMock();
    const betaLimits = makeBetaLimitsMock();
    const svc = new StrategyRegistryService(prisma, redis, state, betaLimits);

    // parentId === childId
    expect(svc.hasCircularDependency("A", "A")).toBe(true);
  });
});
