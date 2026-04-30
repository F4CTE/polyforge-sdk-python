import { describe, expect, it } from "vitest";
import { INTERCEPTORS_METADATA } from "@nestjs/common/constants";
import { IdempotencyInterceptor } from "../common/interceptors/idempotency.interceptor";
import { SmartOrderController } from "./smart-order.controller";

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

describe("SmartOrderController", () => {
  it("create requires Idempotency-Key", () => {
    expectRequiredIdempotencyKey(SmartOrderController.prototype.create);
  });
});
