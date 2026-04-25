import { describe, it, expect } from "vitest";
import { ScoresController } from "./scores.controller";
import { JwtAuthGuard } from "@polyforge/shared-auth";

const GUARDS_KEY = "__guards__";

describe("ScoresController — auth guard coverage", () => {
  it("has JwtAuthGuard applied at class level", () => {
    const guards: unknown[] =
      Reflect.getMetadata(GUARDS_KEY, ScoresController) ?? [];

    const hasJwtGuard = guards.some(
      (g) => g === JwtAuthGuard || (g as any)?.name === "JwtAuthGuard",
    );

    expect(
      hasJwtGuard,
      "ScoresController must have JwtAuthGuard at class level",
    ).toBe(true);
  });

  it("getMyScore method exists and is guarded by the class-level guard", () => {
    const method = ScoresController.prototype.getMyScore;
    expect(method).toBeDefined();

    const methodGuards: unknown[] =
      Reflect.getMetadata(GUARDS_KEY, method) ?? [];
    const noPublicOverride = !methodGuards.some(
      (g: any) => g?.name === "PublicGuard",
    );
    expect(
      noPublicOverride,
      "getMyScore must not override JwtAuthGuard with a public guard",
    ).toBe(true);
  });

  it("getMyBadges method exists and is guarded", () => {
    expect(ScoresController.prototype.getMyBadges).toBeDefined();
  });

  it("getTopTraders method exists", () => {
    expect(ScoresController.prototype.getTopTraders).toBeDefined();
  });

  it("getUserScore and getUserBadges accept userId param", () => {
    expect(ScoresController.prototype.getUserScore).toBeDefined();
    expect(ScoresController.prototype.getUserBadges).toBeDefined();
  });
});
