/**
 * Returns the production rate limit in prod, or a permissive limit in dev/test/CI
 * to prevent 429 errors during E2E and development.
 *
 * CI=true bypass: write-env-from-ci.sh sets CI=true in the CI .env. Without this
 * guard, NODE_ENV=production collapses the limit to prodLimit (e.g. 60/min), and
 * parallel E2E suites flood auth endpoints with 429s.
 */
export function throttleLimit(prodLimit: number): number {
  if (process.env.CI === 'true') return 10_000;
  return process.env.NODE_ENV === 'production' ? prodLimit : 10_000;
}
