## Issue Sweep — 2026-04-08 03:00 UTC

### Workflow
Issue Sweep (hour 3 UTC)

### Issues Triaged
- 18 open issues reviewed
- 2 HIGH priority without PRs identified and fixed
- 4 MEDIUM priority issues fixed
- 1 MEDIUM issue closed as false positive

### Shipped (PRs Created)

| PR | Issue | Priority | Description |
|----|-------|----------|-------------|
| #457 | #455 | security/high | Restrict stub signing mode to NODE_ENV=development only |
| #458 | #453 | security/high | Add gitleaks allowlist for historical CI key exposure + document key rotation |
| #459 | #456 | security/medium | Warn when all-zeros MASTER_ENCRYPTION_KEY used in development |
| #460 | #454 | security/medium | Comment out COOKIE_SECURE=false in .env.example (safe default) |
| #461 | #451 | security/medium | Bump hono >=4.12.12 and @hono/node-server >=1.19.13 (6 CVEs) |
| #462 | #447 | design/medium | Add charter-defined glow shadow tokens to globals.css |

### Issues Closed
- **#452** (security/medium) — Nginx H2C smuggling: closed as false positive. All 4 gateway configs already have the safe `$safe_upgrade`/`$safe_connection` map pattern. Semgrep rule fires on presence of headers regardless of safe values.

### Decisions Made
- Issue #453 (hardcoded keys in git history): created mitigation PR with gitleaks allowlist and documentation rather than destructive git history rewrite. Key rotation documented as manual action item for the team.
- Issue #452: closed without code changes after verifying all 4 nginx configs already implement the safe map-restricted pattern.

### Existing PRs Checked
- All 12 open PRs have CI checks in QUEUED state (self-hosted runner). No failures to fix.

### Open Issues Remaining (by priority)
- HIGH: #440 (PR #441 exists), #393 (PR #401 exists)
- MEDIUM: none without PRs
- LOW/Design: #450, #449, #448, #446, #295, #282, #274, #258 (PRs #438, #437 cover some)

### Next Session Focus
1. Merge ready PRs at 18 UTC PR review session
2. Monitor CI status on newly created PRs
3. Tackle remaining low-priority design issues if no new HIGH/CRITICAL arrive
