import { afterEach, describe, expect, it, vi } from "vitest";

const xadd = vi.fn().mockResolvedValue("1-0");
const quit = vi.fn().mockResolvedValue("OK");
const on = vi.fn();

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(function RedisMock() {
    return {
      xadd,
      quit,
      on,
    };
  }),
}));

describe("RedisService", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    xadd.mockClear();
    quit.mockClear();
    on.mockClear();
  });

  it("adds stream:events entries with approximate MAXLEN trimming by default", async () => {
    const { RedisService } = await import("./redis.service");
    const service = new RedisService();

    await service.xadd("stream:events", { type: "PRICE", tokenId: "token-1" });

    expect(xadd).toHaveBeenCalledWith(
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
    const { RedisService } = await import("./redis.service");
    const service = new RedisService();

    await service.xadd("stream:events", { type: "PRICE" });

    expect(xadd).toHaveBeenCalledWith(
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
    const { RedisService } = await import("./redis.service");
    const service = new RedisService();

    await service.xadd("stream:orders", { type: "ORDER" });

    expect(xadd).toHaveBeenCalledWith("stream:orders", "*", "type", "ORDER");
  });

  it("allows callers to opt into approximate MAXLEN trimming", async () => {
    const { RedisService } = await import("./redis.service");
    const service = new RedisService();

    await service.xadd("stream:orders", { type: "ORDER" }, 500);

    expect(xadd).toHaveBeenCalledWith(
      "stream:orders",
      "MAXLEN",
      "~",
      500,
      "*",
      "type",
      "ORDER",
    );
  });
});
