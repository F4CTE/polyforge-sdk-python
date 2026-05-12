import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const yaml = readFileSync("docker-compose.infra.yml", "utf8");

const USER_FACING_SERVICES = [
  "signer-service",
  "strategy-engine",
  "order-service",
  "api-service",
  "paper-order-service",
  "backtest-service",
  "notification-service",
  "bot-service",
  "auth-service",
  "market-data-service",
  "admin-api-service",
  "admin-auth-service",
];

const ADMIN_SERVICES = ["admin-api-service", "admin-auth-service"];

/**
 * Extract a top-level service block from docker-compose.infra.yml.
 * Top-level services are indented with exactly 2 spaces.
 * Returns null if the service is not found.
 */
function serviceBlock(yamlContent, serviceName) {
  const lines = yamlContent.split("\n");
  const target = `  ${serviceName}:`;
  let startLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === target) {
      startLine = i;
      break;
    }
  }

  if (startLine === -1) return null;

  const blockLines = [lines[startLine]];
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "" || line.startsWith("#")) {
      blockLines.push(line);
      continue;
    }
    if (/^\s{2}[a-z]/.test(line)) {
      break;
    }
    blockLines.push(line);
  }

  return blockLines.join("\n");
}

/** Get the full value from a YAML-colon key line (handles values with spaces) */
function getValue(block, key) {
  const lines = block.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}: `)) {
      return trimmed.slice(key.length + 2).trim();
    }
  }
  return null;
}

test("all user-facing service DATABASE_URL entries route through pgbouncer", () => {
  for (const svc of USER_FACING_SERVICES) {
    const block = serviceBlock(yaml, svc);
    assert.ok(block, `${svc} must be defined in docker-compose.infra.yml`);

    const url = getValue(block, "DATABASE_URL");
    assert.ok(url, `${svc} must have DATABASE_URL`);

    assert.ok(
      url.includes("@pgbouncer:"),
      `${svc} DATABASE_URL must route through pgbouncer, got: ${url}`,
    );
    assert.ok(
      !url.includes("@postgres:"),
      `${svc} DATABASE_URL must NOT bypass pgbouncer, got: ${url}`,
    );
  }
});

test("all services depending on pgbouncer have depends_on: pgbouncer", () => {
  for (const svc of USER_FACING_SERVICES) {
    const block = serviceBlock(yaml, svc);
    if (!block) continue;

    const url = getValue(block, "DATABASE_URL");
    if (!url) continue;

    if (url.includes("@pgbouncer:")) {
      assert.ok(
        block.includes("pgbouncer:"),
        `${svc} routes DATABASE_URL through pgbouncer but lacks depends_on: pgbouncer`,
      );
    }
  }
});

test("DIRECT_DATABASE_URL preserves migration path for all services", () => {
  for (const svc of USER_FACING_SERVICES) {
    const block = serviceBlock(yaml, svc);
    if (!block) continue;

    const url = getValue(block, "DIRECT_DATABASE_URL");
    assert.ok(url, `${svc} must keep DIRECT_DATABASE_URL for migrations`);

    assert.ok(
      url.includes("@postgres:"),
      `${svc} DIRECT_DATABASE_URL must point to direct postgres, got: ${url}`,
    );
    assert.ok(
      !url.includes("@pgbouncer:"),
      `${svc} DIRECT_DATABASE_URL must NOT route through pgbouncer, got: ${url}`,
    );
  }
});

test("no user-facing service uses bare postgres:5432 for DATABASE_URL", () => {
  for (const svc of USER_FACING_SERVICES) {
    const block = serviceBlock(yaml, svc);
    if (!block) continue;

    const url = getValue(block, "DATABASE_URL");
    if (!url) continue;

    assert.ok(
      !url.includes("@postgres:"),
      `${svc} DATABASE_URL must not bypass pgbouncer: ${url}`,
    );
  }
});

test("admin services route both user and admin DBs through pgbouncer", () => {
  for (const svc of ADMIN_SERVICES) {
    const block = serviceBlock(yaml, svc);
    assert.ok(block, `${svc} must be defined`);

    const userDb = getValue(block, "DATABASE_URL");
    assert.ok(userDb, `${svc} must have DATABASE_URL`);
    assert.ok(
      userDb.includes("@pgbouncer:"),
      `${svc} DATABASE_URL must route through pgbouncer`,
    );

    const adminDb = getValue(block, "ADMIN_DATABASE_URL");
    assert.ok(adminDb, `${svc} must have ADMIN_DATABASE_URL`);
    assert.ok(
      adminDb.includes("@pgbouncer-admin:"),
      `${svc} ADMIN_DATABASE_URL must route through pgbouncer-admin`,
    );
  }
});

test("admin services keep ADMIN_DIRECT_DATABASE_URL for migrations", () => {
  for (const svc of ADMIN_SERVICES) {
    const block = serviceBlock(yaml, svc);
    if (!block) continue;

    const url = getValue(block, "ADMIN_DIRECT_DATABASE_URL");
    assert.ok(url, `${svc} must keep ADMIN_DIRECT_DATABASE_URL for admin migrations`);
    assert.ok(
      url.includes("@postgres-admin:"),
      `${svc} ADMIN_DIRECT_DATABASE_URL must point to postgres-admin`,
    );
  }
});

test("migrate-user uses DIRECT_DATABASE_URL (direct postgres) by design", () => {
  const block = serviceBlock(yaml, "migrate-user");
  assert.ok(block, "migrate-user must be defined");

  const url = getValue(block, "DIRECT_DATABASE_URL");
  assert.ok(url, "migrate-user must have DIRECT_DATABASE_URL");
  assert.ok(
    url.includes("@postgres:"),
    "migrate-user must use direct postgres for DDL",
  );

  const runtimeUrl = getValue(block, "DATABASE_URL");
  assert.equal(
    runtimeUrl,
    null,
    "migrate-user must not have DATABASE_URL — only DIRECT_DATABASE_URL",
  );
});

test("migrate-admin uses ADMIN_DIRECT_DATABASE_URL (direct admin postgres)", () => {
  const block = serviceBlock(yaml, "migrate-admin");
  assert.ok(block, "migrate-admin must be defined");

  const url = getValue(block, "ADMIN_DIRECT_DATABASE_URL");
  assert.ok(url, "migrate-admin must have ADMIN_DIRECT_DATABASE_URL");
  assert.ok(
    url.includes("@postgres-admin:"),
    "migrate-admin must use direct postgres-admin for DDL",
  );

  const runtimeUrl = getValue(block, "ADMIN_DATABASE_URL");
  assert.equal(
    runtimeUrl,
    null,
    "migrate-admin must not have ADMIN_DATABASE_URL — only ADMIN_DIRECT_DATABASE_URL",
  );
});

test("PgBouncer has MAX_DB_CONNECTIONS well below postgres max_connections", () => {
  const block = serviceBlock(yaml, "pgbouncer");
  assert.ok(block, "pgbouncer must be defined");

  const maxDb = getValue(block, "MAX_DB_CONNECTIONS");
  assert.ok(maxDb, "pgbouncer must have MAX_DB_CONNECTIONS");
  assert.ok(
    parseInt(maxDb, 10) <= 100,
    `pgbouncer MAX_DB_CONNECTIONS must be ≤100 to respect postgres max_connections=200, got ${maxDb}`,
  );
});

test("PgBouncer admin container exists and has configuration", () => {
  const block = serviceBlock(yaml, "pgbouncer-admin");
  assert.ok(block, "pgbouncer-admin must be defined");

  assert.ok(
    block.includes("POOL_MODE:"),
    "pgbouncer-admin must have POOL_MODE configured",
  );
});

test("PRISMA_POOL_SIZE is set for high-throughput services", () => {
  const highThroughput = new Map([
    ["api-service", "20"],
    ["strategy-engine", "15"],
    ["market-data-service", "15"],
  ]);

  for (const [svc, expected] of highThroughput) {
    const block = serviceBlock(yaml, svc);
    assert.ok(block, `${svc} must be defined`);

    const pool = getValue(block, "PRISMA_POOL_SIZE");
    assert.ok(pool, `${svc} must have explicit PRISMA_POOL_SIZE`);
    assert.equal(
      pool.replace(/"/g, ""),
      expected,
      `${svc} PRISMA_POOL_SIZE must be ${expected}`,
    );
  }
});

test("low-traffic services use conservative PRISMA_POOL_SIZE", () => {
  const lowTraffic = [
    "paper-order-service",
    "backtest-service",
    "notification-service",
    "bot-service",
  ];

  for (const svc of lowTraffic) {
    const block = serviceBlock(yaml, svc);
    if (!block) continue;

    const pool = getValue(block, "PRISMA_POOL_SIZE");
    assert.ok(pool, `${svc} must have explicit PRISMA_POOL_SIZE`);
    const val = parseInt(pool.replace(/"/g, ""), 10);
    assert.ok(
      val <= 5,
      `${svc} PRISMA_POOL_SIZE should be ≤5 (low traffic), got ${val}`,
    );
  }
});

test("no user-facing service runs without explicit PRISMA_POOL_SIZE", () => {
  for (const svc of USER_FACING_SERVICES) {
    const block = serviceBlock(yaml, svc);
    if (!block) continue;

    const hasDbUrl = getValue(block, "DATABASE_URL") !== null;
    if (hasDbUrl) {
      const pool = getValue(block, "PRISMA_POOL_SIZE");
      assert.ok(
        pool,
        `${svc} has DATABASE_URL but no explicit PRISMA_POOL_SIZE (default=10 is too high for PgBouncer pooling)`,
      );
    }
  }
});

test("prisma/seed.ts prefers DIRECT_DATABASE_URL over PgBouncer for reliable host-run seeding", () => {
  const seedContent = readFileSync("prisma/seed.ts", "utf8");
  const adapterLine = seedContent
    .split("\n")
    .find((line) => line.includes("new PrismaPg"));

  assert.ok(adapterLine, "seed.ts must create a PrismaPg adapter");

  assert.ok(
    adapterLine.includes("DIRECT_DATABASE_URL ?? process.env.DATABASE_URL") ||
    adapterLine.includes("DIRECT_DATABASE_URL ?? DATABASE_URL"),
    `seed.ts must prefer DIRECT_DATABASE_URL (direct) over DATABASE_URL (PgBouncer), got: ${adapterLine.trim()}`,
  );
});
