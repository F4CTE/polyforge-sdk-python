## Issue Sweep — 2026-04-08 14:00 UTC

### Workflow
ISSUE SWEEP (hour 14 UTC)

### Repos Audited
- F4CTE/PolyForge (17 open issues — all have PRs)
- F4CTE/PolyForge-mcp (42 open issues — 2 HIGH without PRs)
- F4CTE/PolyForge-sdk-ts (48 open issues — 2 HIGH without PRs)
- F4CTE/PolyForge-sdk-python (44 open issues — 1 HIGH without PRs, 1 HIGH already resolved)
- F4CTE/PolyForge-sdk-rust (42 open issues — no HIGH without PRs)

### PRs Created

| Repo | PR | Issues Fixed | Description |
|------|----|-------------|-------------|
| PolyForge | #474 | E2E fix | Add `aria-pressed` to order filter buttons — fixes pre-existing E2E failures on main |
| PolyForge-mcp | pending | #69, #25 | Switch CI to ubuntu-latest + fix SSRF IPv6 hex bypass |
| PolyForge-sdk-ts | pending | #69, #68 | Switch CI to ubuntu-latest + pin vite>=8.0.5 for CVEs |
| PolyForge-sdk-python | pending | #68 | Switch CI to ubuntu-latest |

### Security Issues Fixed (HIGH)

1. **CI Runner Security (3 repos)** — All three SDK repos used `self-hosted` runners triggered by `pull_request` events. Malicious fork PRs could execute arbitrary code on the runner host. Fixed by switching to `ubuntu-latest` and adding `permissions: contents: read`.

2. **SSRF IPv6 Hex Bypass (PolyForge-mcp #25)** — `isPrivateIPv6()` only matched dotted-decimal IPv4-mapped addresses (`::ffff:127.0.0.1`) but missed hex-word form (`::ffff:7f00:1`) that Node.js normalizes to. Added hex-word pattern matching.

3. **Vite CVEs (PolyForge-sdk-ts #68)** — Vite 8.0.3 has 3 HIGH advisories (path traversal, fs.deny bypass, arbitrary file read). Pinned to `>=8.0.5` via npm overrides.

4. **SDK-Python #67 (shell: node)** — Investigated and found no longer present in current code. Skipped.

### E2E Investigation

- E2E tests failing on `main` (pre-existing) — not caused by any open PRs
- Root causes identified:
  - Orders filter tests: buttons missing `aria-pressed` attribute → **fixed in PR #474**
  - Auth flow tests: redirect assertions depend on full Docker environment (MailHog, Postgres) — not fixable locally
- All open fix PRs pass Check (lint+typecheck) and Build steps

### Main Repo PR Status

| PR | Title | Check | Build | E2E |
|----|-------|-------|-------|-----|
| #457 | Stub signer env guard (#455) | PASS | PASS | CANCELLED |
| #458 | Gitleaks allowlist (#453) | PASS | PASS | CANCELLED |
| #460 | Cookie secure default (#454) | PASS | PASS | CANCELLED |
| #459 | Zero-key warning (#456) | PASS | PASS | CANCELLED |
| #461 | Hono CVE bump (#451) | PASS | PASS | FAIL (pre-existing) |
| #462 | Glow shadow tokens (#447) | PASS | PASS | FAIL (pre-existing) |
| #464 | Design token batch (#446-450) | PASS | PASS | FAIL (pre-existing) |
| #401 | Throttler Redis (#393) | PASS | PASS | CANCELLED |

### Next Session Focus
1. Merge ready PRs at 18:00 UTC PR review session
2. Investigate auth E2E failures in full Docker environment
3. Address remaining MEDIUM security issues across SDK repos
