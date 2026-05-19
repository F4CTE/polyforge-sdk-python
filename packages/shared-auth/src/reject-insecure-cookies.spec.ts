import { describe, it, expect } from "vitest";
import { rejectInsecureCookies } from "./reject-insecure-cookies";

describe("rejectInsecureCookies", () => {
  it("throws when COOKIE_SECURE=false in production", () => {
    expect(() =>
      rejectInsecureCookies("test-service", {
        NODE_ENV: "production",
        COOKIE_SECURE: "false",
      }),
    ).toThrow("COOKIE_SECURE=false is forbidden in production");
  });

  it("does not throw when COOKIE_SECURE is unset in production", () => {
    expect(() =>
      rejectInsecureCookies("test-service", {
        NODE_ENV: "production",
      }),
    ).not.toThrow();
  });

  it("does not throw when COOKIE_SECURE=true in production", () => {
    expect(() =>
      rejectInsecureCookies("test-service", {
        NODE_ENV: "production",
        COOKIE_SECURE: "true",
      }),
    ).not.toThrow();
  });

  it("allows COOKIE_SECURE=false outside production", () => {
    expect(() =>
      rejectInsecureCookies("test-service", {
        NODE_ENV: "development",
        COOKIE_SECURE: "false",
      }),
    ).not.toThrow();
  });

  it("allows COOKIE_SECURE=false when NODE_ENV is unset", () => {
    expect(() =>
      rejectInsecureCookies("test-service", {
        COOKIE_SECURE: "false",
      }),
    ).not.toThrow();
  });

  it("throws when COOKIE_SECURE=false in production when CI=true", () => {
    expect(() =>
      rejectInsecureCookies("test-service", {
        NODE_ENV: "production",
        COOKIE_SECURE: "false",
        CI: "true",
      }),
    ).toThrow("COOKIE_SECURE=false is forbidden in production");
  });

  it("still throws in production when CI is not true", () => {
    expect(() =>
      rejectInsecureCookies("test-service", {
        NODE_ENV: "production",
        COOKIE_SECURE: "false",
        CI: "false",
      }),
    ).toThrow("COOKIE_SECURE=false is forbidden in production");
  });

  it("includes service name in error message", () => {
    expect(() =>
      rejectInsecureCookies("my-auth", {
        NODE_ENV: "production",
        COOKIE_SECURE: "false",
      }),
    ).toThrow("[my-auth]");
  });
});
