import { z } from "zod";
import { UuidSchema, DecimalStringSchema, PriceStringSchema } from "./common.schema";

// ─── stream:events — events published by backend services ─────────────────────
// Validated when consuming from Redis streams.
// Field names match the canonical Redis stream convention: "type" and "ts".
// NOTE: when adding new event types, append them to KnownEventSchemas below
// and update the discriminated union.

const BaseFields = {
  userId: UuidSchema.optional(),
  ts: z.coerce.number(),
} as const;

// ─── Order events ───────────────────────────────────────────────────────────

export const OrderPlacedEventSchema = z.object({
  type: z.literal("ORDER_PLACED"),
  userId: UuidSchema,
  orderId: UuidSchema,
  intentId: UuidSchema.optional(),
  strategyId: UuidSchema.nullish().default(null),
  ts: z.coerce.number(),
});

export const OrderFilledEventSchema = z.object({
  type: z.literal("ORDER_FILLED"),
  userId: UuidSchema,
  orderId: UuidSchema.optional(),
  fillPrice: DecimalStringSchema,
  fillSize: DecimalStringSchema,
  pnl: DecimalStringSchema.optional(),
  copyTradeId: UuidSchema.optional(),
  ts: z.coerce.number(),
});

export const OrderCancelledEventSchema = z.object({
  type: z.literal("ORDER_CANCELLED"),
  userId: UuidSchema,
  orderId: z.string(),
  copyTradeId: UuidSchema.optional(),
  ts: z.coerce.number(),
});

export const OrderFailedEventSchema = z.object({
  type: z.literal("ORDER_FAILED"),
  userId: UuidSchema,
  orderId: UuidSchema,
  reason: z.string(),
  ts: z.coerce.number(),
});

// ─── Strategy events ────────────────────────────────────────────────────────

export const StrategyStartedEventSchema = z.object({
  type: z.literal("STRATEGY_STARTED"),
  userId: UuidSchema,
  strategyId: UuidSchema,
  reason: z.string().optional(),
  ts: z.coerce.number(),
});

export const StrategyStoppedEventSchema = z.object({
  type: z.literal("STRATEGY_STOPPED"),
  userId: UuidSchema,
  strategyId: UuidSchema,
  reason: z.string().optional(),
  ts: z.coerce.number(),
});

export const StrategyPausedEventSchema = z.object({
  type: z.literal("STRATEGY_PAUSED"),
  userId: UuidSchema,
  strategyId: UuidSchema,
  reason: z.string().optional(),
  ts: z.coerce.number(),
});

// ─── Backtest events ────────────────────────────────────────────────────────

export const BacktestProgressEventSchema = z.object({
  type: z.literal("BACKTEST_PROGRESS"),
  userId: UuidSchema,
  runId: UuidSchema,
  progress: z.coerce.number().min(0).max(100),
  ts: z.coerce.number(),
});

// ─── Paper order events ─────────────────────────────────────────────────────

export const PaperOrderFilledEventSchema = z.object({
  type: z.literal("PAPER_ORDER_FILLED"),
  userId: UuidSchema,
  orderId: UuidSchema,
  intentId: UuidSchema,
  strategyId: UuidSchema.nullish().default(null),
  tokenId: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  fillSize: DecimalStringSchema,
  simulatedPrice: DecimalStringSchema,
  ts: z.coerce.number(),
});

// ─── Price alert events ─────────────────────────────────────────────────────

export const PriceAlertTriggeredEventSchema = z.object({
  type: z.literal("PRICE_ALERT_TRIGGERED"),
  userId: UuidSchema,
  alertId: UuidSchema,
  tokenId: z.string().min(1),
  price: DecimalStringSchema,
  direction: z.enum(["above", "below"]),
  ts: z.coerce.number(),
});

// ─── Arbitrage events ───────────────────────────────────────────────────────

export const ArbitrageOpportunityEventSchema = z.object({
  type: z.literal("ARBITRAGE_OPPORTUNITY"),
  matchId: UuidSchema,
  outcome: z.string(),
  polymarketPrice: PriceStringSchema,
  kalshiPrice: DecimalStringSchema,
  spreadPct: DecimalStringSchema,
  direction: z.string(),
  polymarketTitle: z.string(),
  kalshiTitle: z.string(),
  ts: z.coerce.number(),
});

export const ArbitrageCrossVenueEventSchema = z.object({
  type: z.literal("ARBITRAGE_CROSS_VENUE"),
  matchId: UuidSchema,
  polymarketId: z.string().min(1),
  kalshiId: z.string().min(1),
  spreadPct: DecimalStringSchema,
  direction: z.string(),
  ts: z.coerce.number(),
});

// ─── Strategy error events ─────────────────────────────────────────────────

export const StrategyErrorEventSchema = z.object({
  type: z.literal("STRATEGY_ERROR"),
  userId: UuidSchema,
  strategyId: UuidSchema.optional(),
  reason: z.string().optional(),
  ts: z.coerce.number(),
});

// ─── Safety / loss limit events ─────────────────────────────────────────────

export const DailyLossTriggeredEventSchema = z.object({
  type: z.literal("DAILY_LOSS_TRIGGERED"),
  userId: UuidSchema,
  strategyId: UuidSchema.optional(),
  reason: z.string().optional(),
  ts: z.coerce.number(),
});

// ─── Market events ──────────────────────────────────────────────────────────

