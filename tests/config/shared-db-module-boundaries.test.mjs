import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SERVICES_DIR = "services";
const SHARED_DB_INDEX = "packages/shared-db/src/index.ts";
const SHARED_USER_DB_MODULE = "packages/shared-db/src/shared-user-db.module.ts";
const SHARED_ADMIN_DB_MODULE = "packages/shared-db/src/shared-admin-db.module.ts";
const LEGACY_MODULE = "packages/shared-db/src/shared-db.module.ts";

const ADMIN_SERVICE_DIRS = new Set([
  "admin-auth-service",
  "admin-api-service",
]);

function read(filePath) {
  return readFileSync(filePath, "utf8");
}

function findTsFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findTsFiles(fullPath);
    if (entry.name.endsWith(".ts")) return [fullPath];
    return [];
  });
}

function isAdminService(filePath) {
  const relative = path.relative(SERVICES_DIR, filePath);
  const topDir = relative.split(path.sep)[0];
  return ADMIN_SERVICE_DIRS.has(topDir);
}

test("shared-db index exports split modules, not combined SharedDbModule", () => {
  const index = read(SHARED_DB_INDEX);

  assert.ok(
    index.includes("SharedUserDbModule"),
    "index.ts must export SharedUserDbModule",
  );
  assert.ok(
    index.includes("SharedAdminDbModule"),
    "index.ts must export SharedAdminDbModule",
  );
  assert.ok(
    !/export\s+\{[^}]*\bSharedDbModule\b[^}]*\}/.test(index),
    "index.ts must NOT export combined SharedDbModule",
  );
});

test("legacy shared-db.module.ts does not exist", () => {
  assert.ok(
    !existsSync(LEGACY_MODULE),
    "legacy shared-db.module.ts must be deleted to prevent deep imports",
  );
});

test("shared-user-db.module.ts exists and exports only PrismaService", () => {
  const mod = read(SHARED_USER_DB_MODULE);

  assert.ok(
    mod.includes("PrismaService"),
    "SharedUserDbModule must provide PrismaService",
  );
  assert.ok(
    !mod.includes("PrismaAdminService"),
    "SharedUserDbModule must NOT provide PrismaAdminService",
  );
  assert.ok(
    mod.includes("@Global()"),
    "SharedUserDbModule must be @Global()",
  );
});

test("shared-admin-db.module.ts exists and exports only PrismaAdminService", () => {
  const mod = read(SHARED_ADMIN_DB_MODULE);

  assert.ok(
    mod.includes("PrismaAdminService"),
    "SharedAdminDbModule must provide PrismaAdminService",
  );
  assert.ok(
    !mod.includes("PrismaService"),
    "SharedAdminDbModule must NOT provide PrismaService",
  );
  assert.ok(
    mod.includes("@Global()"),
    "SharedAdminDbModule must be @Global()",
  );
});

test("no service imports combined SharedDbModule", () => {
  const serviceFiles = findTsFiles(SERVICES_DIR);

  for (const file of serviceFiles) {
    const content = read(file);
    const deepImport = /import\s+\{[^}]*\bSharedDbModule\b[^}]*\}\s+from\s+["'][^"']*shared-db\.module["']/;
    const barrelImport = /import\s+\{[^}]*\bSharedDbModule\b[^}]*\}\s+from\s+["']@polyforge\/shared-db["']/;

    assert.ok(
      !deepImport.test(content),
      `${file} must not deep-import legacy shared-db.module`,
    );
    assert.ok(
      !barrelImport.test(content),
      `${file} must not import combined SharedDbModule from @polyforge/shared-db`,
    );
  }
});

test("admin-auth-service imports only SharedAdminDbModule", () => {
  const authFiles = findTsFiles("services/admin-auth-service");

  for (const file of authFiles) {
    const content = read(file);
    assert.ok(
      !content.includes("SharedUserDbModule"),
      `${file} must NOT import SharedUserDbModule`,
    );
  }

  const appModule = read("services/admin-auth-service/src/app.module.ts");
  assert.ok(
    appModule.includes("SharedAdminDbModule"),
    "admin-auth-service app.module.ts must import SharedAdminDbModule",
  );
});

test("admin-api-service imports both SharedUserDbModule and SharedAdminDbModule", () => {
  const adminApiApp =
    "services/admin-api-service/src/app.module.ts";
  const content = read(adminApiApp);

  assert.ok(
    content.includes("SharedUserDbModule"),
    "admin-api-service must import SharedUserDbModule",
  );
  assert.ok(
    content.includes("SharedAdminDbModule"),
    "admin-api-service must import SharedAdminDbModule",
  );
});

test("non-admin services do not import SharedAdminDbModule", () => {
  const serviceFiles = findTsFiles(SERVICES_DIR).filter(
    (f) => !isAdminService(f),
  );

  for (const file of serviceFiles) {
    const content = read(file);
    if (content.includes("SharedAdminDbModule")) {
      assert.fail(
        `${file} must not import SharedAdminDbModule`,
      );
    }
  }
});
