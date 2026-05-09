import { readFileSync } from "node:fs";
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

  it("rejects the checked-in dev encryption keys in production", () => {
    const envExample = readFileSync("../../.env.dev.example", "utf8");
    const env = Object.fromEntries(
      envExample
        .split(/\r?\n/)
        .filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => line.split("=", 2) as [string, string]),
    );

    expect(() =>
      rejectPlaceholderSecrets(
        "test-svc",
        ["MASTER_ENCRYPTION_KEY", "TOTP_ENCRYPTION_KEY"],
        {
          ...env,
          NODE_ENV: "production",
        },
      ),
    ).toThrow(/MASTER_ENCRYPTION_KEY, TOTP_ENCRYPTION_KEY/);
  });

  it.each([
    "A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2",
    "A1b2c3D4E5f6A7B8c9d0E1F2a3B4c5d6E7f8A9b0C1D2e3f4A5B6C7d8e9f0A1b2",
    "B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3",
    "  a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2  ",
  ])(
    "rejects case/whitespace variant of known-bad encryption key",
    (variant) => {
      expect(() =>
        rejectPlaceholderSecrets("test-svc", ["KEY"], {
          NODE_ENV: "production",
          KEY: variant,
        }),
      ).toThrow("Placeholder secrets detected");
    },
  );

  it("does not reject a real-looking 64-char hex value", () => {
    const real =
      "3f9d2a7c8b1e4f506a9d3c2b8e7f4a1d5c0b9e8a7f6d5c4b3a291807f6e5d4c3";
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
