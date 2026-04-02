/**
 * Lightweight mock of the generated Prisma client enums.
 * Used by vitest via resolve.alias so test imports of '.prisma/client'
 * don't require a generated client on disk.
 */

export const OrderSide = { BUY: 'BUY', SELL: 'SELL' } as const;
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

export const OrderOutcome = { YES: 'YES', NO: 'NO' } as const;
export type OrderOutcome = (typeof OrderOutcome)[keyof typeof OrderOutcome];

export const OrderType = { GTC: 'GTC', GTD: 'GTD', FOK: 'FOK', FAK: 'FAK' } as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  LIVE: 'LIVE',
  MATCHED: 'MATCHED',
  DELAYED: 'DELAYED',
  MINED: 'MINED',
  CONFIRMED: 'CONFIRMED',
  PARTIAL: 'PARTIAL',
  CANCELLED: 'CANCELLED',
  UNMATCHED: 'UNMATCHED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
