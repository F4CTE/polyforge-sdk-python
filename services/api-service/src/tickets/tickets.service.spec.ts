import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ──── Factories ──────────────────────────────────────────────────────────────

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    userId: "user-1",
    subject: "Login issue",
    category: "TECHNICAL",
    status: "OPEN",
    priority: "MEDIUM",
    assignedTo: null,
    closedBy: null,
    closedAt: null,
    reminderSentAt: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    ticketId: "ticket-1",
    senderId: "user-1",
    senderName: "alice",
    isAdmin: false,
    body: "I can't log in",
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeCreateDto(overrides: Record<string, unknown> = {}) {
  return {
    subject: "Login issue",
    category: "TECHNICAL",
    body: "I can't log in to my account",
    ...overrides,
  };
}

function makeRedis() {
  return {
    xadd: vi.fn().mockResolvedValue("1-0"),
  };
}

// ──── Suite ──────────────────────────────────────────────────────────────────

describe("TicketsService", () => {
  let service: TicketsService;
  let db: MockDb;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    db = createMockDb();
    redis = makeRedis();
    // Mock $transaction to execute the callback with the db proxy
    (db as any).$transaction = vi
      .fn()
      .mockImplementation(async (cb: any) => cb(db));
    service = new TicketsService(db as any, redis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a ticket and first message in a transaction", async () => {
      const ticket = makeTicket();
      db.ticket.create.mockResolvedValue(ticket as any);
      db.ticketMessage.create.mockResolvedValue(makeMessage() as any);

      const result = await service.create(
        "user-1",
        "alice",
        makeCreateDto() as any,
      );

      expect(result).toEqual(ticket);
      expect(db.ticket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          subject: "Login issue",
          category: "TECHNICAL",
          status: "OPEN",
        }),
      });
      expect(db.ticketMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderId: "user-1",
          senderName: "alice",
          isAdmin: false,
          body: "I can't log in to my account",
        }),
      });
    });

    it("emits TICKET_CREATED event to stream:events", async () => {
      db.ticket.create.mockResolvedValue(makeTicket() as any);
      db.ticketMessage.create.mockResolvedValue(makeMessage() as any);

      await service.create("user-1", "alice", makeCreateDto() as any);

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          event_type: "TICKET_CREATED",
          userId: "user-1",
          ticketId: "ticket-1",
          subject: "Login issue",
        }),
      );
    });

    it("defaults category to GENERAL when not provided", async () => {
      const dto = makeCreateDto({ category: undefined });
      db.ticket.create.mockResolvedValue(
        makeTicket({ category: "GENERAL" }) as any,
      );
      db.ticketMessage.create.mockResolvedValue(makeMessage() as any);

      await service.create("user-1", "alice", dto as any);

      expect(db.ticket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ category: "GENERAL" }),
      });
    });
  });

  // ─── listMy ──────────────────────────────────────────────────────────────

  describe("listMy", () => {
    it("returns paginated tickets for the user ordered by updatedAt desc", async () => {
      const tickets = [makeTicket(), makeTicket({ id: "ticket-2" })];
      db.ticket.findMany.mockResolvedValue(tickets as any);
      db.ticket.count.mockResolvedValue(2);

      const result = await service.listMy("user-1", 1, 20);

      expect(result.data).toEqual(tickets);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(db.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          orderBy: { updatedAt: "desc" },
          skip: 0,
          take: 20,
        }),
      );
    });

    it("computes pagination correctly for multiple pages", async () => {
      db.ticket.findMany.mockResolvedValue([makeTicket()] as any);
      db.ticket.count.mockResolvedValue(45);

      const result = await service.listMy("user-1", 2, 20);

      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(true);
      expect(db.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it("includes latest message in the response", async () => {
      db.ticket.findMany.mockResolvedValue([] as any);
      db.ticket.count.mockResolvedValue(0);

      await service.listMy("user-1", 1, 20);

      const call = db.ticket.findMany.mock.calls[0][0] as any;
      expect(call.include.messages).toBeDefined();
      expect(call.include.messages.take).toBe(1);
      expect(call.include.messages.orderBy).toEqual({ createdAt: "desc" });
    });
  });

  // ─── getOne ──────────────────────────────────────────────────────────────

  describe("getOne", () => {
    it("returns ticket with all messages when user owns it", async () => {
      const ticket = makeTicket({ messages: [makeMessage()] });
      db.ticket.findUnique.mockResolvedValue(ticket as any);

      const result = await service.getOne("ticket-1", "user-1");

      expect(result).toEqual(ticket);
      expect(db.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    });

    it("throws NotFoundException when ticket does not exist", async () => {
      db.ticket.findUnique.mockResolvedValue(null);

      await expect(service.getOne("ghost", "user-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("includes code NOT_FOUND in the exception", async () => {
      db.ticket.findUnique.mockResolvedValue(null);

      await expect(service.getOne("ghost", "user-1")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("throws ForbiddenException when user does not own the ticket", async () => {
      db.ticket.findUnique.mockResolvedValue(
        makeTicket({ userId: "other-user" }) as any,
      );

      await expect(service.getOne("ticket-1", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("includes code FORBIDDEN in the exception", async () => {
      db.ticket.findUnique.mockResolvedValue(
        makeTicket({ userId: "other-user" }) as any,
      );

      await expect(service.getOne("ticket-1", "user-1")).rejects.toMatchObject({
        response: { code: "FORBIDDEN" },
      });
    });
  });

  // ─── addMessage ──────────────────────────────────────────────────────────

  describe("addMessage", () => {
    it("creates a message and sets status to AWAITING_ADMIN", async () => {
      db.ticket.findUnique.mockResolvedValue(makeTicket() as any);
      const msg = makeMessage();
      db.ticketMessage.create.mockResolvedValue(msg as any);
      db.ticket.update.mockResolvedValue(
        makeTicket({ status: "AWAITING_ADMIN" }) as any,
      );

      const result = await service.addMessage("ticket-1", "user-1", "alice", {
        body: "Still broken",
      } as any);

      expect(result).toEqual(msg);
      expect(db.ticketMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: "ticket-1",
          senderId: "user-1",
          senderName: "alice",
          isAdmin: false,
          body: "Still broken",
        }),
      });
      expect(db.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: { status: "AWAITING_ADMIN", reminderSentAt: null },
      });
    });

    it("throws NotFoundException when ticket does not exist", async () => {
      db.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.addMessage("ghost", "user-1", "alice", { body: "test" } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when user does not own the ticket", async () => {
      db.ticket.findUnique.mockResolvedValue(
        makeTicket({ userId: "other-user" }) as any,
      );

      await expect(
        service.addMessage("ticket-1", "user-1", "alice", {
          body: "test",
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws ForbiddenException with TICKET_CLOSED code on closed tickets", async () => {
      db.ticket.findUnique.mockResolvedValue(
        makeTicket({ status: "CLOSED" }) as any,
      );

      await expect(
        service.addMessage("ticket-1", "user-1", "alice", {
          body: "test",
        } as any),
      ).rejects.toMatchObject({
        response: { code: "TICKET_CLOSED" },
      });
    });

    it("clears reminderSentAt when user replies", async () => {
      db.ticket.findUnique.mockResolvedValue(
        makeTicket({ reminderSentAt: new Date() }) as any,
      );
      db.ticketMessage.create.mockResolvedValue(makeMessage() as any);
      db.ticket.update.mockResolvedValue({} as any);

      await service.addMessage("ticket-1", "user-1", "alice", {
        body: "reply",
      } as any);

      expect(db.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: expect.objectContaining({ reminderSentAt: null }),
      });
    });
  });
});
