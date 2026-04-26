import { describe, it, expect } from "vitest";
import { ProfileController } from "./profile.controller";

const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";

describe("ProfileController — @Throttle decorator coverage", () => {
  it("changePassword has @Throttle with 5/hour limit", () => {
    const method = ProfileController.prototype.changePassword;
    const limit: unknown = Reflect.getMetadata(
      `${THROTTLER_LIMIT}default`,
      method,
    );
    const ttl: unknown = Reflect.getMetadata(`${THROTTLER_TTL}default`, method);

    expect(
      limit,
      "@Throttle limit must be set on changePassword",
    ).toBeDefined();
    expect(ttl, "@Throttle ttl must be set on changePassword").toBeDefined();
    expect(ttl).toBe(3_600_000);
  });

  it("toggleFollow has @Throttle with 60/min limit", () => {
    const method = ProfileController.prototype.toggleFollow;
    const limit: unknown = Reflect.getMetadata(
      `${THROTTLER_LIMIT}default`,
      method,
    );
    const ttl: unknown = Reflect.getMetadata(`${THROTTLER_TTL}default`, method);

    expect(limit, "@Throttle limit must be set on toggleFollow").toBeDefined();
    expect(ttl, "@Throttle ttl must be set on toggleFollow").toBeDefined();
    expect(ttl).toBe(60_000);
  });
});
