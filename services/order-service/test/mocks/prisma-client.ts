/**
 * Lightweight mock of the generated Prisma client enums.
 * Used by vitest via resolve.alias so test imports of '.prisma/client'
 * don't require a generated client on disk.
 */

export const OrderOutcome = { YES: 'YES', NO: 'NO' } as const;
export type OrderOutcome = (typeof OrderOutcome)[keyof typeof OrderOutcome];

export const OrderStatus = {
    PENDING: 'PENDING',
    MATCHED: 'MATCHED',
    FILLED: 'FILLED',
    PARTIALLY_FILLED: 'PARTIALLY_FILLED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
