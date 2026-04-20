/**
 * Rejects COOKIE_SECURE=false in production.
 *
 * Call from each auth service's `validateEnv()` or `main.ts` bootstrap.
 * Only enforced when `NODE_ENV=production`.
 */
export function rejectInsecureCookies(
  serviceName: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.NODE_ENV !== "production") return;

  if (env.COOKIE_SECURE === "false") {
    throw new Error(
      `[${serviceName}] COOKIE_SECURE=false is forbidden in production. ` +
        `Session cookies must use the Secure flag over HTTPS.`,
    );
  }
}
