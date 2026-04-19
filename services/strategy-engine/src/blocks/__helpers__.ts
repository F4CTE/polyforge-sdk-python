/**
 * Shared test helpers for block unit tests.
 * Imported by *.spec.ts files — NOT part of the production build.
 */
import { vi } from "vitest";
import type { EvalContext, StrategyState } from "./block.types";
import type { RedisService } from "@polyforge/shared-redis";
import type { PrismaService } from "@polyforge/shared-db";

// ─── Context factory ──────────────────────────────────────────────────────────

const DEFAULT_STATE: StrategyState = {
  betsToday: 0,
  dailyPnl: 0,
  consecutiveLoss: 0,
  consecutiveWin: 0,
  lastTradeAt: 0,
  tradedTokensToday: [],
  totalOrders: 0,
  tickCount: 0,
  weeklyPnl: 0,
  weekStartDate: new Date().toISOString().slice(0, 10),
};

export function makeCtx(
  state: Partial<StrategyState> = {},
  now = Date.now(),
): EvalContext {
  return {
    strategyId: "strat-test",
    userId: "user-test",
    now,
    state: { ...DEFAULT_STATE, ...state },
  };
}

// ─── Redis mock ───────────────────────────────────────────────────────────────

/**
 * A strongly-typed mock of RedisService.
 * Each method is typed as `ReturnType<typeof vi.fn>` so vitest mock helpers
 * (`.mockResolvedValue`, `.mockReturnValue`, `.mock`, etc.) are accessible
 * in spec files, while the intersection with `RedisService` lets the object
 * be passed wherever the real service is expected.
 */
export type MockRedisService = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  getJson: ReturnType<typeof vi.fn>;
  getClient: ReturnType<typeof vi.fn>;
  xadd: ReturnType<typeof vi.fn>;
} & RedisService;

/**
 * Converts a price array into the alternating [member, score] format
 * returned by Redis ZRANGE ... WITHSCORES, where member=price and score=timestamp.
 */
export function toPriceWindow(prices: number[]): string[] {
  return prices.flatMap((p, i) => [String(p), String(i * 1000)]);
}

export function makeRedis(
  overrides: Record<string, unknown> = {},
): MockRedisService {
  const client = {
    lrange: vi.fn().mockResolvedValue([]),
    zrange: vi.fn().mockResolvedValue([]),
  };

  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    getJson: vi.fn().mockResolvedValue(null),
    getClient: vi.fn().mockReturnValue(client),
    xadd: vi.fn().mockResolvedValue("ok"),
    ...overrides,
  } as unknown as MockRedisService;
}

// ─── Prisma mock ──────────────────────────────────────────────────────────────

/**
 * A strongly-typed mock of PrismaService.
 * Each method is typed as `ReturnType<typeof vi.fn>` so vitest mock helpers
 * (`.mockResolvedValue`, `.mock`, etc.) are accessible in spec files, while
 * the intersection with `PrismaService` lets the object be passed wherever
 * the real service is expected.
 */
export type MockPrismaService = {
  position: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  token: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  market: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  strategy: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
} & PrismaService;

export function makePrisma(
  overrides: Record<string, unknown> = {},
): MockPrismaService {
  return {
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
    strategy: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    ...overrides,
  } as unknown as MockPrismaService;
}

// ─── Block factory ────────────────────────────────────────────────────────────

export function block(type: string, params: Record<string, unknown> = {}) {
  return { id: "b1", type, params };
}