export const MarketResolvedEventSchema = z.object({
  type: z.literal("MARKET_RESOLVED"),
  userId: UuidSchema.optional(),
  marketId: z.string().optional(),
  outcome: z.string().optional(),
  ts: z.coerce.number(),
});

// ─── Social events ──────────────────────────────────────────────────────────

export const StrategyForkedEventSchema = z.object({
  type: z.literal("STRATEGY_FORKED"),
  userId: UuidSchema,
  strategyId: UuidSchema.optional(),
  strategyName: z.string().optional(),
  forkerUsername: z.string().optional(),
  ts: z.coerce.number(),
});

export const UserFollowedEventSchema = z.object({
  type: z.literal("USER_FOLLOWED"),
  userId: UuidSchema,
  followerUsername: z.string().optional(),
  ts: z.coerce.number(),
});

export const StrategyLikedEventSchema = z.object({
  type: z.literal("STRATEGY_LIKED"),
  userId: UuidSchema,
  strategyId: UuidSchema.optional(),
  strategyName: z.string().optional(),
  likerUsername: z.string().optional(),
  ts: z.coerce.number(),
});

export const StrategyCommentedEventSchema = z.object({
  type: z.literal("STRATEGY_COMMENTED"),
  userId: UuidSchema,
  strategyId: UuidSchema.optional(),
  strategyName: z.string().optional(),
  commenterUsername: z.string().optional(),
  ts: z.coerce.number(),
});

// ─── News / social events ──────────────────────────────────────────────────

export const NewsSignalEventSchema = z.object({
  type: z.literal("NEWS_SIGNAL"),
  signalId: UuidSchema,
  articleId: z.string().min(1),
  marketId: z.string().min(1),
  direction: z.string(),
  outcome: z.string().optional(),
  confidence: z.coerce.number().min(0).max(100),
  articleTitle: z.string(),
  marketTitle: z.string().optional(),
  ts: z.coerce.number(),
});

// ─── Whale events ───────────────────────────────────────────────────────────

export const WhaleTradeEventSchema = z.object({
  type: z.literal("WHALE_TRADE"),
  walletAddress: z.string(),
  marketId: z.string(),
  tokenId: z.string(),
  side: z.string(),
  outcome: z.string(),
  notional: z.string(),
  marketTitle: z.string(),
  classification: z.string(),
  label: z.string(),
  alertId: UuidSchema,
  ts: z.coerce.number(),
});

// ─── User management events ─────────────────────────────────────────────────

export const UserSuspendedEventSchema = z.object({
  type: z.literal("USER_SUSPENDED"),
  userId: UuidSchema,
  ts: z.coerce.number(),
});

// ─── Ticket events ──────────────────────────────────────────────────────────

export const TicketCreatedEventSchema = z.object({
  type: z.literal("TICKET_CREATED"),
  userId: UuidSchema,
  ticketId: UuidSchema,
  subject: z.string(),
  ts: z.coerce.number(),
});

export const TicketReplyEventSchema = z.object({
  type: z.literal("TICKET_REPLY"),
  userId: UuidSchema,
  ticketId: UuidSchema,
  subject: z.string(),
  adminName: z.string().optional(),
  ts: z.coerce.number(),
});

export const TicketClosedEventSchema = z.object({
  type: z.literal("TICKET_CLOSED"),
  userId: UuidSchema,
  ticketId: UuidSchema,
  subject: z.string(),
  ts: z.coerce.number(),
});

// ─── Notification events ────────────────────────────────────────────────────

export const NotificationEventSchema = z.object({
  type: z.literal("NOTIFICATION"),
  userId: UuidSchema,
  id: z.string().min(1),
  title: z.string(),
  body: z.string(),
  severity: z.string().optional(),
  ts: z.coerce.number(),
});

// ─── Circuit breaker events ─────────────────────────────────────────────────

export const CircuitBreakerTriggeredEventSchema = z.object({
  type: z.literal("CIRCUIT_BREAKER_TRIGGERED"),
  userId: UuidSchema,
  drawdownPct: DecimalStringSchema,
  thresholdPct: DecimalStringSchema,
  strategiesPaused: z.coerce.number().int().min(0),
  lookbackHours: z.coerce.number(),
  triggeredAt: z.string(),
});

// ─── Union of all known event types ──────────────────────────────────────────

export const KnownEventSchemas = [
  OrderPlacedEventSchema,
  OrderFilledEventSchema,
  OrderCancelledEventSchema,
  OrderFailedEventSchema,
  StrategyStartedEventSchema,
  StrategyStoppedEventSchema,
  StrategyPausedEventSchema,
  StrategyErrorEventSchema,
  BacktestProgressEventSchema,
  PaperOrderFilledEventSchema,
  PriceAlertTriggeredEventSchema,
  ArbitrageOpportunityEventSchema,
  ArbitrageCrossVenueEventSchema,
  NewsSignalEventSchema,
  DailyLossTriggeredEventSchema,
  MarketResolvedEventSchema,
  StrategyForkedEventSchema,
  UserFollowedEventSchema,
  StrategyLikedEventSchema,
  StrategyCommentedEventSchema,
  WhaleTradeEventSchema,
  UserSuspendedEventSchema,
  TicketCreatedEventSchema,
  TicketReplyEventSchema,
  TicketClosedEventSchema,
  NotificationEventSchema,
  CircuitBreakerTriggeredEventSchema,
] as const;

export const StreamEventSchema = z.discriminatedUnion("type", KnownEventSchemas);

export type StreamEvent = z.infer<typeof StreamEventSchema>;
