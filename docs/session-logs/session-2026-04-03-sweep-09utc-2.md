# Issue Sweep — 2026-04-03 09:00 UTC (Session 2)

## Workflow
ISSUE SWEEP (hour 9 UTC) — Cross-repo security + compatibility fixes

## Triage Summary

Scanned all 5 PolyForge repos for open issues. Prioritized by severity:

| Repo | Open Issues | Tackled This Session |
|------|------------|----------------------|
| polyforge (main) | 20 (1 security HIGH, 19 design) | Fixed PR #94 CI |
| polyforge-mcp | 9 (2 security, 1 breaking, 6 compat) | #12, #13 |
| polyforge-sdk-python | 9 (2 security HIGH, 2 security MEDIUM, 5 compat) | #8, #9, #15 |
| polyforge-sdk-rust | 6 (1 security MEDIUM, 2 security, 3 compat) | #9, #11 |
| polyforge-sdk-ts | 3 (1 security, 2 compat) | — |

## Shipped (PRs created)

### Security HIGH
- **sdk-python#17** — URL-encode all 32 path parameter interpolations to prevent traversal (closes #15)
- **sdk-python#16** — Upgrade cryptography >=46.0.6 (6 CVEs) and requests >=2.32.6 (closes #8, #9)

### Security MEDIUM / Breaking
- **polyforge-mcp#18** — Fix smart order `size` → `totalSize`, add `type` enum, add `updateStrategySchema` validation (closes #12, #13)
- **sdk-rust#15** — HTTPS enforcement in `with_url()`, query param URL-encoding in `get_orders()`, 9 new tests (closes #9, #11)

### CI Fix
- **polyforge PR #94** — Rebased `fix/issue-7-elasticache-ha` onto main (26 commits behind), resolved CHANGELOG conflict, all quality gates pass

## Remaining Open Issues (by priority)

### Security (not yet addressed)
- sdk-python #7, sdk-ts #6, sdk-rust #10 — SSRF blocklist gaps (shared pattern across SDKs)
- sdk-python #10 — MarketSentiment constructor bug
- polyforge-mcp #9, #10, #11 — Zod passthrough + missing validation schemas

### Compatibility/Breaking
- polyforge-mcp #14-#17 — Missing tools and filter params
- sdk-python #11-#14 — Wrong param names, missing fields
- sdk-ts #7-#8 — WebhookEvent format, missing endpoints
- sdk-rust #12-#14 — Missing serde renames

### Design (main repo)
- 19 open design issues (#37-#67) — token violations, inline styles, accessibility

## Next Session Focus
1. Merge ready PRs at evening review (18 UTC)
2. Fix SSRF blocklist issues across sdk-python, sdk-ts, sdk-rust (shared pattern)
3. Batch compatibility/breaking issues by repo
4. Start design issue batch for main repo
