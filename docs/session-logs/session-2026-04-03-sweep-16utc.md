# Issue Sweep — 2026-04-03 16:00 UTC

## Workflow
ISSUE SWEEP (hour 16 UTC)

## Triage Summary

### Open Issues: ~20 total
- 1 security issue (#7 ElastiCache HA — has PR #94, IaC only)
- ~8 design issues remaining (after earlier batches merged)
- No new critical/high issues since 14 UTC sweep

### Branches Pushed: 2
| Branch | Closes | Status |
|--------|--------|--------|
| `fix/issue-40-builder-nodes-inline-styles` | #40 | Pushed, PR pending (no gh auth) |
| `fix/issue-48-form-input-labels` | #48 | Pushed, PR pending (no gh auth) |

## Shipped

### fix/issue-40-builder-nodes-inline-styles (closes #40)
**Builder nodes inline styles → CSS utility classes**

Replaced ~30 inline `style={{...}}` objects across all 4 builder node components with reusable CSS utility classes driven by `--node-color` CSS custom property:

- **globals.css** — added `.builder-node-card`, `.builder-node-header`, `.builder-handle`, `.builder-badge`, `.builder-preview-chip` utility classes
- **block-node.tsx** — 9 inline styles → CSS classes
- **calc-node.tsx** — 8 inline styles → CSS classes
- **logic-node.tsx** — 8 inline styles → CSS classes
- **variable-node.tsx** — 4 inline styles → CSS classes
- **strategy-canvas.tsx** — removed redundant MiniMap inline styles
- Updated `docs/13-design-charter.md` with §36 "Builder Node CSS Utilities" reference table

Only truly dynamic values (per-instance colors, animations, computed handle offsets) remain as minimal style props.

### fix/issue-48-form-input-labels (closes #48)
**Form inputs missing accessibility labels**

Added `aria-label` or `htmlFor`/`id` associations to 6 form controls:
- `copy-setup.tsx` — size percent slider
- `alerts.tsx` — token selection radio
- `markets-list.tsx` — end date From/To date pickers (×2)
- `market-detail.tsx` — Kelly confidence slider
- `block-palette.tsx` — block search input

## Quality Gates
- **Lint**: 17/17 PASS (0 errors, 3164 warnings — baseline)
- **Typecheck**: user-app PASS (shared-db pre-existing failure — no PostgreSQL)
- **Build**: user-app PASS

## Blocked
- **No `gh` CLI auth** — cannot create PRs or verify CI status. Branches pushed; PRs to be created when auth is available.

## Remaining Open Issues (no PR)
| # | Title | Priority |
|---|-------|----------|
| #42 | Spacing not on 4px grid | Medium |
| #44 | Missing meta image assets | High |
| #46 | Strategy-chart hex fallbacks | Medium |
| #49 | Transition durations | Low |
| #52 | Unused design tokens | Low |
| #62 | Hero particles inline styles | Medium |

## Next Session Focus
1. Create PRs for pushed branches (#40, #48)
2. Review and merge ready PRs at 18 UTC session
3. Fix #44 (missing meta image assets — high priority)
