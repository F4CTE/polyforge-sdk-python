import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const GITHUB_DIR = ".github";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const SETUP_ACTION = ".github/actions/setup/action.yml";
const DEPLOY_SCRIPT = "scripts/deploy.sh";

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

  assert.notEqual(externalUses.length, 0, "Expected at least one external action");

  for (const { filePath, ref } of externalUses) {
    assert.match(ref, /@[a-f0-9]{40}$/, `${filePath} must pin ${ref} to a full SHA`);
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

  for (const jobName of ["lint", "nginx-security", "typecheck", "test", "build"]) {
    const block = jobBlock(workflow, jobName);
    assert.ok(block.includes(`if: ${trustedPrGuard}`), `${jobName} must skip external forks`);
    assert.ok(block.includes("runs-on: [self-hosted, linux]"), `${jobName} must remain self-hosted for trusted CI`);
  }
});

test("CI includes a secret-scanning gate and a matching pre-commit hook", () => {
  const workflow = read(CI_WORKFLOW);
  const hook = read(".husky/pre-commit");
  const packageJson = read("package.json");

  assert.ok(workflow.includes("name: Secret scan"));
  assert.ok(workflow.includes("gitleaks detect --no-git --redact --no-banner --config .gitleaks.toml --source ."));
  assert.ok(jobBlock(workflow, "build").includes("needs: [secret-scan, lint, typecheck, test, nginx-security]"));
  assert.ok(hook.includes("gitleaks protect --staged --redact --config .gitleaks.toml"));
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
  ]) {
    assert.ok(deployBlock.includes(`secrets.${secretName}`), `deploy-dev must use ${secretName}`);
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

test("deployment hardening controls remain enabled", () => {
  const workflow = read(CI_WORKFLOW);
  const deployScript = read(DEPLOY_SCRIPT);

  assert.ok(workflow.includes("id-token: write"), "production deploy needs OIDC for cosign keyless signing");
  assert.ok(workflow.includes("sigstore/cosign-installer@d58896d6a1865668819e1d91763c7751a165e159"));
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
    assert.ok(!content.includes(":latest"), `${filePath} must not reference mutable ECR latest tags`);
    assert.ok(!/docker\s+push\s+.*latest/.test(content), `${filePath} must not push latest tags`);
  }
});

test("sensitive ownership and Docker context exclusions are configured", () => {
  const dockerignore = read(".dockerignore");
  const codeowners = read(".github/CODEOWNERS");

  assert.match(dockerignore, /^\.env\*/m, ".dockerignore must exclude .env files");

  for (const ownedPath of [
    "/.github/workflows/",
    "/.github/actions/",
    "/scripts/deploy.sh",
    "/scripts/write-env-from-ci.sh",
    "/services/auth-service/",
    "/services/admin-auth-service/",
    "/services/signer-service/",
  ]) {
    assert.ok(codeowners.includes(ownedPath), `CODEOWNERS must cover ${ownedPath}`);
  }
});

test("composite setup action uses the pinned setup-node SHA", () => {
  const setupAction = read(SETUP_ACTION);
  assert.ok(setupAction.includes("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020"));
});
