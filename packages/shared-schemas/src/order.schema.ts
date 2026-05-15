import { z } from "zod";
import { UuidSchema, DecimalStringSchema, PriceStringSchema } from "./common.schema";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const OrderTypeSchema = z.enum(["GTC", "GTD", "FOK", "FAK", "POST_ONLY"]);

export const OrderSideSchema = z.enum(["BUY", "SELL"]);
export const OrderOutcomeSchema = z.enum(["YES", "NO"]);
export const OrderStatusSchema = z.enum([
  "PENDING",
  "SUBMITTED",
  "LIVE",
  "MATCHED",
  "DELAYED",
  "MINED",
  "CONFIRMED",
  "PARTIAL",
  "CANCELLED",
  "UNMATCHED",
  "FAILED",
  "ERROR",
]);

// ─── Order intent (published to stream:orders by strategy-engine) ─────────────

export const VenueIdSchema = z.enum(["polymarket", "polymarket_us", "kalshi"]);

export const OrderIntentSchema = z.object({
  intentId: UuidSchema,
  orderId: UuidSchema.optional(),
  userId: UuidSchema,
  strategyId: UuidSchema.nullish().default(null),
  copyTradeId: UuidSchema.optional(),
  marketId: z.string().min(1),
  tokenId: z.string().min(1),
  side: OrderSideSchema,
  outcome: OrderOutcomeSchema,
  size: DecimalStringSchema,
  price: PriceStringSchema,
  orderType: OrderTypeSchema,
  expiration: z.number().positive().optional(),
  tickSize: DecimalStringSchema.optional(),
  negRisk: z.boolean().optional(),
  venue: VenueIdSchema.optional(),
  kalshiSubaccount: z.number().int().min(0).optional(),
});

export type OrderIntentType = z.infer<typeof OrderIntentSchema>;

// ─── Redis stream raw message (all fields are strings) ──────────────────────
// Used when consuming from Redis Streams where XREAD returns string[] fields.

const NonEmptyString = z.string().min(1);

export const StreamOrderIntentSchema = z
  .object({
    intentId: NonEmptyString,
    orderId: NonEmptyString.optional(),
    userId: NonEmptyString,
    strategyId: z.string().optional(),
    copyTradeId: NonEmptyString.optional(),
    marketId: NonEmptyString,
    tokenId: NonEmptyString,
    side: NonEmptyString,
    outcome: NonEmptyString,
    size: NonEmptyString,
    price: NonEmptyString,
    orderType: NonEmptyString,
    expiration: NonEmptyString.optional(),
    tickSize: NonEmptyString.optional(),
    negRisk: NonEmptyString.optional(),
    venue: NonEmptyString.optional(),
    kalshiSubaccount: NonEmptyString.optional(),
  })
  .passthrough();

export type StreamOrderIntent = z.infer<typeof StreamOrderIntentSchema>;

// ─── Close position request ───────────────────────────────────────────────────

export const ClosePositionSchema = z.object({
  tokenId: z.string().min(1),
  size: DecimalStringSchema.optional(),
});

export type ClosePositionSchema = z.infer<typeof ClosePositionSchema>;

// ─── Order query filters ──────────────────────────────────────────────────────

export const OrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: OrderStatusSchema.optional(),
  strategyId: UuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type OrderQuerySchema = z.infer<typeof OrderQuerySchema>;
