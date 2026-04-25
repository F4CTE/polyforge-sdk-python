import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GameStartedBlock,
  PregameWindowBlock,
  HalftimeBlock,
  SportScoreAboveBlock,
} from "./sports.blocks";
import type { EvalContext } from "./block.types";
import type { RedisService } from "@polyforge/shared-redis";
import type { PrismaService } from "@polyforge/shared-db";

function makeCtx(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    strategyId: "strat-1",
    userId: "user-1",
    state: {
      betsToday: 0,
      dailyPnl: 0,
      consecutiveLoss: 0,
      consecutiveWin: 0,
      lastTradeAt: 0,
      tradedTokensToday: [],
      totalOrders: 0,
    },
    now: Date.now(),
    ...overrides,
  };
}

function makeRedis(getJsonResult: unknown = null): RedisService {
  return {
    getJson: vi.fn().mockResolvedValue(getJsonResult),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    setJson: vi.fn(),
  } as unknown as RedisService;
}

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    event: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as unknown as PrismaService;
}

describe("GameStartedBlock", () => {
  it("fires when game transitions to LIVE", async () => {
    const now = Date.now();
    const redis = makeRedis({
      status: "LIVE",
      prevStatus: "PREGAME",
      updatedAt: now - 30_000,
    });

    const result = await GameStartedBlock.evaluate(
      { params: { eventTicker: "NFL-CHIEFS-BILLS" } },
      makeCtx({ now }),
      redis,
      makePrisma(),
    );

    expect(result.fired).toBe(true);
    expect(result.metadata?.status).toBe("LIVE");
  });

  it("does not fire when already LIVE", async () => {
    const now = Date.now();
    const redis = makeRedis({
      status: "LIVE",
      prevStatus: "LIVE",
      updatedAt: now - 30_000,
    });

    const result = await GameStartedBlock.evaluate(
      { params: { eventTicker: "NFL-CHIEFS-BILLS" } },
      makeCtx({ now }),
      redis,
      makePrisma(),
    );

    expect(result.fired).toBe(false);
  });

  it("does not fire when state too old", async () => {
    const now = Date.now();
    const redis = makeRedis({
      status: "LIVE",
      prevStatus: "PREGAME",
      updatedAt: now - 300_000,
    });

    const result = await GameStartedBlock.evaluate(
      { params: { eventTicker: "NFL-CHIEFS-BILLS" } },
      makeCtx({ now }),
      redis,
      makePrisma(),
    );

    expect(result.fired).toBe(false);
  });

  it("returns false when no game state cached", async () => {
    const result = await GameStartedBlock.evaluate(
      { params: { eventTicker: "NFL-CHIEFS-BILLS" } },
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );

    expect(result.fired).toBe(false);
    expect(result.reason).toBe("no game state cached");
  });

  it("returns false when no eventTicker", async () => {
    const result = await GameStartedBlock.evaluate(
      { params: {} },
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );

    expect(result.fired).toBe(false);
    expect(result.reason).toBe("no eventTicker");
  });
});

describe("PregameWindowBlock", () => {
  it("fires within pregame window", async () => {
    const now = Date.now();
    const startDate = new Date(now + 15 * 60_000); // 15 min from now
    const prisma = makePrisma({
      event: {
        findUnique: vi.fn().mockResolvedValue({ startDate }),
      },
    });

    const result = await PregameWindowBlock.evaluate(
      { params: { eventTicker: "NBA-LAKERS-CELTICS", minutesBefore: 30 } },
      makeCtx({ now }),
      makeRedis(),
      prisma,
    );

    expect(result.fired).toBe(true);
    expect(result.metadata?.minutesToStart).toBe(15);
  });

  it("does not fire outside window", async () => {
    const now = Date.now();
    const startDate = new Date(now + 120 * 60_000); // 2 hours from now
    const prisma = makePrisma({
      event: {
        findUnique: vi.fn().mockResolvedValue({ startDate }),
      },
    });

    const result = await PregameWindowBlock.evaluate(
      { params: { eventTicker: "NBA-LAKERS-CELTICS", minutesBefore: 30 } },
      makeCtx({ now }),
      makeRedis(),
      prisma,
    );

    expect(result.fired).toBe(false);
  });

  it("does not fire after game started", async () => {
    const now = Date.now();
    const startDate = new Date(now - 10 * 60_000); // started 10 min ago
    const prisma = makePrisma({
      event: {
        findUnique: vi.fn().mockResolvedValue({ startDate }),
      },
    });

    const result = await PregameWindowBlock.evaluate(
      { params: { eventTicker: "NBA-LAKERS-CELTICS", minutesBefore: 30 } },
      makeCtx({ now }),
      makeRedis(),
      prisma,
    );

    expect(result.fired).toBe(false);
  });

  it("returns false when event not found", async () => {
    const result = await PregameWindowBlock.evaluate(
      { params: { eventTicker: "NONEXISTENT", minutesBefore: 30 } },
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );

    expect(result.fired).toBe(false);
    expect(result.reason).toBe("no event or start date");
  });
});

