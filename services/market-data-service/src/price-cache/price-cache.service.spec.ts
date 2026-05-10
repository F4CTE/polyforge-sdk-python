import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PriceCacheService } from "./price-cache.service";
import {
  PriceUpdateEvent,
  BookUpdateEvent,
} from "../market-sync/polymarket-ws.service";

// ── Mocks ─────────────────────────────────────────────────────────────────────

function makeMocks() {
  const ioredisClient = {
    exists: vi.fn().mockResolvedValue(0),
    zadd: vi.fn().mockResolvedValue(1),
    zremrangebyrank: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(1),
  };
  const redis = {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    getClient: vi.fn().mockReturnValue(ioredisClient),
  } as any;

  const prisma = {
    token: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    priceSnapshot: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    dataGap: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  } as any;

  return { redis, prisma };
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("PriceCacheService", () => {
  let svc: PriceCacheService;
  let redis: ReturnType<typeof makeMocks>["redis"];
  let prisma: ReturnType<typeof makeMocks>["prisma"];

  beforeEach(() => {
    vi.useFakeTimers();
    const m = makeMocks();
    ({ redis, prisma } = m);
    svc = new PriceCacheService(redis, prisma);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── handlePriceUpdate ─────────────────────────────────────────────────────

  describe("handlePriceUpdate()", () => {
    const priceEvent: PriceUpdateEvent = {
      tokenId: "token-1",
      price: 0.72,
      timestamp: 1700000000,
    };

    it("writes price to Redis with 10s TTL", async () => {
      await svc.handlePriceUpdate(priceEvent);

      expect(redis.set).toHaveBeenCalledWith(
        "cache:price:token-1",
        JSON.stringify({ price: 0.72, timestamp: 1700000000 }),
        10,
      );
    });

    it("buffers token price for batch DB flush instead of immediate write", async () => {
      await svc.handlePriceUpdate(priceEvent);

      // Price is buffered, not written immediately
      expect(prisma.token.updateMany).not.toHaveBeenCalled();

      // Flush after 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      // Now the batched $transaction should have fired
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("buffers snapshot data for TimescaleDB flush", async () => {
      await svc.handlePriceUpdate(priceEvent);

      // Trigger flush by advancing past the 5s interval
      vi.advanceTimersByTime(5_500);

      // The flush uses prisma.priceSnapshot.createMany
      expect(prisma.priceSnapshot.createMany).toHaveBeenCalled();
    });

    it("tracks OHLC correctly across multiple updates for same token", async () => {
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.5,
        timestamp: 1,
      });
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.8,
        timestamp: 2,
      });
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.3,
        timestamp: 3,
      });
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.6,
        timestamp: 4,
      });

      // Flush snapshots
      vi.advanceTimersByTime(5_500);

      expect(prisma.priceSnapshot.createMany).toHaveBeenCalled();
      const call = prisma.priceSnapshot.createMany.mock.calls[0][0];
      // The snapshot should have: open=0.50, high=0.80, low=0.30, close=0.60
      expect(call.data).toHaveLength(1);
      expect(call.data[0].open).toBe(0.5);
      expect(call.data[0].high).toBe(0.8);
      expect(call.data[0].low).toBe(0.3);
      expect(call.data[0].close).toBe(0.6);
    });

    it("creates separate snapshot entries for different tokens", async () => {
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.5,
        timestamp: 1,
      });
      await svc.handlePriceUpdate({
        tokenId: "token-2",
        price: 0.7,
        timestamp: 2,
      });

      // Flush snapshots
      vi.advanceTimersByTime(5_500);

      expect(prisma.priceSnapshot.createMany).toHaveBeenCalled();
      const call = prisma.priceSnapshot.createMany.mock.calls[0][0];
      expect(call.data).toHaveLength(2);
    });
  });

  // ── handleBookUpdate ──────────────────────────────────────────────────────

  describe("handleBookUpdate()", () => {
    const bookEvent: BookUpdateEvent = {
      tokenId: "token-1",
      bids: [{ price: "0.60", size: "100" }],
      asks: [{ price: "0.65", size: "200" }],
      midpoint: "0.625",
      spread: "0.05",
      timestamp: 1700000002,
    };

    it("writes book data to Redis with 5s TTL", async () => {
      await svc.handleBookUpdate(bookEvent);

      expect(redis.set).toHaveBeenCalledWith(
        "cache:book:token-1",
        JSON.stringify({
          bids: bookEvent.bids,
          asks: bookEvent.asks,
          midpoint: bookEvent.midpoint,
          spread: bookEvent.spread,
          timestamp: bookEvent.timestamp,
        }),
        5,
      );
    });

    it("uses correct cache key format", async () => {
      await svc.handleBookUpdate({ ...bookEvent, tokenId: "abc-xyz" });

      expect(redis.set).toHaveBeenCalledWith(
        "cache:book:abc-xyz",
        expect.any(String),
        5,
      );
    });
  });

  // ── Snapshot flushing ─────────────────────────────────────────────────────

  describe("flushSnapshots()", () => {
    it("flushes a high-throughput snapshot batch after 1 second", async () => {
      for (let i = 0; i < 250; i += 1) {
        await svc.handlePriceUpdate({
          tokenId: `token-${i}`,
          price: 0.5,
          timestamp: i,
        });
      }

      await vi.advanceTimersByTimeAsync(1_000);

      expect(prisma.priceSnapshot.createMany).toHaveBeenCalledTimes(1);
      expect(
        prisma.priceSnapshot.createMany.mock.calls[0][0].data,
      ).toHaveLength(250);
    });

    it("does nothing when buffer is empty", () => {
      // Advance past flush interval with no data
      vi.advanceTimersByTime(5_500);

      expect(prisma.priceSnapshot.createMany).not.toHaveBeenCalled();
    });

    it("clears the buffer after flushing", async () => {
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.5,
        timestamp: 1,
      });

      // First flush
      vi.advanceTimersByTime(5_500);
      expect(prisma.priceSnapshot.createMany).toHaveBeenCalledTimes(1);

      // Second flush — buffer should be empty now
      vi.advanceTimersByTime(5_500);
      expect(prisma.priceSnapshot.createMany).toHaveBeenCalledTimes(1); // no additional call
    });

    it("does not throw when createMany fails", async () => {
      prisma.priceSnapshot.createMany.mockRejectedValue(
        new Error("TimescaleDB error"),
      );

      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.5,
        timestamp: 1,
      });

      // Should not throw
      expect(() => vi.advanceTimersByTime(5_500)).not.toThrow();
    });
  });

  // ── Lifecycle cleanup ────────────────────────────────────────────────────

  describe("onModuleDestroy()", () => {
    it("clears all owned timers", async () => {
      const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

      svc.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(3);
    });
  });

  // ── Data gap detection ────────────────────────────────────────────────────

  describe("data gap detection", () => {
    it("records a data gap when no update for 30+ seconds", async () => {
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.5,
        timestamp: 1,
      });

      // Advance past gap threshold (30s) + gap detection interval (15s)
      vi.advanceTimersByTime(50_000);

      // Give async gap detection time to complete
      await vi.advanceTimersByTimeAsync(0);

      expect(prisma.dataGap.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenId: "token-1",
          reason: "WebSocket feed interrupted",
        }),
      });
    });

    it("does not record a gap for tokens with recent updates", async () => {
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.5,
        timestamp: 1,
      });

      // Advance 10s — well within the 30s threshold
      vi.advanceTimersByTime(10_000);

      // Send another update
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.6,
        timestamp: 2,
      });

      // Advance another 10s (total 20s from last update)
      vi.advanceTimersByTime(10_000);

      expect(prisma.dataGap.create).not.toHaveBeenCalled();
    });

    it("removes token from tracking after recording a gap", async () => {
      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.5,
        timestamp: 1,
      });

      // Trigger gap detection
      vi.advanceTimersByTime(50_000);
      await vi.advanceTimersByTimeAsync(0);

      // Reset the mock
      prisma.dataGap.create.mockClear();

      // Advance again — should not create another gap (token removed from tracking)
      vi.advanceTimersByTime(50_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(prisma.dataGap.create).not.toHaveBeenCalled();
    });

    it("does not throw when dataGap.create fails", async () => {
      prisma.dataGap.create.mockRejectedValue(new Error("DB error"));

      await svc.handlePriceUpdate({
        tokenId: "token-1",
        price: 0.5,
        timestamp: 1,
      });

      // Should not throw
      expect(() => vi.advanceTimersByTime(50_000)).not.toThrow();
    });
  });

  // ── Redis cache keys ──────────────────────────────────────────────────────

  describe("cache key format", () => {
    it("uses cache:price:{tokenId} for price cache", async () => {
      await svc.handlePriceUpdate({
        tokenId: "my-token",
        price: 0.5,
        timestamp: 1,
      });

      expect(redis.set).toHaveBeenCalledWith(
        "cache:price:my-token",
        expect.any(String),
        10,
      );
    });

    it("uses cache:book:{tokenId} for book cache", async () => {
      await svc.handleBookUpdate({
        tokenId: "my-token",
        bids: [],
        asks: [],
        midpoint: "0",
        spread: "0",
        timestamp: 1,
      });

      expect(redis.set).toHaveBeenCalledWith(
        "cache:book:my-token",
        expect.any(String),
        5,
      );
    });
  });

  // ── WS disconnect / reconnect handlers ───────────────────────────────────

  describe("handleFeedDisconnected()", () => {
    const makeEvent = (
      overrides?: Partial<{ venueId: string; tokenIds: string[] }>,
    ) => ({
      venueId: "polymarket",
      tokenIds: ["token-a", "token-b", "token-c"],
      ...overrides,
    });

    const del = () => redis.getClient().del;

    it("deletes all price and book cache keys for the disconnected tokens", async () => {
      await svc.handleFeedDisconnected(makeEvent());

      expect(del()).toHaveBeenCalledTimes(1);
      // 3 tokens × 2 key types = 6 keys, all in one batch (batch size 200)
      expect(del()).toHaveBeenCalledWith(
        "cache:price:token-a",
        "cache:price:token-b",
        "cache:price:token-c",
        "cache:book:token-a",
        "cache:book:token-b",
        "cache:book:token-c",
      );
    });

    it("batches deletes when token count exceeds BATCH size", async () => {
      const tokenIds = Array.from({ length: 250 }, (_, i) => `token-${i}`);
      await svc.handleFeedDisconnected(makeEvent({ tokenIds }));

      // 250 tokens × 2 = 500 keys, batch size 200 → 3 batches
      expect(del()).toHaveBeenCalledTimes(3);
      // First batch: 200 keys (all price keys: token-0 through token-199)
      expect(del().mock.calls[0][0]).toBe("cache:price:token-0");
      expect(del().mock.calls[0][199]).toBe("cache:price:token-199");
      // Second batch: 200 keys (price:token-200..249 + book:token-0..149)
      expect(del().mock.calls[1][0]).toBe("cache:price:token-200");
      expect(del().mock.calls[1][50]).toBe("cache:book:token-0");
      // Third batch: remaining 100 keys (book:token-150..249)
      expect(del().mock.calls[2]).toHaveLength(100);
      expect(del().mock.calls[2][0]).toBe("cache:book:token-150");
    });

    it("aborts remaining batches when venue reconnects mid-deletion", async () => {
      const tokenIds = Array.from({ length: 500 }, (_, i) => `token-${i}`);

      // After the first batch completes, simulate a reconnect
      const delMock = del();
      delMock.mockImplementationOnce(async () => {
        // First batch succeeds — then reconnect fires
        svc.handleFeedConnected({ venueId: "polymarket" });
      });

      await svc.handleFeedDisconnected(makeEvent({ tokenIds }));

      // Only 1 batch made it through (200 keys = first batch)
      // The reconnect should have aborted the remaining 2 batches
      expect(delMock).toHaveBeenCalledTimes(1);
    });

    it("per-venue isolation: reconnect on venue B does not abort cleanup on venue A", async () => {
      // Polymarket has many tokens → multiple batches
      const polyTokens = Array.from({ length: 250 }, (_, i) => `poly-${i}`);

      // Kalshi reconnects — should NOT affect polymarket's ongoing cleanup
      svc.handleFeedConnected({ venueId: "kalshi" });

      await svc.handleFeedDisconnected({
        venueId: "polymarket",
        tokenIds: polyTokens,
      });

      // All batches should complete (500 keys / 200 = 3 batches)
      expect(del()).toHaveBeenCalledTimes(3);
    });

    it("does nothing when tokenIds array is empty", async () => {
      await svc.handleFeedDisconnected(makeEvent({ tokenIds: [] }));

      expect(del()).not.toHaveBeenCalled();
    });

    it("does not throw when del rejects", async () => {
      del().mockRejectedValueOnce(new Error("Redis error"));

      await expect(
        svc.handleFeedDisconnected(makeEvent()),
      ).resolves.toBeUndefined();
    });
  });

  describe("handleFeedConnected()", () => {
    it("increments the disconnect epoch to abort in-flight cleanup", async () => {
      // Start a disconnect with 500 tokens (3 batches of 200+100)
      const tokenIds = Array.from({ length: 500 }, (_, i) => `token-${i}`);

      // Capture the first del call, then fire reconnect
      const delMock = redis.getClient().del;
      delMock.mockImplementationOnce(async () => {
        svc.handleFeedConnected({ venueId: "polymarket" });
      });

      await svc.handleFeedDisconnected({
        venueId: "polymarket",
        tokenIds,
      });

      // Only the first batch should have executed
      expect(delMock).toHaveBeenCalledTimes(1);
    });
  });
});
