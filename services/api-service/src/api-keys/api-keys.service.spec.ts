import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ApiKeysService } from "./api-keys.service";
import { createMockDb, MockDb } from "../../test/helpers/mock-db";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeApiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-uuid-1",
    userId: "user-1",
    name: "My Key",
    prefix: "pf_abc123",
    tokenHash: "somehash",
    scopes: ["READ"],
    revoked: false,
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
    createdAt: new Date("2025-06-01"),
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("ApiKeysService", () => {
  let service: ApiKeysService;
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    service = new ApiKeysService(db as any);
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("returns non-revoked keys for the given user", async () => {
      const keys = [makeApiKey(), makeApiKey({ id: "key-uuid-2", name: "Second" })];
      db.apiKey.findMany.mockResolvedValue(keys as any);

      const result = await service.list("user-1");

      expect(result).toEqual(keys);
      expect(db.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", revoked: false },
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("returns an empty array when user has no keys", async () => {
      db.apiKey.findMany.mockResolvedValue([]);

      const result = await service.list("user-1");

      expect(result).toEqual([]);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("generates a token starting with 'pf_' prefix", async () => {
      db.apiKey.create.mockResolvedValue(makeApiKey() as any);

      const result = await service.create("user-1", { name: "Test Key" });

      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^pf_/);
    });

    it("stores the prefix as first 10 chars of the raw token", async () => {
      let capturedData: any;
      (db.apiKey.create as any).mockImplementation(async (args: any) => {
        capturedData = args.data;
        return makeApiKey({ prefix: capturedData.prefix }) as any;
      });

      const result = await service.create("user-1", { name: "Test Key" });

      expect(capturedData.prefix).toBe(result.token.slice(0, 10));
    });

    it("truncates name at 100 characters", async () => {
      const longName = "A".repeat(200);
      (db.apiKey.create as any).mockImplementation(async (args: any) => {
        return makeApiKey({ name: args.data.name }) as any;
      });

      await service.create("user-1", { name: longName });

      expect(db.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "A".repeat(100),
          }),
        }),
      );
    });

    it("defaults scopes to ['READ'] when not provided", async () => {
      db.apiKey.create.mockResolvedValue(makeApiKey() as any);

      await service.create("user-1", { name: "Test Key" });

      expect(db.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scopes: ["READ"],
          }),
        }),
      );
    });

    it("uses provided scopes when given", async () => {
      db.apiKey.create.mockResolvedValue(
        makeApiKey({ scopes: ["READ", "WRITE"] }) as any,
      );

      await service.create("user-1", {
        name: "Test Key",
        scopes: ["READ", "WRITE"],
      });

      expect(db.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scopes: ["READ", "WRITE"],
          }),
        }),
      );
    });
  });

  // ── revoke ────────────────────────────────────────────────────────────────

  describe("revoke", () => {
    it("throws NotFoundException when key is not found", async () => {
      db.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revoke("user-1", "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws NotFoundException when key belongs to another user", async () => {
      db.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revoke("user-2", "key-uuid-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("marks the key as revoked and returns success message", async () => {
      db.apiKey.findFirst.mockResolvedValue(makeApiKey() as any);
      db.apiKey.update.mockResolvedValue(
        makeApiKey({ revoked: true, revokedAt: new Date() }) as any,
      );

      const result = await service.revoke("user-1", "key-uuid-1");

      expect(result).toEqual({ message: "API key revoked" });
      expect(db.apiKey.update).toHaveBeenCalledWith({
        where: { id: "key-uuid-1" },
        data: expect.objectContaining({ revoked: true }),
      });
    });
  });
});
