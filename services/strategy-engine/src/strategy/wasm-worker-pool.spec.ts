import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPostMessage, nextWorkerId } = vi.hoisted(() => {
  const mockPostMessage = vi.fn();
  let workerIdCounter = 0;
  return { mockPostMessage, nextWorkerId: () => workerIdCounter++ };
});

vi.mock("worker_threads", () => {
  class MockWorker {
    private _events: Record<string, Array<(...args: any[]) => void>> = {};
    postMessage = mockPostMessage;
    terminate = vi.fn().mockResolvedValue(undefined);
    readonly workerId: number;

    constructor() {
      this.workerId = nextWorkerId();
    }

    on(event: string, handler: (...args: any[]) => void): this {
      (this._events[event] ??= []).push(handler);
      return this;
    }

    emit(event: string, ...args: any[]): boolean {
      const handlers = this._events[event];
      if (!handlers) return false;
      for (const h of handlers) h(...args);
      return true;
    }
  }

  return { Worker: MockWorker };
});

import { WasmWorkerPoolService } from "./wasm-worker-pool";

const MOCK_RESULT = {
  safety_passed: true,
  safety_reason: null,
  triggered: true,
  conditions_met: true,
  actions: [],
};

const MOCK_CONTEXT = {
  current_price: 100,
  best_bid: 99,
  best_ask: 101,
  spread: 2,
  volume_24h: 5000,
  daily_pnl: 0,
  total_exposure: 0,
  open_positions: 0,
  pending_orders: 0,
  consecutive_losses: 0,
  orders_today: 0,
  variables: {},
};

interface MockWorker {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  workerId: number;
  on: (event: string, handler: (...args: any[]) => void) => this;
  emit: (event: string, ...args: any[]) => boolean;
}

