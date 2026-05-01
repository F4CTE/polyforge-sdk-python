import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { throttleLimit } from "./throttle-limit";

describe("throttleLimit (admin-auth)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCi = process.env.CI;

  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.CI;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalCi === undefined) delete process.env.CI;
    else process.env.CI = originalCi;
  });

  it("returns the prod limit in production", () => {
    process.env.NODE_ENV = "production";
    expect(throttleLimit(5)).toBe(5);
  });

  it("returns a permissive limit in development", () => {
    process.env.NODE_ENV = "development";
    expect(throttleLimit(5)).toBe(10_000);
  });

  it("bypasses prod limit when CI=true (parallel E2E shards must not 429)", () => {
    process.env.NODE_ENV = "production";
    process.env.CI = "true";
    expect(throttleLimit(5)).toBe(10_000);
  });
});
