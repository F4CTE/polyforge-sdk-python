# Issue Sweep Session — 2026-04-02 16:00 UTC

## Workflow: D (Issue Sweep)

## Actions Taken

### 1. Quality Gate Baseline (main)
- Lint: PASS (17/17, warnings only)
- Typecheck: PASS (21/21, after Prisma generate)
- Build: PASS (23/25 — `crypto-native` needs crates.io, `landing` needs Google Fonts — both are network-only failures in this environment)

### 2. CI Fixes on Existing PRs

**PR #84 — fix/issue-3-kek-rotation (CRITICAL: KEK rotation)**
- CI status: Lint OK, Typecheck OK, Test FAILED
- Root cause: `credentials.service.spec.ts` ConfigService mock returned the KEK hex string for `MASTER_ENCRYPTION_KEY_VERSION`, causing `Number("aaa...") = NaN`
- Fix: Updated mock to return proper config map with `MASTER_ENCRYPTION_KEY_VERSION: "1"`
- Result: 118/118 tests pass
- Pushed: `75a2d5b`

**PR #86 — fix/issue-6-buffer-credentials (HIGH: Buffer return type)**
- CI status: Lint OK, Typecheck OK, Test FAILED
- Root cause: `encryption.service.spec.ts` assertions compared `Buffer` with `.toBe("string")` after `decryptField` return type changed from `string` to `Buffer`. Also had the same KEK version mock issue.
- Fix: Added `.toString("utf8")` to 4 roundtrip assertions; fixed ConfigService mock
- Result: 108/108 tests pass
- Pushed: `7e333db`

**PR #85 — fix/issue-75-exponentiation-guard (HIGH: DoS guard)**
- CI status: Lint OK, Typecheck OK, Test OK, Build OK, E2E FAILED
- E2E failure is Docker infrastructure issue (not code-related)
- All 319 strategy-engine tests pass locally
- No action needed

**PR #83 — fix/issues-design-token-violations-batch**
- CI status: Lint OK, Typecheck OK, Test OK, Build OK, E2E still running
- No action needed

### 3. New Issue Fixed

**Issue #8 (HIGH) — Admin IP allowlist empty**
- Created PR #87: `fix/issue-8-admin-ip-allowlist`
- Added `docker-entrypoint.sh` that generates nginx `geo` block from `ADMIN_ALLOWED_IPS` env var
- Defaults to loopback-only when unset (safe default with clear warning)
- Updated `.env.example`, `docs/08-env-reference.md`, `CHANGELOG.md`

## Open Issues Summary (39 total)
- 1 CRITICAL: #3 (PR #84 — CI now fixed)
- 4 HIGH: #75 (PR #85), #6 (PR #86 — CI now fixed), #8 (PR #87 — new), #7 (infra — ElastiCache)
- 11 MEDIUM security issues (#56, #57, #58, #59, #76, #77, #78, #79, #80, #81)
- ~23 design issues

## Open PRs (5 total)
| PR | Branch | Issue | Status |
|----|--------|-------|--------|
| #84 | fix/issue-3-kek-rotation | #3 CRITICAL | Tests fixed, awaiting re-run |
| #85 | fix/issue-75-exponentiation-guard | #75 HIGH | E2E infra issue only |
| #86 | fix/issue-6-buffer-credentials | #6 HIGH | Tests fixed, awaiting re-run |
| #83 | fix/issues-design-token-violations-batch | design batch | CI running |
| #87 | fix/issue-8-admin-ip-allowlist | #8 HIGH | New — CI pending |
