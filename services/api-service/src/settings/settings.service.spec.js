"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const common_1 = require("@nestjs/common");
const settings_service_1 = require("./settings.service");
const mock_db_1 = require("../../test/helpers/mock-db");
const bcrypt = __importStar(require("bcrypt"));
// ─── Factories ────────────────────────────────────────────────────────────────
function makeUpdateProfileDto(overrides = {}) {
    return {
        displayName: "Alice Smith",
        bio: "Polymarket trader",
        avatarUrl: "https://example.com/avatar.png",
        twitterHandle: "@alice",
        ...overrides,
    };
}
function makeUpdatePasswordDto(overrides = {}) {
    return {
        currentPassword: "OldPassw0rd!",
        newPassword: "NewPassw0rd!",
        ...overrides,
    };
}
function createMockRedis() {
    return {
        get: vitest_1.vi.fn().mockResolvedValue(null),
        set: vitest_1.vi.fn().mockResolvedValue("OK"),
        getClient: vitest_1.vi.fn().mockReturnValue({
            scanStream: vitest_1.vi.fn().mockReturnValue({ on: vitest_1.vi.fn() }),
            del: vitest_1.vi.fn(),
        }),
    };
}
function createMockConfig(overrides = {}) {
    const defaults = {
        GAS_DAILY_LIMIT_MATIC: "0.5",
        GAS_SPONSOR_ENABLED: "true",
        ...overrides,
    };
    return {
        get: vitest_1.vi.fn((key) => defaults[key]),
    };
}
// ─── Suite ───────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("SettingsService", () => {
    let service;
    let db;
    let mockRedis;
    let mockConfig;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        mockRedis = createMockRedis();
        mockConfig = createMockConfig();
        service = new settings_service_1.SettingsService(db, mockRedis, mockConfig);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── updateProfile ─────────────────────────────────────────────────────────
    (0, vitest_1.describe)("updateProfile", () => {
        (0, vitest_1.it)("updates and returns the user profile", async () => {
            const updatedUser = {
                id: "user-uuid-1",
                username: "alice",
                displayName: "Alice Smith",
                bio: "Polymarket trader",
                avatarUrl: "https://example.com/avatar.png",
            };
            db.user.update.mockResolvedValue(updatedUser);
            const result = await service.updateProfile("user-uuid-1", makeUpdateProfileDto());
            (0, vitest_1.expect)(result).toEqual(updatedUser);
        });
        (0, vitest_1.it)("calls prisma.user.update with the correct where and data", async () => {
            db.user.update.mockResolvedValue({});
            await service.updateProfile("user-uuid-1", makeUpdateProfileDto());
            (0, vitest_1.expect)(db.user.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                where: { id: "user-uuid-1" },
                data: vitest_1.expect.objectContaining({
                    displayName: "Alice Smith",
                    bio: "Polymarket trader",
                }),
            }));
        });
        (0, vitest_1.it)("only includes fields that are defined in the dto", async () => {
            db.user.update.mockResolvedValue({});
            await service.updateProfile("user-uuid-1", { displayName: "Bob" });
            const dataArg = db.user.update.mock.calls[0][0]?.data;
            (0, vitest_1.expect)(dataArg).toHaveProperty("displayName", "Bob");
            (0, vitest_1.expect)(dataArg).not.toHaveProperty("bio");
            (0, vitest_1.expect)(dataArg).not.toHaveProperty("avatarUrl");
            (0, vitest_1.expect)(dataArg).not.toHaveProperty("twitterHandle");
        });
        (0, vitest_1.it)("includes bio when explicitly set to empty string", async () => {
            db.user.update.mockResolvedValue({});
            await service.updateProfile("user-uuid-1", { bio: "" });
            const dataArg = db.user.update.mock.calls[0][0]?.data;
            (0, vitest_1.expect)(dataArg).toHaveProperty("bio", "");
        });
        (0, vitest_1.it)("does NOT include displayName when it is undefined", async () => {
            db.user.update.mockResolvedValue({});
            await service.updateProfile("user-uuid-1", { bio: "trader" });
            const dataArg = db.user.update.mock.calls[0][0]?.data;
            (0, vitest_1.expect)(dataArg).not.toHaveProperty("displayName");
        });
        (0, vitest_1.it)("selects only safe fields (no passwordHash)", async () => {
            db.user.update.mockResolvedValue({});
            await service.updateProfile("user-uuid-1", makeUpdateProfileDto());
            (0, vitest_1.expect)(db.user.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    bio: true,
                    avatarUrl: true,
                },
            }));
        });
        (0, vitest_1.it)("includes twitterHandle in data when provided", async () => {
            db.user.update.mockResolvedValue({});
            await service.updateProfile("user-uuid-1", {
                twitterHandle: "@alice",
            });
            const dataArg = db.user.update.mock.calls[0][0]?.data;
            (0, vitest_1.expect)(dataArg).toHaveProperty("twitterHandle", "@alice");
        });
    });
    // ── updateNotifications ───────────────────────────────────────────────────
    (0, vitest_1.describe)("updateNotifications", () => {
        (0, vitest_1.it)("upserts notification preferences and returns the record", async () => {
            const prefs = {
                userId: "user-uuid-1",
                emailOnFill: true,
                emailOnAlert: false,
            };
            db.notificationPreference.upsert.mockResolvedValue(prefs);
            const result = await service.updateNotifications("user-uuid-1", {
                emailOnFill: true,
                emailOnAlert: false,
            });
            (0, vitest_1.expect)(result).toEqual(prefs);
        });
        (0, vitest_1.it)("calls upsert with the correct where, create and update args", async () => {
            db.notificationPreference.upsert.mockResolvedValue({});
            const dto = { emailOnFill: true, emailOnAlert: false };
            await service.updateNotifications("user-uuid-1", dto);
            (0, vitest_1.expect)(db.notificationPreference.upsert).toHaveBeenCalledWith({
                where: { userId: "user-uuid-1" },
                create: { userId: "user-uuid-1", ...dto },
                update: { ...dto },
            });
        });
        (0, vitest_1.it)("handles an empty dto without throwing", async () => {
            db.notificationPreference.upsert.mockResolvedValue({});
            await (0, vitest_1.expect)(service.updateNotifications("user-uuid-1", {})).resolves.toBeDefined();
        });
    });
    // ── updatePassword ────────────────────────────────────────────────────────
    (0, vitest_1.describe)("updatePassword", () => {
        (0, vitest_1.it)("updates the password and returns a success message", async () => {
            const hash = await bcrypt.hash("OldPassw0rd!", 10);
            db.user.findUniqueOrThrow.mockResolvedValue({
                passwordHash: hash,
            });
            db.user.update.mockResolvedValue({});
            const result = await service.updatePassword("user-uuid-1", makeUpdatePasswordDto());
            (0, vitest_1.expect)(result).toEqual({ message: "Password updated" });
        });
        (0, vitest_1.it)("calls prisma.user.update with a bcrypt hash of the new password", async () => {
            const hash = await bcrypt.hash("OldPassw0rd!", 10);
            db.user.findUniqueOrThrow.mockResolvedValue({
                passwordHash: hash,
            });
            db.user.update.mockResolvedValue({});
            await service.updatePassword("user-uuid-1", makeUpdatePasswordDto());
            const dataArg = db.user.update.mock.calls[0][0]?.data;
            (0, vitest_1.expect)(dataArg.passwordHash).toBeDefined();
            // Verify it is a valid bcrypt hash (not the plain text password)
            const isValidHash = await bcrypt.compare("NewPassw0rd!", dataArg.passwordHash);
            (0, vitest_1.expect)(isValidHash).toBe(true);
        });
        (0, vitest_1.it)("throws INVALID_CREDENTIALS (401) when current password is wrong", async () => {
            const hash = await bcrypt.hash("CorrectPassword123!", 10);
            db.user.findUniqueOrThrow.mockResolvedValue({
                passwordHash: hash,
            });
            await (0, vitest_1.expect)(service.updatePassword("user-uuid-1", makeUpdatePasswordDto({ currentPassword: "WrongPassword1!" }))).rejects.toThrow(common_1.UnauthorizedException);
        });
        (0, vitest_1.it)("throws INVALID_CREDENTIALS error code when current password does not match", async () => {
            const hash = await bcrypt.hash("CorrectPassword123!", 10);
            db.user.findUniqueOrThrow.mockResolvedValue({
                passwordHash: hash,
            });
            await (0, vitest_1.expect)(service.updatePassword("user-uuid-1", makeUpdatePasswordDto({ currentPassword: "WrongPassword1!" }))).rejects.toMatchObject({
                response: { code: "INVALID_CREDENTIALS" },
            });
        });
        (0, vitest_1.it)("does NOT call user.update when the current password is wrong", async () => {
            const hash = await bcrypt.hash("CorrectPassword123!", 10);
            db.user.findUniqueOrThrow.mockResolvedValue({
                passwordHash: hash,
            });
            await service
                .updatePassword("user-uuid-1", makeUpdatePasswordDto({ currentPassword: "WrongPassword1!" }))
                .catch(() => { });
            (0, vitest_1.expect)(db.user.update).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("looks up the user with findUniqueOrThrow selecting only passwordHash", async () => {
            const hash = await bcrypt.hash("OldPassw0rd!", 10);
            db.user.findUniqueOrThrow.mockResolvedValue({
                passwordHash: hash,
            });
            db.user.update.mockResolvedValue({});
            await service.updatePassword("user-uuid-1", makeUpdatePasswordDto());
            (0, vitest_1.expect)(db.user.findUniqueOrThrow).toHaveBeenCalledWith({
                where: { id: "user-uuid-1" },
                select: { passwordHash: true },
            });
        });
        (0, vitest_1.it)("uses bcrypt cost 12 for the new password hash", async () => {
            const hash = await bcrypt.hash("OldPassw0rd!", 10);
            db.user.findUniqueOrThrow.mockResolvedValue({
                passwordHash: hash,
            });
            db.user.update.mockResolvedValue({});
            await service.updatePassword("user-uuid-1", makeUpdatePasswordDto());
            const updateCall = db.user.update.mock.calls[0][0];
            const newHash = updateCall.data.passwordHash;
            // Verify the stored hash is a valid bcrypt hash at cost 12
            (0, vitest_1.expect)(newHash).toMatch(/^\$2[ab]\$12\$/);
            (0, vitest_1.expect)(await bcrypt.compare("NewPassw0rd!", newHash)).toBe(true);
        });
        (0, vitest_1.it)("propagates errors from findUniqueOrThrow (e.g. user not found)", async () => {
            db.user.findUniqueOrThrow.mockRejectedValue(new Error("Record not found"));
            await (0, vitest_1.expect)(service.updatePassword("user-uuid-1", makeUpdatePasswordDto())).rejects.toThrow("Record not found");
        });
    });
    // ── getGasUsage ─────────────────────────────────────────────────────────────
    (0, vitest_1.describe)("getGasUsage", () => {
        (0, vitest_1.beforeEach)(() => {
            vitest_1.vi.useFakeTimers();
            vitest_1.vi.setSystemTime(new Date("2026-03-24T12:00:00Z"));
        });
        (0, vitest_1.afterEach)(() => {
            vitest_1.vi.useRealTimers();
        });
        (0, vitest_1.it)("returns spent, limit, and remaining when usage exists", async () => {
            mockRedis.get.mockResolvedValue("0.2");
            const result = await service.getGasUsage("user-uuid-1");
            (0, vitest_1.expect)(result).toEqual({
                todayUsage: 0.2,
                dailyLimit: 0.5,
                remaining: 0.3,
                sponsorEnabled: true,
            });
        });
        (0, vitest_1.it)("returns 0 spent when no Redis key exists", async () => {
            mockRedis.get.mockResolvedValue(null);
            const result = await service.getGasUsage("user-uuid-1");
            (0, vitest_1.expect)(result.todayUsage).toBe(0);
            (0, vitest_1.expect)(result.remaining).toBe(0.5);
            (0, vitest_1.expect)(result.dailyLimit).toBe(0.5);
        });
        (0, vitest_1.it)("reads the correct Redis key based on today's date", async () => {
            mockRedis.get.mockResolvedValue(null);
            await service.getGasUsage("user-uuid-1");
            (0, vitest_1.expect)(mockRedis.get).toHaveBeenCalledWith("gas:spent:user-uuid-1:2026-03-24");
        });
        (0, vitest_1.it)("handles Redis errors gracefully and returns 0 usage", async () => {
            mockRedis.get.mockRejectedValue(new Error("Redis connection refused"));
            const result = await service.getGasUsage("user-uuid-1");
            (0, vitest_1.expect)(result.todayUsage).toBe(0);
            (0, vitest_1.expect)(result.remaining).toBe(0.5);
        });
        (0, vitest_1.it)("clamps remaining to 0 when usage exceeds limit", async () => {
            mockRedis.get.mockResolvedValue("0.8");
            const result = await service.getGasUsage("user-uuid-1");
            (0, vitest_1.expect)(result.remaining).toBe(0);
        });
        (0, vitest_1.it)("reflects disabled sponsor when GAS_SPONSOR_ENABLED=false", async () => {
            mockConfig = createMockConfig({ GAS_SPONSOR_ENABLED: "false" });
            service = new settings_service_1.SettingsService(db, mockRedis, mockConfig);
            const result = await service.getGasUsage("user-uuid-1");
            (0, vitest_1.expect)(result.sponsorEnabled).toBe(false);
        });
    });
});
//# sourceMappingURL=settings.service.spec.js.map