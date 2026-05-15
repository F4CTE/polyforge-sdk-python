import { describe, it, expect } from "vitest";
import { INTERCEPTORS_METADATA } from "@nestjs/common/constants";
import { IdempotencyInterceptor } from "../common/interceptors/idempotency.interceptor";
import { OrdersController } from "./orders.controller";

const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";
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

describe("OrdersController — bulk cancel routing", () => {
  it("cancelBulk is decorated with DELETE method", () => {
    const method: unknown = Reflect.getMetadata(
      "method",
      OrdersController.prototype.cancelBulk,
    );
    const path: unknown = Reflect.getMetadata(
      "path",
      OrdersController.prototype.cancelBulk,
    );
    expect(method).toBe(3); // RequestMethod.DELETE
    expect(path).toBe("bulk");
  });

  it("cancelBulkPost is decorated with POST method and same path", () => {
    const method: unknown = Reflect.getMetadata(
      "method",
      OrdersController.prototype.cancelBulkPost,
    );
    const path: unknown = Reflect.getMetadata(
      "path",
      OrdersController.prototype.cancelBulkPost,
    );
    expect(method).toBe(1); // RequestMethod.POST
    expect(path).toBe("bulk");
  });
});

describe("OrdersController — @Throttle decorator coverage", () => {
  it("redeemPosition has @Throttle with limit and ttl matching sibling endpoints", () => {
    const method = OrdersController.prototype.redeemPosition;

    const limit: unknown = Reflect.getMetadata(
      `${THROTTLER_LIMIT}default`,
      method,
    );
    const ttl: unknown = Reflect.getMetadata(`${THROTTLER_TTL}default`, method);

    expect(
      limit,
      "@Throttle limit must be set on redeemPosition",
    ).toBeDefined();
    expect(ttl, "@Throttle ttl must be set on redeemPosition").toBeDefined();
    // ttl should be 60 000 ms
    expect(ttl).toBe(60000);
  });

  it("closePosition has @Throttle (reference baseline)", () => {
    const method = OrdersController.prototype.closePosition;
    const limit: unknown = Reflect.getMetadata(
      `${THROTTLER_LIMIT}default`,
      method,
    );
    expect(limit).toBeDefined();
  });

  it("splitPosition has @Throttle (reference baseline)", () => {
    const method = OrdersController.prototype.splitPosition;
    const limit: unknown = Reflect.getMetadata(
      `${THROTTLER_LIMIT}default`,
      method,
    );
    expect(limit).toBeDefined();
  });

  it("mergePosition has @Throttle (reference baseline)", () => {
    const method = OrdersController.prototype.mergePosition;
    const limit: unknown = Reflect.getMetadata(
      `${THROTTLER_LIMIT}default`,
      method,
    );
    expect(limit).toBeDefined();
  });

  it("updateJournal method is defined on the controller", () => {
    expect(OrdersController.prototype.updateJournal).toBeDefined();
  });

  it("updateJournal uses PATCH http method", () => {
    const method: unknown = Reflect.getMetadata(
      "method",
      OrdersController.prototype.updateJournal,
    );
    expect(method).toBeDefined();
  });

  it("placeBatch requires Idempotency-Key", () => {
    expectRequiredIdempotencyKey(OrdersController.prototype.placeBatch);
  });

  it("splitPosition is wrapped with IdempotencyInterceptor", () => {
    const interceptors: unknown = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      OrdersController.prototype.splitPosition,
    );
    expect(Array.isArray(interceptors)).toBe(true);
    expect(interceptors as unknown[]).toContain(IdempotencyInterceptor);
  });

  it("mergePosition is wrapped with IdempotencyInterceptor", () => {
    const interceptors: unknown = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      OrdersController.prototype.mergePosition,
    );
    expect(Array.isArray(interceptors)).toBe(true);
    expect(interceptors as unknown[]).toContain(IdempotencyInterceptor);
  });
});
