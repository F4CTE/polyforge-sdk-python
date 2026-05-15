import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const GITHUB_DIR = ".github";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const SETUP_ACTION = ".github/actions/setup/action.yml";
const DEPLOY_SCRIPT = "scripts/deploy.sh";
const WRITE_ENV_SCRIPT = "scripts/write-env-from-ci.sh";

function read(filePath) {
  return readFileSync(filePath, "utf8");
}

function listYamlFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return listYamlFiles(fullPath);
    }

    return /\.(ya?ml)$/.test(entry) ? [fullPath] : [];
  });
}

function jobBlock(workflow, jobName) {
  const match = workflow.match(
    new RegExp(`\\n  ${jobName}:\\n([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:|\\n$)`),
  );

  assert.ok(match, `Expected job ${jobName} in ${CI_WORKFLOW}`);
  return match[1];
}

test("external GitHub Actions are pinned to immutable commit SHAs", () => {
  const yamlFiles = listYamlFiles(GITHUB_DIR);
  const externalUses = [];

  for (const filePath of yamlFiles) {
    const content = read(filePath);
    const matches = content.matchAll(/^\s*uses:\s*([^#\s]+)\s*$/gm);

    for (const match of matches) {
      const ref = match[1].trim();
      if (ref.startsWith("./")) {
        continue;
      }
      externalUses.push({ filePath, ref });
    }
  }

  assert.notEqual(
    externalUses.length,
    0,
    "Expected at least one external action",
  );

  for (const { filePath, ref } of externalUses) {
    assert.match(
      ref,
      /@[a-f0-9]{40}$/,
      `${filePath} must pin ${ref} to a full SHA`,
    );
  }
});

test("external fork pull requests cannot execute self-hosted CI jobs", () => {
  const workflow = read(CI_WORKFLOW);
  const trustedPrGuard =
    "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository";
  const externalPrGuard =
    "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository";

  const guardBlock = jobBlock(workflow, "external-pr-guard");
  assert.ok(guardBlock.includes(`if: ${externalPrGuard}`));
  assert.ok(guardBlock.includes("runs-on: ubuntu-latest"));
  assert.ok(guardBlock.includes("exit 1"));

  for (const jobName of [
    "lint",
    "nginx-security",
    "typecheck",
    "test",
    "build",
  ]) {
    const block = jobBlock(workflow, jobName);
    assert.ok(
      block.includes(`if: ${trustedPrGuard}`),
      `${jobName} must skip external forks`,
    );
    assert.ok(
      block.includes("runs-on: [self-hosted, linux]"),
      `${jobName} must remain self-hosted for trusted CI`,
    );
  }
});

test("CI includes a secret-scanning gate and a matching pre-commit hook", () => {
  const workflow = read(CI_WORKFLOW);
  const hook = read(".husky/pre-commit");
  const packageJson = read("package.json");

  assert.ok(workflow.includes("name: Secret scan"));
  assert.ok(
    workflow.includes(
      "gitleaks detect --no-git --redact --no-banner --config .gitleaks.toml --source .",
    ),
  );
  assert.ok(
    jobBlock(workflow, "build").includes(
      "needs: [secret-scan, semgrep, lint, typecheck, test, nginx-security]",
    ),
  );
  assert.ok(
    hook.includes("gitleaks protect --staged --redact --config .gitleaks.toml"),
  );
  assert.ok(packageJson.includes('"prepare": "husky"'));
});

test("dev deployment uses dedicated dev secrets only", () => {
  const workflow = read(CI_WORKFLOW);
  const deployBlock = jobBlock(workflow, "deploy-and-e2e");

  assert.ok(deployBlock.includes("environment: development"));

  for (const secretName of [
    "DEV_USER_JWT_SECRET",
    "DEV_ADMIN_JWT_SECRET",
    "DEV_BOT_JWT_SECRET",
    "DEV_INTERNAL_JWT_SECRET",
    "DEV_MASTER_ENCRYPTION_KEY",
    "DEV_TOTP_ENCRYPTION_KEY",
    "DEV_DB_PASSWORD",
    "DEV_ADMIN_DB_PASSWORD",
    "DEV_REDIS_PASSWORD",
    "DEV_POLY_BUILDER_API_KEY",
    "DEV_POLY_BUILDER_SECRET",
    "DEV_POLY_BUILDER_PASSPHRASE",
    "DEV_POSTHOG_SECRET_KEY",
    "DEV_POSTHOG_DB_PASSWORD",
  ]) {
    assert.ok(
      deployBlock.includes(`secrets.${secretName}`),
      `deploy-dev must use ${secretName}`,
    );
  }

  for (const prodSecretName of [
    "USER_JWT_SECRET",
    "ADMIN_JWT_SECRET",
    "BOT_JWT_SECRET",
    "INTERNAL_JWT_SECRET",
    "MASTER_ENCRYPTION_KEY",
    "TOTP_ENCRYPTION_KEY",
    "DB_PASSWORD",
    "ADMIN_DB_PASSWORD",
    "REDIS_PASSWORD",
    "POLY_BUILDER_API_KEY",
    "POLY_BUILDER_SECRET",
    "POLY_BUILDER_PASSPHRASE",
    "POSTHOG_SECRET_KEY",
    "POSTHOG_DB_PASSWORD",
    "GAS_SPONSOR_PRIVATE_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
  ]) {
    assert.ok(
      !deployBlock.includes(`secrets.${prodSecretName}`),
      `deploy-dev must not use production secret ${prodSecretName}`,
    );
  }
});

test("CI-generated dev env stays in non-production signing mode", () => {
  const envWriter = read(WRITE_ENV_SCRIPT);

  assert.ok(envWriter.includes("NODE_ENV=development"));
  assert.ok(envWriter.includes("SIGNING_MODE=stub"));
  assert.ok(
    envWriter.includes(
      "POLYGON_RPC_URL=${POLYGON_RPC_URL:-https://polygon-rpc.com}",
    ),
  );
  assert.match(
    envWriter,
    /^POSTHOG_SECRET_KEY=\$\{POSTHOG_SECRET_KEY\}$/m,
    "write-env-from-ci.sh must emit POSTHOG_SECRET_KEY",
  );
  assert.match(
    envWriter,
    /^POSTHOG_DB_PASSWORD="\$\{POSTHOG_DB_PASSWORD_ESC\}"$/m,
    "write-env-from-ci.sh must emit POSTHOG_DB_PASSWORD with double-quote wrapping for bash and Docker Compose safety",
  );
});

/**
 * Parse a dotenv file into a key-value map.  Handles double-quoted values
 * (with standard backslash escapes), single-quoted values (no escapes), and
 * unquoted values.  Does not expand shell variables.
 */
function parseDotenv(content) {
  const entries = Object.create(null);
  const re =
    /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(.+?))(?:\s+#.*)?$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    const key = match[1];
    let value = match[2] ?? match[3] ?? match[4];
    if (value !== undefined) {
      value = value.trim();
    }
    // Unescape standard backslash escapes inside double-quoted values
    // (\" → ", \\ → \, \$ → $, \n → newline, etc.)
    if (match[2] !== undefined) {
      value = value.replace(
        /\\([\\"$`\n/])/g,
        (_, c) => c === "n" ? "\n" : c,
      );
    }
    entries[key] = value;
  }
  return entries;
}

test("write-env-from-ci.sh emits a correctly quoted POSTHOG_DB_PASSWORD that survives shell and Docker Compose parsing", () => {
  const REPO_DIR = mkdtempSync(path.join(tmpdir(), "poly-ci-security-"));
  const envFile = path.join(REPO_DIR, ".env");
  const scriptPath = path.join(REPO_DIR, WRITE_ENV_SCRIPT);

  try {
    mkdirSync(path.dirname(scriptPath), { recursive: true });
    writeFileSync(scriptPath, read(WRITE_ENV_SCRIPT), { mode: 0o755 });

    // Use a password with quotes, backslashes, dollar signs, backticks, and
    // brace groups to verify the quoting strategy survives both bash `source`
    // and Docker Compose `.env` interpolation.  $, $(...), ${...}, and `...`
    // are the exact tokens that bash/Compose interpolate inside double quotes.
    const fixturePassword = "p@ss'w0rd!\"d'oh\\n%\$$HOME\`cmd\`\${NESTED}";

    const result = execSync(`bash "${scriptPath}"`, {
      cwd: REPO_DIR,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        REPO_DIR,
        USER_JWT_SECRET: "user-jwt-fixture",
        ADMIN_JWT_SECRET: "admin-jwt-fixture",
        BOT_JWT_SECRET: "bot-jwt-fixture",
        INTERNAL_JWT_SECRET: "internal-jwt-fixture",
        MASTER_ENCRYPTION_KEY:
          "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
        TOTP_ENCRYPTION_KEY: "totp-key-fixture",
        DB_PASSWORD: "db-pass-fixture",
        ADMIN_DB_PASSWORD: "admin-db-pass-fixture",
        REDIS_PASSWORD: "redis-pass-fixture",
        POLY_BUILDER_API_KEY: "poly-api-key-fixture",
        POLY_BUILDER_SECRET: "poly-secret-fixture",
        POLY_BUILDER_PASSPHRASE: "poly-passphrase-fixture",
        POSTHOG_SECRET_KEY: "ph-secret-fixture",
        POSTHOG_DB_PASSWORD: fixturePassword,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    assert.ok(result.includes("Wrote"), "script should report success");
    assert.ok(
      result.includes(".env"),
      "script should mention the env file path",
    );

    const envContent = read(envFile);

    // Extract the value via an independent dotenv parser
    const parsed = parseDotenv(envContent);
    assert.strictEqual(
      parsed.POSTHOG_DB_PASSWORD,
      fixturePassword,
      `POSTHOG_DB_PASSWORD must survive round-trip through write-env-from-ci.sh (got: ${JSON.stringify(parsed.POSTHOG_DB_PASSWORD)})`,
    );

    // The raw file must use double-quote wrapping so the value works for
    // both bash `source` (CI deploy step) and Docker Compose `.env` interpolation.
    assert.match(
      envContent,
      /^POSTHOG_DB_PASSWORD=".*"$/m,
      "POSTHOG_DB_PASSWORD line must use double-quote wrapping for bash and Docker Compose compatibility",
    );

    // Bash `source` must be able to parse the generated .env file and
    // resolve POSTHOG_DB_PASSWORD to the original fixture.
    const bashSourced = execSync(
      `bash -c 'set -a; source "${envFile}" 2>&1; printf "%s" "\${POSTHOG_DB_PASSWORD}"'`,
      {
        cwd: REPO_DIR,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    assert.strictEqual(
      bashSourced.trim(),
      fixturePassword,
      `POSTHOG_DB_PASSWORD must survive bash \`source\` of the generated .env (got: ${JSON.stringify(bashSourced.trim())})`,
    );
  } finally {
    rmSync(REPO_DIR, { recursive: true, force: true });
  }
});

test("deployment hardening controls remain enabled", () => {
  const workflow = read(CI_WORKFLOW);
  const deployScript = read(DEPLOY_SCRIPT);

  assert.ok(
    workflow.includes("id-token: write"),
    "production deploy needs OIDC for cosign keyless signing",
  );
  assert.ok(
    workflow.includes(
      "sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6",
    ),
  );
  assert.ok(workflow.includes('cosign sign --yes "$image"'));
  assert.ok(workflow.includes("PREVIOUS_IMAGE_TAG"));
  assert.ok(workflow.includes(".last-successful-image-tag"));
  assert.ok(deployScript.includes("StrictHostKeyChecking=yes"));
  assert.ok(deployScript.includes(".last-successful-image-tag"));
  assert.ok(!deployScript.includes("StrictHostKeyChecking=no"));
});

test("mutable ECR latest tags are not built or pushed by deploy code", () => {
  for (const filePath of [CI_WORKFLOW, DEPLOY_SCRIPT]) {
    const content = read(filePath);
    assert.ok(
      !content.includes(":latest"),
      `${filePath} must not reference mutable ECR latest tags`,
    );
    assert.ok(
      !/docker\s+push\s+.*latest/.test(content),
      `${filePath} must not push latest tags`,
    );
  }
});

test("sensitive ownership and Docker context exclusions are configured", () => {
  const dockerignore = read(".dockerignore");
  const codeowners = read(".github/CODEOWNERS");

  assert.match(
    dockerignore,
    /^\.env\*/m,
    ".dockerignore must exclude .env files",
  );

  for (const ownedPath of [
    "/.github/workflows/",
    "/.github/actions/",
    "/scripts/deploy.sh",
    "/scripts/write-env-from-ci.sh",
    "/services/auth-service/",
    "/services/admin-auth-service/",
    "/services/signer-service/",
  ]) {
    assert.ok(
      codeowners.includes(ownedPath),
      `CODEOWNERS must cover ${ownedPath}`,
    );
  }
});

test("composite setup action uses the pinned setup-node SHA", () => {
  const setupAction = read(SETUP_ACTION);
  assert.ok(
    setupAction.includes(
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    ),
  );
});
