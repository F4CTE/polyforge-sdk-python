import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeyScopeGuard } from "./api-key-scopes.guard";
import { REQUIRED_SCOPES } from "./api-key-scopes.decorator";

function makeExecutionContext(request: Record<string, any> = {}) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

describe("ApiKeyScopeGuard", () => {
  let guard: ApiKeyScopeGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;
    guard = new ApiKeyScopeGuard(reflector);
  });

  it("allows request when no scopes are required (no metadata)", () => {
    (reflector.getAllAndOverride as any).mockReturnValue(undefined);

    const ctx = makeExecutionContext();
    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it("allows request when required scopes is an empty array", () => {
    (reflector.getAllAndOverride as any).mockReturnValue([]);

    const ctx = makeExecutionContext();
    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it("allows JWT requests (no apiKeyMeta) unconditionally", () => {
    (reflector.getAllAndOverride as any).mockReturnValue(["READ", "TRADE"]);

    const ctx = makeExecutionContext({ user: { sub: "user-1" } });
    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it("allows API key with matching scopes", () => {
    (reflector.getAllAndOverride as any).mockReturnValue(["READ"]);

    const ctx = makeExecutionContext({
      apiKeyMeta: { scopes: ["READ", "TRADE"] },
    });
    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it("allows API key when all required scopes are present", () => {
    (reflector.getAllAndOverride as any).mockReturnValue(["READ", "TRADE"]);

    const ctx = makeExecutionContext({
      apiKeyMeta: { scopes: ["READ", "TRADE", "ADMIN"] },
    });
    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it("throws ForbiddenException when API key is missing a required scope", () => {
    (reflector.getAllAndOverride as any).mockReturnValue(["TRADE"]);

    const ctx = makeExecutionContext({
      apiKeyMeta: { scopes: ["READ"] },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("includes INSUFFICIENT_SCOPES code in the exception", () => {
    (reflector.getAllAndOverride as any).mockReturnValue(["TRADE"]);

    const ctx = makeExecutionContext({
      apiKeyMeta: { scopes: ["READ"] },
    });

    try {
      guard.canActivate(ctx);
      expect.fail("Expected ForbiddenException");
    } catch (err: any) {
      expect(err.response.code).toBe("INSUFFICIENT_SCOPES");
    }
  });

  it("throws when API key is missing one of multiple required scopes", () => {
    (reflector.getAllAndOverride as any).mockReturnValue([
      "READ",
      "TRADE",
      "ADMIN",
    ]);

    const ctx = makeExecutionContext({
      apiKeyMeta: { scopes: ["READ", "TRADE"] },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("throws when apiKeyMeta has no scopes", () => {
    (reflector.getAllAndOverride as any).mockReturnValue(["READ"]);

    const ctx = makeExecutionContext({
      apiKeyMeta: {},
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("reads metadata using REQUIRED_SCOPES key from handler and class", () => {
    (reflector.getAllAndOverride as any).mockReturnValue(undefined);

    const ctx = makeExecutionContext();
    guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(REQUIRED_SCOPES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });
});
