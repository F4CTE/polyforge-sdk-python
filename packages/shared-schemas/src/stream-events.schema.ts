import { z } from 'zod';
import { UuidSchema, DecimalStringSchema } from './common.schema';

// ─── stream:events — all events published by backend services ─────────────────
// Validated when consuming from Redis streams.

export const BaseEventSchema = z.object({
    event_type: z.string(),
    userId:     UuidSchema.optional(),
    requestId:  UuidSchema.optional(),
    timestamp:  z.coerce.number(),
});

export const OrderPlacedEventSchema = BaseEventSchema.extend({
    event_type: z.literal('ORDER_PLACED'),
    userId:     UuidSchema,
    orderId:    UuidSchema,
    intentId:   UuidSchema,
    strategyId: UuidSchema.nullable(),
    status:     z.literal('PENDING'),
});

export const OrderFilledEventSchema = BaseEventSchema.extend({
    event_type:    z.literal('ORDER_FILLED'),
    userId:        UuidSchema,
    orderId:       UuidSchema,
    filledSize:    DecimalStringSchema,
    avgFillPrice:  DecimalStringSchema,
    pnl:           DecimalStringSchema,
});

export const OrderCancelledEventSchema = BaseEventSchema.extend({
    event_type: z.literal('ORDER_CANCELLED'),
    userId:     UuidSchema,
    orderId:    UuidSchema,
    reason:     z.string(),
});

export const OrderFailedEventSchema = BaseEventSchema.extend({
    event_type: z.literal('ORDER_FAILED'),
    userId:     UuidSchema,
    orderId:    UuidSchema,
    error:      z.string(),
});

export const OrderErrorEventSchema = BaseEventSchema.extend({
    event_type: z.literal('ORDER_ERROR'),
    userId:     UuidSchema,
    orderId:    UuidSchema,
    intentId:   UuidSchema,
    error:      z.string(),
});

export const StrategyStartedEventSchema = BaseEventSchema.extend({
    event_type: z.literal('STRATEGY_STARTED'),
    userId:     UuidSchema,
    strategyId: UuidSchema,
});

export const StrategyStoppedEventSchema = BaseEventSchema.extend({
    event_type: z.literal('STRATEGY_STOPPED'),
    userId:     UuidSchema,
    strategyId: UuidSchema,
    reason:     z.string().optional(),
});

export const StrategyPausedEventSchema = BaseEventSchema.extend({
    event_type: z.literal('STRATEGY_PAUSED'),
    userId:     UuidSchema,
    strategyId: UuidSchema,
    reason:     z.string().optional(),
});

export const BacktestCompletedEventSchema = BaseEventSchema.extend({
    event_type: z.literal('BACKTEST_COMPLETED'),
    userId:     UuidSchema,
    runId:      UuidSchema,
    totalPnl:   DecimalStringSchema,
    winRate:    DecimalStringSchema,
});

export const PriceAlertTriggeredEventSchema = BaseEventSchema.extend({
    event_type: z.literal('PRICE_ALERT_TRIGGERED'),
    userId:     UuidSchema,
    alertId:    UuidSchema,
    tokenId:    z.string().min(1),
    price:      DecimalStringSchema,
    direction:  z.enum(['above', 'below']),
});

// ─── Union of all event types ─────────────────────────────────────────────────

export const StreamEventSchema = z.discriminatedUnion('event_type', [
    OrderPlacedEventSchema,
    OrderFilledEventSchema,
    OrderCancelledEventSchema,
    OrderFailedEventSchema,
    OrderErrorEventSchema,
    StrategyStartedEventSchema,
    StrategyStoppedEventSchema,
    StrategyPausedEventSchema,
    BacktestCompletedEventSchema,
    PriceAlertTriggeredEventSchema,
]);

export type StreamEvent = z.infer<typeof StreamEventSchema>;
