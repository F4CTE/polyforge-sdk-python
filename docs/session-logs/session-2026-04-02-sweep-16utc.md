# Issue Sweep Session — 2026-04-02 16:00 UTC

## Workflow
ISSUE SWEEP (hour 16 UTC)

## Quality Gate Results (main branch)

| Gate | Result |
|------|--------|
| Lint | PASS (0 errors, 3151 warnings) |
| Typecheck | PASS (21/21 packages) |
| Build | 23/25 PASS (`crypto-native` + `landing` fail due to network) |

## Open PR CI Verification

| PR | Branch | Lint | Typecheck | Build | CHANGELOG |
|----|--------|------|-----------|-------|-----------|
| #83 | `fix/issues-design-token-violations-batch` | PASS | PASS | PASS | PASS |
| #84 | `fix/issue-3-kek-rotation` | PASS | PASS | PASS | PASS |
| #85 | `fix/issue-75-exponentiation-guard` | PASS | PASS | PASS | PASS |

## Issues Closed (already fixed on main)

| Issue | Title | Resolution |
|-------|-------|------------|
| #74 | picomatch ReDoS (CVE-2026-33671, CVE-2026-33672) | pnpm override >=4.0.4 (installed: 4.0.4) |
| #73 | lodash Code Injection (CVE-2026-4800) | pnpm override >=4.18.1 (installed: 4.18.1) |
| #72 | effect AsyncLocalStorage leak (CVE-2026-32887) | pnpm override >=3.20.0 (installed: 3.21.0) |
| #71 | Hono file access + auth bypass (CVE-2026-29045, CVE-2026-29087) | pnpm override hono >=4.12.4 (installed: 4.12.9) |
| #55 | path-to-regexp DoS (CVE-2026-4926, CVE-2026-4923) | pnpm override >=8.4.0 (installed: 8.4.2) |
| #54 | undici WebSocket DoS (CVE-2026-1528, CVE-2026-1526, CVE-2026-2229) | pnpm override >=6.24.0 (installed: 6.24.1) |
| #53 | expr-eval Prototype Pollution (CVE-2025-13204, CVE-2025-12735) | Replaced with mathjs |

## New PRs Created

### PR #86 — fix(security): Buffer credentials (closes #6)
**Branch:** `fix/issue-6-buffer-credentials`

Changed `decryptField()` to return `Buffer` instead of `string` in both `EncryptionService` and `NativeEncryptionService`. Added `DecryptedCredentials` interface and `zeroCredentials()` helper. `SigningService` now zeroes all credential Buffers in `finally` blocks. Strings are only created at the external API boundary (ClobClient).

### PR #83 update — additional shadow-lg fixes
Added 6 `shadow-lg` -> `shadow-pf-lg` replacements across correlation, sentiment, retention, alerts, feed, and public-profile pages. Zero `shadow-lg` violations remain.

## Remaining Open HIGH Security Issues

| Issue | Title | Status |
|-------|-------|--------|
| #3 | CRITICAL: No KEK rotation | PR #84 open |
| #75 | HIGH: exponentiation guard | PR #85 open |
| #8 | HIGH: Admin IP allowlist empty | Infrastructure — requires actual admin IPs |
| #7 | HIGH: ElastiCache single-node | Infrastructure — Terraform change needed |
| #6 | HIGH: Private keys as JS strings | PR #86 open |

## Open Issue Summary
- 38 total open issues (down from 45 after closing 7)
- 4 HIGH security with open PRs (#3, #6, #75)
- 2 HIGH security infrastructure-only (#7, #8)
- 10 MEDIUM security
- ~20 design issues
