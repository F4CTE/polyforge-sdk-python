import { afterEach, describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";

const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";
const REQUIRED_SCOPES = "requiredScopes";

const ORIGINAL_ENV = { ...process.env };

async function loadCreateThrottleMetadata(env: NodeJS.ProcessEnv = {}) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };

  const { ApiKeysController } = await import("./api-keys.controller.js");
  const method = ApiKeysController.prototype.create;

  return {
    limit: Reflect.getMetadata(`${THROTTLER_LIMIT}default`, method),
    ttl: Reflect.getMetadata(`${THROTTLER_TTL}default`, method),
    guards: Reflect.getMetadata(GUARDS_METADATA, method) ?? [],
    scopes: Reflect.getMetadata(REQUIRED_SCOPES, method),
  };
}

async function loadListGuardMetadata() {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };

  const { ApiKeysController } = await import("./api-keys.controller.js");
  const method = ApiKeysController.prototype.list;

  return {
    guards: Reflect.getMetadata(GUARDS_METADATA, method) ?? [],
    scopes: Reflect.getMetadata(REQUIRED_SCOPES, method),
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

  it("create is session-only and has no API-key scope metadata", async () => {
    const { guards, scopes } = await loadCreateThrottleMetadata();

    expect(
      guards.map((guard: { name?: string }) => guard.name),
    ).toEqual(["SessionOnlyGuard"]);
    expect(scopes).toBeUndefined();
  });

  it("list is session-only and rejects API-key callers regardless of scope", async () => {
    const { guards, scopes } = await loadListGuardMetadata();
    const [Guard] = guards;

    expect(
      guards.map((guard: { name?: string }) => guard.name),
    ).toEqual(["SessionOnlyGuard"]);
    expect(scopes).toBeUndefined();

    const guard = new Guard();
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            apiKeyMeta: { keyId: "key-1", scopes: ["READ", "WRITE", "TRADE"] },
          }),
        }),
      } as any),
    ).toThrow("This endpoint requires an authenticated user session");
  });
});
