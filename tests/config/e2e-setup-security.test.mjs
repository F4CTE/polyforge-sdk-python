import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const GLOBAL_SETUP = "tests/e2e/global-setup.ts";

test("E2E global setup does not embed a Redis password fallback", () => {
  const source = readFileSync(GLOBAL_SETUP, "utf8");

  assert.ok(
    source.includes("process.env.REDIS_PASSWORD"),
    "global setup should read Redis auth from REDIS_PASSWORD",
  );
  assert.ok(
    !/process\.env\.REDIS_PASSWORD\s*(\?\?|\|\|)\s*['"]/.test(source),
    "global setup must not fall back to a checked-in Redis password",
  );
  assert.ok(
    !/REDIS_PASS\s*=\s*['"]/.test(source),
    "REDIS_PASS must not be assigned from a string literal",
  );
});
