/**
 * Global setup for E2E tests.
 *
 * Ensures clean state before the test suite starts:
 *   - Approves all seed users in the database (prevents ACCOUNT_PENDING)
 *   - Clears invite-only flag in Redis
 *   - Flushes throttle counters
 *   - Clears MailHog messages
 */
export default async function globalSetup() {
  const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:3001';
  const MAILHOG_URL = process.env.MAILHOG_URL ?? 'http://localhost:8025';

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

  // Clear invite-only Redis flag and approve all seed users
  try {
    const { execSync, execFileSync } = await import('child_process');

    const REDIS_PASS = process.env.REDIS_PASSWORD;

    if (REDIS_PASS) {
      // Disable invite-only mode (SET to 'false' so the env-var fallback is overridden)
      execFileSync('docker', [
        'exec', 'polyforge-dev-redis-1',
        'redis-cli', '-a', REDIS_PASS, 'SET', 'config:invite_only', 'false',
      ], { stdio: 'ignore', timeout: 5000 });
    } else {
      console.warn('[E2E setup] REDIS_PASSWORD is not set; skipping Redis invite cleanup');
    }

    // Approve ALL seed users — safety net in case the seed's updateMany didn't run
    // or the approved column was reset by a migration/rebuild.
    execSync(
      `docker exec polyforge-dev-postgres-1 psql -U poly -d polyforge -c "UPDATE users SET approved = true, \\"approvedAt\\" = NOW() WHERE approved = false AND suspended = false"`,
      { stdio: 'ignore', timeout: 5000 },
    );

    // Flush all throttle counters so E2E tests don't hit rate limits.
    // Keys use the format {<hash>:default}:hits and {<hash>:default}:blocked
    // as created by @nest-lab/throttler-storage-redis v1.x.
    if (REDIS_PASS) {
      const throttleKeys = execFileSync('docker', [
        'exec', 'polyforge-dev-redis-1',
        'redis-cli', '-a', REDIS_PASS, '--scan', '--pattern', '*:default}:*',
      ], { timeout: 5000 }).toString().trim().split('\n').filter(Boolean);

      if (throttleKeys.length > 0) {
        execFileSync('docker', [
          'exec', 'polyforge-dev-redis-1',
          'redis-cli', '-a', REDIS_PASS, 'DEL', ...throttleKeys,
        ], { stdio: 'ignore', timeout: 5000 });
      }
    }
  } catch {
    // Fallback: if Docker is not accessible, skip
    console.warn('[E2E setup] Could not clear Redis state — Docker may not be accessible');
  }
}
