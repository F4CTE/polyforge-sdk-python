/**
 * Lightweight mock of the generated Prisma client enums.
 * Used by vitest via resolve.alias so test imports of '.prisma/client'
 * don't require a generated client on disk.
 */

// Stub PrismaClient so that PrismaService (which extends it) can be loaded.
export class PrismaClient {
  protected $connect() { return Promise.resolve(); }
  protected $disconnect() { return Promise.resolve(); }
  static get dmmf() { return {}; }
}

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

export const ResolutionStatus = { UNRESOLVED: 'UNRESOLVED', RESOLVED_YES: 'RESOLVED_YES', RESOLVED_NO: 'RESOLVED_NO' } as const;
export type ResolutionStatus = (typeof ResolutionStatus)[keyof typeof ResolutionStatus];

// Stub types used by the strategies service
export type Strategy = Record<string, unknown>;
export type InputJsonValue = string | number | boolean | null | Record<string, unknown> | unknown[];
export const Prisma = {
    Decimal: class Decimal {
      value: string;
      constructor(value: string | number) { this.value = String(value); }
      toFixed(precision: number) { return parseFloat(this.value).toFixed(precision); }
      toString() { return this.value; }
      valueOf() { return parseFloat(this.value); }
    },
} as const;
export namespace Prisma {
    export type Decimal = InstanceType<typeof Prisma.Decimal>;
    export type InputJsonValue = string | number | boolean | null | Record<string, unknown> | unknown[];
    export type StrategyWhereInput = Record<string, unknown>;
    export type StrategyUpdateInput = Record<string, unknown>;
}
