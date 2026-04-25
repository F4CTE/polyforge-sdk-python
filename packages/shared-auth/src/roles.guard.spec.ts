import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

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

describe("RolesGuard (shared-auth)", () => {
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
    expect(guard.canActivate(makeContext({ role: "ADMIN" }))).toBe(true);
  });

  it("allows access when @Roles returns an empty array", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([]);
    expect(guard.canActivate(makeContext({ role: "ADMIN" }))).toBe(true);
  });

  it("allows SUPER_ADMIN when required", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["SUPER_ADMIN"]);
    expect(guard.canActivate(makeContext({ role: "SUPER_ADMIN" }))).toBe(true);
  });

  it("allows ADMIN when @Roles includes ADMIN", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
    expect(guard.canActivate(makeContext({ role: "ADMIN" }))).toBe(true);
  });

  it("denies ADMIN when only SUPER_ADMIN is required", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["SUPER_ADMIN"]);
    expect(() => guard.canActivate(makeContext({ role: "ADMIN" }))).toThrow(
      ForbiddenException,
    );
  });

  it("denies VIEWER when ADMIN is required", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["ADMIN"]);
    expect(() => guard.canActivate(makeContext({ role: "VIEWER" }))).toThrow(
      ForbiddenException,
    );
  });

  it("denies when admin is missing on request", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["ADMIN"]);
    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);
  });

  it("throws ForbiddenException with FORBIDDEN code", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["SUPER_ADMIN"]);
    expect(() => guard.canActivate(makeContext({ role: "SUPPORT" }))).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: "FORBIDDEN" }),
      }),
    );
  });
});
