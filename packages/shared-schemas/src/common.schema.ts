import { z } from "zod";

// ─── Primitives ───────────────────────────────────────────────────────────────

/** UUID v4 string */
export const UuidSchema = z.string().uuid();

/** Decimal string — for all monetary / price values; never float */
export const DecimalStringSchema = z.string().regex(/^\d+(\.\d+)?$/, {
  message: 'Must be a decimal string (e.g. "1.50", "0.72")',
});

/** Price in [0, 1] exclusive — Polymarket outcome price format */
export const PriceStringSchema = z.string().regex(/^0\.\d+$/, {
  message: 'Price must be a decimal between 0 and 1 exclusive (e.g. "0.72")',
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

// ─── ISO datetime ─────────────────────────────────────────────────────────────

export const IsoDateSchema = z
  .string()
  .datetime({ message: "Must be an ISO 8601 datetime string" });
