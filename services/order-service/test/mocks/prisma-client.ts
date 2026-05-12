/**
 * Lightweight mock of the generated Prisma client enums.
 * Used by vitest via resolve.alias so test imports of '.prisma/client'
 * don't require a generated client on disk.
 */

export const OrderOutcome = { YES: 'YES', NO: 'NO' } as const;
export type OrderOutcome = (typeof OrderOutcome)[keyof typeof OrderOutcome];

export const OrderStatus = {
    PENDING: 'PENDING',
    SUBMITTED: 'SUBMITTED',
    LIVE: 'LIVE',
    MATCHED: 'MATCHED',
    FILLED: 'FILLED',
    CONFIRMED: 'CONFIRMED',
    PARTIALLY_FILLED: 'PARTIALLY_FILLED',
    CANCELLED: 'CANCELLED',
    DELAYED: 'DELAYED',
    MINED: 'MINED',
    FAILED: 'FAILED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
