import { describe, it, expect } from "vitest";
import { rejectPlaceholderSecrets } from "./reject-placeholder-secrets";

describe("rejectPlaceholderSecrets", () => {
  it("is a no-op when NODE_ENV is not production", () => {
    expect(() =>
      rejectPlaceholderSecrets("test-svc", ["SECRET"], {
        NODE_ENV: "development",
        SECRET: "CHANGE_ME_now",
      }),
    ).not.toThrow();
  });

  it("is a no-op when NODE_ENV is undefined", () => {
    expect(() =>
      rejectPlaceholderSecrets("test-svc", ["SECRET"], {
        SECRET: "CHANGE_ME_now",
      }),
    ).not.toThrow();
  });

  it.each([
    "CHANGE_ME",
    "CHANGE_ME_please",
    "dev-secret",
    "sk-ant-xxx-abc",
    "sk-xxx-abc",
    "dev-builder-key",
    "devpassword",
    "devredis123",
    "<GENERATE_ME>",
  ])("rejects value starting with %s in production", (placeholder) => {
    expect(() =>
      rejectPlaceholderSecrets("test-svc", ["MY_SECRET"], {
        NODE_ENV: "production",
        MY_SECRET: placeholder,
      }),
    ).toThrow("Placeholder secrets detected in production");
  });

  it("rejects all-zeros 64-char hex value in production", () => {
    const allZeros =
      "0000000000000000000000000000000000000000000000000000000000000000";
    expect(() =>
      rejectPlaceholderSecrets("test-svc", ["KEY"], {
        NODE_ENV: "production",
        KEY: allZeros,
      }),
    ).toThrow("Placeholder secrets detected");
  });

  it("does not reject a real-looking 64-char hex value", () => {
    const real =
      "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
    expect(() =>
      rejectPlaceholderSecrets("test-svc", ["KEY"], {
        NODE_ENV: "production",
        KEY: real,
      }),
    ).not.toThrow();
  });

  it("collects ALL violations into a single error, not just the first", () => {
    expect(() =>
      rejectPlaceholderSecrets("test-svc", ["A", "B", "C"], {
        NODE_ENV: "production",
        A: "CHANGE_ME_a",
        B: "dev-b",
        C: "real-value",
      }),
    ).toThrow(/A, B/);
  });

  it("skips undefined env vars without error", () => {
    expect(() =>
      rejectPlaceholderSecrets("test-svc", ["MISSING_KEY"], {
        NODE_ENV: "production",
      }),
    ).not.toThrow();
  });
});
