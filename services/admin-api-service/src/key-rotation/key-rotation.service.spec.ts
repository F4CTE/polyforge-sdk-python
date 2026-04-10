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

    it("defaults missing metadata fields", async () => {
      redis.get.mockResolvedValueOnce(
        JSON.stringify({ lastRotatedAt: "2026-01-01T00:00:00Z" }),
      );

      const status = await service.getStatus();

      expect(status.nextScheduledAt).toBeNull();
      expect(status.sessionsInvalidated).toBe(0);
      expect(status.status).toBe("idle");
    });
  });

  // ── startRotation ─────────────────────────────────────────────────────

  describe("startRotation", () => {
    it("returns session invalidation result", async () => {
      const result = await service.startRotation();

      expect(result).toHaveProperty("sessionsInvalidated");
      expect(result).toHaveProperty("rotatedAt");
      expect(result).toHaveProperty("note");
      expect(typeof result.sessionsInvalidated).toBe("number");
    });

    it("invalidates admin sessions via SCAN", async () => {
      redis._client.scan
        .mockResolvedValueOnce(["42", ["admin:session:a", "admin:session:b"]])
        .mockResolvedValueOnce(["0", ["admin:session:c"]]);

      const result = await service.startRotation();

      expect(result.sessionsInvalidated).toBe(3);
      expect(redis._client.del).toHaveBeenCalledWith(
        "admin:session:a",
        "admin:session:b",
      );
      expect(redis._client.del).toHaveBeenCalledWith("admin:session:c");
    });

    it("sets rotating status then idle in metadata", async () => {
      await service.startRotation();

      const metaCalls = redis.set.mock.calls.filter(
        (c: any[]) => c[0] === "jwt:rotation:meta",
      );
      expect(metaCalls.length).toBe(2);

      const firstMeta = JSON.parse(metaCalls[0][1]);
      expect(firstMeta.status).toBe("rotating");

      const lastMeta = JSON.parse(metaCalls[1][1]);
      expect(lastMeta.status).toBe("idle");
      expect(lastMeta.sessionsInvalidated).toBe(0);
    });

    it("returns zero invalidated when no sessions exist", async () => {
      redis._client.scan.mockResolvedValue(["0", []]);

      const result = await service.startRotation();

      expect(result.sessionsInvalidated).toBe(0);
      expect(redis._client.del).not.toHaveBeenCalled();
    });
  });
});
