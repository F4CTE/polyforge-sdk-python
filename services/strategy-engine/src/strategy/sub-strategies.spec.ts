import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { StrategyRegistryService } from "./strategy-registry.service";
import { StrategyStatus } from ".prisma/client";
import { RunStrategyAction } from "../blocks/action.blocks";
import { block, makeCtx, makePrisma, makeRedis } from "../blocks/__helpers__";

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
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
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
    parentStrategyId: string | null;
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
    parentStrategyId: null,
    ...overrides,
  };
}

// ─── RunStrategyAction tests ─────────────────────────────────────────────────

describe("RunStrategyAction", () => {
  it("produces a __run_strategy__ sentinel intent", async () => {
    const prisma = makePrisma();
    prisma.strategy.findUnique.mockResolvedValue({
      id: "child-1",
      userId: "user-test",
    });
    const ctx = makeCtx();

    const { intents } = await RunStrategyAction.execute(
      block("RUN_STRATEGY", { strategyId: "child-1", mode: "managed" }),
      ctx,
      makeRedis(),
      prisma,
    );

    expect(intents).toHaveLength(1);
    expect(intents[0].marketId).toBe("__run_strategy__");
    expect(intents[0].tokenId).toBe("child-1");
    expect(intents[0].size).toBe("managed");
  });

  it("prevents self-reference", async () => {
    const ctx = makeCtx();
    const { intents } = await RunStrategyAction.execute(
      block("RUN_STRATEGY", {
        strategyId: ctx.strategyId,
        mode: "managed",
      }),
      ctx,
      makeRedis(),
      makePrisma(),
    );

    expect(intents).toHaveLength(0);
  });

  it("returns empty intents when child not found", async () => {
    const prisma = makePrisma();
    prisma.strategy.findUnique.mockResolvedValue(null);
    const ctx = makeCtx();

    const { intents } = await RunStrategyAction.execute(
      block("RUN_STRATEGY", { strategyId: "nonexistent", mode: "managed" }),
      ctx,
      makeRedis(),
      prisma,
    );

    expect(intents).toHaveLength(0);
  });

  it("returns empty intents when child owned by different user", async () => {
    const prisma = makePrisma();
    prisma.strategy.findUnique.mockResolvedValue({
      id: "child-1",
      userId: "other-user",
    });
    const ctx = makeCtx();

    const { intents } = await RunStrategyAction.execute(
      block("RUN_STRATEGY", { strategyId: "child-1", mode: "managed" }),
      ctx,
      makeRedis(),
      prisma,
    );

    expect(intents).toHaveLength(0);
  });

  it("returns empty intents when missing params", async () => {
    const ctx = makeCtx();
    const { intents } = await RunStrategyAction.execute(
      block("RUN_STRATEGY", {}),
      ctx,
      makeRedis(),
      makePrisma(),
    );
    expect(intents).toHaveLength(0);
  });
});

// ─── Circular dependency detection tests ─────────────────────────────────────

describe("StrategyRegistryService — circular dependency", () => {
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

  it("detects A -> B -> C -> A circular dependency", async () => {
    // Simulate: A is parent of B, B is parent of C
    // Now trying to make C parent of A
    // We need to set up the parentChildMap
    const parentChildMap = (svc as any).parentChildMap as Map<string, string>;
    parentChildMap.set("B", "A"); // B's parent is A
    parentChildMap.set("C", "B"); // C's parent is B

    // Trying to start A as child of C should detect circular dependency
    const result = svc.hasCircularDependency("C", "A");
    expect(result).toBe(true);
  });

  it("allows non-circular dependencies", () => {
    const parentChildMap = (svc as any).parentChildMap as Map<string, string>;
    parentChildMap.set("B", "A");

    // C as child of B should be fine (A -> B -> C)
    const result = svc.hasCircularDependency("B", "C");
    expect(result).toBe(false);
  });

  it("does not detect circular dependency when depth > 3 (depth is checked separately)", () => {
    const parentChildMap = (svc as any).parentChildMap as Map<string, string>;
    parentChildMap.set("B", "A");
    parentChildMap.set("C", "B");
    parentChildMap.set("D", "C");
    parentChildMap.set("E", "D");

    // hasCircularDependency only checks for CIRCULAR refs (A→B→C→A), not depth.
    // Depth > 3 is enforced at the startAsChild level, not here.
    const result = svc.hasCircularDependency("E", "F");
    expect(result).toBe(false);
  });

  it("allows depth <= 3", () => {
    const parentChildMap = (svc as any).parentChildMap as Map<string, string>;
    parentChildMap.set("B", "A");
    parentChildMap.set("C", "B");

    // D under C: depth is 3 (A -> B -> C -> D), but C's depth from root is 2
    // hasCircularDependency checks parentDepth from "C" upward:
    // C -> B -> A -> undefined = parentDepth 2, which is < 3, so OK
    const result = svc.hasCircularDependency("C", "D");
    expect(result).toBe(false);
  });
});

// ─── startAsChild tests ─────────────────────────────────────────────────────

