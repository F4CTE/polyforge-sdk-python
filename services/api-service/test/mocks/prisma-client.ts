/**
 * Lightweight mock of the generated Prisma client enums.
 * Used by vitest via resolve.alias so test imports of '.prisma/client'
 * don't require a generated client on disk.
 */

export const StrategyStatus = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    ERROR: 'ERROR',
    PAPER: 'PAPER',
    ARCHIVED: 'ARCHIVED',
} as const;
export type StrategyStatus = (typeof StrategyStatus)[keyof typeof StrategyStatus];

export const OrderSide = { BUY: 'BUY', SELL: 'SELL' } as const;
export const OrderOutcome = { YES: 'YES', NO: 'NO' } as const;
export const OrderType = { GTC: 'GTC', GTD: 'GTD', FOK: 'FOK' } as const;

export const TicketStatus = {
    OPEN: 'OPEN',
    AWAITING_USER: 'AWAITING_USER',
    AWAITING_ADMIN: 'AWAITING_ADMIN',
    CLOSED: 'CLOSED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketPriority = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', URGENT: 'URGENT' } as const;
export const TicketCategory = { GENERAL: 'GENERAL', BILLING: 'BILLING', TECHNICAL: 'TECHNICAL', ACCOUNT: 'ACCOUNT', BUG: 'BUG', FEATURE_REQUEST: 'FEATURE_REQUEST' } as const;
