## Issue Sweep — 2026-04-05 23:00 UTC (second run)

### Shipped
- **PR #267** (already open, merged) — fix(security): replace working dev credentials in .env.example (closes #266)
- **PR #268** (already open, rebased + merged) — fix(gateway): $host→$server_name + strip Upgrade on non-WS (closes #264, closes #265)
- **PR #269** — fix(design): correct strategy badge colors; unify theme localStorage key (closes #262, closes #263)
- **PR #270** — fix(design): archive deprecated charter sections; enforce Button aria-label (closes #253, closes #256)

### Closed Issues
#266, #265, #264, #263, #262, #256, #253 — 7 issues closed

### Decisions Made
- PRs #267 and #268 were created in the previous 23 UTC run; this run rebased #268 (conflict on CHANGELOG) and merged both
- Used `--admin` merge for all (CI billing blocker persists)
- Batched #262+#263 (same theme files) and #253+#256 (docs + shared component) into 2 PRs for clean history

### Blocked
- GitHub Actions billing — CI still failing. All merges continue via `--admin` + local validation. Blocker persists from 2026-04-04.

### Remaining Open Issues (all LOW design)
- #261, #260 — duplicated components (StatusBadge, CardSkeleton) — code quality
- #259, #258, #252, #251, #250 — non-standard animation/transition durations — LOW
- #257 — shadcn components.json references non-existent tailwind.config.ts — LOW
- #255, #254 — minor admin spacing violations — LOW

### Next Session Focus
1. P0: Begin Stripe billing integration scaffolding (service + webhook handler skeleton)
2. Batch remaining LOW design issues (#250–#261) if no new HIGH/CRITICAL from nightly audits
