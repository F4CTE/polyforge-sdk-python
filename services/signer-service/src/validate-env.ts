/**
 * Validates required environment variables for signer-service.
 * Extracted from main.ts for testability.
 */

import { rejectPlaceholderSecrets } from "@polyforge/shared-auth";

const REQUIRED_ENV = ["INTERNAL_JWT_SECRET", "ENCRYPTION_KEY", "REDIS_URL"];

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): void {
  const missing = REQUIRED_ENV.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `[signer-service] Missing required env vars: ${missing.join(", ")}`,
    );
  }

  if (env.NODE_ENV === "production") {
    const masterKey = env.MASTER_ENCRYPTION_KEY;
    if (!masterKey || masterKey === "0".repeat(64)) {
      throw new Error(
        "MASTER_ENCRYPTION_KEY must not be all-zeros in production",
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
