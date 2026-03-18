import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AuditService } from "./audit.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAdminDb() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("AuditService", () => {
  let service: AuditService;
  let adminDb: ReturnType<typeof makeAdminDb>;

  beforeEach(() => {
    adminDb = makeAdminDb();
    service = new AuditService(adminDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── log ───────────────────────────────────────────────────────────────────

  describe("log", () => {
    it("creates an audit log record with the expected fields", async () => {
      await service.log({
        adminId: "admin-1",
        action: "USER_SUSPEND",
        targetType: "User",
        targetId: "user-42",
        payload: { reason: "TOS breach" },
        ip: "192.168.1.1",
      });

      expect(adminDb.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: "admin-1",
          action: "USER_SUSPEND",
          targetType: "User",
          targetId: "user-42",
          payload: { reason: "TOS breach" },
          ip: "192.168.1.1",
        },
      });
    });

    it("strips control characters from the IP (log injection prevention)", async () => {
      await service.log({
        adminId: "admin-1",
        action: "LOGIN",
        targetType: "Admin",
        ip: "127.0.0.1\r\nX-Injected: evil",
      });

      const call = adminDb.auditLog.create.mock.calls[0][0];
      expect(call.data.ip).not.toContain("\r");
      expect(call.data.ip).not.toContain("\n");
    });

    it("strips non-printable ASCII from the IP", async () => {
      const maliciousIp = "10.0.0.1\x00\x01\x1F\x7F";

      await service.log({
        adminId: "admin-1",
        action: "ACTION",
        targetType: "User",
        ip: maliciousIp,
      });

      const call = adminDb.auditLog.create.mock.calls[0][0];
      expect(call.data.ip).toBe("10.0.0.1");
    });

    it("truncates IP to 64 characters", async () => {
      const longIp = "x".repeat(128);

      await service.log({
        adminId: "admin-1",
        action: "ACTION",
        targetType: "User",
        ip: longIp,
      });

      const call = adminDb.auditLog.create.mock.calls[0][0];
      expect(call.data.ip.length).toBeLessThanOrEqual(64);
    });

    it("preserves a valid IPv4 address unchanged", async () => {
      await service.log({
        adminId: "admin-1",
        action: "ACTION",
        targetType: "User",
        ip: "203.0.113.42",
      });

      const call = adminDb.auditLog.create.mock.calls[0][0];
      expect(call.data.ip).toBe("203.0.113.42");
    });

    it("preserves a valid IPv6 address unchanged", async () => {
      const ipv6 = "2001:db8::1";
      await service.log({
        adminId: "admin-1",
        action: "ACTION",
        targetType: "User",
        ip: ipv6,
      });

      const call = adminDb.auditLog.create.mock.calls[0][0];
      expect(call.data.ip).toBe(ipv6);
    });

    it("stores undefined targetId when not provided", async () => {
      await service.log({
        adminId: "admin-1",
        action: "LIST_USERS",
        targetType: "User",
        ip: "1.2.3.4",
      });

      const call = adminDb.auditLog.create.mock.calls[0][0];
      expect(call.data.targetId).toBeUndefined();
    });

    it("resolves without returning a value (void)", async () => {
      const result = await service.log({
        adminId: "admin-1",
        action: "ACTION",
        targetType: "User",
        ip: "1.2.3.4",
      });

      expect(result).toBeUndefined();
    });

    it("handles an empty payload gracefully", async () => {
      await expect(
        service.log({
          adminId: "admin-1",
          action: "ACTION",
          targetType: "User",
          ip: "1.2.3.4",
          payload: {},
        }),
      ).resolves.toBeUndefined();
    });
  });
});
