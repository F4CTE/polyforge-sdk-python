import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStreamLag, reclaimPendingEntries } from "./streams";

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    xlen: vi.fn().mockResolvedValue(0),
    xpending: vi.fn().mockResolvedValue([0, null, null, null]),
    xinfo: vi.fn().mockResolvedValue([]),
    xautoclaim: vi.fn().mockResolvedValue(["0-0", [], []]),
    ...overrides,
  } as unknown as Parameters<typeof getStreamLag>[0];
}

describe("getStreamLag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero snapshot when stream key does not exist", async () => {
    const client = makeClient({
      xlen: vi.fn().mockRejectedValue(new Error("ERR no such key")),
    });

    const snapshot = await getStreamLag(client, "stream:foo", "group");

    expect(snapshot).toEqual({
      stream: "stream:foo",
      group: "group",
      length: 0,
      pending: 0,
      oldestPendingMs: 0,
      consumers: 0,
    });
  });

  it("returns length but zero pending when group has not been created", async () => {
    const client = makeClient({
      xlen: vi.fn().mockResolvedValue(42),
      xpending: vi
        .fn()
        .mockRejectedValue(new Error("NOGROUP no such consumer group")),
    });

    const snapshot = await getStreamLag(client, "stream:foo", "group");

    expect(snapshot.length).toBe(42);
    expect(snapshot.pending).toBe(0);
    expect(snapshot.consumers).toBe(0);
  });

  it("computes oldest pending age from the oldest pending id", async () => {
    const tenSecondsAgo = Date.now() - 10_000;
    const client = makeClient({
      xlen: vi.fn().mockResolvedValue(100),
      xpending: vi
        .fn()
        .mockResolvedValue([5, `${tenSecondsAgo}-0`, "x", [["c1", "5"]]]),
      xinfo: vi.fn().mockResolvedValue([
        ["name", "c1"],
        ["name", "c2"],
      ]),
    });

    const snapshot = await getStreamLag(client, "stream:foo", "group");

    expect(snapshot.length).toBe(100);
    expect(snapshot.pending).toBe(5);
    expect(snapshot.oldestPendingMs).toBeGreaterThanOrEqual(10_000);
    expect(snapshot.oldestPendingMs).toBeLessThan(11_000);
    expect(snapshot.consumers).toBe(2);
  });

  it("returns zero oldest age when there are no pending entries", async () => {
    const client = makeClient({
      xlen: vi.fn().mockResolvedValue(10),
      xpending: vi.fn().mockResolvedValue([0, null, null, null]),
    });

    const snapshot = await getStreamLag(client, "stream:foo", "group");

    expect(snapshot.pending).toBe(0);
    expect(snapshot.oldestPendingMs).toBe(0);
  });
});

describe("reclaimPendingEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result when consumer group does not exist", async () => {
    const client = makeClient({
      xautoclaim: vi
        .fn()
        .mockRejectedValue(new Error("NOGROUP no such consumer group")),
    });

    const result = await reclaimPendingEntries(
      client,
      "stream:foo",
      "g",
      "c1",
      60_000,
    );

    expect(result.reclaimedCount).toBe(0);
    expect(result.entries).toEqual([]);
    expect(result.nextCursor).toBe("0-0");
  });

  it("parses XAUTOCLAIM entries into id+fields shape", async () => {
    const client = makeClient({
      xautoclaim: vi.fn().mockResolvedValue([
        "1700000-0",
        [
          ["1699999-0", ["intentId", "i1", "userId", "u1"]],
          ["1699999-1", ["intentId", "i2", "userId", "u2"]],
        ],
        [],
      ]),
    });

    const result = await reclaimPendingEntries(
      client,
      "stream:orders",
      "order-service",
      "consumer-1",
      300_000,
    );

    expect(result.reclaimedCount).toBe(2);
    expect(result.nextCursor).toBe("1700000-0");
    expect(result.entries[0]).toEqual({
      id: "1699999-0",
      fields: { intentId: "i1", userId: "u1" },
    });
    expect(result.entries[1].fields.userId).toBe("u2");
  });

  it("calls XAUTOCLAIM with the supplied cursor for pagination", async () => {
    const xautoclaim = vi.fn().mockResolvedValue(["0-0", [], []]);
    const client = makeClient({ xautoclaim });

    await reclaimPendingEntries(
      client,
      "stream:foo",
      "g",
      "c1",
      30_000,
      50,
      "1234567-0",
    );

    expect(xautoclaim).toHaveBeenCalledWith(
      "stream:foo",
      "g",
      "c1",
      30_000,
      "1234567-0",
      "COUNT",
      50,
    );
  });
});
