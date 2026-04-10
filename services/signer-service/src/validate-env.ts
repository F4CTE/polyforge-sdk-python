/**
 * Validates required environment variables for signer-service.
 * Extracted from main.ts for testability.
 */

import { rejectPlaceholderSecrets } from "@polyforge/shared-auth";

// MASTER_ENCRYPTION_KEY is the variable name read by EncryptionService;
// ENCRYPTION_KEY was a legacy name that was only in this validation list,
// causing startup to pass even when the operative variable was unset.
const REQUIRED_ENV = [
  "INTERNAL_JWT_SECRET",
  "MASTER_ENCRYPTION_KEY",
  "REDIS_URL",
  "POLY_BUILDER_API_KEY",
  "POLY_BUILDER_SECRET",
  "POLY_BUILDER_PASSPHRASE",
];

/** Regex for a valid 0x-prefixed 256-bit hex private key */
const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): void {
  const missing = REQUIRED_ENV.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `[signer-service] Missing required env vars: ${missing.join(", ")}`,
    );
  }

  // All-zeros guard: throws in non-dev, warns loudly in dev.
  const masterKey = env.MASTER_ENCRYPTION_KEY;
  if (!masterKey || masterKey === "0".repeat(64)) {
    if (env.NODE_ENV !== "development") {
      throw new Error(
        "MASTER_ENCRYPTION_KEY must not be all-zeros in non-development environments",
      );
    } else {
      process.stderr.write(
        "[signer-service] ⚠️  WARNING: MASTER_ENCRYPTION_KEY is all zeros — " +
          "encryption is effectively disabled. DO NOT use with real credentials " +
          "or promote this configuration to staging/production.\n",
      );
    }
  }

  // Validate GAS_SPONSOR_PRIVATE_KEY format when gas sponsorship is enabled
  const gasSponsorEnabled = (env.GAS_SPONSOR_ENABLED ?? "false") === "true";
  if (gasSponsorEnabled) {
    const gasKey = env.GAS_SPONSOR_PRIVATE_KEY;
    if (!gasKey || !PRIVATE_KEY_RE.test(gasKey)) {
      throw new Error(
        "GAS_SPONSOR_PRIVATE_KEY must be a valid 0x-prefixed 64-char hex string when gas sponsorship is enabled",
      );
    }
  }

  // Reject all known placeholder patterns in production
  rejectPlaceholderSecrets(
    "signer-service",
    [
      "INTERNAL_JWT_SECRET",
      "MASTER_ENCRYPTION_KEY",
      "POLY_BUILDER_API_KEY",
      "POLY_BUILDER_SECRET",
      "POLY_BUILDER_PASSPHRASE",
      ...(gasSponsorEnabled ? ["GAS_SPONSOR_PRIVATE_KEY"] : []),
    ],
    env,
  );
}
