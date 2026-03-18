// ─────────────────────────────────────────────────────────────────────────────
// Strategy types
// ─────────────────────────────────────────────────────────────────────────────

export enum StrategyStatus {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  ERROR = "ERROR",
  PAPER = "PAPER",
  ARCHIVED = "ARCHIVED",
}

export enum StrategyVisibility {
  PRIVATE = "PRIVATE",
  PUBLIC = "PUBLIC",
  UNLISTED = "UNLISTED",
}

export enum ExecMode {
  EVENT = "EVENT",
  TICK = "TICK",
  HYBRID = "HYBRID",
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

export enum BlockType {
  // Triggers
  PRICE_CROSSES_UP = "PRICE_CROSSES_UP",
  PRICE_CROSSES_DOWN = "PRICE_CROSSES_DOWN",
  TICK = "TICK",
  MARKET_RESOLVES = "MARKET_RESOLVES",

  // Conditions
  PRICE_ABOVE = "PRICE_ABOVE",
  PRICE_BELOW = "PRICE_BELOW",
  BETS_TODAY_LESS_THAN = "BETS_TODAY_LESS_THAN",
  SPREAD_ABOVE = "SPREAD_ABOVE",
  POSITION_SIZE_BELOW = "POSITION_SIZE_BELOW",
  DAILY_PNL_ABOVE = "DAILY_PNL_ABOVE",
  DAILY_PNL_BELOW = "DAILY_PNL_BELOW",

  // Actions
  BUY = "BUY",
  SELL = "SELL",
  WAIT = "WAIT",

  // Safety
  DAILY_LOSS_LIMIT = "DAILY_LOSS_LIMIT",
  MAX_POSITION_SIZE = "MAX_POSITION_SIZE",
  MAX_BETS_PER_DAY = "MAX_BETS_PER_DAY",
}

export interface Block {
  id: string;
  type: BlockType;
  params: Record<string, unknown>;
}

// ─── Strategy ────────────────────────────────────────────────────────────────

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  visibility: StrategyVisibility;
  execMode: ExecMode;
  tickMs: number | null;
  triggers: Block[];
  conditions: Block[];
  actions: Block[];
  safety: Block[];
  status: StrategyStatus;
  errorMessage: string | null;
  forkedFromId: string | null;
  forkedFromUserId: string | null;
  forkCount: number;
  likeCount: number;
  template: boolean;
  tags: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Strategy state (Redis) ──────────────────────────────────────────────────

export interface StrategyState {
  betsToday: number;
  dailyPnl: string; // decimal string — never float
  lastTradeAt: number | null;
  streak: number; // positive = wins, negative = losses
  lastBetSize: string | null;
  tradedToday: string[]; // marketIds traded today
}
