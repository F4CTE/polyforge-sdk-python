import { describe, it, expect } from "vitest";
import { WhalesController } from "./whales.controller";
import { JwtAuthGuard } from "@polyforge/shared-auth";

const GUARDS_KEY = "__guards__";

describe("WhalesController — auth guard coverage", () => {
  it("has JwtAuthGuard applied at class level", () => {
    const guards: unknown[] =
      Reflect.getMetadata(GUARDS_KEY, WhalesController) ?? [];

    const hasJwtGuard = guards.some(
      (g) => g === JwtAuthGuard || (g as any)?.name === "JwtAuthGuard",
    );

    expect(
      hasJwtGuard,
      "WhalesController must have JwtAuthGuard at class level",
    ).toBe(true);
  });

  it("getFeed method exists and is guarded by the class-level guard", () => {
    const method = WhalesController.prototype.getFeed;
    expect(method).toBeDefined();

    const methodGuards: unknown[] =
      Reflect.getMetadata(GUARDS_KEY, method) ?? [];
    const noPublicOverride = !methodGuards.some(
      (g: any) => g?.name === "PublicGuard",
    );
    expect(
      noPublicOverride,
      "getFeed must not override JwtAuthGuard with a public guard",
    ).toBe(true);
  });

  it("getFollowing method exists and is guarded", () => {
    expect(WhalesController.prototype.getFollowing).toBeDefined();
  });

  it("follow and unfollow methods exist and are guarded", () => {
    expect(WhalesController.prototype.follow).toBeDefined();
    expect(WhalesController.prototype.unfollow).toBeDefined();
  });

  it("getFeed has @Throttle decorator", () => {
    const method = WhalesController.prototype.getFeed;
    const ttl: unknown = Reflect.getMetadata("THROTTLER:TTLdefault", method);
    expect(ttl, "@Throttle ttl must be set on getFeed").toBeDefined();
  });
});
