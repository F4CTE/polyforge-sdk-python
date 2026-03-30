"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const profile_service_1 = require("./profile.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Factories ────────────────────────────────────────────────────────────────
function makeUser(overrides = {}) {
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
(0, vitest_1.describe)("ProfileService", () => {
    let service;
    let db;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        service = new profile_service_1.ProfileService(db);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── getProfile ────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("getProfile", () => {
        (0, vitest_1.it)("returns the full profile for a known username", async () => {
            const user = makeUser();
            db.user.findUnique.mockResolvedValue(user);
            db.follow.count
                .mockResolvedValueOnce(42) // followersCount
                .mockResolvedValueOnce(10); // followingCount
            db.strategy.count.mockResolvedValue(5);
            const result = await service.getProfile("alice");
            // SECURITY: Internal UUID removed from public profile response
            (0, vitest_1.expect)(result.id).toBeUndefined();
            (0, vitest_1.expect)(result.username).toBe("alice");
            (0, vitest_1.expect)(result.displayName).toBe("Alice Smith");
            (0, vitest_1.expect)(result.followersCount).toBe(42);
            (0, vitest_1.expect)(result.followingCount).toBe(10);
            (0, vitest_1.expect)(result.publicStrategyCount).toBe(5);
        });
        (0, vitest_1.it)("throws NotFoundException (404) when the user does not exist", async () => {
            db.user.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.getProfile("nonexistent")).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws NOT_FOUND error code when user does not exist", async () => {
            db.user.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.getProfile("nonexistent")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
            });
        });
        (0, vitest_1.it)("sets isFollowing: false when no viewerUserId is provided", async () => {
            db.user.findUnique.mockResolvedValue(makeUser());
            db.follow.count.mockResolvedValue(0);
            db.strategy.count.mockResolvedValue(0);
            const result = await service.getProfile("alice");
            (0, vitest_1.expect)(result.isFollowing).toBe(false);
        });
        (0, vitest_1.it)("sets isFollowing: false when viewerUserId is the same as the profile user", async () => {
            const user = makeUser({ id: "user-uuid-1" });
            db.user.findUnique.mockResolvedValue(user);
            db.follow.count.mockResolvedValue(0);
            db.strategy.count.mockResolvedValue(0);
            const result = await service.getProfile("alice", "user-uuid-1");
            (0, vitest_1.expect)(result.isFollowing).toBe(false);
            // follow.findUnique should NOT be called because viewer === profile user
            (0, vitest_1.expect)(db.follow.findUnique).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("sets isFollowing: true when viewer follows the profile user", async () => {
            const user = makeUser({ id: "user-uuid-1" });
            db.user.findUnique.mockResolvedValue(user);
            db.follow.count.mockResolvedValue(5);
            db.strategy.count.mockResolvedValue(0);
            db.follow.findUnique.mockResolvedValue({
                followerId: "viewer-uuid",
                followingId: "user-uuid-1",
            });
            const result = await service.getProfile("alice", "viewer-uuid");
            (0, vitest_1.expect)(result.isFollowing).toBe(true);
        });
        (0, vitest_1.it)("sets isFollowing: false when viewer does NOT follow the profile user", async () => {
            const user = makeUser({ id: "user-uuid-1" });
            db.user.findUnique.mockResolvedValue(user);
            db.follow.count.mockResolvedValue(5);
            db.strategy.count.mockResolvedValue(0);
            db.follow.findUnique.mockResolvedValue(null);
            const result = await service.getProfile("alice", "viewer-uuid");
            (0, vitest_1.expect)(result.isFollowing).toBe(false);
        });
        (0, vitest_1.it)("looks up the user by username", async () => {
            db.user.findUnique.mockResolvedValue(makeUser());
            db.follow.count.mockResolvedValue(0);
            db.strategy.count.mockResolvedValue(0);
            await service.getProfile("alice");
            (0, vitest_1.expect)(db.user.findUnique).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ where: { username: "alice" } }));
        });
        (0, vitest_1.it)("includes joinedAt from createdAt", async () => {
            const createdAt = new Date("2024-06-15T00:00:00.000Z");
            db.user.findUnique.mockResolvedValue(makeUser({ createdAt }));
            db.follow.count.mockResolvedValue(0);
            db.strategy.count.mockResolvedValue(0);
            const result = await service.getProfile("alice");
            (0, vitest_1.expect)(result.joinedAt).toEqual(createdAt);
        });
        (0, vitest_1.it)("returns null for bio and avatarUrl when they are not set", async () => {
            db.user.findUnique.mockResolvedValue(makeUser({ bio: null, avatarUrl: null }));
            db.follow.count.mockResolvedValue(0);
            db.strategy.count.mockResolvedValue(0);
            const result = await service.getProfile("alice");
            (0, vitest_1.expect)(result.bio).toBeNull();
            (0, vitest_1.expect)(result.avatarUrl).toBeNull();
        });
    });
    // ── toggleFollow ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)("toggleFollow", () => {
        (0, vitest_1.it)("creates a follow and returns following: true when not already following", async () => {
            const target = { id: "target-uuid-1" };
            db.user.findUnique.mockResolvedValue(target);
            db.follow.findUnique.mockResolvedValue(null); // not following yet
            db.follow.create.mockResolvedValue({});
            db.follow.count.mockResolvedValue(11);
            const result = await service.toggleFollow("bob", "viewer-uuid");
            (0, vitest_1.expect)(result.following).toBe(true);
            (0, vitest_1.expect)(result.followersCount).toBe(11);
            (0, vitest_1.expect)(db.follow.create).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("deletes a follow and returns following: false when already following", async () => {
            const target = { id: "target-uuid-1" };
            db.user.findUnique.mockResolvedValue(target);
            db.follow.findUnique.mockResolvedValue({
                followerId: "viewer-uuid",
                followingId: "target-uuid-1",
            });
            db.follow.delete.mockResolvedValue({});
            db.follow.count.mockResolvedValue(9);
            const result = await service.toggleFollow("bob", "viewer-uuid");
            (0, vitest_1.expect)(result.following).toBe(false);
            (0, vitest_1.expect)(result.followersCount).toBe(9);
            (0, vitest_1.expect)(db.follow.delete).toHaveBeenCalledOnce();
        });
        (0, vitest_1.it)("throws NotFoundException (404) when target user does not exist", async () => {
            db.user.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.toggleFollow("nonexistent", "viewer-uuid")).rejects.toThrow(common_1.NotFoundException);
        });
        (0, vitest_1.it)("throws NOT_FOUND error code when target user does not exist", async () => {
            db.user.findUnique.mockResolvedValue(null);
            await (0, vitest_1.expect)(service.toggleFollow("nonexistent", "viewer-uuid")).rejects.toMatchObject({
                response: { code: "NOT_FOUND" },
            });
        });
        (0, vitest_1.it)("does NOT call delete when creating a new follow", async () => {
            const target = { id: "target-uuid-1" };
            db.user.findUnique.mockResolvedValue(target);
            db.follow.findUnique.mockResolvedValue(null);
            db.follow.create.mockResolvedValue({});
            db.follow.count.mockResolvedValue(5);
            await service.toggleFollow("bob", "viewer-uuid");
            (0, vitest_1.expect)(db.follow.delete).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("does NOT call create when deleting an existing follow", async () => {
            const target = { id: "target-uuid-1" };
            db.user.findUnique.mockResolvedValue(target);
            db.follow.findUnique.mockResolvedValue({
                followerId: "viewer-uuid",
                followingId: "target-uuid-1",
            });
            db.follow.delete.mockResolvedValue({});
            db.follow.count.mockResolvedValue(3);
            await service.toggleFollow("bob", "viewer-uuid");
            (0, vitest_1.expect)(db.follow.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("queries updated follower count after the toggle", async () => {
            const target = { id: "target-uuid-1" };
            db.user.findUnique.mockResolvedValue(target);
            db.follow.findUnique.mockResolvedValue(null);
            db.follow.create.mockResolvedValue({});
            db.follow.count.mockResolvedValue(20);
            await service.toggleFollow("bob", "viewer-uuid");
            (0, vitest_1.expect)(db.follow.count).toHaveBeenCalledWith({
                where: { followingId: "target-uuid-1" },
            });
        });
        (0, vitest_1.it)("throws CANNOT_FOLLOW_SELF when userId equals target userId (N-M3)", async () => {
            const selfId = "user-uuid-self";
            db.user.findUnique.mockResolvedValue({ id: selfId });
            await (0, vitest_1.expect)(service.toggleFollow("alice", selfId)).rejects.toThrow(common_1.UnprocessableEntityException);
        });
        (0, vitest_1.it)("throws with CANNOT_FOLLOW_SELF error code (N-M3)", async () => {
            const selfId = "user-uuid-self";
            db.user.findUnique.mockResolvedValue({ id: selfId });
            await (0, vitest_1.expect)(service.toggleFollow("alice", selfId)).rejects.toMatchObject({
                response: { code: "CANNOT_FOLLOW_SELF" },
            });
        });
        (0, vitest_1.it)("does not create or delete a follow when self-following (N-M3)", async () => {
            const selfId = "user-uuid-self";
            db.user.findUnique.mockResolvedValue({ id: selfId });
            await service.toggleFollow("alice", selfId).catch(() => { });
            (0, vitest_1.expect)(db.follow.create).not.toHaveBeenCalled();
            (0, vitest_1.expect)(db.follow.delete).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=profile.service.spec.js.map