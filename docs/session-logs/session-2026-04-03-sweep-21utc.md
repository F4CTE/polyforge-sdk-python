# Issue Sweep — 2026-04-03 21:00 UTC

## Workflow
ISSUE SWEEP (hour 21 UTC)

## Triage Summary

### Open Issues Remaining: 1
| # | Title | Priority | Status |
|---|-------|----------|--------|
| #42 | Spacing not on 4px grid | Medium | Branch lost to force push — needs redo |

- #49 (transition durations) **FIXED** — branch pushed
- #52 (unused design tokens) **FIXED** — branch pushed
- No critical or high priority issues open
- All security issues resolved

## Shipped

### fix/issue-49-transition-duration-tokens (closes #49)
**Replace hardcoded transition durations with design tokens**

Replaced **85** hardcoded `duration-*` Tailwind classes across **39 files** with design token equivalents:

| Old class | Token | Value | Context |
|-----------|-------|-------|---------|
| `duration-100` | `duration-pf-fast` | 100ms | 1 occurrence |
| `duration-150` | `duration-pf-fast` | 100ms | 38 occurrences — hover/focus |
| `duration-200` | `duration-pf-normal` | 200ms | 31 occurrences — component transitions |
| `duration-250` | `duration-pf-slow` | 300ms | 1 occurrence — feature card hover |
| `duration-300` | `duration-pf-slow` | 300ms | 3 occurrences — modals/sidebars |
| `duration-400` | `duration-pf-slow` | 300ms | 1 occurrence — product preview |
| `duration-500` | `duration-pf-progress` | 500ms | 8 occurrences — progress bars |
| `duration-700` | `duration-pf-chart` | 700ms | 2 occurrences — market bar animations |

New tokens added to `@theme` in `globals.css`:
- `--duration-pf-progress: 500ms`
- `--duration-pf-chart: 700ms`

### fix/issue-52-unused-design-tokens (closes #52)
**Remove unused design tokens**

Removed **13** dead tokens from `@theme`:
- `--color-pf-cyan-100`, `--color-pf-cyan-200`, `--color-pf-cyan-700` — zero references in codebase
- `--spacing-pf-1` through `--spacing-pf-10` — zero references; codebase uses standard Tailwind spacing

Kept `--color-pf-chart-1..6` and `--color-pf-chart-muted` (shadcn convention, reserved for future chart components).

### Documentation
- `CHANGELOG.md` — versions 6.35.17, 6.35.18
- `docs/13-design-charter.md` — updated §4 (spacing: removed pf-spacing scale, noted Tailwind default suffices), §9 (added `--duration-pf-progress` and `--duration-pf-chart` to duration table + enforcement note)

## Quality Gates
- **Lint**: 17/17 PASS (0 errors, 3164 warnings — baseline)
- **Typecheck**: user-app ✓, admin-app ✓ (shared-db pre-existing failure — no PostgreSQL)
- **Build**: user-app ✓, admin-app ✓

## Blocked
- **No `gh` CLI auth** — cannot create PRs via API. Branches pushed; PRs pending.

## Open Branches (PRs pending)
| Branch | Closes |
|--------|--------|
| `fix/issue-49-transition-duration-tokens` | #49 |
| `fix/issue-52-unused-design-tokens` | #52 |

## Next Session Focus
1. Create PRs for #49 and #52 branches when auth available
2. Redo #42 (spacing 4px grid — branch lost to force push, ~1686 replacements)
