/**
 * Rejects known placeholder/dev secrets in production.
 *
 * Call from each service's `validateEnv()` or `main.ts` bootstrap.
 * Only enforced when `NODE_ENV=production`.
 */

const PLACEHOLDER_PREFIXES = [
  "CHANGE_ME",
  "dev-",
  "sk-ant-xxx",
  "sk-xxx",
  "dev-builder-",
  "devpass",
  "devredis",
  "<GENERATE_ME>",
];

const ALL_ZEROS_64 =
  "0000000000000000000000000000000000000000000000000000000000000000";

const KNOWN_BAD_VALUES = new Set([
  "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
]);

function isPlaceholder(value: string): boolean {
  if (value === ALL_ZEROS_64) return true;
  if (KNOWN_BAD_VALUES.has(value.trim().toLowerCase())) return true;
  return PLACEHOLDER_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/**
 * Validates that the given env vars do not contain placeholder values
 * when running in production. Throws if any are detected.
 *
 * @param serviceName  Human-readable service name for error messages
 * @param secretKeys   Env var names to check
 * @param env          Environment object (defaults to `process.env`)
 */
export function rejectPlaceholderSecrets(
  serviceName: string,
  secretKeys: string[],
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.NODE_ENV !== "production") return;

  const violations: string[] = [];

  for (const key of secretKeys) {
    const value = env[key];
    if (value && isPlaceholder(value)) {
      violations.push(key);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `[${serviceName}] Placeholder secrets detected in production: ${violations.join(", ")}. ` +
        `Replace with real values from your secrets manager.`,
    );
  }
}
