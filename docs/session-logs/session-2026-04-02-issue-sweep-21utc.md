# Session Log — Issue Sweep 2026-04-02 21:00 UTC

**Workflow:** D — Issue Sweep (hour 21 UTC)
**Duration:** ~25 min

## Triage Summary

- **Total open issues:** 30
- **Critical/High without PR:** 0 (all covered by existing PRs)
- **MEDIUM security without PR:** 8 (picked top 3 for this session)
- **Open PRs at start:** 8 (#83–#90)

## Work Done

### 1. PR #91 — fix(security): register @fastify/helmet across all NestJS services (closes #57)
- **Branch:** `fix/issue-57-helmet-security-headers`
- Installed `@fastify/helmet` in 12 production services
- Replaced incomplete manual `addHook('onSend')` security headers in 4 services (api, admin-api, admin-auth, auth)
- Added helmet registration to 8 services that had zero security headers
- Headers now set: X-Content-Type-Options, X-Frame-Options, HSTS, X-XSS-Protection, Referrer-Policy, X-Permitted-Cross-Domain-Policies, X-Download-Options
- CSP disabled at service level (gateway manages it)
- Updated CHANGELOG.md + docs/01-architecture.md
- **Lint:** PASS (17/17)

### 2. PR #92 — fix(security): default Swagger/OpenAPI to disabled (closes #79)
- **Branch:** `fix/issue-79-swagger-default-off`
- Changed `ENABLE_SWAGGER` from default-on (non-production) to explicit opt-in only
- Added startup warning if Swagger is enabled in production
- Documented `ENABLE_SWAGGER` in `.env.example` and `docs/08-env-reference.md`
- Updated CHANGELOG.md
- **Lint:** PASS (17/17)

### 3. PR #93 — fix(security): reject CORS credentialed requests when Origin absent (closes #58)
- **Branch:** `fix/issue-58-cors-missing-origin`
- Fixed CORS callbacks in all 4 public-facing services
- `!origin || allowed` → `origin && allowed` with explicit `!origin → false` branch
- Server-to-server requests still work but no longer get CORS credentials headers
- Updated CHANGELOG.md
- **Lint:** PASS (17/17)

## Quality Gates

- **Lint:** 17/17 PASS across all PRs
- **Typecheck/Build:** pre-existing `shared-db` Prisma client failure (no DB in environment) — not introduced by this session

## Remaining MEDIUM Security Issues (no PR yet)
- #80 — Placeholder secrets in .env.example
- #78 — Missing rate limiting on notification/market-data/gateway
- #77 — brace-expansion CVE (dependency)
- #76 — ajv ReDoS CVE (dependency)
- #56 — fastify protocol spoofable (CVE-2026-3635)

## Open PRs After Session: 11