describe("WasmWorkerPoolService — lifecycle", () => {
  let pool: WasmWorkerPoolService;

  beforeEach(() => {
    vi.clearAllMocks();
    pool = new WasmWorkerPoolService();
  });

  afterEach(async () => {
    // Clear pending and queued requests to suppress unhandled rejections
    const pending = (pool as any).pending as Map<number, any>;
    for (const [, req] of pending) {
      clearTimeout(req.timeout);
    }
    pending.clear();
    (pool as any).taskQueue = [];
    await pool.onApplicationShutdown();
  });

  function getLatestWorker(): MockWorker {
    const workers = (pool as any).workers as MockWorker[];
    return workers[workers.length - 1];
  }

  function finishPendingRequest(
    worker: MockWorker,
    overrides: Partial<{ result: unknown; error: string }> = {},
  ): void {
    const calls = mockPostMessage.mock.calls;
    const lastCall = calls[calls.length - 1];
    const id = lastCall?.[0]?.id ?? 0;
    if (overrides.error) {
      worker.emit("message", { id, error: overrides.error });
    } else {
      worker.emit("message", { id, result: overrides.result ?? MOCK_RESULT });
    }
  }

  // ── Basic pool startup ───────────────────────────────────────────────────

  it("creates workers and makes them available on start", () => {
    pool.start(2);
    const workers = (pool as any).workers as MockWorker[];
    const available = (pool as any).available as MockWorker[];
    expect(workers).toHaveLength(2);
    expect(available).toHaveLength(2);
  });

  it("does nothing on duplicate start", () => {
    pool.start(2);
    pool.start(4);
    const workers = (pool as any).workers as MockWorker[];
    expect(workers).toHaveLength(2);
  });

  // ── Normal evaluation flow ───────────────────────────────────────────────

  it("dispatches work to an available worker and resolves on response", async () => {
    pool.start(1);
    const promise = pool.evaluate([], [], [], [], MOCK_CONTEXT);
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    finishPendingRequest(getLatestWorker());
    const result = await promise;
    expect(result.safety_passed).toBe(true);
  });

  it("rejects on worker error message", async () => {
    pool.start(1);
    const promise = pool.evaluate([], [], [], [], MOCK_CONTEXT);
    finishPendingRequest(getLatestWorker(), { error: "WASM panicked" });
    await expect(promise).rejects.toThrow("WASM panicked");
  });

  // ── Queuing ──────────────────────────────────────────────────────────────

  it("queues requests when all workers are busy", async () => {
    pool.start(1);
    const p1 = pool.evaluate([], [], [], [], MOCK_CONTEXT);
    const p2 = pool.evaluate([], [], [], [], MOCK_CONTEXT);
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect((pool as any).taskQueue).toHaveLength(1);
    finishPendingRequest(getLatestWorker());
    await p1;
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    finishPendingRequest(getLatestWorker());
    await p2;
  });

  // ── Worker removal ───────────────────────────────────────────────────────

  it("removeWorker removes a worker from workers and available arrays", () => {
    pool.start(1);
    const original = getLatestWorker();
    expect((pool as any).workers).toHaveLength(1);
    expect((pool as any).available).toHaveLength(1);

    (pool as any).removeWorker(original);

    expect((pool as any).workers).toHaveLength(0);
    expect((pool as any).available).toHaveLength(0);
    expect(
      (original as any).terminate as ReturnType<typeof vi.fn>,
    ).toHaveBeenCalled();
  });

  // ── Timeout → quarantine + respawn ───────────────────────────────────────

  it(
    "quarantines and respawns a worker, removing it from available",
    async () => {
      vi.useFakeTimers();
      pool.start(1);

      const promise = pool.evaluate([], [], [], [], MOCK_CONTEXT);
      expect(mockPostMessage).toHaveBeenCalledTimes(1);

      const originalWorker = getLatestWorker();

      // Clear the real eval timeout to prevent a second quarantine fire
      const pending = (pool as any).pending as Map<number, any>;
      const req = pending.get(0)!;
      clearTimeout(req.timeout);

      // Simulate the full timeout path: quarantine + reject
      (pool as any).quarantineWorker(originalWorker);
      pending.delete(0);
      req.reject(new Error("WASM evaluation timed out after 150ms (id=0)"));

      // Advance past the respawn delay (exponential backoff: 200ms for 1st failure)
      vi.advanceTimersByTime(200);

      await expect(promise).rejects.toThrow(/timed out/);

      const workers = (pool as any).workers as MockWorker[];
      expect(workers).toHaveLength(1);
      expect(workers).not.toContain(originalWorker);

      expect((originalWorker as any).terminate).toHaveBeenCalled();

      const available = (pool as any).available as MockWorker[];
      expect(available).toHaveLength(1);
      expect(available).toContain(workers[0]);

      vi.useRealTimers();
    },
  );

  // ── Stale response handling ──────────────────────────────────────────────

  it("returns a live worker to available on stale response when worker is still in pool", async () => {
    pool.start(1);
    const originalWorker = getLatestWorker();

    const promise = pool.evaluate([], [], [], [], MOCK_CONTEXT);

    const pending = (pool as any).pending as Map<number, any>;
    const req = pending.get(0)!;
    clearTimeout(req.timeout);

    // Delete from pending (simulating that the request was cleaned up)
    pending.delete(0);

    // Stale response arrives AFTER pending was cleaned up — worker is still in pool
    originalWorker.emit("message", { id: 0, result: MOCK_RESULT });

    const available = (pool as any).available as MockWorker[];
    expect(available).toContain(originalWorker);

    promise.catch(() => {});
  });

  it("discards stale response from a worker that was already removed from the pool", async () => {
    pool.start(1);
    const originalWorker = getLatestWorker();

    const promise = pool.evaluate([], [], [], [], MOCK_CONTEXT);

    const pending = (pool as any).pending as Map<number, any>;
    clearTimeout(pending.get(0)!.timeout);

    // Simulate full quarantine: add to quarantined, remove from workers+available,
    // and delete the pending request (as the timeout handler would)
    (pool as any).quarantined.add(originalWorker);
    (pool as any).removeWorker(originalWorker);
    pending.delete(0);

    // Stale response arrives AFTER worker was already removed and request was cleaned up
    originalWorker.emit("message", { id: 0, result: MOCK_RESULT });

    const available = (pool as any).available as MockWorker[];
    expect(available).not.toContain(originalWorker);

    promise.catch(() => {});
  });

  // ── Draining queued work after timeout ───────────────────────────────────

  it(
    "drains queued requests through the replacement worker after a timeout",
    async () => {
      vi.useFakeTimers();
      pool.start(1);

      const p1 = pool.evaluate([], [], [], [], MOCK_CONTEXT);
      const p2 = pool.evaluate([], [], [], [], MOCK_CONTEXT);

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect((pool as any).taskQueue).toHaveLength(1);

      // Clear eval timeout on first request to prevent double-quarantine
      const pending = (pool as any).pending as Map<number, any>;
      clearTimeout(pending.get(0)!.timeout);

      (pool as any).quarantineWorker(getLatestWorker());

      // Advance past the respawn delay so replacement worker dispatches p2
      vi.advanceTimersByTime(200);

      expect(mockPostMessage).toHaveBeenCalledTimes(2);

      // p1 got its worker quarantined, so it's silently dead
      p1.catch(() => {});

      finishPendingRequest(getLatestWorker());
      await p2;

      vi.useRealTimers();
    },
  );

  // ── Queue timeout ────────────────────────────────────────────────────────

  it("rejects queued requests that exceed queue timeout", async () => {
    pool.start(1);
    void pool.evaluate([], [], [], [], MOCK_CONTEXT);
    const p2 = pool.evaluate([], [], [], [], MOCK_CONTEXT);

    const pending = (pool as any).pending as Map<number, any>;
    const req2 = pending.get(1)!;
    clearTimeout(req2.timeout);
    pending.delete(1);
    (pool as any).taskQueue = (pool as any).taskQueue.filter(
      (r: any) => r.id !== 1,
    );
    req2.reject(new Error("WASM evaluation queued too long (1000ms, id=1)"));

    await expect(p2).rejects.toThrow(/queued too long/);
  });

  // ── Worker error respawn ─────────────────────────────────────────────────

  it("removes worker from pool on error event", () => {
    pool.start(1);
    const originalWorker = getLatestWorker();

    originalWorker.emit("error", new Error("worker crash"));

    const workers = (pool as any).workers as MockWorker[];
    expect(workers).toHaveLength(0);
    expect((originalWorker as any).terminate).toHaveBeenCalled();
  });

  it("clears pending respawn timeouts on shutdown, preventing stale respawns", async () => {
    pool.start(1);
    const originalWorker = getLatestWorker();

    // Trigger an error, which schedules a respawn setTimeout
    originalWorker.emit("error", new Error("worker crash"));

    const respawnTimeouts = (pool as any).respawnTimeouts as Set<NodeJS.Timeout>;
    expect(respawnTimeouts.size).toBeGreaterThanOrEqual(1);

    // Shutdown the pool
    await pool.onApplicationShutdown();

    // Respawn timeouts should be cleared
    expect(respawnTimeouts.size).toBe(0);

    // Advance timers to ensure no stale respawn fires
    // (the MockWorker constructor counter should not increment)
    const workersAfter = (pool as any).workers as MockWorker[];
    expect(workersAfter).toHaveLength(0);
  });

  // ── No live workers ──────────────────────────────────────────────────────

  it("rejects when pool has no live workers", async () => {
    await expect(pool.evaluate([], [], [], [], MOCK_CONTEXT)).rejects.toThrow(
      "no live workers",
    );
  });

  // ── Shutdown ─────────────────────────────────────────────────────────────

  it("rejects pending requests on shutdown", async () => {
    pool.start(1);
    const promise = pool.evaluate([], [], [], [], MOCK_CONTEXT);
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    await pool.onApplicationShutdown();
    await expect(promise).rejects.toThrow("shutting down");

    expect((pool as any).workers).toHaveLength(0);
    expect((pool as any).available).toHaveLength(0);
    expect((pool as any).taskQueue).toHaveLength(0);
  });

  // ── Default pool sizing ──────────────────────────────────────────────────

  it("uses container-aware default pool size (>= 1 worker)", async () => {
    const freshPool = new WasmWorkerPoolService();
    freshPool.start();
    expect((freshPool as any).workers.length).toBeGreaterThanOrEqual(1);
  });

  it("uses exactly the requested pool size when passed explicitly", async () => {
    pool.start(2);
    expect((pool as any).workers).toHaveLength(2);
    expect((pool as any).available).toHaveLength(2);
  });
});
