import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HeartbeatService } from "./heartbeat.service";

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeMocks() {
  const prisma = {
    order: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as any;

  const config = {
    get: vi.fn().mockReturnValue("http://mock-polymarket:3099"),
  } as any;

  return { prisma, config };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("HeartbeatService", () => {
  let svc: HeartbeatService;
  let prisma: ReturnType<typeof makeMocks>["prisma"];
  let config: ReturnType<typeof makeMocks>["config"];

  beforeEach(() => {
    vi.useFakeTimers();
    const m = makeMocks();
    ({ prisma, config } = m);
    svc = new HeartbeatService(prisma, config);

    // Stub global fetch
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
  });

  afterEach(() => {
    svc.onModuleDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── Sends heartbeat for LIVE GTC orders ──────────────────────────────────

  it("sends heartbeat for LIVE GTC orders", async () => {
    prisma.order.findMany.mockResolvedValue([
      { clobOrderId: "clob-1", userId: "user-1" },
      { clobOrderId: "clob-2", userId: "user-2" },
    ]);

    await svc.sendHeartbeat();

    expect(fetch).toHaveBeenCalledWith(
      "http://mock-polymarket:3099/heartbeat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ orderIds: ["clob-1", "clob-2"] }),
      }),
    );
  });

  // ── Queries correct where clause ─────────────────────────────────────────

  it("queries for LIVE GTC orders only", async () => {
    await svc.sendHeartbeat();

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { status: "LIVE", orderType: "GTC" },
      select: { clobOrderId: true, userId: true },
    });
  });

  // ── Skips when no live orders ────────────────────────────────────────────

  it("skips fetch when no live orders exist", async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await svc.sendHeartbeat();

    expect(fetch).not.toHaveBeenCalled();
  });

  // ── Filters out orders without clobOrderId ──────────────────────────────

  it("filters out orders without clobOrderId", async () => {
    prisma.order.findMany.mockResolvedValue([
      { clobOrderId: "clob-1", userId: "user-1" },
      { clobOrderId: null, userId: "user-2" },
      { clobOrderId: "clob-3", userId: "user-3" },
    ]);

    await svc.sendHeartbeat();

    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(body.orderIds).toEqual(["clob-1", "clob-3"]);
  });

  // ── Skips fetch when all clobOrderIds are null ──────────────────────────

  it("skips fetch when all clobOrderIds are null", async () => {
    prisma.order.findMany.mockResolvedValue([
      { clobOrderId: null, userId: "user-1" },
    ]);

    await svc.sendHeartbeat();

    expect(fetch).not.toHaveBeenCalled();
  });

  // ── Handles fetch failure gracefully ────────────────────────────────────

  it("handles fetch failure gracefully without throwing", async () => {
    prisma.order.findMany.mockResolvedValue([
      { clobOrderId: "clob-1", userId: "user-1" },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    await expect(svc.sendHeartbeat()).resolves.toBeUndefined();
  });

  // ── Handles non-ok response without throwing ───────────────────────────

  it("handles non-ok response without throwing", async () => {
    prisma.order.findMany.mockResolvedValue([
      { clobOrderId: "clob-1", userId: "user-1" },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(svc.sendHeartbeat()).resolves.toBeUndefined();
  });

  // ── Starts interval on module init ─────────────────────────────────────

  it("starts 30s interval on onModuleInit", () => {
    svc.onModuleInit();

    prisma.order.findMany.mockResolvedValue([
      { clobOrderId: "clob-1", userId: "user-1" },
    ]);

    vi.advanceTimersByTime(30_000);

    expect(prisma.order.findMany).toHaveBeenCalled();
  });

  // ── Clears interval on module destroy ──────────────────────────────────

  it("clears interval on onModuleDestroy", () => {
    svc.onModuleInit();
    svc.onModuleDestroy();

    prisma.order.findMany.mockClear();
    vi.advanceTimersByTime(60_000);

    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });
});
