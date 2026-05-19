import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PelReclaimService } from "./pel-reclaim.service";

function makeRedis(client: Record<string, unknown>) {
  return {
    getClient: vi.fn().mockReturnValue(client),
  } as never;
}

describe("PelReclaimService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("invokes the handler for each reclaimed entry and ACKs on success", async () => {
    const xack = vi.fn().mockResolvedValue(1);
    const client = {
      xautoclaim: vi.fn().mockResolvedValue([
        "0-0",
        [
          ["100-0", ["intentId", "i1"]],
          ["100-1", ["intentId", "i2"]],
        ],
        [],
      ]),
      xack,
    };
    const handler = vi.fn().mockResolvedValue(true);
    const onReclaim = vi.fn();

    const svc = new PelReclaimService(makeRedis(client));
    svc.setIntervalMs(10_000);
    svc.register({
      stream: "stream:orders",
      group: "g",
      consumer: "c1",
      handler,
      onReclaim,
    });

    // First tick fires after intervalMs.
    await vi.advanceTimersByTimeAsync(10_000);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith({
      id: "100-0",
      fields: { intentId: "i1" },
    });
    expect(xack).toHaveBeenCalledWith("stream:orders", "g", "100-0");
    expect(xack).toHaveBeenCalledWith("stream:orders", "g", "100-1");
    expect(onReclaim).toHaveBeenCalledWith(2);
  });

  it("does not ACK when the handler throws", async () => {
    const xack = vi.fn().mockResolvedValue(1);
    const client = {
      xautoclaim: vi
        .fn()
        .mockResolvedValue(["0-0", [["100-0", ["intentId", "i1"]]], []]),
      xack,
    };

    const svc = new PelReclaimService(makeRedis(client));
    svc.setIntervalMs(10_000);
    svc.register({
      stream: "s",
      group: "g",
      consumer: "c",
      handler: vi.fn().mockRejectedValue(new Error("boom")),
    });

    await vi.advanceTimersByTimeAsync(10_000);

    expect(xack).not.toHaveBeenCalled();
  });

  it("does not ACK when handler returns false", async () => {
    const xack = vi.fn().mockResolvedValue(1);
    const client = {
      xautoclaim: vi
        .fn()
        .mockResolvedValue(["0-0", [["100-0", ["intentId", "i1"]]], []]),
      xack,
    };

    const svc = new PelReclaimService(makeRedis(client));
    svc.setIntervalMs(10_000);
    svc.register({
      stream: "s",
      group: "g",
      consumer: "c",
      handler: vi.fn().mockResolvedValue(false),
    });

    await vi.advanceTimersByTimeAsync(10_000);

    expect(xack).not.toHaveBeenCalled();
  });

  it("ACKs when handler returns undefined (backward-compatible void)", async () => {
    const xack = vi.fn().mockResolvedValue(1);
    const client = {
      xautoclaim: vi
        .fn()
        .mockResolvedValue(["0-0", [["100-0", ["intentId", "i1"]]], []]),
      xack,
    };

    const svc = new PelReclaimService(makeRedis(client));
    svc.setIntervalMs(10_000);
    svc.register({
      stream: "s",
      group: "g",
      consumer: "c",
      handler: vi.fn().mockResolvedValue(undefined),
    });

    await vi.advanceTimersByTimeAsync(10_000);

    expect(xack).toHaveBeenCalledWith("s", "g", "100-0");
  });

  it("ACKs when handler returns true (explicit ACK)", async () => {
    const xack = vi.fn().mockResolvedValue(1);
    const client = {
      xautoclaim: vi
        .fn()
        .mockResolvedValue(["0-0", [["100-0", ["intentId", "i1"]]], []]),
      xack,
    };

    const svc = new PelReclaimService(makeRedis(client));
    svc.setIntervalMs(10_000);
    svc.register({
      stream: "s",
      group: "g",
      consumer: "c",
      handler: vi.fn().mockResolvedValue(true),
    });

    await vi.advanceTimersByTimeAsync(10_000);

    expect(xack).toHaveBeenCalledWith("s", "g", "100-0");
  });

  it("does not call handler when no entries are reclaimed", async () => {
    const handler = vi.fn();
    const client = {
      xautoclaim: vi.fn().mockResolvedValue(["0-0", [], []]),
      xack: vi.fn(),
    };

    const svc = new PelReclaimService(makeRedis(client));
    svc.setIntervalMs(10_000);
    svc.register({
      stream: "s",
      group: "g",
      consumer: "c",
      handler,
    });

    await vi.advanceTimersByTimeAsync(10_000);

    expect(handler).not.toHaveBeenCalled();
  });

  it("clears the timer on module destroy", async () => {
    const client = {
      xautoclaim: vi.fn().mockResolvedValue(["0-0", [], []]),
      xack: vi.fn(),
    };
    const svc = new PelReclaimService(makeRedis(client));
    svc.setIntervalMs(10_000);
    svc.register({ stream: "s", group: "g", consumer: "c" });

    svc.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(client.xautoclaim).not.toHaveBeenCalled();
  });
});
