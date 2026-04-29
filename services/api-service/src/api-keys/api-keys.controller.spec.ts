import { afterEach, describe, expect, it, vi } from "vitest";

const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";

const ORIGINAL_ENV = { ...process.env };

async function loadCreateThrottleMetadata(env: NodeJS.ProcessEnv = {}) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };

  const { ApiKeysController } = await import("./api-keys.controller");
  const method = ApiKeysController.prototype.create;

  return {
    limit: Reflect.getMetadata(`${THROTTLER_LIMIT}default`, method),
    ttl: Reflect.getMetadata(`${THROTTLER_TTL}default`, method),
  };
}

describe("ApiKeysController — @Throttle decorator coverage", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("create keeps the 5/hour production limit outside CI", async () => {
    const { limit, ttl } = await loadCreateThrottleMetadata({
      CI: "false",
      NODE_ENV: "production",
    });

    expect(limit).toBe(5);
    expect(ttl).toBe(3_600_000);
  });

  it("create uses an E2E-safe limit when production config runs in CI", async () => {
    const { limit, ttl } = await loadCreateThrottleMetadata({
      CI: "true",
      NODE_ENV: "production",
    });

    expect(limit, "@Throttle limit must be set on create").toBeDefined();
    expect(ttl, "@Throttle ttl must be set on create").toBeDefined();
    expect(limit).toBe(10000);
    expect(ttl).toBe(3_600_000);
  });
});
