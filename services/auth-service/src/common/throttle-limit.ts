/**
 * Returns the production rate limit in prod, or a permissive limit in dev/test
 * to prevent 429 errors during E2E and development.
 */
export function throttleLimit(prodLimit: number): number {
  return process.env.NODE_ENV === 'production' ? prodLimit : 10_000;
}
