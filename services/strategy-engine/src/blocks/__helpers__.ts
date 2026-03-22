/**
 * Shared test helpers for block unit tests.
 * Imported by *.spec.ts files — NOT part of the production build.
 */
import { vi } from "vitest";
import type { EvalContext, StrategyState } from "./block.types";

// ─── Context factory ──────────────────────────────────────────────────────────

const DEFAULT_STATE: StrategyState = {
  betsToday: 0,
  dailyPnl: 0,
  consecutiveLoss: 0,
  consecutiveWin: 0,
  lastTradeAt: 0,
  tradedTokensToday: [],
  totalOrders: 0,
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

export function makeRedis(overrides: Record<string, unknown> = {}) {
  const client = {
    lrange: vi.fn().mockResolvedValue([]),
  };

  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    getJson: vi.fn().mockResolvedValue(null),
    getClient: vi.fn().mockReturnValue(client),
    xadd: vi.fn().mockResolvedValue("ok"),
    ...overrides,
  } as any;
}

// ─── Prisma mock ──────────────────────────────────────────────────────────────

export function makePrisma(overrides: Record<string, unknown> = {}) {
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
  } as any;
}

// ─── Block factory ────────────────────────────────────────────────────────────

export function block(type: string, params: Record<string, unknown> = {}) {
  return { id: "b1", type, params };
}