describe("HalftimeBlock", () => {
  it("fires when game transitions to HALFTIME", async () => {
    const now = Date.now();
    const redis = makeRedis({
      status: "HALFTIME",
      prevStatus: "LIVE",
      updatedAt: now - 10_000,
    });

    const result = await HalftimeBlock.evaluate(
      { params: { eventTicker: "NBA-LAKERS-CELTICS" } },
      makeCtx({ now }),
      redis,
      makePrisma(),
    );

    expect(result.fired).toBe(true);
  });

  it("does not fire when already at halftime", async () => {
    const now = Date.now();
    const redis = makeRedis({
      status: "HALFTIME",
      prevStatus: "HALFTIME",
      updatedAt: now - 10_000,
    });

    const result = await HalftimeBlock.evaluate(
      { params: { eventTicker: "NBA-LAKERS-CELTICS" } },
      makeCtx({ now }),
      redis,
      makePrisma(),
    );

    expect(result.fired).toBe(false);
  });
});

describe("SportScoreAboveBlock", () => {
  it("fires when home score exceeds threshold", async () => {
    const redis = makeRedis({ homeScore: 28, awayScore: 14 });

    const result = await SportScoreAboveBlock.evaluate(
      { params: { eventTicker: "NFL-KC-BUF", team: "home", threshold: 21 } },
      makeCtx(),
      redis,
      makePrisma(),
    );

    expect(result.fired).toBe(true);
    expect(result.metadata?.score).toBe(28);
  });

  it("does not fire when score below threshold", async () => {
    const redis = makeRedis({ homeScore: 14, awayScore: 21 });

    const result = await SportScoreAboveBlock.evaluate(
      { params: { eventTicker: "NFL-KC-BUF", team: "home", threshold: 21 } },
      makeCtx(),
      redis,
      makePrisma(),
    );

    expect(result.fired).toBe(false);
  });

  it("checks away team score", async () => {
    const redis = makeRedis({ homeScore: 14, awayScore: 35 });

    const result = await SportScoreAboveBlock.evaluate(
      { params: { eventTicker: "NFL-KC-BUF", team: "away", threshold: 28 } },
      makeCtx(),
      redis,
      makePrisma(),
    );

    expect(result.fired).toBe(true);
    expect(result.metadata?.score).toBe(35);
  });

  it("defaults to home team when team not specified", async () => {
    const redis = makeRedis({ homeScore: 30, awayScore: 10 });

    const result = await SportScoreAboveBlock.evaluate(
      { params: { eventTicker: "NFL-KC-BUF", threshold: 21 } },
      makeCtx(),
      redis,
      makePrisma(),
    );

    expect(result.fired).toBe(true);
  });

  it("returns false when no score data", async () => {
    const result = await SportScoreAboveBlock.evaluate(
      { params: { eventTicker: "NFL-KC-BUF", threshold: 21 } },
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );

    expect(result.fired).toBe(false);
    expect(result.reason).toBe("no score data cached");
  });

  it("returns false on invalid config", async () => {
    const result = await SportScoreAboveBlock.evaluate(
      { params: {} },
      makeCtx(),
      makeRedis(),
      makePrisma(),
    );

    expect(result.fired).toBe(false);
    expect(result.reason).toBe("invalid config");
  });
});
