import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicConfig = readFileSync("openapi-ts.config.ts", "utf8");
const adminConfig = readFileSync("openapi-ts.admin.config.ts", "utf8");

const adminOnlyMatchMutations = [
  "POST /api/v1/arbitrage/matches",
  "POST /api/v1/arbitrage/matches/{matchId}/verify",
  "DELETE /api/v1/arbitrage/matches/{matchId}",
  "POST /api/v1/arbitrage/matches/sync",
];

test("public TypeScript SDK generation excludes admin-only arbitrage match mutations", () => {
  assert.match(publicConfig, /operations:\s*{\s*exclude:/s);

  for (const operation of adminOnlyMatchMutations) {
    assert.match(
      publicConfig,
      new RegExp(operation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});

test("public TypeScript SDK generation still exposes read-only arbitrage match endpoints", () => {
  assert.doesNotMatch(publicConfig, /GET \/api\/v1\/arbitrage\/matches/);
  assert.doesNotMatch(
    publicConfig,
    /GET \/api\/v1\/arbitrage\/matches\/\{matchId\}/,
  );
});

test("admin TypeScript SDK generation keeps the admin-only match mutations available", () => {
  assert.match(adminConfig, /output:\s*'packages\/api-client\/src\/generated\/admin'/);

  for (const operation of adminOnlyMatchMutations) {
    assert.doesNotMatch(
      adminConfig,
      new RegExp(operation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});
