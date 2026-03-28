// ─────────────────────────────────────────────────────────────────────────────
// Ticket types
// ─────────────────────────────────────────────────────────────────────────────

export enum TicketStatus {
  OPEN = "OPEN",
  AWAITING_USER = "AWAITING_USER",
  AWAITING_ADMIN = "AWAITING_ADMIN",
  CLOSED = "CLOSED",
}

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum TicketCategory {
  GENERAL = "GENERAL",
  BILLING = "BILLING",
  TECHNICAL = "TECHNICAL",
  ACCOUNT = "ACCOUNT",
  BUG = "BUG",
  FEATURE_REQUEST = "FEATURE_REQUEST",
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  userId: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail extends Ticket {
  closedBy: string | null;
  closedAt: string | null;
  messages: TicketMessage[];
}
