# Issue Sweep — 2026-04-03 13:00 UTC

## Workflow
ISSUE SWEEP (hour 13 UTC)

## Triage Summary

Scanned all 5 repos for open issues. All HIGH/CRITICAL issues already have PRs from earlier sessions.

### Issue Landscape

| Repo | Open Issues | HIGH (has PR?) | MEDIUM without PR |
|------|------------|----------------|-------------------|
| polyforge-sdk-python | 9 | #15 (PR #17), #8 (PR #16) | #10, #7 |
| polyforge-mcp | 9 | none | #9, #10, #11 |
| polyforge-sdk-ts | 3 | none | #6 |
| polyforge-sdk-rust | 6 | none | #10 (existing branch), #9 (PR #15) |

## Shipped

### polyforge-sdk-python
- **fix/issue-10-market-sentiment-bug** — Fixed `MarketSentiment` constructor using wrong field name (`label` → `direction`) at two call sites in `client.py`. Runtime TypeError on any market sentiment API response. (closes #10)
- **fix/issue-7-ssrf-blocklist** — Replaced naive 4-entry hostname blocklist with comprehensive SSRF protection using `ipaddress` module + `socket.getaddrinfo()` DNS resolution. Now blocks IPv6 loopback, RFC1918, link-local, reserved, IPv4-mapped IPv6, cloud metadata endpoints. (closes #7)

### polyforge-mcp
- **fix/issues-9-10-11-security-batch** — Batch fix for three security issues:
  - Removed `.passthrough()` from all 10 Zod schemas to prevent mass-assignment (closes #9)
  - Added `getStrategyEventsSchema` with proper UUID + pagination validation (closes #10)
  - Replaced naive SSRF blocklist with comprehensive `validateWebhookUrl()` covering IPv4/IPv6 private ranges, cloud metadata, reserved TLDs, embedded credentials (closes #11)

### polyforge-sdk-ts
- **fix/issue-6-ssrf-blocklist** — Enhanced existing branch with IPv6 unique-local (fc00::/7) and link-local (fe80::/10) range checks, bracket stripping fix, full `expandIPv6()` helper. TypeScript type checks pass. (closes #6)

### polyforge-sdk-rust
- **fix/issues-10-12-13-14-serde-ssrf** — Already fully addressed #10 in existing branch. No additional work needed.

## Existing PRs (status check)
- sdk-python PR #17 (closes #15) — open, CI status not verifiable via WebFetch
- sdk-python PR #16 (closes #8, #9) — open, CI status not verifiable
- mcp PR #18 (closes #12, #13) — open, CI status not verifiable
- sdk-rust PR #15 (closes #9, #11) — open, CI status not verifiable

## Decisions Made
- Batched MCP issues #9, #10, #11 into single branch since all touch `src/index.ts`
- Skipped sdk-rust #10 — existing branch already has comprehensive fix
- Did not create PRs (no `gh` CLI available) — branches pushed, PRs to be created in next session with tooling

## Blocked
- No `gh` CLI or GitHub MCP tools available in this environment — cannot create PRs or verify CI status
- PRs for new branches need to be created in next session

## Next Session Focus
1. Create PRs for all pushed branches (sdk-python #10, #7; mcp #9-10-11; sdk-ts #6)
2. Review and merge existing PRs if CI is green
3. Start on compatibility/breaking issues across SDKs
