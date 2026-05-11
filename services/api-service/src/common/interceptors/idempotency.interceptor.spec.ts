import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { lastValueFrom, of } from "rxjs";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

function makeContext(headers: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: "POST",
        url: "/orders",
        headers,
        user: { sub: "user-1" },
      }),
    }),
  } as any;
}

function makeRedis() {
  const client = {
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  };
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    getClient: vi.fn().mockReturnValue(client),
  } as any;
}

describe("IdempotencyInterceptor", () => {
  it("requires an idempotency key", async () => {
    const interceptor = new IdempotencyInterceptor(makeRedis());

    await expect(
      interceptor.intercept(makeContext(), { handle: () => of({}) } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a concurrent request while the lock exists", async () => {
    const redis = makeRedis();
    redis.getClient().set.mockResolvedValue(null);
    const interceptor = new IdempotencyInterceptor(redis);

    await expect(
      interceptor.intercept(makeContext({ "idempotency-key": "abcdefgh" }), {
        handle: () => of({ ok: true }),
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("writes the result cache before releasing the in-flight lock", async () => {
    const redis = makeRedis();
    const interceptor = new IdempotencyInterceptor(redis);

    const obs = await interceptor.intercept(
      makeContext({ "idempotency-key": "abcdefgh" }),
      { handle: () => of({ orderId: "ord-1" }) } as any,
    );

    await expect(lastValueFrom(obs)).resolves.toEqual({ orderId: "ord-1" });
    expect(redis.set).toHaveBeenCalledWith(
      "idempotency:POST:/orders:user-1:abcdefgh",
      JSON.stringify({ orderId: "ord-1" }),
      86_400,
    );
    expect(redis.getClient().del).toHaveBeenCalledWith(
      "idempotency:POST:/orders:user-1:abcdefgh:lock",
    );
    expect(redis.set.mock.invocationCallOrder[0]).toBeLessThan(
      redis.getClient().del.mock.invocationCallOrder[0],
    );
  });

  it("retains lock and returns result when cache write fails (TOCTOU guard)", async () => {
    const redis = makeRedis();
    redis.set.mockRejectedValue(new Error("redis down"));
    const interceptor = new IdempotencyInterceptor(redis);

    const obs = await interceptor.intercept(
      makeContext({ "idempotency-key": "abcdefgh" }),
      { handle: () => of({ orderId: "ord-1" }) } as any,
    );

    await expect(lastValueFrom(obs)).resolves.toEqual({ orderId: "ord-1" });
    // Lock is NOT released when cache write fails — it will expire naturally.
    // This prevents a concurrent request with the same key from being
    // processed while no cached result exists.
    expect(redis.getClient().del).not.toHaveBeenCalled();
  });
});
