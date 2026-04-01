import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContext(admin?: { role: string }) {
  const request = admin ? { admin } : {};
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(request),
    }),
  } as any;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("RolesGuard (N-M1)", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it("allows access when no @Roles decorator is set", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);
    const context = makeContext({ role: "ADMIN" });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows access when @Roles returns an empty array", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([]);
    const context = makeContext({ role: "ADMIN" });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows SUPER_ADMIN when @Roles("SUPER_ADMIN") is set', () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["SUPER_ADMIN"]);
    const context = makeContext({ role: "SUPER_ADMIN" });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies ADMIN when @Roles("SUPER_ADMIN") is set', () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["SUPER_ADMIN"]);
    const context = makeContext({ role: "ADMIN" });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("throws ForbiddenException with FORBIDDEN code when role is insufficient", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["SUPER_ADMIN"]);
    const context = makeContext({ role: "ADMIN" });

    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: "FORBIDDEN" }),
      }),
    );
  });

  it("throws ForbiddenException when admin is missing on request", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["SUPER_ADMIN"]);
    const context = makeContext(); // no admin on request

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("allows ADMIN when @Roles includes ADMIN", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
    const context = makeContext({ role: "ADMIN" });

    expect(guard.canActivate(context)).toBe(true);
  });
});
