import { describe, expect, it } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ApiKeyScopeGuard, REQUIRED_SCOPES } from "@polyforge/shared-auth";
import { GeoBlockGuard } from "../common/guards/geo.guard";
import { StrategiesController } from "./strategies.controller";

function expectRequiredScope(method: object, scope: string) {
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];

  expect(guards).toContain(ApiKeyScopeGuard);
  expect(Reflect.getMetadata(REQUIRED_SCOPES, method)).toEqual([scope]);
}

describe("StrategiesController", () => {
  it("blocks strategy starts by geo", () => {
    const guards: unknown[] =
      Reflect.getMetadata(
        GUARDS_METADATA,
        StrategiesController.prototype.start,
      ) ?? [];

    expect(guards).toContain(GeoBlockGuard);
  });

  it("blocks strategy resumes by geo", () => {
    const guards: unknown[] =
      Reflect.getMetadata(
        GUARDS_METADATA,
        StrategiesController.prototype.resume,
      ) ?? [];

    expect(guards).toContain(GeoBlockGuard);
  });

  it("requires STRATEGY scope for strategy import/fork mutations", () => {
    expectRequiredScope(
      StrategiesController.prototype.importStrategy,
      "STRATEGY",
    );
    expectRequiredScope(StrategiesController.prototype.fork, "STRATEGY");
  });

  it("requires WRITE scope for strategy social/report mutations", () => {
    expectRequiredScope(StrategiesController.prototype.like, "WRITE");
    expectRequiredScope(StrategiesController.prototype.addComment, "WRITE");
    expectRequiredScope(StrategiesController.prototype.deleteComment, "WRITE");
    expectRequiredScope(StrategiesController.prototype.report, "WRITE");
  });
});
