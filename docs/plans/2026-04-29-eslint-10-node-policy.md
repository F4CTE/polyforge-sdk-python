# ESLint 10 Node Policy Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Upgrade the monorepo lint toolchain to ESLint 10 while making the supported Node runtime policy explicit.

**Architecture:** Keep ESLint centralized in the root workspace and continue using the existing flat config files in `eslint.config.mjs` and service-local `eslint.config.mjs` files. Set the supported project runtime to Node 24 because CI, Docker images, and dev docs already target Node 24, and the current dependency graph includes packages with Node 22.19+ and 22.22+ floors.

**Tech Stack:** pnpm 9, Turbo, ESLint 10, `@eslint/js` 10, `typescript-eslint` 8, Node 24.

---

### Task 1: Update Root Toolchain Metadata

**Objective:** Move the root ESLint dependency and Node engine declaration to the supported policy.

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Update package metadata**

Set the root dev dependency and engine policy:

```json
{
  "devDependencies": {
    "eslint": "10.2.1"
  },
  "engines": {
    "node": ">=24.0.0 <25.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

**Step 2: Refresh the lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` resolves ESLint 10.2.1 and keeps `@eslint/js` at 10.0.1, which is the latest published `@eslint/js` version available for ESLint 10.

### Task 2: Validate ESLint 10 Compatibility Surface

**Objective:** Confirm the repo is not relying on removed ESLint 10 behavior.

**Files:**
- Read: `eslint.config.mjs`
- Read: `services/*/eslint.config.mjs`
- Read: `.github/workflows/ci.yml`
- Read: `.github/actions/setup/action.yml`

**Step 1: Check removed config paths**

Run:

```bash
rg -n "eslint-env|ESLINT_USE_FLAT_CONFIG|v10_config_lookup_from_file|--flag" . -g '!node_modules' -g '!pnpm-lock.yaml'
```

Expected: no usage requiring migration. The repo already uses flat config.

**Step 2: Check runtime policy alignment**

Run:

```bash
rg -n "NODE_VERSION|node-version|node:24|Node.js \\| 24|Node.js 24" .github Dockerfile* apps services docs README.md
```

Expected: CI, Docker, and docs continue to target Node 24.

### Task 3: Verify Lint Under Supported Runtime

**Objective:** Prove the monorepo lint surface runs with the supported runtime.

**Files:**
- Read: `package.json`
- Read: `turbo.json`
- Read: workspace `package.json` files with `lint` scripts

**Step 1: Install with the refreshed lockfile**

Run under Node 24:

```bash
pnpm install --frozen-lockfile
```

Expected: install succeeds without lockfile drift.

**Step 2: Run lint**

Run under Node 24:

```bash
pnpm lint
```

Expected: Turbo runs all workspace lint scripts without ESLint 10 runtime or config errors.

### Task 4: Close Out Dependabot PR 1095

**Objective:** Avoid merging the raw Dependabot major bump separately after this branch carries the coherent policy update.

**Files:**
- External: `https://github.com/F4CTE/PolyForge/pull/1095`

**Step 1: Supersede the Dependabot PR**

After this branch is reviewed and merged, close PR #1095 with a comment that the ESLint 10 migration landed with the Node 24 engine policy.

**Step 2: Re-run queue checks**

Run:

```bash
gh pr checks <this-pr>
```

Expected: CI is green on Node 24.
