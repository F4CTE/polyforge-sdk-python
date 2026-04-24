import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import * as bcrypt from "bcrypt";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUpdateProfileDto(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Alice Smith",
    bio: "Polymarket trader",
    avatarUrl: "https://example.com/avatar.png",
    twitterHandle: "@alice",
    ...overrides,
  };
}

function makeUpdatePasswordDto(overrides: Record<string, unknown> = {}) {
  return {
    currentPassword: "OldPassw0rd!",
    newPassword: "NewPassw0rd!",
    ...overrides,
  };
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    getClient: vi.fn().mockReturnValue({
      scanStream: vi.fn().mockReturnValue({ on: vi.fn() }),
      del: vi.fn(),
    }),
  };
}

function createMockConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    GAS_DAILY_LIMIT_MATIC: "0.5",
    ...overrides,
  };
  return {
    get: vi.fn((key: string) => defaults[key]),
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("SettingsService", () => {
  let service: SettingsService;
  let db: MockDb;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockConfig: ReturnType<typeof createMockConfig>;

  beforeEach(() => {
    db = createMockDb();
    mockRedis = createMockRedis();
    mockConfig = createMockConfig();
    service = new SettingsService(
      db as any,
      mockRedis as any,
      mockConfig as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── updateProfile ─────────────────────────────────────────────────────────

  describe("updateProfile", () => {
    it("updates and returns the user profile", async () => {
      const updatedUser = {
        id: "user-uuid-1",
        username: "alice",
        displayName: "Alice Smith",
        bio: "Polymarket trader",
        avatarUrl: "https://example.com/avatar.png",
      };
      db.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.updateProfile(
        "user-uuid-1",
        makeUpdateProfileDto() as any,
      );

      expect(result).toEqual(updatedUser);
    });

    it("calls prisma.user.update with the correct where and data", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", makeUpdateProfileDto() as any);

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-uuid-1" },
          data: expect.objectContaining({
            displayName: "Alice Smith",
            bio: "Polymarket trader",
          }),
        }),
      );
    });

    it("only includes fields that are defined in the dto", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", { displayName: "Bob" } as any);

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect(dataArg).toHaveProperty("displayName", "Bob");
      expect(dataArg).not.toHaveProperty("bio");
      expect(dataArg).not.toHaveProperty("avatarUrl");
      expect(dataArg).not.toHaveProperty("twitterHandle");
    });

    it("includes bio when explicitly set to empty string", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", { bio: "" } as any);

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect(dataArg).toHaveProperty("bio", "");
    });

    it("does NOT include displayName when it is undefined", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", { bio: "trader" } as any);

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect(dataArg).not.toHaveProperty("displayName");
    });

    it("selects only safe fields (no passwordHash)", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", makeUpdateProfileDto() as any);

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
          },
        }),
      );
    });

    it("includes twitterHandle in data when provided", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", {
        twitterHandle: "@alice",
      } as any);

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect(dataArg).toHaveProperty("twitterHandle", "@alice");
    });
  });

  // ── updateNotifications ───────────────────────────────────────────────────

  describe("updateNotifications", () => {
    it("upserts notification preferences and returns the record", async () => {
      const prefs = {
        userId: "user-uuid-1",
        emailOnFill: true,
        emailOnAlert: false,
      };
      db.notificationPreference.upsert.mockResolvedValue(prefs as any);

      const result = await service.updateNotifications("user-uuid-1", {
        onOrderFilled: true,
        onStrategyError: false,
      });

      expect(result).toEqual(prefs);
    });

    it("calls upsert with the correct where, create and update args", async () => {
      db.notificationPreference.upsert.mockResolvedValue({} as any);
      const dto = { onOrderFilled: true, onStrategyError: false };

      await service.updateNotifications("user-uuid-1", dto);

      expect(db.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1" },
        create: { userId: "user-uuid-1", ...dto },
        update: { ...dto },
      });
    });

    it("handles an empty dto without throwing", async () => {
      db.notificationPreference.upsert.mockResolvedValue({} as any);

      await expect(
        service.updateNotifications("user-uuid-1", {}),
      ).resolves.toBeDefined();
    });
  });

  // ── updatePassword ────────────────────────────────────────────────────────

  describe("updatePassword", () => {
    it("updates the password and returns a success message", async () => {
      const hash = await bcrypt.hash("OldPassw0rd!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);
      db.user.update.mockResolvedValue({} as any);

      const result = await service.updatePassword(
        "user-uuid-1",
        makeUpdatePasswordDto() as any,
      );

      expect(result).toEqual({ message: "Password updated" });
    });

    it("calls prisma.user.update with a bcrypt hash of the new password", async () => {
      const hash = await bcrypt.hash("OldPassw0rd!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);
      db.user.update.mockResolvedValue({} as any);

      await service.updatePassword(
        "user-uuid-1",
        makeUpdatePasswordDto() as any,
      );

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect(dataArg.passwordHash).toBeDefined();
      // Verify it is a valid bcrypt hash (not the plain text password)
      const isValidHash = await bcrypt.compare(
        "NewPassw0rd!",
        dataArg.passwordHash as string,
      );
      expect(isValidHash).toBe(true);
    });

    it("throws INVALID_CREDENTIALS (401) when current password is wrong", async () => {
      const hash = await bcrypt.hash("CorrectPassword123!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);

      await expect(
        service.updatePassword(
          "user-uuid-1",
          makeUpdatePasswordDto({ currentPassword: "WrongPassword1!" }) as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws INVALID_CREDENTIALS error code when current password does not match", async () => {
      const hash = await bcrypt.hash("CorrectPassword123!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);

      await expect(
        service.updatePassword(
          "user-uuid-1",
          makeUpdatePasswordDto({ currentPassword: "WrongPassword1!" }) as any,
        ),
      ).rejects.toMatchObject({
        response: { code: "INVALID_CREDENTIALS" },
      });
    });

    it("does NOT call user.update when the current password is wrong", async () => {
      const hash = await bcrypt.hash("CorrectPassword123!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);

      await service
        .updatePassword(
          "user-uuid-1",
          makeUpdatePasswordDto({ currentPassword: "WrongPassword1!" }) as any,
        )
        .catch(() => {});

      expect(db.user.update).not.toHaveBeenCalled();
    });

    it("looks up the user with findUniqueOrThrow selecting only passwordHash", async () => {
      const hash = await bcrypt.hash("OldPassw0rd!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);
      db.user.update.mockResolvedValue({} as any);

      await service.updatePassword(
        "user-uuid-1",
        makeUpdatePasswordDto() as any,
      );

      expect(db.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "user-uuid-1" },
        select: { passwordHash: true },
      });
    });

    it("uses bcrypt cost 12 for the new password hash", async () => {
      const hash = await bcrypt.hash("OldPassw0rd!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);
      db.user.update.mockResolvedValue({} as any);

      await service.updatePassword(
        "user-uuid-1",
        makeUpdatePasswordDto() as any,
      );

      const updateCall = db.user.update.mock.calls[0][0];
      const newHash = updateCall.data.passwordHash as string;
      // Verify the stored hash is a valid bcrypt hash at cost 12
      expect(newHash).toMatch(/^\$2[ab]\$12\$/);
      expect(await bcrypt.compare("NewPassw0rd!", newHash)).toBe(true);
    });

    it("propagates errors from findUniqueOrThrow (e.g. user not found)", async () => {
      db.user.findUniqueOrThrow.mockRejectedValue(
        new Error("Record not found"),
      );

      await expect(
        service.updatePassword("user-uuid-1", makeUpdatePasswordDto() as any),
      ).rejects.toThrow("Record not found");
    });
  });

  // ── getGasUsage ─────────────────────────────────────────────────────────────

  describe("getGasUsage", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-24T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns spent, limit, and remaining when usage exists", async () => {
      mockRedis.get.mockResolvedValue("0.2");

      const result = await service.getGasUsage("user-uuid-1");

      expect(result).toEqual({
        todayUsage: 0.2,
        dailyLimit: 0.5,
        remaining: 0.3,
      });
    });

    it("returns 0 spent when no Redis key exists", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getGasUsage("user-uuid-1");

      expect(result.todayUsage).toBe(0);
      expect(result.remaining).toBe(0.5);
      expect(result.dailyLimit).toBe(0.5);
    });

    it("reads the correct Redis key based on today's date", async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.getGasUsage("user-uuid-1");

      expect(mockRedis.get).toHaveBeenCalledWith(
        "gas:spent:user-uuid-1:2026-03-24",
      );
    });

    it("handles Redis errors gracefully and returns 0 usage", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis connection refused"));

      const result = await service.getGasUsage("user-uuid-1");

      expect(result.todayUsage).toBe(0);
      expect(result.remaining).toBe(0.5);
    });

    it("clamps remaining to 0 when usage exceeds limit", async () => {
      mockRedis.get.mockResolvedValue("0.8");

      const result = await service.getGasUsage("user-uuid-1");

      expect(result.remaining).toBe(0);
    });
  });

  // ── getEventNotifications / updateEventNotifications ────────────────────────

  describe("getEventNotifications", () => {
    it("returns empty preferences and DAILY digest when no row exists", async () => {
      db.notificationPreference.findUnique.mockResolvedValue(null);

      const result = await service.getEventNotifications("user-uuid-1");

      expect(result).toEqual({ preferences: [], emailDigest: "DAILY" });
    });

    it("returns stored eventPrefs and emailDigest", async () => {
      const stored = [
        { event: "ORDER_FILLED", inApp: true, email: true, push: false },
      ];
      db.notificationPreference.findUnique.mockResolvedValue({
        eventPrefs: stored,
        emailDigest: "WEEKLY",
      } as any);

      const result = await service.getEventNotifications("user-uuid-1");

      expect(result.preferences).toEqual(stored);
      expect(result.emailDigest).toBe("WEEKLY");
    });
  });

  describe("updateEventNotifications", () => {
    it("upserts eventPrefs and emailDigest, returns them", async () => {
      const prefs = [
        { event: "ORDER_FILLED", inApp: true, email: false, push: false },
      ];
      db.notificationPreference.upsert.mockResolvedValue({
        eventPrefs: prefs,
        emailDigest: "INSTANT",
      } as any);

      const result = await service.updateEventNotifications("user-uuid-1", {
        preferences: prefs,
        emailDigest: "INSTANT",
      });

      expect(result.preferences).toEqual(prefs);
      expect(result.emailDigest).toBe("INSTANT");
    });

    it("upserts without emailDigest when not provided", async () => {
      db.notificationPreference.upsert.mockResolvedValue({
        eventPrefs: [],
        emailDigest: "DAILY",
      } as any);

      await service.updateEventNotifications("user-uuid-1", {
        preferences: [],
      });

      const call = db.notificationPreference.upsert.mock.calls[0][0];
      expect(call.update).not.toHaveProperty("emailDigest");
    });

    it("upserts without preferences when not provided", async () => {
      db.notificationPreference.upsert.mockResolvedValue({
        eventPrefs: [],
        emailDigest: "WEEKLY",
      } as any);

      await service.updateEventNotifications("user-uuid-1", {
        emailDigest: "WEEKLY",
      });

      const call = db.notificationPreference.upsert.mock.calls[0][0];
      expect(call.update).not.toHaveProperty("eventPrefs");
      expect(call.update).toHaveProperty("emailDigest", "WEEKLY");
    });

    it("returns empty preferences when eventPrefs is null", async () => {
      db.notificationPreference.upsert.mockResolvedValue({
        eventPrefs: null,
        emailDigest: "DAILY",
      } as any);

      const result = await service.updateEventNotifications("user-uuid-1", {
        emailDigest: "DAILY",
      });

      expect(result.preferences).toEqual([]);
    });
  });

  // ── getNotifications ─────────────────────────────────────────────────────

  describe("getNotifications", () => {
    it("returns stored notification preferences when row exists", async () => {
      const prefs = {
        emailEnabled: true,
        telegramEnabled: true,
        discordEnabled: false,
        onOrderFilled: true,
        onStrategyError: false,
        onBacktestComplete: true,
        onDailyLossLimit: false,
        onMarketResolved: true,
        onSomeoneForked: false,
        onSomeoneFollowed: true,
        onSomeoneLiked: false,
        onSomeoneCommented: true,
      };
      db.notificationPreference.findUnique.mockResolvedValue(prefs as any);

      const result = await service.getNotifications("user-uuid-1");

      expect(result).toEqual(prefs);
    });

    it("returns defaults when no row exists", async () => {
      db.notificationPreference.findUnique.mockResolvedValue(null);

      const result = await service.getNotifications("user-uuid-1");

      expect(result.emailEnabled).toBe(true);
      expect(result.telegramEnabled).toBe(false);
      expect(result.discordEnabled).toBe(false);
      expect(result.onOrderFilled).toBe(true);
      expect(result.onStrategyError).toBe(true);
      expect(result.onBacktestComplete).toBe(true);
      expect(result.onDailyLossLimit).toBe(true);
      expect(result.onMarketResolved).toBe(true);
      expect(result.onSomeoneForked).toBe(false);
      expect(result.onSomeoneFollowed).toBe(false);
      expect(result.onSomeoneLiked).toBe(false);
      expect(result.onSomeoneCommented).toBe(false);
    });

    it("queries by userId", async () => {
      db.notificationPreference.findUnique.mockResolvedValue(null);

      await service.getNotifications("user-uuid-1");

      expect(db.notificationPreference.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1" },
      });
    });
  });

  // ── getRiskSettings ──────────────────────────────────────────────────────

  describe("getRiskSettings", () => {
    it("returns stored risk settings", async () => {
      db.userLimit.findUnique.mockResolvedValue({
        drawdownEnabled: true,
        drawdownLookbackHours: 48,
        drawdownThresholdPct: "0.15",
        circuitBreakerTripped: false,
        circuitBreakerTrippedAt: null,
      } as any);

      const result = await service.getRiskSettings("user-uuid-1");

      expect(result.drawdownEnabled).toBe(true);
      expect(result.drawdownLookbackHours).toBe(48);
      expect(result.drawdownThresholdPct).toBe(0.15);
      expect(result.circuitBreakerTripped).toBe(false);
      expect(result.circuitBreakerTrippedAt).toBeNull();
    });

    it("returns defaults when no row exists", async () => {
      db.userLimit.findUnique.mockResolvedValue(null);

      const result = await service.getRiskSettings("user-uuid-1");

      expect(result.drawdownEnabled).toBe(false);
      expect(result.drawdownLookbackHours).toBe(24);
      expect(result.drawdownThresholdPct).toBe(0.1);
      expect(result.circuitBreakerTripped).toBe(false);
      expect(result.circuitBreakerTrippedAt).toBeNull();
    });

    it("parses drawdownThresholdPct from string to number", async () => {
      db.userLimit.findUnique.mockResolvedValue({
        drawdownThresholdPct: "0.25",
      } as any);

      const result = await service.getRiskSettings("user-uuid-1");

      expect(typeof result.drawdownThresholdPct).toBe("number");
      expect(result.drawdownThresholdPct).toBe(0.25);
    });
  });

  // ── updateRiskSettings ───────────────────────────────────────────────────

  describe("updateRiskSettings", () => {
    it("upserts and returns updated risk settings", async () => {
      db.userLimit.upsert.mockResolvedValue({} as any);
      db.userLimit.findUnique.mockResolvedValue({
        drawdownEnabled: true,
        drawdownLookbackHours: 12,
        drawdownThresholdPct: "0.05",
        circuitBreakerTripped: false,
        circuitBreakerTrippedAt: null,
      } as any);

      const result = await service.updateRiskSettings("user-uuid-1", {
        drawdownEnabled: true,
        drawdownLookbackHours: 12,
        drawdownThresholdPct: 0.05,
      });

      expect(result.drawdownEnabled).toBe(true);
      expect(result.drawdownLookbackHours).toBe(12);
    });

    it("only includes defined fields in the upsert data", async () => {
      db.userLimit.upsert.mockResolvedValue({} as any);
      db.userLimit.findUnique.mockResolvedValue(null);

      await service.updateRiskSettings("user-uuid-1", {
        drawdownEnabled: true,
      });

      const call = db.userLimit.upsert.mock.calls[0][0];
      expect(call.update).toHaveProperty("drawdownEnabled", true);
      expect(call.update).not.toHaveProperty("drawdownLookbackHours");
      expect(call.update).not.toHaveProperty("drawdownThresholdPct");
    });

    it("passes correct where clause with userId", async () => {
      db.userLimit.upsert.mockResolvedValue({} as any);
      db.userLimit.findUnique.mockResolvedValue(null);

      await service.updateRiskSettings("user-uuid-1", {
        drawdownEnabled: false,
      });

      expect(db.userLimit.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-uuid-1" },
          create: expect.objectContaining({ userId: "user-uuid-1" }),
        }),
      );
    });
  });

  // ── resetCircuitBreaker ──────────────────────────────────────────────────

  describe("resetCircuitBreaker", () => {
    it("resets circuit breaker and returns { reset: true }", async () => {
      db.userLimit.upsert.mockResolvedValue({} as any);
      const mockDel = vi.fn().mockResolvedValue(1);
      mockRedis.getClient.mockReturnValue({ del: mockDel });

      const result = await service.resetCircuitBreaker("user-uuid-1");

      expect(result).toEqual({ reset: true });
    });

    it("upserts with circuitBreakerTripped false and null timestamp", async () => {
      db.userLimit.upsert.mockResolvedValue({} as any);
      mockRedis.getClient.mockReturnValue({ del: vi.fn() });

      await service.resetCircuitBreaker("user-uuid-1");

      expect(db.userLimit.upsert).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1" },
        create: {
          userId: "user-uuid-1",
          circuitBreakerTripped: false,
          circuitBreakerTrippedAt: null,
        },
        update: {
          circuitBreakerTripped: false,
          circuitBreakerTrippedAt: null,
        },
      });
    });

    it("deletes the Redis debounce key", async () => {
      db.userLimit.upsert.mockResolvedValue({} as any);
      const mockDel = vi.fn().mockResolvedValue(1);
      mockRedis.getClient.mockReturnValue({ del: mockDel });

      await service.resetCircuitBreaker("user-uuid-1");

      expect(mockDel).toHaveBeenCalledWith("cb:tripped:user-uuid-1");
    });

    it("still returns { reset: true } when Redis del fails", async () => {
      db.userLimit.upsert.mockResolvedValue({} as any);
      mockRedis.getClient.mockReturnValue({
        del: vi.fn().mockRejectedValue(new Error("Redis down")),
      });

      const result = await service.resetCircuitBreaker("user-uuid-1");

      expect(result).toEqual({ reset: true });
    });
  });

  // ── getBetaUsage ─────────────────────────────────────────────────────────

  describe("getBetaUsage", () => {
    it("returns all beta usage metrics", async () => {
      db.strategy.count.mockResolvedValue(2);
      db.order.aggregate.mockResolvedValue({ _sum: { size: 1500 } } as any);
      db.backtestRun.count.mockResolvedValue(1);
      db.marketplaceListing.count.mockResolvedValue(0);

      const result = await service.getBetaUsage("user-uuid-1");

      expect(result.strategies.used).toBe(2);
      expect(result.strategies.limit).toBe(3);
      expect(result.monthlyVolume.usedUsdc).toBe(1500);
      expect(result.monthlyVolume.limitUsdc).toBe(5000);
      expect(result.positionSize.maxUsdc).toBe(500);
      expect(result.backtests.runningOrQueued).toBe(1);
      expect(result.backtests.maxConcurrent).toBe(1);
      expect(result.marketplaceListings.used).toBe(0);
      expect(result.marketplaceListings.limit).toBe(2);
    });

    it("returns 0 volume when no orders exist", async () => {
      db.strategy.count.mockResolvedValue(0);
      db.order.aggregate.mockResolvedValue({ _sum: { size: null } } as any);
      db.backtestRun.count.mockResolvedValue(0);
      db.marketplaceListing.count.mockResolvedValue(0);

      const result = await service.getBetaUsage("user-uuid-1");

      expect(result.monthlyVolume.usedUsdc).toBe(0);
    });

    it("queries strategies excluding ARCHIVED status", async () => {
      db.strategy.count.mockResolvedValue(0);
      db.order.aggregate.mockResolvedValue({ _sum: { size: null } } as any);
      db.backtestRun.count.mockResolvedValue(0);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.getBetaUsage("user-uuid-1");

      expect(db.strategy.count).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1", status: { not: "ARCHIVED" } },
      });
    });

    it("queries orders with CONFIRMED status in current month", async () => {
      db.strategy.count.mockResolvedValue(0);
      db.order.aggregate.mockResolvedValue({ _sum: { size: null } } as any);
      db.backtestRun.count.mockResolvedValue(0);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.getBetaUsage("user-uuid-1");

      expect(db.order.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-uuid-1",
            status: "CONFIRMED",
          }),
        }),
      );
    });

    it("queries backtests with RUNNING or QUEUED status", async () => {
      db.strategy.count.mockResolvedValue(0);
      db.order.aggregate.mockResolvedValue({ _sum: { size: null } } as any);
      db.backtestRun.count.mockResolvedValue(0);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.getBetaUsage("user-uuid-1");

      expect(db.backtestRun.count).toHaveBeenCalledWith({
        where: {
          userId: "user-uuid-1",
          status: { in: ["RUNNING", "QUEUED"] },
        },
      });
    });

    it("queries marketplace listings excluding DELISTED", async () => {
      db.strategy.count.mockResolvedValue(0);
      db.order.aggregate.mockResolvedValue({ _sum: { size: null } } as any);
      db.backtestRun.count.mockResolvedValue(0);
      db.marketplaceListing.count.mockResolvedValue(0);

      await service.getBetaUsage("user-uuid-1");

      expect(db.marketplaceListing.count).toHaveBeenCalledWith({
        where: {
          sellerId: "user-uuid-1",
          status: { notIn: ["DELISTED"] },
        },
      });
    });
  });

  // ── updatePassword Redis side effects ────────────────────────────────────

  describe("updatePassword — Redis side effects", () => {
    it("sets pwchange key in Redis after successful password change", async () => {
      const hash = await bcrypt.hash("OldPassw0rd!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);
      db.user.update.mockResolvedValue({} as any);

      await service.updatePassword(
        "user-uuid-1",
        makeUpdatePasswordDto() as any,
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        "pwchange:user-uuid-1",
        expect.any(String),
        300,
      );
    });

    it("scans and deletes refresh tokens after password change", async () => {
      const hash = await bcrypt.hash("OldPassw0rd!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);
      db.user.update.mockResolvedValue({} as any);

      await service.updatePassword(
        "user-uuid-1",
        makeUpdatePasswordDto() as any,
      );

      const client = mockRedis.getClient();
      expect(client.scanStream).toHaveBeenCalledWith({
        match: "refresh:user-uuid-1:*",
        count: 100,
      });
    });

    it("still returns success when Redis set fails", async () => {
      const hash = await bcrypt.hash("OldPassw0rd!", 10);
      db.user.findUniqueOrThrow.mockResolvedValue({
        passwordHash: hash,
      } as any);
      db.user.update.mockResolvedValue({} as any);
      mockRedis.set.mockRejectedValue(new Error("Redis down"));

      const result = await service.updatePassword(
        "user-uuid-1",
        makeUpdatePasswordDto() as any,
      );

      expect(result).toEqual({ message: "Password updated" });
    });
  });
});
