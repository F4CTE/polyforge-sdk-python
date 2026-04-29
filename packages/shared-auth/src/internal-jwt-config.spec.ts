import { describe, expect, it } from "vitest";
import {
  getInternalJwtConfig,
  validateInternalJwtConfig,
} from "./internal-jwt-config";

describe("internal JWT config", () => {
  it("returns trimmed audience and non-empty issuers", () => {
    expect(
      getInternalJwtConfig({
        INTERNAL_JWT_AUDIENCE: " api-service ",
        INTERNAL_JWT_ISSUERS: " auth-service, ,admin-api-service ",
      }),
    ).toEqual({
      audience: "api-service",
      issuer: ["auth-service", "admin-api-service"],
    });
  });

  it("rejects missing audience", () => {
    expect(() =>
      getInternalJwtConfig({
        INTERNAL_JWT_ISSUERS: "auth-service",
      }),
    ).toThrow("INTERNAL_JWT_AUDIENCE environment variable is required");
  });

  it("rejects blank audience", () => {
    expect(() =>
      getInternalJwtConfig({
        INTERNAL_JWT_AUDIENCE: "  ",
        INTERNAL_JWT_ISSUERS: "auth-service",
      }),
    ).toThrow("INTERNAL_JWT_AUDIENCE environment variable is required");
  });

  it("rejects missing issuers", () => {
    expect(() =>
      getInternalJwtConfig({
        INTERNAL_JWT_AUDIENCE: "api-service",
      }),
    ).toThrow("INTERNAL_JWT_ISSUERS environment variable is required");
  });

  it("rejects blank issuers", () => {
    expect(() =>
      getInternalJwtConfig({
        INTERNAL_JWT_AUDIENCE: "api-service",
        INTERNAL_JWT_ISSUERS: " , ",
      }),
    ).toThrow("INTERNAL_JWT_ISSUERS environment variable is required");
  });

  it("adds service context for startup validation errors", () => {
    expect(() =>
      validateInternalJwtConfig("api-service", {
        INTERNAL_JWT_AUDIENCE: "api-service",
      }),
    ).toThrow(
      "[api-service] INTERNAL_JWT_ISSUERS environment variable is required",
    );
  });
});
