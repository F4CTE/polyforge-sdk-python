import { RedisService } from "@polyforge/shared-redis";
import { PrismaService } from "@polyforge/shared-db";
import type { VenueId } from "@polyforge/shared-types";

/** Minimal price data from Redis cache */
export interface CachedPrice {
  price: number;
  timestamp: number;
}

/** Minimal order book from Redis cache */
export interface CachedBook {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  midpoint: string;
  spread: string;
  timestamp: number;
}

/** Per-strategy state stored in Redis (resets at midnight UTC) */
export interface StrategyState {
  betsToday: number;
  dailyPnl: number;
  consecutiveLoss: number;
  consecutiveWin: number;
  lastTradeAt: number; // epoch ms
  tradedTokensToday: string[];
  totalOrders: number;
}

/** Context passed to every block evaluator */
export interface EvalContext {
  strategyId: string;
  userId: string;
  state: StrategyState;
  now: number; // epoch ms
  variables?: Record<string, number>;
  /** Target venue for all OrderIntents generated in this evaluation cycle. */
  venue?: VenueId | "best";
  /** Kalshi subaccount number for P&L attribution (0 = primary). */
  kalshiSubaccount?: number;
}

export interface BlockResult {
  fired: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/** OrderIntent produced by ACTION blocks */
export interface OrderIntent {
  intentId: string;
  userId: string;
  strategyId: string;
  marketId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  size: string; // decimal shares
  price: string; // decimal 0–1
  orderType: "GTC" | "FOK" | "GTD" | "FAK" | "POST_ONLY";
  expiration?: number;
  venue?: VenueId | "best";
  kalshiSubaccount?: number;
}

export interface BlockEvaluator {
  evaluate(
    block: Record<string, unknown>,
    ctx: EvalContext,
    redis: RedisService,
    prisma: PrismaService,
  ): Promise<BlockResult>;
}

export interface ActionResult {
  intents: OrderIntent[];
}

// ─── Logic blocks ───────────────────────────────────────────────────────────

export interface LogicBlockResult {
  /** The boolean value produced by this logic block */
  value: boolean;
  /** For multi-output blocks: which output port is active (e.g. 'true' or 'false') */
  activeOutput?: string;
}

export interface LogicBlockEvaluator {
  evaluate(
    block: Record<string, unknown>,
    inputs: boolean[],
    ctx: EvalContext,
  ): LogicBlockResult;
}

export interface DelayedAction {
  strategyId: string;
  blockId: string;
  fireAt: number; // epoch ms
  value: boolean;
}

export interface ActionEvaluator {
  execute(
    block: Record<string, unknown>,
    ctx: EvalContext,
    redis: RedisService,
    prisma: PrismaService,
  ): Promise<ActionResult>;
}

// ─── Calculation blocks ─────────────────────────────────────────────────────

export interface CalcBlockResult {
  /** The computed numeric value (or NaN on error) */
  value: number;
  /** For comparison blocks: the boolean result */
  booleanValue?: boolean;
}

export interface CalcBlockEvaluator {
  evaluate(
    block: Record<string, unknown>,
    inputs: number[],
    ctx: EvalContext,
  ): CalcBlockResult;
}
