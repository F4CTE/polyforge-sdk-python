/**
 * Validates required environment variables for signer-service.
 * Extracted from main.ts for testability.
 */

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
        "CRITICAL: MASTER_ENCRYPTION_KEY must not be all-zeros or absent in production. " +
          "Generate with: openssl rand -hex 32",
      );
    }

    const totpKey = env.TOTP_ENCRYPTION_KEY;
    if (!totpKey || totpKey === "0".repeat(64)) {
      throw new Error(
        "CRITICAL: TOTP_ENCRYPTION_KEY must not be all-zeros or absent in production. " +
          "Generate with: openssl rand -hex 32",
      );
    }

    // Reject all-zero ENCRYPTION_KEY alias
    const encKey = env.ENCRYPTION_KEY;
    if (encKey === "0".repeat(64)) {
      throw new Error("ENCRYPTION_KEY must not be all-zeros in production");
    }

    // Reject default or weak JWT secrets across all services
    const jwtSecrets = [
      "INTERNAL_JWT_SECRET",
      "USER_JWT_SECRET",
      "BOT_JWT_SECRET",
      "ADMIN_JWT_SECRET",
    ];
    for (const secretKey of jwtSecrets) {
      const val = env[secretKey];
      if (!val) continue;
      if (
        val.startsWith("CHANGE_ME") ||
        val.startsWith("dev-") ||
        val.includes("change-in-production")
      ) {
        throw new Error(
          `${secretKey} must be changed from its default value in production. ` +
            "Generate with: openssl rand -hex 32",
        );
      }
      if (val.length < 32) {
        throw new Error(
          `${secretKey} must be at least 32 characters in production (got ${val.length})`,
        );
      }
    }

    // Reject mock CLOB API URL in production
    const clobUrl = env.CLOB_API_URL;
    if (!clobUrl || clobUrl.includes("mock")) {
      throw new Error(
        "CLOB_API_URL must point to real Polymarket API in production",
      );
    }
  }
}
