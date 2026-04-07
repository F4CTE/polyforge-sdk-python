## Issue Sweep — 2026-04-07 10:00 UTC

### Workflow
ISSUE SWEEP (hour 10 UTC)

### Shipped
- **PR #414** — `fix(design): replace arbitrary bracket sizing with design tokens (closes #367, closes #368)`
  - Added 10 new design tokens to `globals.css` (chart heights, column widths, input min-widths)
  - Migrated 22 arbitrary bracket values across 10 admin pages
  - Fixed Recharts tooltip colors in sentiment and retention pages to use token classes instead of computed hex

### CI Fixes
- Re-triggered CI on PR #409 (focus-visible, closes #372) and PR #406 (helmet CSP, closes #388) — both had FAILURE from runner cache corruption, code passes locally

### Open PR Status (25 open PRs)
- **Check passed:** PRs #412, #410, #408, #405, #404, #403, #402, #400, #398, #360, #355
- **Check queued (re-run):** PRs #414, #413, #409, #407, #406, #401, #399, #358, #356, #354, #353, #352, #330
- **E2E failure (env-dependent):** PR #397 — Prisma upgrade E2E fail, Check+Build pass

### Issue Coverage
- All `priority: critical` — none open
- All `security` + `priority: high` — covered by PRs (#380-385, #393-394, #379)
- All `security` + `priority: medium` — covered by PRs (#386-392, #395, #290, #299, #300)
- All `design` + `priority: high` — covered by PR #409 (#372)
- `design` + `priority: medium` — #367/#368 covered by new PR #414; #377 and #375 remain (large scope)

### Remaining Uncovered Medium Issues
- #377 — 40+ unused design tokens (large scope, needs Phase 1+2 approach)
- #375 — Missing standard Checkbox/Switch/Label/Separator/Toast components (large scope)

### Next Session Focus
1. Check CI results on re-triggered PRs #409, #406
2. Merge ready PRs at 18:00 UTC session
3. Pick up #375 or #377 if time permits
