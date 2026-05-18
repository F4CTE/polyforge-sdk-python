import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisClient = vi.hoisted(() => ({
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue("OK"),
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  xadd: vi.fn().mockResolvedValue("1-0"),
}));

const RedisMock = vi.hoisted(() =>
  vi.fn(function Redis() {
    return redisClient;
  }),
);

vi.mock("ioredis", () => ({
  default: RedisMock,
}));

import Redis from "ioredis";
import { RedisService } from "./redis.service";

describe("RedisService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns parsed JSON values", async () => {
    redisClient.get.mockResolvedValue(JSON.stringify({ ok: true, count: 2 }));
    const service = new RedisService();

    const result = await service.getJson<{ ok: boolean; count: number }>(
      "cache:key",
    );

    expect(result).toEqual({ ok: true, count: 2 });
    expect(redisClient.get).toHaveBeenCalledWith("cache:key");
  });

  it("returns null for missing JSON values", async () => {
    redisClient.get.mockResolvedValue(null);
    const service = new RedisService();

    await expect(service.getJson("missing:key")).resolves.toBeNull();
  });

  it("adds stream entries with Redis XADD field-value arguments", async () => {
    redisClient.xadd.mockResolvedValue("1700000000000-0");
    const service = new RedisService();

    const id = await service.xadd("stream:orders", {
      type: "ORDER_FILLED",
      userId: "user-1",
      orderId: "order-1",
    });

    expect(id).toBe("1700000000000-0");
    expect(redisClient.xadd).toHaveBeenCalledWith(
      "stream:orders",
      "*",
      "type",
      "ORDER_FILLED",
      "userId",
      "user-1",
      "orderId",
      "order-1",
    );
    expect(Redis).toHaveBeenCalled();
  });

  it("adds stream:events entries with approximate MAXLEN trimming by default", async () => {
    const service = new RedisService();

    await service.xadd("stream:events", { type: "PRICE", tokenId: "token-1" });

    expect(redisClient.xadd).toHaveBeenCalledWith(
      "stream:events",
      "MAXLEN",
      "~",
      100_000,
      "*",
      "type",
      "PRICE",
      "tokenId",
      "token-1",
    );
  });

  it("uses REDIS_STREAM_EVENTS_MAXLEN for stream:events when configured", async () => {
    vi.stubEnv("REDIS_STREAM_EVENTS_MAXLEN", "250000");
    const service = new RedisService();

    await service.xadd("stream:events", { type: "PRICE" });

    expect(redisClient.xadd).toHaveBeenCalledWith(
      "stream:events",
      "MAXLEN",
      "~",
      250_000,
      "*",
      "type",
      "PRICE",
    );
  });

  it("keeps non-events streams untrimmed by default", async () => {
    const service = new RedisService();

    await service.xadd("stream:orders", { type: "ORDER" });

    expect(redisClient.xadd).toHaveBeenCalledWith(
      "stream:orders",
      "*",
      "type",
      "ORDER",
    );
  });

  it("allows callers to opt into approximate MAXLEN trimming", async () => {
    const service = new RedisService();

    await service.xadd("stream:orders", { type: "ORDER" }, 500);

    expect(redisClient.xadd).toHaveBeenCalledWith(
      "stream:orders",
      "MAXLEN",
      "~",
      500,
      "*",
      "type",
      "ORDER",
    );
  });

  it("increments a counter key via INCR", async () => {
    redisClient.incr.mockResolvedValue(5);
    const service = new RedisService();

    const result = await service.incr("reclaim:attempts:intent-1");

    expect(result).toBe(5);
    expect(redisClient.incr).toHaveBeenCalledWith("reclaim:attempts:intent-1");
  });

  it("sets TTL on a key via EXPIRE", async () => {
    const service = new RedisService();

    await service.expire("reclaim:attempts:intent-1", 1800);

    expect(redisClient.expire).toHaveBeenCalledWith(
      "reclaim:attempts:intent-1",
      1800,
    );
  });
});
