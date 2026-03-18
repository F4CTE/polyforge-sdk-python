import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ProfileService } from "./profile.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

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

      expect(result.id).toBe("user-uuid-1");
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
  });
});
