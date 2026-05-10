import { z } from "zod";
import {
  UuidSchema,
  DecimalStringSchema,
  PriceStringSchema,
} from "./common.schema";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const OrderSideSchema = z.enum(["BUY", "SELL"]);
export const OrderOutcomeSchema = z.enum(["YES", "NO"]);
export const OrderTypeSchema = z.enum(["GTC", "GTD", "FOK", "FAK"]);
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
  userId: UuidSchema,
  strategyId: UuidSchema.nullable(),
  marketId: z.string().min(1),
  tokenId: z.string().min(1),
  side: OrderSideSchema,
  outcome: OrderOutcomeSchema,
  size: DecimalStringSchema,
  price: PriceStringSchema,
  orderType: OrderTypeSchema,
  venue: VenueIdSchema.optional(),
});

export type OrderIntentSchema = z.infer<typeof OrderIntentSchema>;

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
