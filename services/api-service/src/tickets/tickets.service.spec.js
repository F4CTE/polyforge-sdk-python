"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const tickets_service_1 = require("./tickets.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ──── Factories ──────────────────────────────────────────────────────────────
function makeTicket(overrides = {}) {
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
function makeMessage(overrides = {}) {
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
function makeCreateDto(overrides = {}) {
    return {
        subject: "Login issue",
        category: "TECHNICAL",
        body: "I can't log in to my account",
        ...overrides,
    };
}
function makeRedis() {
    return {
        xadd: vitest_1.vi.fn().mockResolvedValue("1-0"),
    };
}
// ──── Suite ──────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("TicketsService", () => {
    let service;
    let db;
    let redis;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        redis = makeRedis();
        // Mock $transaction to execute the callback with the db proxy
        db.$transaction = vitest_1.vi
            .fn()
            .mockImplementation(async (cb) => cb(db));
        service = new tickets_service_1.TicketsService(db, redis);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ─── create ──────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("create", () => {
        (0, vitest_1.it)("creates a ticket and first message in a transaction", async () => {
            const ticket = makeTicket();
            db.ticket.create.mockResolvedValue(ticket);
            db.ticketMessage.create.mockResolvedValue(makeMessage());
            const result = await service.create("user-1", "alice", makeCreateDto());
            (0, vitest_1.expect)(result).toEqual(ticket);
            (0, vitest_1.expect)(db.ticket.create).toHaveBeenCalledWith({
                data: vitest_1.expect.objectContaining({
                    userId: "user-1",
                    subject: "Login issue",
                    category: "TECHNICAL",
                    status: "OPEN",
                }),
            });
            (0, vitest_1.expect)(db.ticketMessage.create).toHaveBeenCalledWith({
                data: vitest_1.expect.objectContaining({
                    senderId: "user-1",
                    senderName: "alice",
                    isAdmin: false,
                    body: "I can't log in to my account",
                }),
            });
        });
        (0, vitest_1.it)("emits TICKET_CREATED event to stream:events", async () => {
            db.ticket.create.mockResolvedValue(makeTicket());
            db.ticketMessage.create.mockResolvedValue(makeMessage());
            await service.create("user-1", "alice", makeCreateDto());
            (0, vitest_1.expect)(redis.xadd).toHaveBeenCalledWith("stream:events", vitest_1.expect.objectContaining({
                event_type: "TICKET_CREATED",
                userId: "user-1",
                ticketId: "ticket-1",
                subject: "Login issue",
            }));
        });
        (0, vitest_1.it)("defaults category to GENERAL when not provided", async () => {
            const dto = makeCreateDto({ category: undefined });
            db.ticket.create.mockResolvedValue(makeTicket({ category: "GENERAL" }));
            db.ticketMessage.create.mockResolvedValue(makeMessage());
            await service.create("user-1", "alice", dto);
            (0, vitest_1.expect)(db.ticket.create).toHaveBeenCalledWith({
                data: vitest_1.expect.objectContaining({ category: "GENERAL" }),
            });
        });
    });
    // ─── listMy ──────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("listMy", () => {
        (0, vitest_1.it)("returns paginated tickets for the user ordered by updatedAt desc", async () => {
            const tickets = [makeTicket(), makeTicket({ id: "ticket-2" })];
            db.ticket.findMany.mockResolvedValue(tickets);
            db.ticket.count.mockResolvedValue(2);
            const result = await service.listMy("user-1", 1, 20);
            (0, vitest_1.expect)(result.data).toEqual(tickets);
            (0, vitest_1.expect)(result.total).toBe(2);
            (0, vitest_1.expect)(result.page).toBe(1);
            (0, vitest_1.expect)(result.totalPages).toBe(1);
            (0, vitest_1.expect)(result.hasNext).toBe(false);
            (0, vitest_1.expect)(db.ticket.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: { userId: "user-1" },
                orderBy: { updatedAt: "desc" },
                skip: 0,
                take: 20,
            }));
        });
        (0, vitest_1.it)("computes pagination correctly for multiple pages", async () => {
            db.ticket.findMany.mockResolvedValue([makeTicket()]);
            db.ticket.count.mockResolvedValue(45);
            const result = await service.listMy("user-1", 2, 20);
            (0, vitest_1.expect)(result.totalPages).toBe(3);
            (0, vitest_1.expect)(result.hasNext).toBe(true);
            (0, vitest_1.expect)(db.ticket.findMany).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ skip: 20, take: 20 }));
        });
        (0, vitest_1.it)("includes latest message in the response", async () => {
            db.ticket.findMany.mockResolvedValue([]);
            db.ticket.count.mockResolvedValue(0);
            await service.listMy("user-1", 1, 20);
            const call = db.ticket.findMany.mock.calls[0][0];
            (0, vitest_1.expect)(call.include.messages).toBeDefined();
            (0, vitest_1.expect)(call.include.messages.take).toBe(1);
            (0, vitest_1.expect)(call.include.messages.orderBy).toEqual({ createdAt: "desc" });
        });
    });
    // ─── getOne ──────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("getOne", () => {
        (0, vitest_1.it)("returns ticket with all messages when user owns it", async () => {
            const ticket = makeTicket({ messages: [makeMessage()] });
            db.ticket.findUnique.mockResolvedValue(ticket);
            const result = await service.getOne("ticket-1", "user-1");
            (0, vitest_1.expect)(result).toEqual(ticket);
            (0, vitest_1.expect)(db.ticket.findUnique).toHaveBeenCalledWith({
                where: { id: "ticket-1" },
                include: { messages: { orderBy: { createdAt: "asc" } } },
            });
        });
        (0, vitest_1.it)("throws NotFoundException when ticket does not exist", async () => {
            db.ticket.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.getOne("ghost", "user-1")).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("includes code NOT_FOUND in the exception", async () => {
            db.ticket.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.getOne("ghost", "user-1")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
            });
        });
        (0, vitest_1.it)("throws ForbiddenException when user does not own the ticket", async () => {
            db.ticket.findUnique.mockResolvedValue(makeTicket({ userId: "other-user" }));
            await (0, vitest_1.expect)(service.getOne("ticket-1", "user-1")).rejects.toThrow(common_1.ForbiddenException);
        });
        (0, vitest_1.it)("includes code FORBIDDEN in the exception", async () => {
            db.ticket.findUnique.mockResolvedValue(makeTicket({ userId: "other-user" }));
            await (0, vitest_1.expect)(service.getOne("ticket-1", "user-1")).rejects.toMatchObject({
                response: { code: "FORBIDDEN" },
            });
        });
    });
    // ─── addMessage ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)("addMessage", () => {
        (0, vitest_1.it)("creates a message and sets status to AWAITING_ADMIN", async () => {
            db.ticket.findUnique.mockResolvedValue(makeTicket());
            const msg = makeMessage();
            db.ticketMessage.create.mockResolvedValue(msg);
            db.ticket.update.mockResolvedValue(makeTicket({ status: "AWAITING_ADMIN" }));
            const result = await service.addMessage("ticket-1", "user-1", "alice", {
                body: "Still broken",
            });
            (0, vitest_1.expect)(result).toEqual(msg);
            (0, vitest_1.expect)(db.ticketMessage.create).toHaveBeenCalledWith({
                data: vitest_1.expect.objectContaining({
                    ticketId: "ticket-1",
                    senderId: "user-1",
                    senderName: "alice",
                    isAdmin: false,
                    body: "Still broken",
                }),
            });
            (0, vitest_1.expect)(db.ticket.update).toHaveBeenCalledWith({
                where: { id: "ticket-1" },
                data: { status: "AWAITING_ADMIN", reminderSentAt: null },
            });
        });
        (0, vitest_1.it)("throws NotFoundException when ticket does not exist", async () => {
            db.ticket.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.addMessage("ghost", "user-1", "alice", { body: "test" })).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws ForbiddenException when user does not own the ticket", async () => {
            db.ticket.findUnique.mockResolvedValue(makeTicket({ userId: "other-user" }));
            await (0, vitest_1.expect)(service.addMessage("ticket-1", "user-1", "alice", {
                body: "test",
            })).rejects.toThrow(common_1.ForbiddenException);
        });
        (0, vitest_1.it)("throws ForbiddenException with TICKET_CLOSED code on closed tickets", async () => {
            db.ticket.findUnique.mockResolvedValue(makeTicket({ status: "CLOSED" }));
            await (0, vitest_1.expect)(service.addMessage("ticket-1", "user-1", "alice", {
                body: "test",
            })).rejects.toMatchObject({
                response: { code: "TICKET_CLOSED" },
            });
        });
        (0, vitest_1.it)("clears reminderSentAt when user replies", async () => {
            db.ticket.findUnique.mockResolvedValue(makeTicket({ reminderSentAt: new Date() }));
            db.ticketMessage.create.mockResolvedValue(makeMessage());
            db.ticket.update.mockResolvedValue({});
            await service.addMessage("ticket-1", "user-1", "alice", {
                body: "reply",
            });
            (0, vitest_1.expect)(db.ticket.update).toHaveBeenCalledWith({
                where: { id: "ticket-1" },
                data: vitest_1.expect.objectContaining({ reminderSentAt: null }),
            });
        });
    });
});
//# sourceMappingURL=tickets.service.spec.js.map