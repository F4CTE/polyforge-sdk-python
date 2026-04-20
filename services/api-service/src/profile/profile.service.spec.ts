import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
} from "@nestjs/common";
import { ProfileService } from "./profile.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";
import * as bcrypt from "bcrypt";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-uuid-1",
    username: "alice",
    displayName: "Alice Smith",
    bio: "Polymarket trader",
    avatarUrl: "https://example.com/avatar.png",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("ProfileService", () => {
  let service: ProfileService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new ProfileService(db as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getProfile ────────────────────────────────────────────────────────────

  describe("getProfile", () => {
    it("returns the full profile for a known username", async () => {
      const user = makeUser();
      db.user.findUnique.mockResolvedValue(user as any);
      db.follow.count
        .mockResolvedValueOnce(42) // followersCount
        .mockResolvedValueOnce(10); // followingCount
      db.strategy.count.mockResolvedValue(5);

      const result = await service.getProfile("alice");

      // SECURITY: Internal UUID removed from public profile response
      expect(result.id).toBeUndefined();
      expect(result.username).toBe("alice");
      expect(result.displayName).toBe("Alice Smith");
      expect(result.followersCount).toBe(42);
      expect(result.followingCount).toBe(10);
      expect(result.publicStrategyCount).toBe(5);
    });

    it("throws NotFoundException (404) when the user does not exist", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NOT_FOUND error code when user does not exist", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile("nonexistent")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("sets isFollowing: false when no viewerUserId is provided", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.follow.count.mockResolvedValue(0);
      db.strategy.count.mockResolvedValue(0);

      const result = await service.getProfile("alice");

      expect(result.isFollowing).toBe(false);
    });

    it("sets isFollowing: false when viewerUserId is the same as the profile user", async () => {
      const user = makeUser({ id: "user-uuid-1" });
      db.user.findUnique.mockResolvedValue(user as any);
      db.follow.count.mockResolvedValue(0);
      db.strategy.count.mockResolvedValue(0);

      const result = await service.getProfile("alice", "user-uuid-1");

      expect(result.isFollowing).toBe(false);
      // follow.findUnique should NOT be called because viewer === profile user
      expect(db.follow.findUnique).not.toHaveBeenCalled();
    });

    it("sets isFollowing: true when viewer follows the profile user", async () => {
      const user = makeUser({ id: "user-uuid-1" });
      db.user.findUnique.mockResolvedValue(user as any);
      db.follow.count.mockResolvedValue(5);
      db.strategy.count.mockResolvedValue(0);
      db.follow.findUnique.mockResolvedValue({
        followerId: "viewer-uuid",
        followingId: "user-uuid-1",
      } as any);

      const result = await service.getProfile("alice", "viewer-uuid");

      expect(result.isFollowing).toBe(true);
    });

    it("sets isFollowing: false when viewer does NOT follow the profile user", async () => {
      const user = makeUser({ id: "user-uuid-1" });
      db.user.findUnique.mockResolvedValue(user as any);
      db.follow.count.mockResolvedValue(5);
      db.strategy.count.mockResolvedValue(0);
      db.follow.findUnique.mockResolvedValue(null);

      const result = await service.getProfile("alice", "viewer-uuid");

      expect(result.isFollowing).toBe(false);
    });

    it("looks up the user by username", async () => {
      db.user.findUnique.mockResolvedValue(makeUser() as any);
      db.follow.count.mockResolvedValue(0);
      db.strategy.count.mockResolvedValue(0);

      await service.getProfile("alice");

      expect(db.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { username: "alice" } }),
      );
    });

    it("includes joinedAt from createdAt", async () => {
      const createdAt = new Date("2024-06-15T00:00:00.000Z");
      db.user.findUnique.mockResolvedValue(makeUser({ createdAt }) as any);
      db.follow.count.mockResolvedValue(0);
      db.strategy.count.mockResolvedValue(0);

      const result = await service.getProfile("alice");

      expect(result.joinedAt).toEqual(createdAt);
    });

    it("returns null for bio and avatarUrl when they are not set", async () => {
      db.user.findUnique.mockResolvedValue(
        makeUser({ bio: null, avatarUrl: null }) as any,
      );
      db.follow.count.mockResolvedValue(0);
      db.strategy.count.mockResolvedValue(0);

      const result = await service.getProfile("alice");

      expect(result.bio).toBeNull();
      expect(result.avatarUrl).toBeNull();
    });
  });

  // ── toggleFollow ──────────────────────────────────────────────────────────

  describe("toggleFollow", () => {
    it("creates a follow and returns following: true when not already following", async () => {
      const target = { id: "target-uuid-1" };
      db.user.findUnique.mockResolvedValue(target as any);
      db.follow.findUnique.mockResolvedValue(null); // not following yet
      db.follow.create.mockResolvedValue({} as any);
      db.follow.count.mockResolvedValue(11);

      const result = await service.toggleFollow("bob", "viewer-uuid");

      expect(result.following).toBe(true);
      expect(result.followersCount).toBe(11);
      expect(db.follow.create).toHaveBeenCalledOnce();
    });

    it("deletes a follow and returns following: false when already following", async () => {
      const target = { id: "target-uuid-1" };
      db.user.findUnique.mockResolvedValue(target as any);
      db.follow.findUnique.mockResolvedValue({
        followerId: "viewer-uuid",
        followingId: "target-uuid-1",
      } as any);
      db.follow.delete.mockResolvedValue({} as any);
      db.follow.count.mockResolvedValue(9);

      const result = await service.toggleFollow("bob", "viewer-uuid");

      expect(result.following).toBe(false);
      expect(result.followersCount).toBe(9);
      expect(db.follow.delete).toHaveBeenCalledOnce();
    });

    it("throws NotFoundException (404) when target user does not exist", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleFollow("nonexistent", "viewer-uuid"),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NOT_FOUND error code when target user does not exist", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleFollow("nonexistent", "viewer-uuid"),
      ).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("does NOT call delete when creating a new follow", async () => {
      const target = { id: "target-uuid-1" };
      db.user.findUnique.mockResolvedValue(target as any);
      db.follow.findUnique.mockResolvedValue(null);
      db.follow.create.mockResolvedValue({} as any);
      db.follow.count.mockResolvedValue(5);

      await service.toggleFollow("bob", "viewer-uuid");

      expect(db.follow.delete).not.toHaveBeenCalled();
    });

    it("does NOT call create when deleting an existing follow", async () => {
      const target = { id: "target-uuid-1" };
      db.user.findUnique.mockResolvedValue(target as any);
      db.follow.findUnique.mockResolvedValue({
        followerId: "viewer-uuid",
        followingId: "target-uuid-1",
      } as any);
      db.follow.delete.mockResolvedValue({} as any);
      db.follow.count.mockResolvedValue(3);

      await service.toggleFollow("bob", "viewer-uuid");

      expect(db.follow.create).not.toHaveBeenCalled();
    });

    it("queries updated follower count after the toggle", async () => {
      const target = { id: "target-uuid-1" };
      db.user.findUnique.mockResolvedValue(target as any);
      db.follow.findUnique.mockResolvedValue(null);
      db.follow.create.mockResolvedValue({} as any);
      db.follow.count.mockResolvedValue(20);

      await service.toggleFollow("bob", "viewer-uuid");

      expect(db.follow.count).toHaveBeenCalledWith({
        where: { followingId: "target-uuid-1" },
      });
    });

    it("throws CANNOT_FOLLOW_SELF when userId equals target userId (N-M3)", async () => {
      const selfId = "user-uuid-self";
      db.user.findUnique.mockResolvedValue({ id: selfId } as any);

      await expect(service.toggleFollow("alice", selfId)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("throws with CANNOT_FOLLOW_SELF error code (N-M3)", async () => {
      const selfId = "user-uuid-self";
      db.user.findUnique.mockResolvedValue({ id: selfId } as any);

      await expect(service.toggleFollow("alice", selfId)).rejects.toMatchObject(
        {
          response: { code: "CANNOT_FOLLOW_SELF" },
        },
      );
    });

    it("does not create or delete a follow when self-following (N-M3)", async () => {
      const selfId = "user-uuid-self";
      db.user.findUnique.mockResolvedValue({ id: selfId } as any);

      await service.toggleFollow("alice", selfId).catch(() => {});

      expect(db.follow.create).not.toHaveBeenCalled();
      expect(db.follow.delete).not.toHaveBeenCalled();
    });
  });

  // ── updateProfile ────────────────────────────────────────────────────────

  describe("updateProfile", () => {
    it("updates and returns selected fields", async () => {
      const updated = {
        displayName: "New Name",
        bio: "Updated bio",
        avatarUrl: "https://example.com/new.png",
      };
      db.user.update.mockResolvedValue(updated as any);

      const result = await service.updateProfile("user-uuid-1", {
        displayName: "New Name",
        bio: "Updated bio",
        avatarUrl: "https://example.com/new.png",
      });

      expect(result).toEqual(updated);
    });

    it("truncates displayName to 50 characters", async () => {
      db.user.update.mockResolvedValue({} as any);
      const longName = "A".repeat(100);

      await service.updateProfile("user-uuid-1", { displayName: longName });

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect((dataArg.displayName as string).length).toBe(50);
    });

    it("truncates bio to 500 characters", async () => {
      db.user.update.mockResolvedValue({} as any);
      const longBio = "B".repeat(1000);

      await service.updateProfile("user-uuid-1", { bio: longBio });

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect((dataArg.bio as string).length).toBe(500);
    });

    it("truncates avatarUrl to 500 characters", async () => {
      db.user.update.mockResolvedValue({} as any);
      const longUrl = "https://example.com/" + "x".repeat(600);

      await service.updateProfile("user-uuid-1", { avatarUrl: longUrl });

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect((dataArg.avatarUrl as string).length).toBe(500);
    });

    it("only includes fields that are defined", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", { displayName: "Test" });

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect(dataArg).toHaveProperty("displayName", "Test");
      expect(dataArg).not.toHaveProperty("bio");
      expect(dataArg).not.toHaveProperty("avatarUrl");
    });

    it("includes fields set to empty string", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", {
        displayName: "",
        bio: "",
        avatarUrl: "",
      });

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect(dataArg.displayName).toBe("");
      expect(dataArg.bio).toBe("");
      expect(dataArg.avatarUrl).toBe("");
    });

    it("selects only displayName, bio, and avatarUrl", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", { displayName: "X" });

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { displayName: true, bio: true, avatarUrl: true },
        }),
      );
    });

    it("passes no data keys when dto has no defined fields", async () => {
      db.user.update.mockResolvedValue({} as any);

      await service.updateProfile("user-uuid-1", {});

      const dataArg = db.user.update.mock.calls[0][0]?.data;
      expect(Object.keys(dataArg)).toHaveLength(0);
    });
  });

  // ── changePassword ───────────────────────────────────────────────────────

  describe("changePassword", () => {
    it("changes password and returns success message", async () => {
      const hash = await bcrypt.hash("OldPass123!", 10);
      db.user.findUnique.mockResolvedValue({ passwordHash: hash } as any);
      db.user.update.mockResolvedValue({} as any);

      const result = await service.changePassword("user-uuid-1", {
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      });

      expect(result).toEqual({ message: "Password changed" });
    });

    it("hashes the new password with bcrypt before storing", async () => {
      const hash = await bcrypt.hash("OldPass123!", 10);
      db.user.findUnique.mockResolvedValue({ passwordHash: hash } as any);
      db.user.update.mockResolvedValue({} as any);

      await service.changePassword("user-uuid-1", {
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      });

      const newHash = db.user.update.mock.calls[0][0]?.data
        .passwordHash as string;
      expect(await bcrypt.compare("NewPass123!", newHash)).toBe(true);
    });

    it("throws NotFoundException when user does not exist", async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword("user-uuid-1", {
          currentPassword: "X",
          newPassword: "Y1234567",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when current password is incorrect", async () => {
      const hash = await bcrypt.hash("Correct123!", 10);
      db.user.findUnique.mockResolvedValue({ passwordHash: hash } as any);

      await expect(
        service.changePassword("user-uuid-1", {
          currentPassword: "Wrong123!",
          newPassword: "NewPass123!",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when new password is shorter than 8 characters", async () => {
      const hash = await bcrypt.hash("OldPass123!", 10);
      db.user.findUnique.mockResolvedValue({ passwordHash: hash } as any);

      await expect(
        service.changePassword("user-uuid-1", {
          currentPassword: "OldPass123!",
          newPassword: "short",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("does NOT update when current password is wrong", async () => {
      const hash = await bcrypt.hash("Correct123!", 10);
      db.user.findUnique.mockResolvedValue({ passwordHash: hash } as any);

      await service
        .changePassword("user-uuid-1", {
          currentPassword: "Wrong123!",
          newPassword: "NewPass123!",
        })
        .catch(() => {});

      expect(db.user.update).not.toHaveBeenCalled();
    });

    it("uses bcrypt cost 12 for hashing", async () => {
      const hash = await bcrypt.hash("OldPass123!", 10);
      db.user.findUnique.mockResolvedValue({ passwordHash: hash } as any);
      db.user.update.mockResolvedValue({} as any);

      await service.changePassword("user-uuid-1", {
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      });

      const newHash = db.user.update.mock.calls[0][0]?.data
        .passwordHash as string;
      expect(newHash).toMatch(/^\$2[ab]\$12\$/);
    });
  });

  // ── updateNotifications ──────────────────────────────────────────────────

  describe("updateNotifications", () => {
    it("upserts and returns success message", async () => {
      db.notificationPreference.upsert.mockResolvedValue({} as any);

      const result = await service.updateNotifications("user-uuid-1", {
        emailEnabled: true,
      });

      expect(result).toEqual({ message: "Notification preferences updated" });
    });

    it("calls upsert with correct where, create, and update", async () => {
      db.notificationPreference.upsert.mockResolvedValue({} as any);
      const prefs = { emailEnabled: true, telegramEnabled: false };

      await service.updateNotifications("user-uuid-1", prefs);

      expect(db.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1" },
        create: { userId: "user-uuid-1", ...prefs },
        update: prefs,
      });
    });

    it("handles empty prefs without error", async () => {
      db.notificationPreference.upsert.mockResolvedValue({} as any);

      await expect(
        service.updateNotifications("user-uuid-1", {}),
      ).resolves.toEqual({ message: "Notification preferences updated" });
    });
  });
});
