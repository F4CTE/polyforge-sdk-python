import { describe, it, expect } from "vitest";
import { ApiKeysController } from "./api-keys.controller";

const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";

describe("ApiKeysController — @Throttle decorator coverage", () => {
  it("create has @Throttle with 5/hour limit", () => {
    const method = ApiKeysController.prototype.create;
    const limit: unknown = Reflect.getMetadata(
      `${THROTTLER_LIMIT}default`,
      method,
    );
    const ttl: unknown = Reflect.getMetadata(`${THROTTLER_TTL}default`, method);

    expect(limit, "@Throttle limit must be set on create").toBeDefined();
    expect(ttl, "@Throttle ttl must be set on create").toBeDefined();
    expect(ttl).toBe(3_600_000);
  });
});
