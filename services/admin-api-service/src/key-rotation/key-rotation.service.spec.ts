import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyRotationService } from "./key-rotation.service";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
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
    });

    it("counts active secrets", async () => {
      // First call: meta key (null), second: current secret, third: previous secret
      redis.get
        .mockResolvedValueOnce(null) // meta
        .mockResolvedValueOnce("current-secret") // current exists
        .mockResolvedValueOnce("previous-secret"); // previous exists

      const status = await service.getStatus();

      expect(status.activeSecretsCount).toBe(2);
    });

    it("returns parsed rotation metadata when available", async () => {
      redis.get
        .mockResolvedValueOnce(
          JSON.stringify({
            lastRotatedAt: "2026-01-01T00:00:00Z",
            nextScheduledAt: null,
            status: "idle",
          }),
        )
        .mockResolvedValueOnce("secret") // current
        .mockResolvedValueOnce(null); // no previous

      const status = await service.getStatus();

      expect(status.lastRotatedAt).toBe("2026-01-01T00:00:00Z");
      expect(status.activeSecretsCount).toBe(1);
    });
  });

  // ── startRotation ─────────────────────────────────────────────────────

  describe("startRotation", () => {
    it("generates a new secret and returns its hash", async () => {
      redis.get.mockResolvedValue(null); // no current secret

      const result = await service.startRotation();

      expect(result.secretHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
      expect(result.gracePeriodSeconds).toBe(3600);
    });

    it("moves current secret to previous slot", async () => {
      redis.get.mockResolvedValueOnce("old-secret"); // current secret exists

      await service.startRotation();

      // Should call set for: meta (rotating), previous, current, meta (idle)
      const setCalls = redis.set.mock.calls;
      const previousSecretCall = setCalls.find(
        (c: any[]) => c[0] === "jwt:secret:previous",
      );
      expect(previousSecretCall).toBeDefined();
      expect(previousSecretCall![1]).toBe("old-secret");
      expect(previousSecretCall![2]).toBe(3600); // grace period TTL
    });

    it("stores new secret as current without TTL", async () => {
      redis.get.mockResolvedValue(null);

      await service.startRotation();

      const currentCall = redis.set.mock.calls.find(
        (c: any[]) => c[0] === "jwt:secret:current",
      );
      expect(currentCall).toBeDefined();
      // Current secret should be stored without TTL (only 2 args: key, value)
      expect(currentCall!.length).toBe(2);
    });

    it("updates metadata to idle after rotation", async () => {
      redis.get.mockResolvedValue(null);

      await service.startRotation();

      const metaCalls = redis.set.mock.calls.filter(
        (c: any[]) => c[0] === "jwt:rotation:meta",
      );
      const lastMeta = JSON.parse(metaCalls[metaCalls.length - 1][1]);
      expect(lastMeta.status).toBe("idle");
    });
  });
});
