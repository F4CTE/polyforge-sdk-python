import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import * as bcrypt from "bcryptjs";

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

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("SettingsService", () => {
  let service: SettingsService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new SettingsService(db as any);
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
        emailOnFill: true,
        emailOnAlert: false,
      });

      expect(result).toEqual(prefs);
    });

    it("calls upsert with the correct where, create and update args", async () => {
      db.notificationPreference.upsert.mockResolvedValue({} as any);
      const dto = { emailOnFill: true, emailOnAlert: false };

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
});
