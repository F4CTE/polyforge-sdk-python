// ─────────────────────────────────────────────────────────────────────────────
// Trader score & badge types
// ─────────────────────────────────────────────────────────────────────────────

export interface TraderScore {
  id: string;
  userId: string;
  score: number;
  winRate: string;
  sharpeRatio: string;
  avgReturn: string;
  totalTrades: number;
  profitFactor: string;
  maxDrawdown: string;
  consistency: string;
  updatedAt: string;
}

export interface ScoreBreakdown {
  score: number;
  components: {
    winRate: { value: string; weight: number; weighted: number };
    sharpe: { value: string; weight: number; weighted: number };
    profitFactor: { value: string; weight: number; weighted: number };
    consistency: { value: string; weight: number; weighted: number };
    avgReturn: { value: string; weight: number; weighted: number };
    tradeVolume: { value: number; weight: number; weighted: number };
    drawdown: { value: string; weight: number; weighted: number };
  };
  totalTrades: number;
  updatedAt: string;
}

export type BadgeType =
  | "FIRST_TRADE"
  | "WINNING_STREAK_5"
  | "WHALE_HUNTER"
  | "STRATEGY_MASTER"
  | "COPY_LEADER"
  | "TOP_10"
  | "TOP_50"
  | "CONSISTENT_WINNER"
  | "PAPER_GRADUATE"
  | "EARLY_ADOPTER";

export interface TraderBadge {
  id: string;
  userId: string;
  type: BadgeType;
  name: string;
  earnedAt: string;
}

export interface TraderScoreResponse {
  score: TraderScore;
  breakdown: ScoreBreakdown;
}

export interface TopTraderEntry {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  score: number;
  winRate: string;
  totalTrades: number;
}
