/**
 * Validates required environment variables for signer-service.
 * Extracted from main.ts for testability.
 */

const REQUIRED_ENV = ['INTERNAL_JWT_SECRET', 'ENCRYPTION_KEY', 'REDIS_URL'];

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): void {
  const missing = REQUIRED_ENV.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `[signer-service] Missing required env vars: ${missing.join(', ')}`,
    );
  }

  if (env.NODE_ENV === 'production') {
    const masterKey = env.MASTER_ENCRYPTION_KEY;
    if (masterKey === '0'.repeat(64)) {
      throw new Error(
        'MASTER_ENCRYPTION_KEY must not be all-zeros in production',
      );
    }

    // Reject default JWT secrets in production
    if (
      env.INTERNAL_JWT_SECRET?.startsWith('CHANGE_ME') ||
      env.INTERNAL_JWT_SECRET?.startsWith('dev-')
    ) {
      throw new Error(
        'INTERNAL_JWT_SECRET must be changed from default in production',
      );
    }

    // Reject all-zero ENCRYPTION_KEY alias
    const encKey = env.ENCRYPTION_KEY;
    if (encKey === '0'.repeat(64)) {
      throw new Error(
        'ENCRYPTION_KEY must not be all-zeros in production',
      );
    }

    // Reject mock CLOB API URL in production
    const clobUrl = env.CLOB_API_URL;
    if (!clobUrl || clobUrl.includes('mock')) {
      throw new Error(
        'CLOB_API_URL must point to real Polymarket API in production',
      );
    }
  }
}
