import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyRotationService } from "./key-rotation.service";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockRedis() {
  const mockClient = {
    scan: vi.fn().mockResolvedValue(["0", []]),
    del: vi.fn().mockResolvedValue(0),
  };
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    getClient: vi.fn().mockReturnValue(mockClient),
    _client: mockClient,
  } as any;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("KeyRotationService", () => {
  let service: KeyRotationService;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
    service = new KeyRotationService(redis);
  });

  // ── getStatus ─────────────────────────────────────────────────────────

  describe("getStatus", () => {
    it("returns idle status with no rotation metadata", async () => {
      redis.get.mockResolvedValue(null);

      const status = await service.getStatus();

      expect(status.status).toBe("idle");
      expect(status.lastRotatedAt).toBeNull();
      expect(status.nextScheduledAt).toBeNull();
      expect(status.sessionsInvalidated).toBe(0);
    });

    it("returns parsed rotation metadata when available", async () => {
      redis.get.mockResolvedValueOnce(
        JSON.stringify({
          lastRotatedAt: "2026-01-01T00:00:00Z",
          nextScheduledAt: null,
          sessionsInvalidated: 5,
          status: "idle",
        }),
      );

      const status = await service.getStatus();

      expect(status.lastRotatedAt).toBe("2026-01-01T00:00:00Z");
      expect(status.sessionsInvalidated).toBe(5);
      expect(status.status).toBe("idle");
    });
  });

  // ── startRotation ─────────────────────────────────────────────────────

  describe("startRotation", () => {
    it("invalidates sessions and returns result", async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.startRotation();

      expect(result.sessionsInvalidated).toBe(0);
      expect(result.rotatedAt).toBeDefined();
      expect(result.note).toContain("admin sessions have been invalidated");
    });

    it("marks rotation in progress then idle", async () => {
      redis.get.mockResolvedValue(null);

      await service.startRotation();

      const setCalls = redis.set.mock.calls.filter(
        (c: any[]) => c[0] === "jwt:rotation:meta",
      );
      expect(setCalls.length).toBe(2);

      const firstMeta = JSON.parse(setCalls[0][1]);
      expect(firstMeta.status).toBe("rotating");

      const lastMeta = JSON.parse(setCalls[1][1]);
      expect(lastMeta.status).toBe("idle");
    });

    it("flushes admin session keys from Redis", async () => {
      // Simulate SCAN returning 3 session keys then finishing
      redis._client.scan
        .mockResolvedValueOnce([
          "0",
          ["admin:session:a", "admin:session:b", "admin:session:c"],
        ]);
      redis._client.del.mockResolvedValue(3);

      const result = await service.startRotation();

      expect(redis._client.del).toHaveBeenCalledWith(
        "admin:session:a",
        "admin:session:b",
        "admin:session:c",
      );
      expect(result.sessionsInvalidated).toBe(3);
    });
  });
});
