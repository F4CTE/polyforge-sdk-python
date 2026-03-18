import { RedisService } from "@polyforge/shared-redis";
import { PrismaService } from "@polyforge/shared-db";

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
  orderType: "GTC" | "FOK" | "GTD" | "FAK";
  expiration?: number;
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

export interface ActionEvaluator {
  execute(
    block: Record<string, unknown>,
    ctx: EvalContext,
    redis: RedisService,
    prisma: PrismaService,
  ): Promise<ActionResult>;
}
