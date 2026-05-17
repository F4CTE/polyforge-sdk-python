import { execSync } from 'child_process';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const SCHEMA_PATH = 'prisma/schema.prisma';
const CONFIG_PATH = 'prisma/prisma.config.ts';

function assertTestDatabase(dbUrl: string): void {
  const parsed = new URL(dbUrl);
  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];

  if (!dbName || !/(^|[^a-z])test($|[^a-z])/i.test(dbName)) {
    throw new Error(
      `Refusing to run destructive Prisma operations on a non-test database. ` +
        `TEST_DATABASE_URL must target a dedicated test database whose name contains 'test' as a standalone word. ` +
        `Got database name: ${dbName || '<none>'}`,
    );
  }
}

export async function setup(): Promise<void> {
  const dbUrl = process.env.TEST_DATABASE_URL;
  const redisUrl = process.env.TEST_REDIS_URL;
  if (!dbUrl || !redisUrl) {
    const missing: string[] = [];
    if (!dbUrl) missing.push('TEST_DATABASE_URL');
    if (!redisUrl) missing.push('TEST_REDIS_URL');
    console.warn(
      `[global-setup] ${missing.join(' and ')} not set — real integration tests will skip.`,
    );
    return;
  }

  assertTestDatabase(dbUrl);

  const directUrl = new URL(dbUrl);
  directUrl.search = '';

  console.warn('[global-setup] Pushing schema to test DB...');
  try {
    execSync(
      `pnpm exec prisma db push --schema ${SCHEMA_PATH} --config ${CONFIG_PATH} --accept-data-loss`,
      {
        cwd: WORKSPACE_ROOT,
        env: {
          ...process.env,
          DIRECT_DATABASE_URL: directUrl.toString(),
          DATABASE_URL: dbUrl,
        },
        stdio: 'inherit',
      },
    );
    console.warn('[global-setup] Schema pushed successfully.');
  } catch (err) {
    console.error(
      '[global-setup] Schema push failed. Ensure the test DB is running:\n' +
        '  pnpm exec prisma db push --schema prisma/schema.prisma --config prisma/prisma.config.ts --accept-data-loss',
    );
    throw err;
  }
}
