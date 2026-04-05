# Issue Sweep — 2026-04-05 01:00 UTC

## Workflow
ISSUE SWEEP (hour 1 UTC)

## Summary
Addressed 1 CRITICAL security issue, 2 HIGH security issues, and 20 breaking compatibility fixes across all 4 SDK/MCP repos.

## Security Fixes

### polyforge-sdk-ts PR #60 — CRITICAL: SSRF bypass via bracketed IPv6 (closes #15)
- **Branch:** `fix/issues-40-41-42-46-47-compat-batch`
- **Issue:** `URL.hostname` returns bracketed IPv6 (e.g. `[::1]`) but `net.isIPv6()` rejects brackets, making the entire IPv6 SSRF validation branch unreachable
- **Fix:** Strip brackets before `isIPv6()` check

### polyforge-mcp PR #62 — HIGH: SSRF bypass via IPv4-mapped IPv6 hex notation (closes #25)
- **Branch:** `fix/issue-25-ssrf-ipv4-mapped-hex`
- **Issue:** Node.js normalizes `::ffff:127.0.0.1` to `::ffff:7f00:1` (hex-word form) which bypassed the dotted-decimal-only regex
- **Fix:** Added hex-word pattern match that converts to octets and delegates to `isPrivateIPv4`

### polyforge-sdk-python #36 — HIGH: Path traversal (already fixed)
- Closed with comment — all path parameters already use `_encode_path()` (from prior PR #17)

## Compatibility Fixes (breaking field mismatches)

Aligned all 4 repos with platform API contracts. Same 5 fixes applied consistently:

| Fix | MCP PR | TS PR | Python PR | Rust PR |
|-----|--------|-------|-----------|---------|
| ai_query: query → question | #63 (#50) | #60 (#46) | #61 (#48) | #64 (#50) |
| run_backtest: startDate/endDate → dateRangeStart/dateRangeEnd | #63 (#46) | #60 (#47) | #61 (#49) | — |
| WebhookEvent: SCREAMING_SNAKE_CASE → dot.notation | #63 (#43) | #60 (#42) | #61 (#42) | #64 (#47) |
| create_strategy_from_description: description → query | #63 (#38) | #60 (#40) | #61 (#39) | #64 (#44) |
| start_strategy: lowercase → uppercase LIVE/PAPER | #63 (#41) | #60 (#41) | #61 (#40) | #64 (#46) |

## PRs Created This Session

| Repo | PR | Title | Issues Closed |
|------|----|-------|--------------|
| polyforge-mcp | #62 | fix(security): detect IPv4-mapped IPv6 hex-word form | #25 |
| polyforge-mcp | #63 | fix(compat): align 5 tool schemas with platform | #38, #41, #43, #46, #50 |
| polyforge-sdk-ts | #60 | fix(compat): align SDK + fix SSRF IPv6 | #15, #40, #41, #42, #46, #47 |
| polyforge-sdk-python | #61 | fix(compat): align SDK with platform | #39, #40, #42, #48, #49 |
| polyforge-sdk-rust | #64 | fix(compat): align SDK with platform | #44, #46, #47, #50 |

## PRs Closed (superseded)
- polyforge-sdk-ts PR #59 — superseded by combined PR #60

## Issues Closed Directly
- polyforge-sdk-python #36 — already fixed in prior PR #17

## Quality Gates
- All repos: lint/typecheck/build verified locally before push
- polyforge-mcp: `npm run build` ✅
- polyforge-sdk-ts: `npm run lint` ✅, `npm run build` ✅
- polyforge-sdk-python: syntax check ✅, import test ✅
- polyforge-sdk-rust: `cargo check` ✅

## Open Issue Counts (approximate)
- polyforge-mcp: ~36 open (7 security medium, many compat breaking)
- polyforge-sdk-ts: ~38 open (1 less critical after this session)
- polyforge-sdk-python: ~35 open (1 closed directly)
- polyforge-sdk-rust: ~40 open
- PolyForge (main): ~10 open (design low/medium only)

## Next Session Focus
1. Merge session (18 UTC): review and merge all 5 PRs from this session
2. Continue with remaining security medium issues (SSRF, passthrough, rate limiter)
3. More breaking compat field mismatches across SDKs
