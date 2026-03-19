import { z } from "zod";
import { UuidSchema, PaginationSchema } from "./common.schema";

// ─── Ticket enums ───────────────────────────────────────────────────────────

export const TicketStatusEnum = z.enum([
  "OPEN",
  "AWAITING_USER",
  "AWAITING_ADMIN",
  "CLOSED",
]);

export const TicketPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const TicketCategoryEnum = z.enum([
  "GENERAL",
  "BILLING",
  "TECHNICAL",
  "ACCOUNT",
  "BUG",
  "FEATURE_REQUEST",
]);

// ─── User-facing schemas ────────────────────────────────────────────────────

export const CreateTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  category: TicketCategoryEnum.optional().default("GENERAL"),
  body: z.string().min(1).max(5000),
});

export const TicketMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const TicketQuerySchema = PaginationSchema.extend({
  status: TicketStatusEnum.optional(),
  category: TicketCategoryEnum.optional(),
});

// ─── Admin-facing schemas ───────────────────────────────────────────────────

export const AdminTicketQuerySchema = PaginationSchema.extend({
  status: TicketStatusEnum.optional(),
  priority: TicketPriorityEnum.optional(),
  assignedTo: UuidSchema.optional(),
});

export const UpdateTicketSchema = z.object({
  status: TicketStatusEnum.optional(),
  priority: TicketPriorityEnum.optional(),
  assignedTo: UuidSchema.nullable().optional(),
});
