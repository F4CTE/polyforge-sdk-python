import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { StrategiesService } from "./strategies.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStrategy(overrides: Record<string, unknown> = {}) {
  return {
    id: "strat-1",
    userId: "user-1",
    name: "My Strategy",
    status: "IDLE",
    visibility: "PUBLIC",
    execMode: "PAPER",
    template: false,
    likeCount: 0,
    forkCount: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-06-01"),
    user: { username: "alice", email: "alice@example.com" },
    ...overrides,
  };
}

function makePrisma() {
  return {
    strategy: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

function makeJwtService() {
  return {
    sign: vi.fn().mockReturnValue("internal-jwt-token"),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("StrategiesService", () => {
  let service: StrategiesService;
  let prisma: ReturnType<typeof makePrisma>;
  let jwtService: ReturnType<typeof makeJwtService>;

  beforeEach(() => {
    prisma = makePrisma();
    jwtService = makeJwtService();
    const config = { getOrThrow: vi.fn((key: string) => `test-${key}`) } as any;
    service = new StrategiesService(prisma as any, jwtService as any, config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns paginated strategy list with correct shape", async () => {
      const strategies = [makeStrategy(), makeStrategy({ id: "strat-2" })];
      prisma.strategy.findMany.mockResolvedValue(strategies as any);
      prisma.strategy.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.pages).toBe(1);
    });

    it("filters by userId when provided", async () => {
      prisma.strategy.findMany.mockResolvedValue([] as any);
      prisma.strategy.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, userId: "user-1" });

      const call = prisma.strategy.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe("user-1");
    });

    it("filters by status when provided", async () => {
      prisma.strategy.findMany.mockResolvedValue([] as any);
      prisma.strategy.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, status: "RUNNING" });

      const call = prisma.strategy.findMany.mock.calls[0][0];
      expect(call.where.status).toBe("RUNNING");
    });

    it("filters by visibility when provided", async () => {
      prisma.strategy.findMany.mockResolvedValue([] as any);
      prisma.strategy.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, visibility: "PUBLIC" });

      const call = prisma.strategy.findMany.mock.calls[0][0];
      expect(call.where.visibility).toBe("PUBLIC");
    });

    it("does not apply filters when optional params are omitted", async () => {
      prisma.strategy.findMany.mockResolvedValue([] as any);
      prisma.strategy.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.strategy.findMany.mock.calls[0][0];
      expect(call.where.userId).toBeUndefined();
      expect(call.where.status).toBeUndefined();
      expect(call.where.visibility).toBeUndefined();
    });

    it("applies correct skip for page 3 with limit 10", async () => {
      prisma.strategy.findMany.mockResolvedValue([] as any);
      prisma.strategy.count.mockResolvedValue(0);

      await service.findAll({ page: 3, limit: 10 });

      const call = prisma.strategy.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(10);
    });

    it("includes user.username and user.email in select", async () => {
      prisma.strategy.findMany.mockResolvedValue([] as any);
      prisma.strategy.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      const call = prisma.strategy.findMany.mock.calls[0][0];
      expect(call.select.user).toBeDefined();
    });
  });

  // ── forceStop ─────────────────────────────────────────────────────────────

  describe("forceStop", () => {
    it("calls strategy-engine API when strategy is RUNNING", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const strategy = makeStrategy({ status: "RUNNING" });
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        status: "IDLE",
      } as any);

      await service.forceStop("strat-1");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/internal/strategies/strat-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("calls strategy-engine API when strategy is PAUSED", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const strategy = makeStrategy({ status: "PAUSED" });
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        status: "IDLE",
      } as any);

      await service.forceStop("strat-1");

      expect(fetchMock).toHaveBeenCalled();
    });

    it("skips the engine call when strategy is IDLE", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const strategy = makeStrategy({ status: "IDLE" });
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        status: "IDLE",
      } as any);

      await service.forceStop("strat-1");

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("updates DB status to IDLE regardless of engine call result", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const strategy = makeStrategy({ status: "RUNNING" });
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        status: "IDLE",
      } as any);

      await service.forceStop("strat-1");

      expect(prisma.strategy.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "IDLE" } }),
      );
    });

    it("still updates DB to IDLE when engine call throws", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("engine down")),
      );

      const strategy = makeStrategy({ status: "RUNNING" });
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        status: "IDLE",
      } as any);

      await expect(service.forceStop("strat-1")).resolves.toMatchObject({
        status: "IDLE",
        stoppedBy: "admin",
      });
      expect(prisma.strategy.update).toHaveBeenCalled();
    });

    it('returns { status: "IDLE", stoppedBy: "admin" }', async () => {
      const strategy = makeStrategy({ status: "IDLE" });
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        status: "IDLE",
      } as any);

      const result = await service.forceStop("strat-1");

      expect(result).toEqual({ status: "IDLE", stoppedBy: "admin" });
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      prisma.strategy.findUnique.mockResolvedValue(null);

      await expect(service.forceStop("ghost")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("includes code NOT_FOUND in exception when strategy is missing", async () => {
      prisma.strategy.findUnique.mockResolvedValue(null);

      await expect(service.forceStop("ghost")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });

    it("issues an internal JWT in the Authorization header", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const strategy = makeStrategy({ status: "RUNNING" });
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        status: "IDLE",
      } as any);

      await service.forceStop("strat-1");

      const fetchCall = fetchMock.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.Authorization).toBe("Bearer internal-jwt-token");
    });
  });

  // ── unpublish ─────────────────────────────────────────────────────────────

  describe("unpublish", () => {
    it("sets visibility to PRIVATE", async () => {
      const strategy = makeStrategy({ visibility: "PUBLIC" });
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        visibility: "PRIVATE",
      } as any);

      const result = await service.unpublish("strat-1");

      expect(result.visibility).toBe("PRIVATE");
    });

    it("returns the id and new visibility", async () => {
      const strategy = makeStrategy();
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        visibility: "PRIVATE",
      } as any);

      const result = await service.unpublish("strat-1");

      expect(result).toEqual({ id: "strat-1", visibility: "PRIVATE" });
    });

    it("updates with visibility: PRIVATE in the update call", async () => {
      const strategy = makeStrategy();
      prisma.strategy.findUnique.mockResolvedValue(strategy as any);
      prisma.strategy.update.mockResolvedValue({
        ...strategy,
        visibility: "PRIVATE",
      } as any);

      await service.unpublish("strat-1");

      expect(prisma.strategy.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { visibility: "PRIVATE" } }),
      );
    });

    it("throws NotFoundException when strategy does not exist", async () => {
      prisma.strategy.findUnique.mockResolvedValue(null);

      await expect(service.unpublish("ghost")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("includes code NOT_FOUND in exception", async () => {
      prisma.strategy.findUnique.mockResolvedValue(null);

      await expect(service.unpublish("ghost")).rejects.toMatchObject({
        response: { code: "NOT_FOUND" },
      });
    });
  });
});
