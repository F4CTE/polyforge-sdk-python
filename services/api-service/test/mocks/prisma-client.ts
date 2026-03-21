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

export const StrategyVisibility = { PRIVATE: 'PRIVATE', PUBLIC: 'PUBLIC', UNLISTED: 'UNLISTED' } as const;
export type StrategyVisibility = (typeof StrategyVisibility)[keyof typeof StrategyVisibility];

export const ExecMode = { EVENT: 'EVENT', TICK: 'TICK', HYBRID: 'HYBRID' } as const;
export type ExecMode = (typeof ExecMode)[keyof typeof ExecMode];

export const ReportReason = { SPAM: 'SPAM', INAPPROPRIATE: 'INAPPROPRIATE', MISLEADING: 'MISLEADING', OTHER: 'OTHER' } as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

// Stub types used by the strategies service
export type Strategy = Record<string, unknown>;
export type InputJsonValue = string | number | boolean | null | Record<string, unknown> | unknown[];
export const Prisma = {
    // Placeholder — real Prisma namespace is complex; only the types used by
    // the service under test need to exist here.
} as const;
export namespace Prisma {
    export type InputJsonValue = string | number | boolean | null | Record<string, unknown> | unknown[];
    export type StrategyWhereInput = Record<string, unknown>;
    export type StrategyUpdateInput = Record<string, unknown>;
}
