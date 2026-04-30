import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const EXPECTED_PGBOUNCER_IMAGE = "edoburu/pgbouncer:1.23.1";
const FORBIDDEN_PGBOUNCER_IMAGE = "edoburu/pgbouncer:latest";

const PGBOUNCER_PINNED_FILES = [
  "docker-compose.infra.yml",
  "docker-compose.prod.yml",
  ".github/workflows/runner-setup.yml",
  "docs/11-config-files-setup.md",
];

test("PgBouncer Docker image references are pinned", () => {
  for (const filePath of PGBOUNCER_PINNED_FILES) {
    const content = readFileSync(filePath, "utf8");
    const references = content.match(/edoburu\/pgbouncer:[^\s"'#]+/g) ?? [];

    assert.notEqual(
      references.length,
      0,
      `${filePath} should contain PgBouncer image references`,
    );
    assert.ok(
      !references.includes(FORBIDDEN_PGBOUNCER_IMAGE),
      `${filePath} must not use ${FORBIDDEN_PGBOUNCER_IMAGE}`,
    );
    assert.deepEqual(
      [...new Set(references)],
      [EXPECTED_PGBOUNCER_IMAGE],
      `${filePath} should pin PgBouncer to ${EXPECTED_PGBOUNCER_IMAGE}`,
    );
  }
});
