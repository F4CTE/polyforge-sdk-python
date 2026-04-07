## Issue Sweep — 2026-04-07 08:00 UTC (10am Paris)

### Context
- 48 open issues, 27 open PRs — all PRs had failing CI
- Root cause: `pnpm/action-setup@v4` broken on self-hosted runner with Node.js 24

### Shipped
- **PR #411 MERGED** — `fix(ci): replace pnpm/action-setup@v4 with corepack enable`
  - Root cause: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` forced pnpm/action-setup@v4 (Node 20 target) to run on Node 24, breaking the self-installer
  - Fix: `corepack enable --install-directory "$HOME/.corepack/bin"` in all 3 CI jobs
  - Impact: Unblocked CI for all 27 open PRs

### PRs Created
- **PR #412** — `fix(security): move hardcoded E2E secrets to GitHub Actions Secrets (closes #378)` [CRITICAL]
  - Moved MASTER_ENCRYPTION_KEY, TOTP_ENCRYPTION_KEY, and all JWT secrets to `${{ secrets.CI_* }}`
  - Supersedes stale PR #396 (closed)

### PRs Fixed (test/CI issues resolved)
- **PR #398** (issues #379, #384 — signer env validation): Fixed missing POLY_BUILDER_* env vars in test helper
- **PR #407** (issue #391 — mathjs allowlist): Restored `evaluate` and `parse` in restricted mathjs (were incorrectly removed, breaking all expression evaluation)
- **PR #401** (issue #393 — throttler Redis): Regenerated stale pnpm-lock.yaml after rebase

### PRs Rebased onto fixed main (16 branches)
- fix/issues-379-384-signer-env-validation (#398)
- fix/issue-385-nginx-h2c-smuggling (#400)
- fix/issue-393-throttler-redis-storage (#401)
- fix/issue-391-mathjs-allowlist (#407)
- fix/issue-390-log-level-default (#402)
- fix/issue-395-pin-pnpm-dockerfiles (#403)
- fix/issue-388-helmet-csp (#406)
- fix/issue-386-seed-passwords (#408)
- fix/issue-392-trust-proxy (#404)
- fix/issue-394-mailhog-binding (#399)
- fix/issues-380-383-dependency-cves (#397)
- fix/issues-387-389-dependency-cves (#410)
- fix/issues-364-374-design-batch (#405)
- fix/issue-372-focus-visible (#409)
- fix/issues-274-275-288-295-landing-design (#361)
- fix/issues-291-293-design-tokens (#363)

### CI Status at session end
| PR | Issue(s) | Check | Build | Notes |
|----|----------|-------|-------|-------|
| #397 | #380,#381,#382,#383 | PASS | PASS | E2E pending |
| #398 | #379,#384 | PASS | pending | Test fix pushed |
| #400 | #385 | PASS | pending | |
| #404 | #392 | PASS | pending | |
| #405 | #364,#374 | PASS | pending | |
| #408 | #386 | PASS | pending | |
| #410 | #387,#389 | PASS | pending | |
| #412 | #378 | PASS | pending | |
| #402 | #390 | PASS | pending | Re-triggered after store corruption |
| #403 | #395 | PASS | pending | |

### Not rebased (older branches with non-CHANGELOG conflicts, 9 branches)
- fix/issue-302-key-rotation-flush-v2 (#352)
- fix/issue-299-clobclient-hmac-scope (#354)
- fix/issues-290-300-security-medium-batch (#353)
- fix/issue-317-chart-style-utils (#330)
- fix/issues-287-292-318-319-design-batch (#355)
- fix/issues-279-280-284-input-validation-v2 (#356)
- fix/issues-250-251-254-255-design-tokens (#358)
- fix/issue-252-svg-animation-durations (#360)
- fix/issue-260-card-skeleton-shared (#362)

### Decisions Made
- Replaced `pnpm/action-setup@v4` with corepack — the action targets Node 20 and fails under `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`
- Closed stale PR #396 (had 5 stacked commits from multiple PRs) — replaced with clean single-commit PR #412
- Used `--install-directory "$HOME/.corepack/bin"` because corepack enable fails with EACCES on `/usr/bin/` on the self-hosted runner

### Next Session Focus
1. Monitor CI results — merge PRs where Check + Build + E2E all pass
2. Fix the 9 older PRs that couldn't be rebased (non-CHANGELOG conflicts)
3. Address any new audit issues from tonight's agents
