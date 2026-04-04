## Issue Sweep — 2026-04-04 21:00 UTC (approx)

### Workflow
ISSUE SWEEP (hour 20 UTC, second run)

### Context
Previous sweep (20 UTC) shipped PRs #235, #236, #237 covering HIGH issues (#221, #224, #225).
This run addresses remaining MEDIUM security issues.

### CI Infrastructure Issue (FOUNDER DECISION REQUIRED)
**All open PRs (#207–#240) have failing CI** — GitHub Actions annotation:
> "The job was not started because recent account payments have failed or your spending limit needs to be increased."

This is a billing/payment issue, not a code problem. All quality gates pass locally.

**FOUNDER DECISION REQUIRED**
Context: GitHub Actions is blocked on all PRs due to billing failure. No PRs can auto-verify or merge.
Options:
  A) Update payment method / increase spending limit in GitHub Billing & Plans settings
  B) Temporarily switch to GitHub's free tier self-hosted runners
My recommendation: A — this is the fastest unblock; billing issue likely a card expiry or limit hit
Deadline: ASAP — 8 open security PRs are ready to merge but blocked

### Shipped (PRs created this session)
- **PR #238** — fix(security): TOTP backup codes upgraded from 32-bit SHA-256 to 80-bit bcrypt; admin TOTP confirm rate-limited (closes #226, closes #229)
- **PR #239** — fix(security): Fastify `trustProxy: true` in all 4 services; signer-service validate-env now checks `MASTER_ENCRYPTION_KEY` instead of `ENCRYPTION_KEY` (closes #227, closes #228)
- **PR #240** — fix(security): PgBouncer Docker image pinned to `1.23.1`; `.env.example` ENABLE_SWAGGER defaults to `false` (closes #222, closes #230)

### Open MEDIUM Issues — Now Have PRs
- #222 → PR #240 ✓
- #226 → PR #238 ✓
- #227 → PR #239 ✓
- #228 → PR #239 ✓
- #229 → PR #238 ✓
- #230 → PR #240 ✓

### Remaining Open Issues (LOW priority or needs review)
- #234 — Internal JWT errors logged with full error object (PII leak)
- #233 — Admin-auth TOTP disable does not verify Redis session liveness
- #232 — JWT cache pwchange invalidation only checked on cache-hit path
- #231 — Cookie Secure flag depends on NODE_ENV
- #223 — AI portfolio-review endpoint lacks per-endpoint rate limit
- #220 — api-keys DELETE :id missing ParseUUIDPipe
- #219 — Hardcoded Redis password in docker-compose.infra.yml
- #218 — Webhook deliver() follows HTTP redirects (SSRF bypass)
- #217 — Webhook SSRF — 172.21–172.31 private range not blocked
- Design issues: #200, #201, #212–#216

### Notes
- PgBouncer version `1.23.1` in PR #240 must be verified at hub.docker.com/r/edoburu/pgbouncer/tags before production deploy
- Backup code verification is hybrid (bcrypt + SHA-256 legacy) — existing users' SHA-256 backup codes continue working until they regenerate

### Next Session Focus
1. Resolve GitHub Actions billing (founder action required)
2. After CI resolves: merge PRs #235–#240
3. Address LOW security issues (#217, #218 SSRF are most impactful)
4. Batch design issues #200, #201, #212–#216
