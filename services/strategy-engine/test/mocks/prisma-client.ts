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
