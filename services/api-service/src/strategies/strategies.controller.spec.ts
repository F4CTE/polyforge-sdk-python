import { describe, expect, it } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { GeoBlockGuard } from "../common/guards/geo.guard";
import { StrategiesController } from "./strategies.controller";

describe("StrategiesController", () => {
  it("blocks strategy starts by geo", () => {
    const guards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, StrategiesController.prototype.start) ??
      [];

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
});
