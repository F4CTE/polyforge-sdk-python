/**
 * Global setup for E2E tests.
 *
 * Ensures clean state before the test suite starts:
 *   - Clears invite-only flag in Redis
 *   - Clears MailHog messages
 */
export default async function globalSetup() {
  const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:3001';
  const MAILHOG_URL = process.env.MAILHOG_URL ?? 'http://localhost:8025';

  // Clear invite-only flag via direct Redis (through api-service config endpoint or direct)
  // The simplest approach: use the auth-service health check to verify it's up,
  // then clear MailHog and ensure invite_only is off.

  // Wait for auth-service to be healthy
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${AUTH_URL}/health`);
      if (res.ok) break;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Clear MailHog
  try {
    await fetch(`${MAILHOG_URL}/api/v1/messages`, { method: 'DELETE' });
  } catch {
    // MailHog may not be running
  }

  // Clear invite-only Redis flag by connecting directly
  // Uses a simple HTTP call to a known endpoint or env-based approach
  // For simplicity, we'll use the exec approach via Docker if available
  try {
    const { execSync } = await import('child_process');
    // Clear invite-only flag
    execSync('docker exec polyforge-dev-redis-1 redis-cli DEL config:invite_only', {
      stdio: 'ignore',
      timeout: 5000,
    });
    // Flush all throttle counters so E2E tests don't hit rate limits
    // Throttler keys follow the pattern: throttler:*
    execSync(
      'docker exec polyforge-dev-redis-1 redis-cli --scan --pattern "throttler:*" | xargs -r docker exec -i polyforge-dev-redis-1 redis-cli DEL',
      { stdio: 'ignore', timeout: 5000 },
    );
  } catch {
    // Fallback: if Docker is not accessible, skip
    console.warn('[E2E setup] Could not clear Redis state — Docker may not be accessible');
  }
}
