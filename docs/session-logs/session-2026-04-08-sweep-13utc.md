## Issue Sweep — 2026-04-08 13:00 UTC

### Workflow
ISSUE SWEEP (hour 13 UTC)

### Triage Summary
- **17 open issues** scanned
- All HIGH/CRITICAL issues already have open PRs from earlier sessions
- All MEDIUM issues already have open PRs
- No lint/typecheck CI failures on any open PRs (Check + Build pass on all fix PRs)

### Open Issues → PR Mapping

| Priority | Issue | PR |
|----------|-------|----|
| security + high | #455 Stub signer env guard | PR #457 |
| security + high | #453 CI key leak mitigation | PR #458 |
| security + high | #393 Throttler Redis storage | PR #401 |
| security + medium | #456 Zero-key warning | PR #459 |
| security + medium | #454 Cookie secure default | PR #460 |
| security + medium (deps) | #451 Hono CVEs | PR #461 |
| design + medium | #447 Glow shadow tokens | PR #462 |
| design + low (batch) | #446, #448, #449, #450 | PR #464 |
| design + low (batch) | #258, #274, #282, #295 | PR #438 |
| design + code-quality | #260 Shared CardSkeleton | PR #437 |

### CI Status
- **Check (lint + typecheck):** PASS on all fix PRs
- **Build:** PASS on all fix PRs
- **E2E:** FAIL on all PRs (systemic issue, not PR-specific)

### E2E Systemic Failure Analysis
All PRs (including session-log-only PRs) fail E2E. Root cause identified:
- `playwright.config.ts` sets `workers: 1` (serial execution) with 595 test cases
- At ~45s timeout + 2 retries per failing test, only ~3 tests complete before CI time limit
- Only 3 out of 327 scheduled tests pass; 324 never run
- Docker Compose startup + service health checks consume additional time
- This is a pre-existing infrastructure issue affecting `main` as well

### Open PRs (26 total)
- 10 fix PRs (security, design, code) — all pass Check + Build, blocked by E2E
- 16 session-log PRs — accumulating due to E2E blocking merges

### Decisions
- No new issues to create — all tracked issues have PRs in progress
- E2E infrastructure issue documented here for visibility; requires dedicated fix (parallelism, test splitting, or CI timeout adjustment)

### Next Session Focus
1. 18:00 UTC PR Review session: evaluate whether to merge PRs with passing Check + Build despite E2E failures (since E2E is broken on main too)
2. Consider creating an issue for E2E parallelism fix (workers: 1 → workers: 4+)
3. Clean up accumulated session-log PRs
