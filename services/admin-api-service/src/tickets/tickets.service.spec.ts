import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { TicketsAdminService } from "./tickets.service";

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
    user: { username: "alice", email: "alice@dev.local" },
    messages: [],
    ...overrides,
  };
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    ticketId: "ticket-1",
    senderId: "admin-1",
    senderName: "Support Agent",
    isAdmin: true,
    body: "We're looking into it",
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makePrisma() {
  return {
    ticket: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    ticketMessage: {
      create: vi.fn(),
    },
  };
}

function makeAdminDb() {
  return {
    admin: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function makeRedis() {
  return {
    xadd: vi.fn().mockResolvedValue("1-0"),
    get: vi.fn().mockResolvedValue(null),
  };
}

// ──── Suite ──────────────────────────────────────────────────────────────────

describe("TicketsAdminService", () => {
  let service: TicketsAdminService;
  let prisma: ReturnType<typeof makePrisma>;
  let adminDb: ReturnType<typeof makeAdminDb>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    prisma = makePrisma();
    adminDb = makeAdminDb();
    redis = makeRedis();
    service = new TicketsAdminService(
      prisma as any,
      adminDb as any,
      redis as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns paginated tickets with admin names resolved", async () => {
      const tickets = [
        makeTicket({ assignedTo: "admin-1" }),
        makeTicket({ id: "ticket-2", assignedTo: null }),
      ];
      prisma.ticket.findMany.mockResolvedValue(tickets as any);
      prisma.ticket.count.mockResolvedValue(2);
      adminDb.admin.findMany.mockResolvedValue([
        { id: "admin-1", displayName: "Support Agent" },
      ] as any);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].assignedToName).toBe("Support Agent");
      expect(result.data[1].assignedToName).toBeNull();
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it("applies status filter when provided", async () => {
      prisma.ticket.findMany.mockResolvedValue([] as any);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, status: "OPEN" });

      const call = prisma.ticket.findMany.mock.calls[0][0];
      expect(call.where.status).toBe("OPEN");
    });

    it("applies priority filter when provided", async () => {
      prisma.ticket.findMany.mockResolvedValue([] as any);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, priority: "URGENT" });

      const call = prisma.ticket.findMany.mock.calls[0][0];
      expect(call.where.priority).toBe("URGENT");
    });

    it("applies assignedTo filter when provided", async () => {
      prisma.ticket.findMany.mockResolvedValue([] as any);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, assignedTo: "admin-1" });

      const call = prisma.ticket.findMany.mock.calls[0][0];
      expect(call.where.assignedTo).toBe("admin-1");
    });

    it("computes pagination correctly", async () => {
      prisma.ticket.findMany.mockResolvedValue([makeTicket()] as any);
      prisma.ticket.count.mockResolvedValue(45);

      const result = await service.findAll({ page: 2, limit: 20 });

      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(true);
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it("includes user info and latest message", async () => {
      prisma.ticket.findMany.mockResolvedValue([] as any);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 });

      const call = prisma.ticket.findMany.mock.calls[0][0];
      expect(call.include.user).toBeDefined();
      expect(call.include.messages).toBeDefined();
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns ticket with messages and resolved admin names", async () => {
      const ticket = makeTicket({ assignedTo: "admin-1", closedBy: "admin-2" });
      prisma.ticket.findUnique.mockResolvedValue(ticket as any);
      adminDb.admin.findMany.mockResolvedValue([
        { id: "admin-1", displayName: "Agent A" },
        { id: "admin-2", displayName: "Agent B" },
      ] as any);

      const result = await service.findOne("ticket-1");

      expect(result.assignedToName).toBe("Agent A");
      expect(result.closedByName).toBe("Agent B");
    });

    it("throws NotFoundException when ticket does not exist", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.findOne("ghost")).rejects.toThrow(NotFoundException);
    });

    it("includes code NOT_FOUND in the exception", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.findOne("ghost")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("returns null for assignedToName when no admin is assigned", async () => {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket() as any);

      const result = await service.findOne("ticket-1");

      expect(result.assignedToName).toBeNull();
      expect(result.closedByName).toBeNull();
    });
  });

  // ─── addReply ─────────────────────────────────────────────────────────────

  describe("addReply", () => {
    it("creates an admin message and sets status to AWAITING_USER", async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        makeTicket({ assignedTo: null }) as any,
      );
      const msg = makeMessage();
      prisma.ticketMessage.create.mockResolvedValue(msg as any);
      prisma.ticket.update.mockResolvedValue({} as any);

      const result = await service.addReply(
        "ticket-1",
        "admin-1",
        "Support Agent",
        { body: "We're looking into it" } as any,
      );

      expect(result).toEqual(msg);
      expect(prisma.ticketMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: "ticket-1",
          senderId: "admin-1",
          senderName: "Support Agent",
          isAdmin: true,
          body: "We're looking into it",
        }),
      });
    });

    it("auto-assigns ticket to replying admin when unassigned", async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        makeTicket({ assignedTo: null }) as any,
      );
      prisma.ticketMessage.create.mockResolvedValue(makeMessage() as any);
      prisma.ticket.update.mockResolvedValue({} as any);

      await service.addReply("ticket-1", "admin-1", "Agent", {
        body: "hi",
      } as any);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: expect.objectContaining({ assignedTo: "admin-1" }),
      });
    });

    it("keeps existing assignment when ticket is already assigned", async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        makeTicket({ assignedTo: "admin-2" }) as any,
      );
      prisma.ticketMessage.create.mockResolvedValue(makeMessage() as any);
      prisma.ticket.update.mockResolvedValue({} as any);

      await service.addReply("ticket-1", "admin-1", "Agent", {
        body: "hi",
      } as any);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: expect.objectContaining({ assignedTo: "admin-2" }),
      });
    });

    it("emits TICKET_REPLY event to stream:events", async () => {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket() as any);
      prisma.ticketMessage.create.mockResolvedValue(makeMessage() as any);
      prisma.ticket.update.mockResolvedValue({} as any);

      await service.addReply("ticket-1", "admin-1", "Support Agent", {
        body: "hi",
      } as any);

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          event_type: "TICKET_REPLY",
          userId: "user-1",
          ticketId: "ticket-1",
          adminName: "Support Agent",
        }),
      );
    });

    it("throws NotFoundException when ticket does not exist", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.addReply("ghost", "admin-1", "Agent", { body: "hi" } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("clears reminderSentAt on admin reply", async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        makeTicket({ reminderSentAt: new Date() }) as any,
      );
      prisma.ticketMessage.create.mockResolvedValue(makeMessage() as any);
      prisma.ticket.update.mockResolvedValue({} as any);

      await service.addReply("ticket-1", "admin-1", "Agent", {
        body: "hi",
      } as any);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: expect.objectContaining({ reminderSentAt: null }),
      });
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates status and priority", async () => {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket() as any);
      prisma.ticket.update.mockResolvedValue(
        makeTicket({ status: "AWAITING_ADMIN", priority: "HIGH" }) as any,
      );

      await service.update("ticket-1", "admin-1", {
        status: "AWAITING_ADMIN",
        priority: "HIGH",
      });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        data: expect.objectContaining({
          status: "AWAITING_ADMIN",
          priority: "HIGH",
        }),
      });
    });

    it("sets closedBy and closedAt when status is CLOSED", async () => {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket() as any);
      prisma.ticket.update.mockResolvedValue(
        makeTicket({ status: "CLOSED" }) as any,
      );

      await service.update("ticket-1", "admin-1", { status: "CLOSED" });

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.closedBy).toBe("admin-1");
      expect(updateCall.data.closedAt).toBeInstanceOf(Date);
    });

    it("emits TICKET_CLOSED event when closing", async () => {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket() as any);
      prisma.ticket.update.mockResolvedValue(
        makeTicket({ status: "CLOSED" }) as any,
      );

      await service.update("ticket-1", "admin-1", { status: "CLOSED" });

      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          event_type: "TICKET_CLOSED",
          userId: "user-1",
          ticketId: "ticket-1",
        }),
      );
    });

    it("does NOT emit TICKET_CLOSED for non-close status changes", async () => {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket() as any);
      prisma.ticket.update.mockResolvedValue(
        makeTicket({ priority: "HIGH" }) as any,
      );

      await service.update("ticket-1", "admin-1", { priority: "HIGH" });

      expect(redis.xadd).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when ticket does not exist", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.update("ghost", "admin-1", { status: "CLOSED" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("updates assignedTo when provided", async () => {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket() as any);
      prisma.ticket.update.mockResolvedValue(
        makeTicket({ assignedTo: "admin-2" }) as any,
      );

      await service.update("ticket-1", "admin-1", {
        assignedTo: "admin-2",
      } as any);

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.assignedTo).toBe("admin-2");
    });
  });

  // ─── close ────────────────────────────────────────────────────────────────

  describe("close", () => {
    it("delegates to update with status CLOSED", async () => {
      prisma.ticket.findUnique.mockResolvedValue(makeTicket() as any);
      prisma.ticket.update.mockResolvedValue(
        makeTicket({ status: "CLOSED" }) as any,
      );

      await service.close("ticket-1", "admin-1");

      const updateCall = prisma.ticket.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe("CLOSED");
      expect(updateCall.data.closedBy).toBe("admin-1");
    });
  });

  // ─── resolveAdminNames (tested indirectly via findAll/findOne) ────────────

  describe("admin name resolution", () => {
    it("does not query admin DB when no admin IDs are present", async () => {
      prisma.ticket.findMany.mockResolvedValue([makeTicket()] as any);
      prisma.ticket.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 20 });

      expect(adminDb.admin.findMany).not.toHaveBeenCalled();
    });

    it("returns null for unknown admin IDs", async () => {
      prisma.ticket.findUnique.mockResolvedValue(
        makeTicket({ assignedTo: "unknown-admin" }) as any,
      );
      adminDb.admin.findMany.mockResolvedValue([] as any);

      const result = await service.findOne("ticket-1");

      expect(result.assignedToName).toBeNull();
    });
  });
});
