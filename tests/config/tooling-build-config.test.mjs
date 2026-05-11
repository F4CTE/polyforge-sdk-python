import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
const runScriptWithStubbedBuild = (script, env) =>
  spawnSync("bash", ["-lc", script], {
    cwd: "/",
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      ...env,
    },
  });

test("turbo task hashes include tooling files that affect lint, typecheck, and wasm builds", () => {
  const turbo = readJson("turbo.json");

  for (const dependency of turbo.globalDependencies ?? []) {
    if (!dependency.includes("*")) {
      assert.ok(
        existsSync(dependency),
        `globalDependency ${dependency} must point at a repository file, not a binary name`,
      );
    }
  }

  assert.deepEqual(turbo.tasks.lint.inputs, [
    "$TURBO_DEFAULT$",
    "$TURBO_ROOT$/eslint.config.mjs",
  ]);

  assert.deepEqual(turbo.tasks.typecheck.inputs, [
    "$TURBO_DEFAULT$",
    "**/*.d.ts",
    "$TURBO_ROOT$/tsconfig.json",
  ]);

  assert.ok(
    turbo.tasks.build.dependsOn.includes("build:wasm"),
    "normal builds must depend on same-package build:wasm tasks when present",
  );
  assert.notEqual(
    turbo.tasks["build:wasm"].cache,
    false,
    "build:wasm must be cacheable so input changes can invalidate it",
  );
  assert.deepEqual(turbo.tasks["build:wasm"].inputs, [
    "$TURBO_DEFAULT$",
    "!target/**",
  ]);
});

test("landing app participates in repo lint, typecheck, and test workflows", () => {
  const landing = readJson("apps/landing/package.json");

  assert.equal(landing.scripts.lint, 'eslint "app/**/*.{ts,tsx}" *.ts --fix');
  assert.equal(landing.scripts.typecheck, "tsc --noEmit");
  assert.equal(landing.scripts.test, "pnpm run typecheck");
});

test("wasm package build tasks keep the CI prebuilt-artifact contract", () => {
  const wasmPackages = [
    "packages/polyforge-crypto/package.json",
    "packages/polyforge-engine/package.json",
  ];

  for (const packagePath of wasmPackages) {
    const manifest = readJson(packagePath);
    const script = manifest.scripts["build:wasm"];

    assert.equal(
      manifest.scripts.build,
      script,
      `${packagePath} build must use the same WASM build contract as build:wasm`,
    );

    const ciRun = runScriptWithStubbedBuild(script, { CI: "true" });

    assert.equal(
      ciRun.status,
      0,
      `${packagePath} build:wasm must not require wasm-pack in CI: ${ciRun.stderr}`,
    );
    assert.match(
      ciRun.stdout,
      /CI: using pre-built WASM artifacts/,
      `${packagePath} build:wasm must announce the CI prebuilt-artifact path`,
    );

    const localRun = runScriptWithStubbedBuild(script, { CI: "" });

    assert.notEqual(
      localRun.status,
      0,
      `${packagePath} build:wasm must attempt the local fallback outside CI`,
    );
    assert.match(
      localRun.stderr,
      /bash: .*build\.sh: No such file or directory/,
      `${packagePath} build:wasm must execute bash build.sh outside CI`,
    );
  }
});

test("local database mutation scripts are guarded outside explicit local use", () => {
  const rootManifest = readJson("package.json");
  const guardedScripts = [
    "migrate:dev",
    "migrate:dev:admin",
    "seed",
    "seed:admin",
  ];

  for (const scriptName of guardedScripts) {
    assert.match(
      rootManifest.scripts[scriptName],
      /^node scripts\/guard-local-db-command\.mjs -- /,
      `${scriptName} must run through the local DB command guard`,
    );
  }

  const blocked = spawnSync(
    process.execPath,
    [
      "scripts/guard-local-db-command.mjs",
      "--",
      process.execPath,
      "-e",
      "process.exit(0)",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "true",
        POLYFORGE_ALLOW_DEV_DB_MUTATION: "",
      },
    },
  );

  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /Refusing to run local database command/);

  const allowed = spawnSync(
    process.execPath,
    [
      "scripts/guard-local-db-command.mjs",
      "--",
      process.execPath,
      "-e",
      "process.exit(0)",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "true",
        POLYFORGE_ALLOW_DEV_DB_MUTATION: "1",
      },
    },
  );

  assert.equal(allowed.status, 0, allowed.stderr);
});

test("no service carries uuid as a phantom runtime dependency", () => {
  const services = [
    "services/api-service/package.json",
    "services/order-service/package.json",
    "services/signer-service/package.json",
    "services/strategy-engine/package.json",
  ];

  for (const serviceManifest of services) {
    const manifest = readJson(serviceManifest);

    assert.equal(
      manifest.dependencies?.uuid,
      undefined,
      `${serviceManifest} must not carry the removed uuid phantom dep`,
    );
    assert.equal(
      manifest.devDependencies?.["@types/uuid"],
      undefined,
      `${serviceManifest} must not carry the deprecated @types/uuid stub`,
    );
  }
});
