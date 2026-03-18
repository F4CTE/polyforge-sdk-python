import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { AdminsService } from "./admins.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAdmin(overrides: Record<string, unknown> = {}) {
  return {
    id: "admin-1",
    email: "admin@polyforge.com",
    displayName: "Super Admin",
    passwordHash: "$2b$12$hashed",
    role: "SUPER_ADMIN",
    active: true,
    createdAt: new Date("2024-01-01"),
    lastSeen: new Date("2024-06-01"),
    ...overrides,
  };
}

function makeAdminDb() {
  return {
    admin: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

function makeRedis() {
  const client = {
    scan: vi.fn().mockResolvedValue(["0", []]),
    mget: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(0),
  };
  return {
    getClient: vi.fn().mockReturnValue(client),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("AdminsService", () => {
  let service: AdminsService;
  let adminDb: ReturnType<typeof makeAdminDb>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(() => {
    adminDb = makeAdminDb();
    redis = makeRedis();
    service = new AdminsService(adminDb as any, redis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns all admins ordered by createdAt asc", async () => {
      const admins = [
        makeAdmin(),
        makeAdmin({ id: "admin-2", email: "mod@polyforge.com" }),
      ];
      adminDb.admin.findMany.mockResolvedValue(admins as any);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("admin-1");
    });

    it("selects only safe fields (no passwordHash)", async () => {
      const admins = [makeAdmin()];
      adminDb.admin.findMany.mockResolvedValue(admins as any);

      const result = await service.findAll();

      const call = adminDb.admin.findMany.mock.calls[0][0];
      expect(call.select.passwordHash).toBeUndefined();
      expect(call.select.id).toBe(true);
      expect(call.select.email).toBe(true);
      expect(call.select.role).toBe(true);
    });

    it("returns an empty array when no admins exist", async () => {
      adminDb.admin.findMany.mockResolvedValue([] as any);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a new admin and returns safe admin object", async () => {
      adminDb.admin.findUnique.mockResolvedValue(null);
      const created = makeAdmin({
        email: "new@polyforge.com",
        displayName: "New Admin",
        role: "MODERATOR",
      });
      adminDb.admin.create.mockResolvedValue(created as any);

      const dto = {
        email: "new@polyforge.com",
        displayName: "New Admin",
        password: "Secret1!",
        role: "MODERATOR" as any,
      };
      const result = await service.create(dto);

      expect(result.email).toBe("new@polyforge.com");
      expect(result.role).toBe("MODERATOR");
    });

    it("hashes the password before saving (never stores plaintext)", async () => {
      adminDb.admin.findUnique.mockResolvedValue(null);
      adminDb.admin.create.mockResolvedValue(makeAdmin() as any);

      const dto = {
        email: "new@polyforge.com",
        displayName: "Admin",
        password: "Secret1!",
        role: "MODERATOR" as any,
      };
      await service.create(dto);

      const createCall = adminDb.admin.create.mock.calls[0][0];
      // passwordHash must not equal the plaintext password
      expect(createCall.data.passwordHash).not.toBe("Secret1!");
      // Must be a bcrypt hash
      expect(createCall.data.passwordHash).toMatch(/^\$2[ab]\$\d{2}\$/);
    });

    it("sets active:true on creation", async () => {
      adminDb.admin.findUnique.mockResolvedValue(null);
      adminDb.admin.create.mockResolvedValue(makeAdmin() as any);

      const dto = {
        email: "x@x.com",
        displayName: "X",
        password: "Secret1!",
        role: "MODERATOR" as any,
      };
      await service.create(dto);

      const createCall = adminDb.admin.create.mock.calls[0][0];
      expect(createCall.data.active).toBe(true);
    });

    it("throws ConflictException (EMAIL_TAKEN) when email already exists", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);

      const dto = {
        email: "admin@polyforge.com",
        displayName: "Dup",
        password: "Secret1!",
        role: "MODERATOR" as any,
      };
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it("includes code EMAIL_TAKEN in conflict exception", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);

      const dto = {
        email: "admin@polyforge.com",
        displayName: "Dup",
        password: "Secret1!",
        role: "MODERATOR" as any,
      };
      await expect(service.create(dto)).rejects.toMatchObject({
        response: { code: "EMAIL_TAKEN" },
      });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates displayName for a valid admin", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);
      const updated = makeAdmin({ displayName: "Updated Name" });
      adminDb.admin.update.mockResolvedValue(updated as any);

      const result = await service.update("admin-1", "admin-999", {
        displayName: "Updated Name",
      });

      expect(result.displayName).toBe("Updated Name");
    });

    it("prevents changing own role (SELF_MODIFY)", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);

      await expect(
        service.update("admin-1", "admin-1", { role: "MODERATOR" as any }),
      ).rejects.toMatchObject({
        response: { code: "SELF_MODIFY" },
      });
    });

    it("prevents self-deactivation via update (SELF_MODIFY)", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);

      await expect(
        service.update("admin-1", "admin-1", { active: false }),
      ).rejects.toMatchObject({
        response: { code: "SELF_MODIFY" },
      });
    });

    it("allows requester to update their own displayName without triggering SELF_MODIFY", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);
      adminDb.admin.update.mockResolvedValue(
        makeAdmin({ displayName: "Me Updated" }) as any,
      );

      const result = await service.update("admin-1", "admin-1", {
        displayName: "Me Updated",
      });

      expect(result.displayName).toBe("Me Updated");
    });

    it("hashes new password when password is included in update", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);
      adminDb.admin.update.mockResolvedValue(makeAdmin() as any);

      await service.update("admin-1", "admin-999", { password: "NewPass1!" });

      const updateCall = adminDb.admin.update.mock.calls[0][0];
      expect(updateCall.data.passwordHash).toBeDefined();
      expect(updateCall.data.passwordHash).toMatch(/^\$2[ab]\$\d{2}\$/);
      expect(updateCall.data.password).toBeUndefined();
    });

    it("invalidates sessions when role changes", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);
      adminDb.admin.update.mockResolvedValue(
        makeAdmin({ role: "MODERATOR" }) as any,
      );

      const client = redis.getClient();
      await service.update("admin-1", "admin-999", {
        role: "MODERATOR" as any,
      });

      expect(client.scan).toHaveBeenCalled();
    });

    it("invalidates sessions when active status changes", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);
      adminDb.admin.update.mockResolvedValue(
        makeAdmin({ active: false }) as any,
      );

      const client = redis.getClient();
      await service.update("admin-1", "admin-999", { active: false });

      expect(client.scan).toHaveBeenCalled();
    });

    it("does NOT invalidate sessions for displayName-only update", async () => {
      adminDb.admin.findUnique.mockResolvedValue(makeAdmin() as any);
      adminDb.admin.update.mockResolvedValue(makeAdmin() as any);

      const client = redis.getClient();
      await service.update("admin-1", "admin-999", {
        displayName: "No Session Kill",
      });

      expect(client.scan).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when admin does not exist", async () => {
      adminDb.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.update("ghost", "admin-999", { displayName: "x" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────

  describe("deactivate", () => {
    it("deactivates another admin and returns { deactivated: true }", async () => {
      adminDb.admin.findUnique.mockResolvedValue(
        makeAdmin({ id: "admin-2" }) as any,
      );
      adminDb.admin.update.mockResolvedValue(
        makeAdmin({ id: "admin-2", active: false }) as any,
      );

      const result = await service.deactivate("admin-2", "admin-1");

      expect(result).toEqual({ deactivated: true });
    });

    it("throws ForbiddenException (SELF_DEACTIVATE) when attempting to deactivate self", async () => {
      await expect(service.deactivate("admin-1", "admin-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("includes code SELF_DEACTIVATE in the exception", async () => {
      await expect(
        service.deactivate("admin-1", "admin-1"),
      ).rejects.toMatchObject({
        response: { code: "SELF_DEACTIVATE" },
      });
    });

    it("throws NotFoundException when admin does not exist", async () => {
      adminDb.admin.findUnique.mockResolvedValue(null);

      await expect(service.deactivate("ghost", "admin-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("force-logs out the admin by invalidating Redis sessions", async () => {
      adminDb.admin.findUnique.mockResolvedValue(
        makeAdmin({ id: "admin-2" }) as any,
      );
      adminDb.admin.update.mockResolvedValue(
        makeAdmin({ id: "admin-2", active: false }) as any,
      );

      const client = redis.getClient();
      await service.deactivate("admin-2", "admin-1");

      expect(client.scan).toHaveBeenCalled();
    });
  });

  // ── invalidateAdminSessions ───────────────────────────────────────────────

  describe("invalidateAdminSessions (via deactivate)", () => {
    it("deletes keys whose value matches the adminId", async () => {
      const client = {
        scan: vi
          .fn()
          .mockResolvedValueOnce([
            "0",
            ["admin:session:tok1", "admin:session:tok2"],
          ]),
        mget: vi.fn().mockResolvedValue(["admin-2", "admin-3"]),
        del: vi.fn().mockResolvedValue(1),
      };
      redis.getClient.mockReturnValue(client as any);

      adminDb.admin.findUnique.mockResolvedValue(
        makeAdmin({ id: "admin-2" }) as any,
      );
      adminDb.admin.update.mockResolvedValue(
        makeAdmin({ id: "admin-2", active: false }) as any,
      );

      await service.deactivate("admin-2", "admin-1");

      // Only the key with value 'admin-2' should be deleted
      expect(client.del).toHaveBeenCalledWith("admin:session:tok1");
    });

    it("skips del when no session keys belong to the admin", async () => {
      const client = {
        scan: vi.fn().mockResolvedValueOnce(["0", ["admin:session:tok1"]]),
        mget: vi.fn().mockResolvedValue(["admin-999"]), // different admin
        del: vi.fn(),
      };
      redis.getClient.mockReturnValue(client as any);

      adminDb.admin.findUnique.mockResolvedValue(
        makeAdmin({ id: "admin-2" }) as any,
      );
      adminDb.admin.update.mockResolvedValue(
        makeAdmin({ id: "admin-2", active: false }) as any,
      );

      await service.deactivate("admin-2", "admin-1");

      expect(client.del).not.toHaveBeenCalled();
    });
  });
});
