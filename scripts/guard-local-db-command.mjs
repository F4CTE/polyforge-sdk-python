#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const separatorIndex = process.argv.indexOf("--");
const command = process.argv[separatorIndex + 1];
const args = process.argv.slice(separatorIndex + 2);

if (separatorIndex === -1 || !command) {
  console.error(
    "Usage: node scripts/guard-local-db-command.mjs -- <command> [args...]",
  );
  process.exit(2);
}

const isCi = process.env.CI && process.env.CI !== "false";
const isProduction = process.env.NODE_ENV === "production";
const hasOverride = process.env.POLYFORGE_ALLOW_DEV_DB_MUTATION === "1";

if (!hasOverride && (isCi || isProduction)) {
  console.error(
    "Refusing to run local database command in CI or production. Set POLYFORGE_ALLOW_DEV_DB_MUTATION=1 only for an intentional local maintenance run.",
  );
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal) {
  console.error(`Command terminated by signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
