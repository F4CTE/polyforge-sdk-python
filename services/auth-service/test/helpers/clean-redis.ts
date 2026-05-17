interface MinimalRedis {
  flushdb(): Promise<string>;
}

const DEFAULT_REDIS_PORT = '6379';

function assertTestRedis(redisUrl: string): void {
  const parsed = new URL(redisUrl);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  const port = parsed.port || DEFAULT_REDIS_PORT;

  const isLocalhost =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  if (!isLocalhost) {
    throw new Error(
      `Refusing to flushdb on non-local Redis.` +
        ` Host must be localhost, 127.0.0.1, or ::1.` +
        ` Got: ${hostname}`,
    );
  }

  if (port === DEFAULT_REDIS_PORT) {
    throw new Error(
      `Refusing to flushdb on default Redis port (${DEFAULT_REDIS_PORT}).` +
        ` Use a dedicated non-default port (e.g., 6380) for test Redis.`,
    );
  }
}

export async function cleanAuthRedis(
  redis: MinimalRedis,
  redisUrl: string,
): Promise<void> {
  assertTestRedis(redisUrl);

  await redis.flushdb();
}
