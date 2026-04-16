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

  // Reject all known placeholder patterns in production
  rejectPlaceholderSecrets(
    "signer-service",
    [
      "INTERNAL_JWT_SECRET",
      "MASTER_ENCRYPTION_KEY",
      "POLY_BUILDER_API_KEY",
      "POLY_BUILDER_SECRET",
      "POLY_BUILDER_PASSPHRASE",
    ],
    env,
  );
}
