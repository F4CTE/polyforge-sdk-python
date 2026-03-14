// ─────────────────────────────────────────────────────────────────────────────
// Order types
// ─────────────────────────────────────────────────────────────────────────────

export enum OrderSide {
    BUY = 'BUY',
    SELL = 'SELL',
}

export enum OrderOutcome {
    YES = 'YES',
    NO = 'NO',
}

export enum OrderType {
    GTC = 'GTC',
    GTD = 'GTD',
    FOK = 'FOK',
    FAK = 'FAK',
}

export enum OrderStatus {
    PENDING = 'PENDING',
    SUBMITTED = 'SUBMITTED',
    LIVE = 'LIVE',
    MATCHED = 'MATCHED',
    DELAYED = 'DELAYED',
    MINED = 'MINED',
    CONFIRMED = 'CONFIRMED',
    PARTIAL = 'PARTIAL',
    CANCELLED = 'CANCELLED',
    UNMATCHED = 'UNMATCHED',
    FAILED = 'FAILED',
    ERROR = 'ERROR',
}

export enum ResolutionStatus {
    UNRESOLVED = 'UNRESOLVED',
    RESOLVING = 'RESOLVING',
    RESOLVED = 'RESOLVED',
    DISPUTED = 'DISPUTED',
}

export enum ResolutionOutcome {
    YES_WIN = 'YES_WIN',
    NO_WIN = 'NO_WIN',
    FIFTY_FIFTY = 'FIFTY_FIFTY',
    CANCELLED = 'CANCELLED',
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
    size: string;   // decimal string — never float
    price: string;   // decimal string — never float
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