## Issue Sweep — 2026-04-08 07:00 UTC

### Workflow
ISSUE SWEEP (hour 7 UTC)

### Main Repo (F4CTE/PolyForge)

**All 17 open issues already have corresponding PRs:**

| Priority | Issues | PRs |
|----------|--------|-----|
| HIGH (security) | #455, #453, #393 | #457, #458, #401 |
| MEDIUM (security) | #456, #454, #451 | #459, #460, #461 |
| MEDIUM (design) | #447 | #462 |
| LOW (design) | #446, #448, #449, #450 | #464 (batch) |
| LOW (design) | #258, #274, #282, #295 | #438 (batch) |
| LOW (design/code) | #260 | #437 |

**CI Status:** All 18 open PRs pass Check (lint+typecheck) and Build. E2E fails across ALL PRs (systemic — Docker infrastructure required on self-hosted runner, not a per-PR issue). Deploy skipped (depends on E2E).

### Satellite Repos — PRs Created

| Repo | PR | Issue(s) | Description |
|------|----|----------|-------------|
| PolyForge-mcp | #77 | #69 | Switch CI to GitHub-hosted runners, add permissions: contents: read |
| PolyForge-sdk-ts | #76 | #68, #69 | Harden CI runners + pin vite >=8.0.5 for 3 CVEs |
| PolyForge-sdk-python | #75 | #67, #68 | Harden CI runners + replace shell: node {0} with bash |

### Triage Summary

- **Main repo:** 0 HIGH/CRITICAL issues without PRs — all covered
- **Satellite repos:** Found 5 HIGH security issues across 3 SDK repos (CI runner pwn-request vulnerabilities). Created 3 PRs fixing all 5 issues.
- **E2E failures:** Systemic across all PRs — Docker Compose infrastructure (PostgreSQL, Redis, services) required on self-hosted runner. Not fixable per-PR. Lint/typecheck/build all pass.

### Open Issue Count (all repos)

| Repo | Total Open | Security HIGH | Security MEDIUM |
|------|-----------|---------------|-----------------|
| PolyForge | 17 | 3 (all w/ PRs) | 4 (all w/ PRs) |
| PolyForge-mcp | 20 | 1 (now w/ PR) | 2 |
| PolyForge-sdk-ts | 20 | 2 (now w/ PRs) | 4 |
| PolyForge-sdk-python | 22 | 2 (now w/ PRs) | 3 |
| PolyForge-sdk-rust | 23 | 0 | 3 |

### Next Session Focus
1. Evening PR review (18 UTC) should merge ready PRs in main repo (Check+Build green)
2. Monitor satellite repo CI results on newly created PRs
3. Investigate E2E systemic failure if it blocks merges at review session
