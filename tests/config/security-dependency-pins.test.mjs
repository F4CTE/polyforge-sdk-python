import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const LOCKED_TYPESCRIPT_VERSION = "5.9.3";
const POLYMARKET_US_VERSION = "0.1.1";

test("polymarket-us is exact-pinned in order-service manifests", () => {
  const manifest = JSON.parse(
    readFileSync("services/order-service/package.json", "utf8"),
  );
  const lockfile = readFileSync("pnpm-lock.yaml", "utf8");

  assert.equal(
    manifest.dependencies["polymarket-us"],
    POLYMARKET_US_VERSION,
    "order-service must exact-pin polymarket-us",
  );
  assert.match(
    lockfile,
    /polymarket-us:\n\s+specifier: 0\.1\.1\n\s+version: 0\.1\.1/,
    "pnpm lockfile importer must record the exact polymarket-us specifier",
  );
});

test("browser PostHog clients mask replay text and element attributes", () => {
  const analyticsFiles = [
    "apps/user-app/src/lib/analytics.ts",
    "apps/admin-app/src/lib/analytics.ts",
    "apps/landing/app/providers.tsx",
  ];

  for (const filePath of analyticsFiles) {
    const content = readFileSync(filePath, "utf8");

    assert.match(
      content,
      /mask_all_text:\s*true/,
      `${filePath} must mask all captured text`,
    );
    assert.match(
      content,
      /mask_all_element_attributes:\s*true/,
      `${filePath} must mask captured element attributes`,
    );
    assert.doesNotMatch(
      content,
      /mask_all_text:\s*false/,
      `${filePath} must not disable text masking`,
    );
  }
});

test("service Docker builders install the project TypeScript compiler exactly", () => {
  const dockerfiles = readdirSync("services", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join("services", entry.name, "Dockerfile"))
    .filter((filePath) => {
      try {
        readFileSync(filePath, "utf8");
        return true;
      } catch {
        return false;
      }
    });

  assert.ok(dockerfiles.length > 0, "expected service Dockerfiles to exist");

  for (const filePath of dockerfiles) {
    const content = readFileSync(filePath, "utf8");
    const matches = [
      ...content.matchAll(/npm install -g typescript@([^\s\\]+)/g),
    ].map((match) => match[1]);

    if (matches.length === 0) continue;

    assert.deepEqual(
      [...new Set(matches)],
      [LOCKED_TYPESCRIPT_VERSION],
      `${filePath} must install TypeScript ${LOCKED_TYPESCRIPT_VERSION}`,
    );
  }
});

test("service Docker production installs skip root prepare scripts", () => {
  const dockerfiles = readdirSync("services", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join("services", entry.name, "Dockerfile"))
    .filter((filePath) => {
      try {
        readFileSync(filePath, "utf8");
        return true;
      } catch {
        return false;
      }
    });

  for (const filePath of dockerfiles) {
    const content = readFileSync(filePath, "utf8");
    const prodInstalls = [
      ...content.matchAll(/pnpm install --filter [^\n]+ --prod[^\n]*/g),
    ].map((match) => match[0]);

    for (const installCommand of prodInstalls) {
      assert.match(
        installCommand,
        /--ignore-scripts\b/,
        `${filePath} production install must not run the root prepare script`,
      );
    }
  }
});