describe("StrategyRegistryService — startAsChild()", () => {
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

  // Helper: add a fake runner to the registry without actually starting one
  function addFakeRunner(id: string) {
    const runners = (svc as any).runners as Map<string, any>;
    runners.set(id, { childStrategies: new Set(), stop: vi.fn() });
  }

  it("rejects self-reference (strategy cannot launch itself)", async () => {
    // Parent "parent-1" is running, try to start "parent-1" as its own child
    addFakeRunner("parent-1");
    prisma.strategy.findUnique.mockResolvedValue(
      makeDbStrategy({ id: "parent-1", userId: "user-1" }),
    );

    // startAsChild checks runners.has(childId) first — parent-1 is already running
    // so it throws ConflictException (already running), not UnprocessableEntityException
    await expect(
      svc.startAsChild("parent-1", "parent-1", "managed", { userId: "user-1" }),
    ).rejects.toThrow(ConflictException);
  });

  it("rejects child not found", async () => {
    addFakeRunner("parent-1");
    prisma.strategy.findUnique.mockResolvedValue(null);

    await expect(
      svc.startAsChild("nonexistent", "parent-1", "managed", {
        userId: "user-1",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects child owned by different user", async () => {
    addFakeRunner("parent-1");
    const childDb = makeDbStrategy({
      id: "child-1",
      userId: "user-2",
      status: StrategyStatus.IDLE,
    });

    prisma.strategy.findUnique.mockResolvedValue(childDb);

    await expect(
      svc.startAsChild("child-1", "parent-1", "managed", {
        userId: "user-1",
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("successfully starts a child strategy in fire_and_forget mode", async () => {
    const parentDb = makeDbStrategy({
      id: "parent-1",
      userId: "user-1",
      status: StrategyStatus.IDLE,
    });
    const childDb = makeDbStrategy({
      id: "child-1",
      userId: "user-1",
      status: StrategyStatus.IDLE,
    });

    prisma.strategy.findUnique
      .mockResolvedValueOnce(parentDb) // start()
      .mockResolvedValueOnce(parentDb) // getUserId in emitEvent
      .mockResolvedValueOnce(childDb) // startAsChild - child lookup
      .mockResolvedValueOnce(parentDb) // startAsChild - parent status check
      .mockResolvedValueOnce(childDb); // getUserId in emitEvent for child

    await svc.start("parent-1");
    await svc.startAsChild("child-1", "parent-1", "fire_and_forget", {
      userId: "user-1",
    });

    expect(svc.getStatus("child-1")).toBe("RUNNING");
  });

  it("stops managed children when parent stops", async () => {
    const parentDb = makeDbStrategy({
      id: "parent-1",
      userId: "user-1",
      status: StrategyStatus.IDLE,
    });
    const childDb = makeDbStrategy({
      id: "child-1",
      userId: "user-1",
      status: StrategyStatus.IDLE,
    });

    prisma.strategy.findUnique
      .mockResolvedValueOnce(parentDb) // start parent
      .mockResolvedValueOnce(parentDb) // getUserId for emitEvent
      .mockResolvedValueOnce(childDb) // startAsChild - child lookup
      .mockResolvedValueOnce(parentDb) // startAsChild - parent status
      .mockResolvedValueOnce(childDb) // getUserId for child emitEvent
      .mockResolvedValueOnce(childDb) // stop child - getUserId
      .mockResolvedValueOnce(parentDb); // stop parent - getUserId

    await svc.start("parent-1");
    await svc.startAsChild("child-1", "parent-1", "managed", {
      userId: "user-1",
    });

    // Manually add child to parent runner's child set
    const parentRunner = (svc as any).runners.get("parent-1");
    parentRunner.addChild("child-1", "managed");

    expect(svc.getStatus("child-1")).toBe("RUNNING");

    // Stop parent - should cascade to managed child
    await svc.stop("parent-1");

    expect(svc.getStatus("parent-1")).toBeNull();
    expect(svc.getStatus("child-1")).toBeNull();
  });

  it("rejects already running child", async () => {
    const parentDb = makeDbStrategy({
      id: "parent-1",
      userId: "user-1",
      status: StrategyStatus.IDLE,
    });
    const childDb = makeDbStrategy({
      id: "child-1",
      userId: "user-1",
      status: StrategyStatus.IDLE,
    });

    prisma.strategy.findUnique
      .mockResolvedValueOnce(parentDb)
      .mockResolvedValueOnce(parentDb)
      .mockResolvedValueOnce(childDb)
      .mockResolvedValueOnce(parentDb)
      .mockResolvedValueOnce(childDb)
      .mockResolvedValueOnce(childDb); // second startAsChild attempt

    await svc.start("parent-1");
    await svc.startAsChild("child-1", "parent-1", "managed", {
      userId: "user-1",
    });

    await expect(
      svc.startAsChild("child-1", "parent-1", "managed", {
        userId: "user-1",
      }),
    ).rejects.toThrow(ConflictException);
  });
});

// ─── Max concurrent children test ────────────────────────────────────────────

describe("StrategyRegistryService — max concurrent children", () => {
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

  it("rejects more than 10 concurrent sub-strategies per parent", async () => {
    const parentDb = makeDbStrategy({
      id: "parent-1",
      userId: "user-1",
      status: StrategyStatus.IDLE,
    });

    // Start parent
    prisma.strategy.findUnique.mockResolvedValue(parentDb);
    await svc.start("parent-1");

    // Fill the parent runner with 10 children manually
    const parentRunner = (svc as any).runners.get("parent-1");
    for (let i = 0; i < 10; i++) {
      parentRunner.addChild(`child-${i}`, "managed");
    }

    const childDb = makeDbStrategy({
      id: "child-11",
      userId: "user-1",
      status: StrategyStatus.IDLE,
    });
    prisma.strategy.findUnique.mockResolvedValue(childDb);

    await expect(
      svc.startAsChild("child-11", "parent-1", "managed", {
        userId: "user-1",
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
