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

  // All-zeros guard applies outside development so staging deployments
  // over HTTPS do not silently accept a weak key.
  if (env.NODE_ENV !== "development") {
    const masterKey = env.MASTER_ENCRYPTION_KEY;
    if (!masterKey || masterKey === "0".repeat(64)) {
      throw new Error(
        "MASTER_ENCRYPTION_KEY must not be all-zeros in non-development environments",
      );
    }
  }

  // Reject all known placeholder patterns in production
  rejectPlaceholderSecrets(
    "signer-service",
    ["INTERNAL_JWT_SECRET", "MASTER_ENCRYPTION_KEY"],
    env,
  );
}
