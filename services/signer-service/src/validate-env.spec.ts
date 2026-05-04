import { describe, it, expect } from "vitest";
import { validateEnv } from "./validate-env";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Base env with all required vars set to valid values */
function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    INTERNAL_JWT_SECRET: "test-secret",
    ENCRYPTION_KEY: "a".repeat(64),
    REDIS_URL: "redis://localhost:6379",
    MASTER_ENCRYPTION_KEY: "b".repeat(64),
    CLOB_API_URL: "https://clob.polymarket.com",
    POLYGON_RPC_URL: "https://polygon-rpc.com",
    POLY_BUILDER_API_KEY: "test-api-key",
    POLY_BUILDER_SECRET: "test-secret-value",
    POLY_BUILDER_PASSPHRASE: "test-passphrase",
    ...overrides,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("validateEnv (N-L1)", () => {
  it("does not throw when all required env vars are present", () => {
    expect(() => validateEnv(validEnv())).not.toThrow();
  });

  it("throws when a required env var is missing", () => {
    expect(() =>
      validateEnv(validEnv({ INTERNAL_JWT_SECRET: undefined })),
    ).toThrow("Missing required env vars");
  });

  it("throws in production when MASTER_ENCRYPTION_KEY is all-zeros", () => {
    const env = validEnv({
      NODE_ENV: "production",
      MASTER_ENCRYPTION_KEY: "0".repeat(64),
    });

    expect(() => validateEnv(env)).toThrow(
      "MASTER_ENCRYPTION_KEY must not be all-zeros in non-development environments",
    );
  });

  it("does NOT throw in development when MASTER_ENCRYPTION_KEY is all-zeros", () => {
    const env = validEnv({
      NODE_ENV: "development",
      MASTER_ENCRYPTION_KEY: "0".repeat(64),
    });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it("throws when NODE_ENV is undefined and key is all-zeros", () => {
    // Undefined NODE_ENV is treated as non-development, so all-zeros is rejected
    const env = validEnv({
      MASTER_ENCRYPTION_KEY: "0".repeat(64),
    });

    expect(() => validateEnv(env)).toThrow(
      "MASTER_ENCRYPTION_KEY must not be all-zeros in non-development environments",
    );
  });

  it("allows a valid non-zero key in production", () => {
    const env = validEnv({
      NODE_ENV: "production",
      MASTER_ENCRYPTION_KEY: "a".repeat(64),
    });

    expect(() => validateEnv(env)).not.toThrow();
  });
});
