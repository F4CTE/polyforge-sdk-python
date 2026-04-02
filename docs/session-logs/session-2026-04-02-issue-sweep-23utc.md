# Issue Sweep Session — 2026-04-02 23:00 UTC

## Workflow: D (Issue Sweep)

## Environment
- UTC hour: 23
- GitHub MCP tools became available mid-session
- Git proxy at 127.0.0.1:39441 functional for push/pull

## Quality Gate Baseline (main)
- Lint: 17/17 PASS (0 errors, 3151 warnings)
- Typecheck: shared-db fails (pre-existing Prisma — no PostgreSQL in environment)
- Build: shared-db cascade fails (pre-existing)

## New Branch Created

### PR #97 — `fix/issue-78-rate-limiting-missing-services` (closes #78)

**Rate limiting on notification-service and market-data-service:**
- Registered `ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }])` and `ThrottlerGuard` as global guard in both services
- Added `@nestjs/throttler` dependency to `market-data-service/package.json` (already present in notification-service)
- Matches existing pattern used by all other NestJS services

**Gateway nginx rate limiting:**
- Applied `limit_req zone=api_rl burst=50 nodelay` to user-facing `/api/v1/` location
- Applied `limit_req zone=api_rl burst=20 nodelay` to admin `/api/v1/` location
- The `api_rl` zone (100 req/s per IP) was defined but never referenced in any location block

**Quality gates:** Lint 17/17 PASS, Typecheck/Build baseline only

## PRs Created for Existing Branches

| PR | Branch | Closes | Description |
|----|--------|--------|-------------|
| #97 | `fix/issue-78-rate-limiting-missing-services` | #78 | Rate limiting on notification/market-data/gateway |
| #98 | `fix/issues-design-rounded-full-batch` | #70 | rounded-full → rounded-pf-full (409 occurrences, 86 files) |
| #99 | `fix/issues-design-text-black-batch` | #61 | text-black → text-pf-text-contrast (73 occurrences, 49 files) |
| #100 | `fix/issues-queryraw-safe-templates` | — | $queryRawUnsafe → Prisma.sql tagged templates |
| #101 | `fix/issues-security-cookie-mail-csp` | — | Cookie sameSite strict + SMTP TLS enforcement |

## Stale PRs Closed

Closed 5 PRs whose changes were already squash-merged to main:
- PR #84 (KEK rotation, closes #3) — merged in commit `dea8278`
- PR #85 (exponentiation guard, closes #75) — merged in commit `4bef53b`
- PR #86 (Buffer credentials, closes #6) — merged in commit `8d155f5`
- PR #87 (admin IP allowlist, closes #8) — merged in commit `9abc848`
- PR #88 (ThrottlerGuard admin-auth, closes #59) — merged in commit `aa3b029`

## CI Verification — All Unmerged Fix Branches

Verified lint (17/17 PASS, 0 errors) on ALL 14 unmerged fix branches:

### Security branches (all clean):
| Branch | PR | Issue | Status |
|--------|----|-------|--------|
| `fix/issue-56-forwarded-header-spoofing` | #96 | #56 | PASS |
| `fix/issue-57-helmet-security-headers` | #91 | #57 | PASS |
| `fix/issue-58-cors-missing-origin` | #93 | #58 | PASS |
| `fix/issue-76-ssrf-webhook-validation` | #89 | #81 | PASS |
| `fix/issue-79-swagger-default-off` | #92 | #79 | PASS |
| `fix/issue-80-reject-placeholder-secrets` | #95 | #80 | PASS |
| `fix/issues-queryraw-safe-templates` | #100 | — | PASS |
| `fix/issues-security-cookie-mail-csp` | #101 | — | PASS |
| `fix/issue-7-elasticache-ha` | #94 | #7 | PASS |
| `fix/issue-78-rate-limiting-missing-services` | #97 | #78 | PASS |

### Design branches (all clean):
| Branch | PR | Description | Status |
|--------|----|-------------|--------|
| `fix/issues-design-token-violations-batch` | #83 | shadow-lg + misc tokens | PASS |
| `fix/issues-design-token-violations-batch-2` | #90 | shadow-lg + bg-black backdrop | PASS |
| `fix/issues-design-rounded-full-batch` | #98 | rounded-full → rounded-pf-full | PASS |
| `fix/issues-design-text-black-batch` | #99 | text-black → text-pf-text-contrast | PASS |

## Dependency CVE Status
- #77 (brace-expansion): Already fixed — pnpm override `>=1.1.13`, installed 5.0.5
- #76 (ajv ReDoS): Already fixed — scoped override for `@angular-devkit/core>ajv >=8.18.0`, other ajv at 6.14.0 (>= 6.12.6 patched)

## Issue Summary
- **35 open issues** (down from 45 at start of day)
- **14 open PRs** (#83, #89–#101) covering 12 issues + 2 misc security hardening
- **5 stale PRs closed** (#84–#88, already merged)
- **0 CI regressions** across all branches

## Open PRs After Session: 14
