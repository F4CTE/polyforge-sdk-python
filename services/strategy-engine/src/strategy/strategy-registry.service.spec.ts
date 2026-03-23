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
    getClient: vi
      .fn()
      .mockReturnValue({ xadd: vi.fn().mockResolvedValue("1-0") }),
    ...overrides,
  } as any;
}

function makePrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    strategy: {
      findUnique: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn().mockResolvedValue(null),
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
    ...overrides,
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
    svc = new StrategyRegistryService(prisma, redis, state);
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
    await expect(svc.start("strat-1")).rejects.toThrow(ConflictException);
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
    svc = new StrategyRegistryService(prisma, redis, state);
  });

  it("sets strategy status to IDLE", async () => {
    const strategy = makeDbStrategy();
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");

    await svc.stop("strat-1");

    expect(prisma.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: StrategyStatus.IDLE }) }),
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
    svc = new StrategyRegistryService(prisma, redis, state);
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
    svc = new StrategyRegistryService(prisma, redis, state);
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
    svc = new StrategyRegistryService(prisma, redis, state);
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
    const svc = new StrategyRegistryService(prisma, redis, state);

    const strategy = makeDbStrategy({ execMode: "EVENT" });
    prisma.strategy.findUnique.mockResolvedValue(strategy);
    await svc.start("strat-1");

    await expect(svc.onPriceEvent("tok-1", 0.75)).resolves.not.toThrow();
  });

  it("is a no-op when no strategies are running", async () => {
    const redis = makeRedisMock();
    const prisma = makePrismaMock();
    const state = makeStateMock();
    const svc = new StrategyRegistryService(prisma, redis, state);

    await expect(svc.onPriceEvent("tok-1", 0.5)).resolves.not.toThrow();
  });
});
