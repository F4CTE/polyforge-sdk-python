import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SEED_FILES = [
  "prisma/seed.ts",
  "prisma/seed.admin.ts",
  "prisma/seed.js",
  "prisma/seed.admin.js",
];

const SENSITIVE_PASSWORD_IDENTIFIERS =
  /\b(?:seedPassword|adminPassword)\b/;
const PASSWORD_LOG_POINTER = /password shown at seed start/i;

test("seed scripts do not print generated passwords", () => {
  for (const filePath of SEED_FILES) {
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    const leaks = lines
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => /console\.(?:log|warn|error)\s*\(/.test(line))
      .filter(
        ({ line }) =>
          SENSITIVE_PASSWORD_IDENTIFIERS.test(line) ||
          PASSWORD_LOG_POINTER.test(line),
      );

    assert.deepEqual(
      leaks,
      [],
      `${filePath} must not print generated seed/admin passwords`,
    );
  }
});
