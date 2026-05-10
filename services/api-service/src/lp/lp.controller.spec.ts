import { describe, expect, it } from "vitest";
import {
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
} from "@nestjs/common/constants";
import { GeoBlockGuard } from "../common/guards/geo.guard";
import { IdempotencyInterceptor } from "../common/interceptors/idempotency.interceptor";
import { LpController } from "./lp.controller";

const API_PARAMETERS = "swagger/apiParameters";

function expectRequiredIdempotencyKey(method: object) {
  const interceptors: unknown[] =
    Reflect.getMetadata(INTERCEPTORS_METADATA, method) ?? [];
  const parameters: Array<Record<string, unknown>> =
    Reflect.getMetadata(API_PARAMETERS, method) ?? [];

  expect(interceptors).toContain(IdempotencyInterceptor);
  expect(parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        in: "header",
        name: "Idempotency-Key",
        required: true,
      }),
    ]),
  );
}

describe("LpController", () => {
  it("provideLiquidity requires Idempotency-Key", () => {
    expectRequiredIdempotencyKey(LpController.prototype.provideLiquidity);
  });

  it("provideLiquidity blocks geo-restricted users", () => {
    const guards: unknown[] =
      Reflect.getMetadata(
        GUARDS_METADATA,
        LpController.prototype.provideLiquidity,
      ) ?? [];

    expect(guards).toContain(GeoBlockGuard);
  });
});
