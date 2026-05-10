import { describe, expect, it } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { GeoBlockGuard } from "../common/guards/geo.guard";
import { CopyController } from "./copy.controller";

function expectGeoBlocked(method: object) {
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];
  expect(guards).toContain(GeoBlockGuard);
}

describe("CopyController", () => {
  it("blocks new copy configurations by geo", () => {
    expectGeoBlocked(CopyController.prototype.create);
  });

  it("blocks copy resume by geo", () => {
    expectGeoBlocked(CopyController.prototype.resume);
  });
});
