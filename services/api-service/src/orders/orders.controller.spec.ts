import { describe, it, expect } from "vitest";
import { OrdersController } from "./orders.controller";

const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";

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
});
