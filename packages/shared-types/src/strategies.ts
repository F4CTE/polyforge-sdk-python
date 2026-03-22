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

// ─── Sub-strategy modes ──────────────────────────────────────────────────────

export type SubStrategyMode = 'fire_and_forget' | 'managed' | 'scoped';

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
  RUN_STRATEGY = "RUN_STRATEGY",

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
  logicBlocks?: LogicBlock[];
  calcBlocks?: CalcBlock[];
  status: StrategyStatus;
  errorMessage: string | null;
  parentStrategyId?: string;
  forkedFromId: string | null;
  forkedFromUserId: string | null;
  forkCount: number;
  likeCount: number;
  template: boolean;
  tags: string[];
  canvas?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Logic blocks ───────────────────────────────────────────────────────────

export type LogicBlockType =
  | 'IF_THEN_ELSE'
  | 'AND_GATE'
  | 'OR_GATE'
  | 'NOT_GATE'
  | 'DELAY';

export interface LogicBlock {
  id: string;
  type: LogicBlockType;
  params: Record<string, unknown>;
  /** Output port IDs for multi-output blocks (e.g. IF_THEN_ELSE has 'true' and 'false') */
  outputs?: string[];
}

// ─── Calculation blocks ─────────────────────────────────────────────────────

export type CalcBlockType =
  | 'MATH'
  | 'AGGREGATION'
  | 'COMPARISON'
  | 'ABS_ROUND';

export interface CalcBlock {
  id: string;
  type: CalcBlockType;
  params: Record<string, unknown>;
}

// ─── Calculation variables ───────────────────────────────────────────────────

export interface StrategyVariable {
  id: string;
  name: string;
  expression: string;
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
