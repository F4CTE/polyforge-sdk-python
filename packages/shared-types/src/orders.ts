// ─────────────────────────────────────────────────────────────────────────────
// Order types
// ─────────────────────────────────────────────────────────────────────────────

export enum OrderSide {
  BUY = "BUY",
  SELL = "SELL",
}

export enum OrderOutcome {
  YES = "YES",
  NO = "NO",
}

export enum OrderType {
  GTC = "GTC",
  GTD = "GTD",
  FOK = "FOK",
  FAK = "FAK",
}

export enum OrderStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  LIVE = "LIVE",
  MATCHED = "MATCHED",
  DELAYED = "DELAYED",
  MINED = "MINED",
  CONFIRMED = "CONFIRMED",
  PARTIAL = "PARTIAL",
  CANCELLED = "CANCELLED",
  UNMATCHED = "UNMATCHED",
  FAILED = "FAILED",
  ERROR = "ERROR",
}

export enum ResolutionStatus {
  UNRESOLVED = "UNRESOLVED",
  RESOLVING = "RESOLVING",
  RESOLVED = "RESOLVED",
  DISPUTED = "DISPUTED",
}

export enum ResolutionOutcome {
  YES_WIN = "YES_WIN",
  NO_WIN = "NO_WIN",
  FIFTY_FIFTY = "FIFTY_FIFTY",
  CANCELLED = "CANCELLED",
}

export interface Order {
  id: string;
  intentId: string;
  clobOrderId: string | null;
  userId: string;
  strategyId: string | null;
  marketId: string;
  tokenId: string;
  side: OrderSide;
  outcome: OrderOutcome;
  size: string; // decimal string — never float
  price: string; // decimal string — never float
  orderType: OrderType;
  status: OrderStatus;
  fillSize: string | null;
  fillPrice: string | null;
  fee: string | null;
  errorMessage: string | null;
  placedAt: string | null;
  filledAt: string | null;
  createdAt: string;
}

export interface Position {
  id: string;
  userId: string;
  marketId: string;
  tokenId: string;
  outcome: OrderOutcome;
  size: string;
  avgPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  realizedPnl: string;
  resolutionStatus: ResolutionStatus;
  resolutionOutcome: ResolutionOutcome | null;
  redemptionValue: string | null;
  redeemed: boolean;
  redeemedAt: string | null;
  redemptionTxHash: string | null;
  updatedAt: string;
}

// ─── Conditional Orders ──────────────────────────────────────────────────────

export enum ConditionalOrderType {
  TAKE_PROFIT = "TAKE_PROFIT",
  STOP_LOSS = "STOP_LOSS",
  TRAILING_STOP = "TRAILING_STOP",
  LIMIT = "LIMIT",
  PEGGED = "PEGGED",
}

export enum ConditionalOrderStatus {
  PENDING = "PENDING",
  TRIGGERED = "TRIGGERED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
}

export interface ConditionalOrder {
  id: string;
  userId: string;
  marketId: string;
  tokenId: string;
  type: ConditionalOrderType;
  side: OrderSide;
  outcome: OrderOutcome;
  size: string;
  triggerPrice: string;
  limitPrice: string | null;
  trailingPct: string | null;
  peakPrice: string | null;
  status: ConditionalOrderStatus;
  triggeredAt: string | null;
  orderId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// ─── Order intent (Redis stream payload) ─────────────────────────────────────

export interface OrderIntent {
  intentId: string;
  userId: string;
  strategyId: string | null;
  marketId: string;
  tokenId: string;
  side: OrderSide;
  outcome: OrderOutcome;
  size: string;
  price: string;
  orderType: OrderType;
}
