import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StreamConsumerService } from "./stream-consumer.service";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeRedisMock() {
  const client = {
    xgroup: vi.fn().mockResolvedValue("OK"),
    xreadgroup: vi.fn().mockResolvedValue(null),
    xack: vi.fn().mockResolvedValue(1),
  };
  return {
    getClient: vi.fn().mockReturnValue(client),
    _client: client,
  };
}

function makeBacktestMock() {
  return {
    run: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StreamConsumerService", () => {
  let redis: ReturnType<typeof makeRedisMock>;
  let backtest: ReturnType<typeof makeBacktestMock>;
  let svc: StreamConsumerService;

  beforeEach(() => {
    redis = makeRedisMock();
    backtest = makeBacktestMock();
    svc = new StreamConsumerService(redis as any, backtest as any);
  });

  afterEach(async () => {
    // Ensure consumer loop stops
    (svc as any).running = false;
    try {
      await (svc as any).loopPromise;
    } catch {
      /* ignore */
    }
    vi.restoreAllMocks();
  });

  // ─── ensureGroup ──────────────────────────────────────────────────────────

  describe("ensureGroup (via onModuleInit)", () => {
    it("creates consumer group on init", async () => {
      // Make xreadgroup reject immediately to stop the loop
      redis._client.xreadgroup.mockRejectedValue(new Error("stop"));
      (svc as any).running = false;

      await (svc as any).ensureGroup();

      expect(redis._client.xgroup).toHaveBeenCalledWith(
        "CREATE",
        "stream:backtests",
        "backtest-service",
        "$",
        "MKSTREAM",
      );
    });

    it("ignores BUSYGROUP error (group already exists)", async () => {
      redis._client.xgroup.mockRejectedValue(
        new Error("BUSYGROUP Consumer group already exists"),
      );

      await expect((svc as any).ensureGroup()).resolves.not.toThrow();
    });

    it("re-throws non-BUSYGROUP errors", async () => {
      redis._client.xgroup.mockRejectedValue(new Error("Connection refused"));

      await expect((svc as any).ensureGroup()).rejects.toThrow(
        "Connection refused",
      );
    });
  });

  // ─── parseFields ──────────────────────────────────────────────────────────

  describe("parseFields", () => {
    it("converts flat array of key-value pairs to object", () => {
      const result = (svc as any).parseFields([
        "runId",
        "run-123",
        "type",
        "backtest",
      ]);
      expect(result).toEqual({ runId: "run-123", type: "backtest" });
    });

    it("returns empty object for empty array", () => {
      const result = (svc as any).parseFields([]);
      expect(result).toEqual({});
    });

    it("handles single key-value pair", () => {
      const result = (svc as any).parseFields(["runId", "abc"]);
      expect(result).toEqual({ runId: "abc" });
    });
  });

  // ─── consumeLoop message processing ───────────────────────────────────────

  describe("consumeLoop message processing", () => {
    it("calls backtest.run with parsed runId and ACKs the message", async () => {
      let callCount = 0;
      redis._client.xreadgroup.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return [
            [
              "stream:backtests",
              [["msg-1", ["runId", "run-abc"]]],
            ],
          ];
        }
        // Stop the loop after first iteration
        (svc as any).running = false;
        return null;
      });

      (svc as any).running = true;
      await (svc as any).consumeLoop();

      expect(redis._client.xack).toHaveBeenCalledWith(
        "stream:backtests",
        "backtest-service",
        "msg-1",
      );
      expect(backtest.run).toHaveBeenCalledWith("run-abc");
    });

    it("ACKs and skips messages without runId", async () => {
      let callCount = 0;
      redis._client.xreadgroup.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return [
            [
              "stream:backtests",
              [["msg-no-run", ["type", "unknown"]]],
            ],
          ];
        }
        (svc as any).running = false;
        return null;
      });

      (svc as any).running = true;
      await (svc as any).consumeLoop();

      expect(redis._client.xack).toHaveBeenCalledWith(
        "stream:backtests",
        "backtest-service",
        "msg-no-run",
      );
      expect(backtest.run).not.toHaveBeenCalled();
    });

    it("continues loop when xreadgroup returns null (no messages)", async () => {
      let callCount = 0;
      redis._client.xreadgroup.mockImplementation(async () => {
        callCount++;
        if (callCount >= 2) {
          (svc as any).running = false;
        }
        return null;
      });

      (svc as any).running = true;
      await (svc as any).consumeLoop();

      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(backtest.run).not.toHaveBeenCalled();
    });

    it("catches errors from backtest.run without crashing the loop", async () => {
      backtest.run.mockRejectedValue(new Error("Backtest exploded"));
      let callCount = 0;
      redis._client.xreadgroup.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return [
            [
              "stream:backtests",
              [["msg-err", ["runId", "run-err"]]],
            ],
          ];
        }
        (svc as any).running = false;
        return null;
      });

      (svc as any).running = true;
      await (svc as any).consumeLoop();

      // Should have tried to run and continued
      expect(backtest.run).toHaveBeenCalledWith("run-err");
    });

    it("handles xreadgroup errors gracefully and continues", async () => {
      let callCount = 0;
      redis._client.xreadgroup.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Redis connection lost");
        }
        (svc as any).running = false;
        return null;
      });

      (svc as any).running = true;
      // Override sleep to avoid waiting
      (svc as any).sleep = vi.fn().mockResolvedValue(undefined);
      await (svc as any).consumeLoop();

      // Loop should have continued after error
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  describe("onModuleDestroy", () => {
    it("sets running to false", async () => {
      (svc as any).running = true;
      (svc as any).loopPromise = Promise.resolve();

      await svc.onModuleDestroy();

      expect((svc as any).running).toBe(false);
    });
  });
});
