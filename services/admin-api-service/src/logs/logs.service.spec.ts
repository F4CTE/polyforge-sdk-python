import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { LogsService } from "./logs.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuditLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "audit-1",
    adminId: "admin-1",
    action: "SUSPEND_USER",
    targetType: "user",
    targetId: "user-42",
    metadata: null,
    createdAt: new Date("2024-06-01T10:00:00"),
    admin: {
      email: "admin@example.com",
      displayName: "Super Admin",
      role: "SUPER_ADMIN",
    },
    ...overrides,
  };
}

function makeEventLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    userId: "user-1",
    eventType: "ORDER_PLACED",
    payload: null,
    createdAt: new Date("2024-06-01T09:00:00"),
    ...overrides,
  };
}

function makeLoginEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "login-1",
    userId: "user-1",
    ip: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    success: true,
    createdAt: new Date("2024-06-01T08:00:00"),
    user: { username: "alice", email: "alice@example.com" },
    ...overrides,
  };
}

function makeNotificationEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "notif-1",
    userId: "user-1",
    channel: "EMAIL",
    eventType: "ORDER_FILLED",
    success: true,
    error: null,
    sentAt: new Date("2024-06-01T07:00:00"),
    user: { username: "alice" },
    ...overrides,
  };
}

function makePrisma() {
  return {
    eventLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    userLoginHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    notificationHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

function makeAdminDb() {
  return {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("LogsService", () => {
  let service: LogsService;
  let prisma: ReturnType<typeof makePrisma>;
  let adminDb: ReturnType<typeof makeAdminDb>;

  beforeEach(() => {
    prisma = makePrisma();
    adminDb = makeAdminDb();
    service = new LogsService(prisma as any, adminDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getAuditLogs ──────────────────────────────────────────────────────────

  describe("getAuditLogs", () => {
    it("returns paginated audit log list with correct shape", async () => {
      const logs = [makeAuditLog(), makeAuditLog({ id: "audit-2" })];
      adminDb.auditLog.findMany.mockResolvedValue(logs as any);
      adminDb.auditLog.count.mockResolvedValue(2);

      const result = await service.getAuditLogs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });

    it("calculates pages correctly for a partial last page", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([makeAuditLog()] as any);
      adminDb.auditLog.count.mockResolvedValue(11);

      const result = await service.getAuditLogs({ page: 1, limit: 10 });

      expect(result.pages).toBe(2);
    });

    it("applies correct skip for page 4 with limit 5", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({ page: 4, limit: 5 });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.skip).toBe(15);
      expect(call.take).toBe(5);
    });

    it("filters by adminId when provided", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({ page: 1, limit: 10, adminId: "admin-99" });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.where.adminId).toBe("admin-99");
    });

    it("omits adminId filter when not provided", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({ page: 1, limit: 10 });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.where.adminId).toBeUndefined();
    });

    it("filters by action when provided", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({
        page: 1,
        limit: 10,
        action: "UNSUSPEND_USER",
      });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.where.action).toBe("UNSUSPEND_USER");
    });

    it("filters by targetType when provided", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({
        page: 1,
        limit: 10,
        targetType: "strategy",
      });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.where.targetType).toBe("strategy");
    });

    it("sets createdAt.gte when from is provided", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({
        page: 1,
        limit: 10,
        from: "2024-01-01T00:00:00Z",
      });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
    });

    it("sets createdAt.lte when to is provided", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({
        page: 1,
        limit: 10,
        to: "2024-12-31T23:59:59Z",
      });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.where.createdAt.lte).toBeInstanceOf(Date);
    });

    it("sets both gte and lte when from and to are both provided", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({
        page: 1,
        limit: 10,
        from: "2024-01-01",
        to: "2024-06-30",
      });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
      expect(call.where.createdAt.lte).toBeInstanceOf(Date);
    });

    it("does not add createdAt filter when neither from nor to is given", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({ page: 1, limit: 10 });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.where.createdAt).toBeUndefined();
    });

    it("includes admin with email, displayName, and role", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({ page: 1, limit: 10 });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.include.admin).toBeDefined();
      expect(call.include.admin.select.email).toBe(true);
      expect(call.include.admin.select.displayName).toBe(true);
      expect(call.include.admin.select.role).toBe(true);
    });

    it("orders results by createdAt descending", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({ page: 1, limit: 10 });

      const call = adminDb.auditLog.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: "desc" });
    });

    it("passes same where clause to both findMany and count", async () => {
      adminDb.auditLog.findMany.mockResolvedValue([] as any);
      adminDb.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({
        page: 1,
        limit: 10,
        adminId: "admin-3",
        action: "BAN",
      });

      const findCall = adminDb.auditLog.findMany.mock.calls[0][0];
      const countCall = adminDb.auditLog.count.mock.calls[0][0];
      expect(findCall.where).toEqual(countCall.where);
    });
  });

  // ── getEventLogs ──────────────────────────────────────────────────────────

  describe("getEventLogs", () => {
    it("returns paginated event log list with correct shape", async () => {
      const logs = [makeEventLog(), makeEventLog({ id: "event-2" })];
      prisma.eventLog.findMany.mockResolvedValue(logs as any);
      prisma.eventLog.count.mockResolvedValue(2);

      const result = await service.getEventLogs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });

    it("applies correct skip for page 2 with limit 20", async () => {
      prisma.eventLog.findMany.mockResolvedValue([] as any);
      prisma.eventLog.count.mockResolvedValue(0);

      await service.getEventLogs({ page: 2, limit: 20 });

      const call = prisma.eventLog.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(20);
    });

    it("filters by userId when provided", async () => {
      prisma.eventLog.findMany.mockResolvedValue([] as any);
      prisma.eventLog.count.mockResolvedValue(0);

      await service.getEventLogs({ page: 1, limit: 10, userId: "user-55" });

      const call = prisma.eventLog.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe("user-55");
    });

    it("omits userId filter when not provided", async () => {
      prisma.eventLog.findMany.mockResolvedValue([] as any);
      prisma.eventLog.count.mockResolvedValue(0);

      await service.getEventLogs({ page: 1, limit: 10 });

      const call = prisma.eventLog.findMany.mock.calls[0][0];
      expect(call.where.userId).toBeUndefined();
    });

    it("filters by eventType when provided", async () => {
      prisma.eventLog.findMany.mockResolvedValue([] as any);
      prisma.eventLog.count.mockResolvedValue(0);

      await service.getEventLogs({
        page: 1,
        limit: 10,
        eventType: "STRATEGY_STARTED",
      });

      const call = prisma.eventLog.findMany.mock.calls[0][0];
      expect(call.where.eventType).toBe("STRATEGY_STARTED");
    });

    it("sets createdAt.gte when from is provided", async () => {
      prisma.eventLog.findMany.mockResolvedValue([] as any);
      prisma.eventLog.count.mockResolvedValue(0);

      await service.getEventLogs({
        page: 1,
        limit: 10,
        from: "2024-03-01",
      });

      const call = prisma.eventLog.findMany.mock.calls[0][0];
      expect((call.where.createdAt as any).gte).toBeInstanceOf(Date);
    });

    it("sets createdAt.lte when to is provided", async () => {
      prisma.eventLog.findMany.mockResolvedValue([] as any);
      prisma.eventLog.count.mockResolvedValue(0);

      await service.getEventLogs({
        page: 1,
        limit: 10,
        to: "2024-06-01",
      });

      const call = prisma.eventLog.findMany.mock.calls[0][0];
      expect((call.where.createdAt as any).lte).toBeInstanceOf(Date);
    });

    it("does not add createdAt filter when neither from nor to is given", async () => {
      prisma.eventLog.findMany.mockResolvedValue([] as any);
      prisma.eventLog.count.mockResolvedValue(0);

      await service.getEventLogs({ page: 1, limit: 10 });

      const call = prisma.eventLog.findMany.mock.calls[0][0];
      expect(call.where.createdAt).toBeUndefined();
    });

    it("orders results by createdAt descending", async () => {
      prisma.eventLog.findMany.mockResolvedValue([] as any);
      prisma.eventLog.count.mockResolvedValue(0);

      await service.getEventLogs({ page: 1, limit: 10 });

      const call = prisma.eventLog.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: "desc" });
    });

    it("passes same where clause to both findMany and count", async () => {
      prisma.eventLog.findMany.mockResolvedValue([] as any);
      prisma.eventLog.count.mockResolvedValue(0);

      await service.getEventLogs({
        page: 1,
        limit: 10,
        userId: "user-9",
        eventType: "DEPOSIT",
      });

      const findCall = prisma.eventLog.findMany.mock.calls[0][0];
      const countCall = prisma.eventLog.count.mock.calls[0][0];
      expect(findCall.where).toEqual(countCall.where);
    });

    it("calculates pages correctly for non-divisible total", async () => {
      prisma.eventLog.findMany.mockResolvedValue([makeEventLog()] as any);
      prisma.eventLog.count.mockResolvedValue(7);

      const result = await service.getEventLogs({ page: 1, limit: 5 });

      expect(result.pages).toBe(2);
    });
  });

  // ── getLoginHistory ───────────────────────────────────────────────────────

  describe("getLoginHistory", () => {
    it("returns paginated login history with correct shape", async () => {
      const logs = [makeLoginEntry(), makeLoginEntry({ id: "login-2" })];
      prisma.userLoginHistory.findMany.mockResolvedValue(logs as any);
      prisma.userLoginHistory.count.mockResolvedValue(2);

      const result = await service.getLoginHistory({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });

    it("applies correct skip for page 3 with limit 10", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({ page: 3, limit: 10 });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(10);
    });

    it("filters by userId when provided", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({ page: 1, limit: 10, userId: "user-77" });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe("user-77");
    });

    it("omits userId filter when not provided", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({ page: 1, limit: 10 });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect(call.where.userId).toBeUndefined();
    });

    it("sets createdAt.gte when from is provided", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({
        page: 1,
        limit: 10,
        from: "2024-01-15",
      });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect((call.where.createdAt as any).gte).toBeInstanceOf(Date);
    });

    it("sets createdAt.lte when to is provided", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({
        page: 1,
        limit: 10,
        to: "2024-07-01",
      });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect((call.where.createdAt as any).lte).toBeInstanceOf(Date);
    });

    it("sets both gte and lte when from and to are both provided", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({
        page: 1,
        limit: 10,
        from: "2024-01-01",
        to: "2024-06-30",
      });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect((call.where.createdAt as any).gte).toBeInstanceOf(Date);
      expect((call.where.createdAt as any).lte).toBeInstanceOf(Date);
    });

    it("does not add createdAt filter when neither from nor to is given", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({ page: 1, limit: 10 });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect(call.where.createdAt).toBeUndefined();
    });

    it("selects user username and email via nested select", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({ page: 1, limit: 10 });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect(call.select.user.select.username).toBe(true);
      expect(call.select.user.select.email).toBe(true);
    });

    it("selects expected scalar fields including ip, userAgent, success", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({ page: 1, limit: 10 });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect(call.select.ip).toBe(true);
      expect(call.select.userAgent).toBe(true);
      expect(call.select.success).toBe(true);
    });

    it("orders results by createdAt descending", async () => {
      prisma.userLoginHistory.findMany.mockResolvedValue([] as any);
      prisma.userLoginHistory.count.mockResolvedValue(0);

      await service.getLoginHistory({ page: 1, limit: 10 });

      const call = prisma.userLoginHistory.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: "desc" });
    });
  });

  // ── getNotificationHistory ────────────────────────────────────────────────

  describe("getNotificationHistory", () => {
    it("returns paginated notification history with correct shape", async () => {
      const logs = [
        makeNotificationEntry(),
        makeNotificationEntry({ id: "notif-2" }),
      ];
      prisma.notificationHistory.findMany.mockResolvedValue(logs as any);
      prisma.notificationHistory.count.mockResolvedValue(2);

      const result = await service.getNotificationHistory({
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });

    it("applies correct skip for page 2 with limit 25", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({ page: 2, limit: 25 });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect(call.skip).toBe(25);
      expect(call.take).toBe(25);
    });

    it("filters by userId when provided", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({
        page: 1,
        limit: 10,
        userId: "user-11",
      });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe("user-11");
    });

    it("filters by channel when provided", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({
        page: 1,
        limit: 10,
        channel: "SMS",
      });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect(call.where.channel).toBe("SMS");
    });

    it("omits channel filter when not provided", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({ page: 1, limit: 10 });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect(call.where.channel).toBeUndefined();
    });

    it("sets sentAt.gte when from is provided", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({
        page: 1,
        limit: 10,
        from: "2024-02-01",
      });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect((call.where.sentAt as any).gte).toBeInstanceOf(Date);
    });

    it("sets sentAt.lte when to is provided", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({
        page: 1,
        limit: 10,
        to: "2024-08-01",
      });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect((call.where.sentAt as any).lte).toBeInstanceOf(Date);
    });

    it("sets both gte and lte when from and to are both provided", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({
        page: 1,
        limit: 10,
        from: "2024-01-01",
        to: "2024-12-31",
      });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect((call.where.sentAt as any).gte).toBeInstanceOf(Date);
      expect((call.where.sentAt as any).lte).toBeInstanceOf(Date);
    });

    it("does not add sentAt filter when neither from nor to is given", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({ page: 1, limit: 10 });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect(call.where.sentAt).toBeUndefined();
    });

    it("orders results by sentAt descending", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({ page: 1, limit: 10 });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ sentAt: "desc" });
    });

    it("selects user username via nested select", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({ page: 1, limit: 10 });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect(call.select.user.select.username).toBe(true);
    });

    it("selects channel, eventType, success, error, and sentAt fields", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({ page: 1, limit: 10 });

      const call = prisma.notificationHistory.findMany.mock.calls[0][0];
      expect(call.select.channel).toBe(true);
      expect(call.select.eventType).toBe(true);
      expect(call.select.success).toBe(true);
      expect(call.select.error).toBe(true);
      expect(call.select.sentAt).toBe(true);
    });

    it("passes same where clause to both findMany and count", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue([] as any);
      prisma.notificationHistory.count.mockResolvedValue(0);

      await service.getNotificationHistory({
        page: 1,
        limit: 10,
        userId: "user-5",
        channel: "EMAIL",
      });

      const findCall = prisma.notificationHistory.findMany.mock.calls[0][0];
      const countCall = prisma.notificationHistory.count.mock.calls[0][0];
      expect(findCall.where).toEqual(countCall.where);
    });

    it("calculates pages correctly for non-divisible total", async () => {
      prisma.notificationHistory.findMany.mockResolvedValue(
        [makeNotificationEntry()] as any,
      );
      prisma.notificationHistory.count.mockResolvedValue(13);

      const result = await service.getNotificationHistory({
        page: 1,
        limit: 5,
      });

      expect(result.pages).toBe(3);
    });
  });
});
