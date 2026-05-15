import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { InternalAuthGuard } from "./internal-auth.guard";

function makeContext(token = "service-token") {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: `Bearer ${token}` },
      }),
    }),
  } as any;
}

describe("InternalAuthGuard", () => {
  it("stores each jti with Redis SET NX so replay protection survives restarts", async () => {
    const set = vi.fn().mockResolvedValue("OK");
    const guard = new InternalAuthGuard(
      { verify: vi.fn().mockReturnValue({ jti: "jti-1" }) } as any,
      { get: vi.fn().mockReturnValue("secret") } as any,
      { getClient: vi.fn().mockReturnValue({ set }) } as any,
    );

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);

    expect(set).toHaveBeenCalledWith(
      "strategy-engine:jti:jti-1",
      "1",
      "EX",
      60,
      "NX",
    );
  });

  it("rejects a replayed jti when Redis SET NX reports an existing key", async () => {
    const set = vi.fn().mockResolvedValue(null);
    const guard = new InternalAuthGuard(
      { verify: vi.fn().mockReturnValue({ jti: "jti-1" }) } as any,
      { get: vi.fn().mockReturnValue("secret") } as any,
      { getClient: vi.fn().mockReturnValue({ set }) } as any,
    );

    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
