import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NotFoundException, HttpStatus } from "@nestjs/common";
import { UsersService } from "./users.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "alice@example.com",
    username: "alice",
    displayName: "Alice",
    emailVerified: true,
    polymarketConnected: false,
    suspended: false,
    suspendedReason: null,
    deleted: false,
    passwordHash: "$2b$12$hashed",
    totpSecret: null,
    totpBackupCodes: null,
    createdAt: new Date("2024-01-01"),
    lastSeen: new Date("2024-06-01"),
    limits: null,
    loginHistory: [],
    strategies: [],
    _count: { orders: 0, positions: 0, strategies: 0 },
    ...overrides,
  };
}

function makePrisma() {
  return {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    userLimit: {
      upsert: vi.fn(),
    },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("UsersService", () => {
  let service: UsersService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new UsersService(prisma as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns paginated user list with correct shape", async () => {
      const users = [
        makeUser(),
        makeUser({ id: "user-2", email: "bob@example.com", username: "bob" }),
      ];
      prisma.user.findMany.mockResolvedValue(users as any);
      prisma.user.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });

    it("calculates pages correctly for partial last page", async () => {
      prisma.user.findMany.mockResolvedValue([makeUser()] as any);
      prisma.user.count.mockResolvedValue(11);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.pages).toBe(2);
    });

    it("passes search filter as OR on email and username", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, search: "ali" });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR[0].email.contains).toBe("ali");
      expect(call.where.OR[1].username.contains).toBe("ali");
    });

    it("includes suspended filter when provided", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, suspended: true });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.where.suspended).toBe(true);
    });

    it("omits suspended filter when not provided", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.where.suspended).toBeUndefined();
    });

    it("always filters deleted:false", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.where.deleted).toBe(false);
    });

    it("applies correct skip offset for page 3", async () => {
      prisma.user.findMany.mockResolvedValue([] as any);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ page: 3, limit: 5 });

      const call = prisma.user.findMany.mock.calls[0][0];
      expect(call.skip).toBe(10);
      expect(call.take).toBe(5);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns user without sensitive fields", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);

      const result = await service.findOne("user-1");

      expect(result.id).toBe("user-1");
      expect(result.email).toBe("alice@example.com");
      expect(result.passwordHash).toBeUndefined();
      expect(result.totpSecret).toBeUndefined();
      expect(result.totpBackupCodes).toBeUndefined();
    });

    it("throws NotFoundException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("includes code NOT_FOUND in the exception", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("calls findUnique with include on limits, loginHistory, strategies", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);

      await service.findOne("user-1");

      const call = prisma.user.findUnique.mock.calls[0][0];
      expect(call.include.limits).toBeDefined();
      expect(call.include.loginHistory).toBeDefined();
      expect(call.include.strategies).toBeDefined();
    });
  });

  // ── suspend ───────────────────────────────────────────────────────────────

  describe("suspend", () => {
    it("suspends an active user and returns suspension receipt", async () => {
      const user = makeUser({ suspended: false });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: true,
        suspendedReason: "Violation",
      } as any);

      const result = await service.suspend("user-1", { reason: "Violation" });

      expect(result.suspended).toBe(true);
      expect(result.reason).toBe("Violation");
      expect(result.suspendedAt).toBeDefined();
    });

    it("passes reason to update call", async () => {
      const user = makeUser({ suspended: false });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: true,
        suspendedReason: "TOS breach",
      } as any);

      await service.suspend("user-1", { reason: "TOS breach" });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            suspended: true,
            suspendedReason: "TOS breach",
          }),
        }),
      );
    });

    it("throws CONFLICT/ALREADY_SUSPENDED when user is already suspended", async () => {
      const user = makeUser({ suspended: true });
      prisma.user.findUnique.mockResolvedValue(user as any);

      await expect(
        service.suspend("user-1", { reason: "again" }),
      ).rejects.toMatchObject({
        response: { code: "ALREADY_SUSPENDED" },
        status: HttpStatus.CONFLICT,
      });
    });

    it("throws NotFoundException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.suspend("ghost", { reason: "test" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NOT_FOUND when user is soft-deleted", async () => {
      const user = makeUser({ deleted: true });
      prisma.user.findUnique.mockResolvedValue(user as any);

      await expect(
        service.suspend("user-1", { reason: "test" }),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });

  // ── unsuspend ─────────────────────────────────────────────────────────────

  describe("unsuspend", () => {
    it("unsuspends a user and returns { suspended: false }", async () => {
      const user = makeUser({ suspended: true });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: false,
        suspendedReason: null,
      } as any);

      const result = await service.unsuspend("user-1");

      expect(result).toEqual({ suspended: false });
    });

    it("clears suspendedReason on unsuspend", async () => {
      const user = makeUser({ suspended: true, suspendedReason: "Was bad" });
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        suspended: false,
        suspendedReason: null,
      } as any);

      await service.unsuspend("user-1");

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { suspended: false, suspendedReason: null },
        }),
      );
    });

    it("throws NotFoundException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.unsuspend("ghost")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateLimits ──────────────────────────────────────────────────────────

  describe("updateLimits", () => {
    it("upserts and returns limits for a valid user", async () => {
      const user = makeUser();
      const limits = {
        userId: "user-1",
        maxStrategies: 5,
        maxDailyOrders: 100,
      };
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.userLimit.upsert.mockResolvedValue(limits as any);

      const dto = { maxStrategies: 5, maxDailyOrders: 100 };
      const result = await service.updateLimits("user-1", dto);

      expect(result).toEqual(limits);
    });

    it("passes userId as create key in upsert", async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.userLimit.upsert.mockResolvedValue({} as any);

      const dto = { maxStrategies: 3 };
      await service.updateLimits("user-1", dto);

      const call = prisma.userLimit.upsert.mock.calls[0][0];
      expect(call.where.userId).toBe("user-1");
      expect(call.create.userId).toBe("user-1");
    });

    it("throws NOT_FOUND when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateLimits("ghost", {})).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });

  // ── findUserOrFail (via public methods) ───────────────────────────────────

  describe("findUserOrFail (via public API)", () => {
    it("throws NOT_FOUND for nonexistent user id via suspend", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.suspend("nonexistent", { reason: "x" }),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("throws NOT_FOUND for soft-deleted user via updateLimits", async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ deleted: true }) as any,
      );

      await expect(service.updateLimits("user-1", {})).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });
});
