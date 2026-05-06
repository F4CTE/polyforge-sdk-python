import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runOncePerCluster } from "./run-once";
import { RedisService } from "./redis.service";

function makeRedis(acquired: "OK" | null = "OK") {
  const client = {
    set: vi.fn().mockResolvedValue(acquired),
    del: vi.fn().mockResolvedValue(1),
  };

  return {
    client,
    redis: {
      getClient: vi.fn().mockReturnValue(client),
    } as unknown as RedisService,
  };
}

describe("runOncePerCluster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs the job after acquiring a Redis PX/NX lock", async () => {
    const { redis, client } = makeRedis("OK");
    const job = vi.fn().mockResolvedValue("done");

    const result = await runOncePerCluster({
      redis,
      key: "lock:job",
      ttlMs: 30_000,
      job,
    });

    expect(result).toBe("done");
    expect(client.set).toHaveBeenCalledWith(
      "lock:job",
      "1",
      "PX",
      30_000,
      "NX",
    );
    expect(job).toHaveBeenCalledTimes(1);
    expect(client.del).toHaveBeenCalledWith("lock:job");
  });

  it("returns null without running the job when another worker owns the lock", async () => {
    const { redis, client } = makeRedis(null);
    const job = vi.fn();

    const result = await runOncePerCluster({
      redis,
      key: "lock:job",
      ttlMs: 30_000,
      job,
    });

    expect(result).toBeNull();
    expect(job).not.toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();
  });

  it("releases the lock when the job throws", async () => {
    const { redis, client } = makeRedis("OK");
    const job = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      runOncePerCluster({
        redis,
        key: "lock:job",
        ttlMs: 30_000,
        job,
      }),
    ).rejects.toThrow("boom");

    expect(client.del).toHaveBeenCalledWith("lock:job");
  });
});
