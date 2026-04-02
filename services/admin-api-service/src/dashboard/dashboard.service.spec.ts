import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DashboardService } from "./dashboard.service";

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockRedis() {
  return {
    getClient: vi.fn().mockReturnValue({
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn().mockResolvedValue(null),
      info: vi.fn().mockResolvedValue("used_memory:10485760"),
      scanStream: vi.fn().mockReturnValue({
        on: vi.fn().mockImplementation(function (
          this: any,
          event: string,
          cb: (...args: unknown[]) => unknown,
        ) {
          if (event === "end") setTimeout(() => cb(), 0);
          return this;
        }),
      }),
      ttl: vi.fn().mockResolvedValue(60),
    }),
  } as any;
}

function createMockPrisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ count: BigInt(5) }]),
  } as any;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("DashboardService", () => {
  let service: DashboardService;
  let redis: ReturnType<typeof createMockRedis>;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    redis = createMockRedis();
    prisma = createMockPrisma();
    service = new DashboardService(redis, prisma);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── checkService ──────────────────────────────────────────────────────

  describe("pollHealthChecks", () => {
    it("stores health status for each service in Redis", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      await service.pollHealthChecks();

      const client = redis.getClient();
      expect(client.set).toHaveBeenCalled();
      // Should have called fetch for each service
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    });

    it("marks service as down when fetch fails", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      vi.stubGlobal("fetch", fetchMock);

      await service.pollHealthChecks();

      const client = redis.getClient();
      const setCalls = client.set.mock.calls;
      // At least one call should have "down" status
      const hasDown = setCalls.some(
        (call: any[]) => JSON.parse(call[1]).status === "down",
      );
      expect(hasDown).toBe(true);
    });
  });

  // ── getHealth ─────────────────────────────────────────────────────────

  describe("getHealth", () => {
    it("returns aggregated health status", async () => {
      const client = redis.getClient();
      client.get.mockResolvedValue(
        JSON.stringify({ status: "healthy", latencyMs: 5 }),
      );

      const health = await service.getHealth();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("services");
      expect(health).toHaveProperty("db");
      expect(health).toHaveProperty("redis");
    });

    it('returns "unknown" for services with no cached health data', async () => {
      const client = redis.getClient();
      client.get.mockResolvedValue(null);

      const health = await service.getHealth();

      const serviceValues = Object.values(health.services);
      expect(serviceValues.every((s: any) => s.status === "unknown")).toBe(
        true,
      );
    });

    it('reports db status as "down" when query fails', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error("Connection refused"));
      const client = redis.getClient();
      client.get.mockResolvedValue(null);

      const health = await service.getHealth();

      expect(health.db.status).toBe("down");
    });
  });
});
