import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TicketReminderService } from "./ticket-reminder.service";

// ──── Factories ──────────────────────────────────────────────────────────────

function makeStaleTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    userId: "user-1",
    subject: "Help needed",
    status: "AWAITING_USER",
    updatedAt: new Date("2025-01-01"),
    reminderSentAt: null,
    user: { email: "alice@dev.local", username: "alice" },
    ...overrides,
  };
}

function makePrisma() {
  return {
    ticket: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

function makeRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    getClient: () => ({
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    }),
  };
}

function makeMail() {
  return {
    sendTicketReminderEmail: vi.fn().mockResolvedValue(undefined),
  };
}

// ──── Suite ──────────────────────────────────────────────────────────────────

describe("TicketReminderService", () => {
  let service: TicketReminderService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let mail: ReturnType<typeof makeMail>;

  beforeEach(() => {
    prisma = makePrisma();
    redis = makeRedis();
    mail = makeMail();
    service = new TicketReminderService(
      prisma as any,
      redis as any,
      mail as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when no stale tickets exist", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.checkStaleTickets();

    expect(mail.sendTicketReminderEmail).not.toHaveBeenCalled();
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("sends reminder email for stale tickets", async () => {
    const ticket = makeStaleTicket();
    prisma.ticket.findMany.mockResolvedValue([ticket] as any);

    await service.checkStaleTickets();

    expect(mail.sendTicketReminderEmail).toHaveBeenCalledWith(
      "alice@dev.local",
      "alice",
      "ticket-1",
      "Help needed",
    );
  });

  it("updates reminderSentAt after sending", async () => {
    prisma.ticket.findMany.mockResolvedValue([makeStaleTicket()] as any);

    await service.checkStaleTickets();

    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: { reminderSentAt: expect.any(Date) },
    });
  });

  it("uses configurable cutoff hours from Redis", async () => {
    redis.get.mockResolvedValue("24");
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.checkStaleTickets();

    expect(redis.get).toHaveBeenCalledWith("config:ticket_reminder_hours");
    // The query should use the cutoff — verifying findMany was called
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "AWAITING_USER",
          reminderSentAt: null,
        }),
      }),
    );
  });

  it("defaults to 48 hours when Redis has no config", async () => {
    redis.get.mockResolvedValue(null);
    prisma.ticket.findMany.mockResolvedValue([]);

    await service.checkStaleTickets();

    // Should still query — just with default 48h cutoff
    expect(prisma.ticket.findMany).toHaveBeenCalled();
  });

  it("continues processing other tickets when one email fails", async () => {
    const tickets = [
      makeStaleTicket({ id: "ticket-1" }),
      makeStaleTicket({
        id: "ticket-2",
        user: { email: "bob@dev.local", username: "bob" },
      }),
    ];
    prisma.ticket.findMany.mockResolvedValue(tickets as any);
    mail.sendTicketReminderEmail
      .mockRejectedValueOnce(new Error("SMTP down"))
      .mockResolvedValueOnce(undefined);

    await service.checkStaleTickets();

    // First failed, second should still be sent
    expect(mail.sendTicketReminderEmail).toHaveBeenCalledTimes(2);
    // Only the second should update reminderSentAt
    expect(prisma.ticket.update).toHaveBeenCalledTimes(1);
    expect(prisma.ticket.update).toHaveBeenCalledWith({
      where: { id: "ticket-2" },
      data: { reminderSentAt: expect.any(Date) },
    });
  });

  it("sends reminders for multiple stale tickets", async () => {
    const tickets = [
      makeStaleTicket({ id: "t-1" }),
      makeStaleTicket({ id: "t-2" }),
      makeStaleTicket({ id: "t-3" }),
    ];
    prisma.ticket.findMany.mockResolvedValue(tickets as any);

    await service.checkStaleTickets();

    expect(mail.sendTicketReminderEmail).toHaveBeenCalledTimes(3);
    expect(prisma.ticket.update).toHaveBeenCalledTimes(3);
  });
});
