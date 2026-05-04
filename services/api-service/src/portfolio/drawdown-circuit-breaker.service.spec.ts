import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DrawdownCircuitBreakerService } from "./drawdown-circuit-breaker.service";

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeMocks() {
  const prisma = {
    userLimit: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    strategy: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  } as any;

  const redis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    xadd: vi.fn().mockResolvedValue("ok"),
    getClient: vi.fn().mockReturnValue({
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    }),
  } as any;

  return { prisma, redis };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("DrawdownCircuitBreakerService", () => {
  let svc: DrawdownCircuitBreakerService;
  let prisma: ReturnType<typeof makeMocks>["prisma"];
  let redis: ReturnType<typeof makeMocks>["redis"];

  beforeEach(() => {
    const m = makeMocks();
    ({ prisma, redis } = m);
    svc = new DrawdownCircuitBreakerService(prisma, redis);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── check() ──────────────────────────────────────────────────────────────

  describe("check", () => {
    it("returns early when no limits have drawdown enabled", async () => {
      prisma.userLimit.findMany.mockResolvedValue([]);

      await svc.check();

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("calls checkUser for each user with drawdown enabled", async () => {
      prisma.userLimit.findMany.mockResolvedValue([
        {
          userId: "user-1",
          drawdownLookbackHours: 24,
          drawdownThresholdPct: "0.10",
        },
      ]);
      // No snapshots -> returns early in checkUser
      prisma.$queryRaw.mockResolvedValue([]);

      await svc.check();

      // $queryRaw should have been called (at least for the queries in checkUser)
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("continues checking other users when one fails", async () => {
      prisma.userLimit.findMany.mockResolvedValue([
        {
          userId: "user-1",
          drawdownLookbackHours: 24,
          drawdownThresholdPct: "0.10",
        },
        {
          userId: "user-2",
          drawdownLookbackHours: 24,
          drawdownThresholdPct: "0.10",
        },
      ]);

      let callCount = 0;
      prisma.$queryRaw.mockImplementation(async () => {
        callCount++;
        // Fail on first user's first query
        if (callCount === 1) throw new Error("DB error");
        return [];
      });

      // Should not throw
      await expect(svc.check()).resolves.toBeUndefined();
    });
  });

  // ── checkUser (private, tested via check) ─────────────────────────────

  describe("checkUser (private)", () => {
    it("returns early when no latest portfolio snapshot exists", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // _result (orders query)
        .mockResolvedValueOnce([]) // snapshots (lookback start)
        .mockResolvedValueOnce([]); // latestPortfolio

      await (svc as any).checkUser({
        userId: "user-1",
        drawdownLookbackHours: 24,
        drawdownThresholdPct: "0.10",
      });

      expect(prisma.strategy.updateMany).not.toHaveBeenCalled();
    });

    it("returns early when baseline PnL is 0", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // _result
        .mockResolvedValueOnce([{ pnl: "0" }]) // snapshots (baseline)
        .mockResolvedValueOnce([{ pnl: "100" }]); // latestPortfolio

      await (svc as any).checkUser({
        userId: "user-1",
        drawdownLookbackHours: 24,
        drawdownThresholdPct: "0.10",
      });

      expect(prisma.strategy.updateMany).not.toHaveBeenCalled();
    });

    it("does not trip when drawdown is below threshold", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // _result
        .mockResolvedValueOnce([{ pnl: "1000" }]) // snapshots (baseline)
        .mockResolvedValueOnce([{ pnl: "950" }]); // latestPortfolio (5% drawdown)

      await (svc as any).checkUser({
        userId: "user-1",
        drawdownLookbackHours: 24,
        drawdownThresholdPct: "0.10", // 10% threshold
      });

      expect(prisma.strategy.updateMany).not.toHaveBeenCalled();
    });

    it("trips breaker when drawdown exceeds threshold", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // _result
        .mockResolvedValueOnce([{ pnl: "1000" }]) // snapshots (baseline)
        .mockResolvedValueOnce([{ pnl: "800" }]); // latestPortfolio (20% drawdown)

      redis.get.mockResolvedValue(null); // Not already fired

      await (svc as any).checkUser({
        userId: "user-1",
        drawdownLookbackHours: 24,
        drawdownThresholdPct: "0.10", // 10% threshold
      });

      // Should pause strategies
      expect(prisma.strategy.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          status: { in: ["RUNNING", "PAPER"] },
        },
        data: { status: "PAUSED" },
      });

      // Should mark circuit breaker as tripped
      expect(prisma.userLimit.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: expect.objectContaining({
          circuitBreakerTripped: true,
        }),
      });

      // Should emit event
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({
          type: "CIRCUIT_BREAKER_TRIGGERED",
          userId: "user-1",
        }),
      );

      // Should set dedup key
      expect(redis.set).toHaveBeenCalledWith("cb:tripped:user-1", "1", 120);
    });

    it("skips if dedup key already set (already fired recently)", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // _result
        .mockResolvedValueOnce([{ pnl: "1000" }]) // snapshots (baseline)
        .mockResolvedValueOnce([{ pnl: "800" }]); // latestPortfolio (20% drawdown)

      redis.get.mockResolvedValue("1"); // Already fired

      await (svc as any).checkUser({
        userId: "user-1",
        drawdownLookbackHours: 24,
        drawdownThresholdPct: "0.10",
      });

      // Should NOT pause strategies (dedup)
      expect(prisma.strategy.updateMany).not.toHaveBeenCalled();
    });

    it("handles xadd failure gracefully (does not throw)", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // _result
        .mockResolvedValueOnce([{ pnl: "1000" }]) // snapshots (baseline)
        .mockResolvedValueOnce([{ pnl: "800" }]); // latestPortfolio

      redis.get.mockResolvedValue(null);
      redis.xadd.mockRejectedValue(new Error("Redis down"));

      // Should not throw
      await expect(
        (svc as any).checkUser({
          userId: "user-1",
          drawdownLookbackHours: 24,
          drawdownThresholdPct: "0.10",
        }),
      ).resolves.toBeUndefined();
    });

    it("uses no baseline snapshot when none exists (defaults to 0)", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // _result
        .mockResolvedValueOnce([]) // snapshots (no baseline)
        .mockResolvedValueOnce([{ pnl: "800" }]); // latestPortfolio

      await (svc as any).checkUser({
        userId: "user-1",
        drawdownLookbackHours: 24,
        drawdownThresholdPct: "0.10",
      });

      // baselinePnl = 0, should skip (no meaningful baseline)
      expect(prisma.strategy.updateMany).not.toHaveBeenCalled();
    });

    it("handles null pnl values in snapshots", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // _result
        .mockResolvedValueOnce([{ pnl: null }]) // snapshots (baseline is null -> 0)
        .mockResolvedValueOnce([{ pnl: "800" }]); // latestPortfolio

      await (svc as any).checkUser({
        userId: "user-1",
        drawdownLookbackHours: 24,
        drawdownThresholdPct: "0.10",
      });

      // baselinePnl = 0 -> skip
      expect(prisma.strategy.updateMany).not.toHaveBeenCalled();
    });

    it("trips breaker when latest PnL is NaN instead of bypassing threshold", async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // _result
        .mockResolvedValueOnce([{ pnl: "1000" }])
        .mockResolvedValueOnce([{ pnl: "NaN" }]);

      redis.get.mockResolvedValue(null);

      await (svc as any).checkUser({
        userId: "user-1",
        drawdownLookbackHours: 24,
        drawdownThresholdPct: "0.10",
      });

      expect(prisma.strategy.updateMany).toHaveBeenCalled();
      expect(prisma.userLimit.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: expect.objectContaining({ circuitBreakerTripped: true }),
      });
      expect(redis.xadd).toHaveBeenCalledWith(
        "stream:events",
        expect.objectContaining({ drawdownPct: "invalid" }),
      );
    });
  });
});
