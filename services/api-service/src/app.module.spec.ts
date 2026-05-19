import { describe, expect, it } from "vitest";
import { getApiRateLimit } from "./common/api-rate-limit";

describe("API global rate limit", () => {
  it("keeps the production bucket even when CI is true", () => {
    expect(getApiRateLimit({ CI: "true", NODE_ENV: "production" })).toBe(120);
  });

  it("uses a higher shared bucket for CI E2E shards in non-production", () => {
    expect(getApiRateLimit({ CI: "true", NODE_ENV: "test" })).toBe(10000);
  });

  it("keeps the production bucket outside CI", () => {
    expect(getApiRateLimit({ CI: "false", NODE_ENV: "production" })).toBe(120);
  });

  it("keeps the development bucket outside CI", () => {
    expect(getApiRateLimit({ CI: "false", NODE_ENV: "development" })).toBe(
      1200,
    );
  });
});
