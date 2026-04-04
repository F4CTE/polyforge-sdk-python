## Issue Sweep — 2026-04-04 19:00 UTC (9pm Paris)

### Shipped (PRs created)

| PR | Issues | Type | Description |
|----|--------|------|-------------|
| #207 | #197, #198 | compliance/design | Risk disclaimers on P&L displays + "Simulated" badge on backtest metrics |
| #208 | #196 | security | Remove unsafe `NODE_ENV:-development` default from docker-compose |
| #209 | #193, #194 | security | Nginx H2C smuggling map fix + host header injection regression fix |
| #210 | #195 | design | Replace hardcoded hex color in builder store calc nodes |

### Issues addressed: 6/9 open

- **#197** (HIGH/design) — Backtest "simulated" label → PR #207
- **#198** (HIGH/design) — Portfolio/strategy P&L risk disclaimer → PR #207
- **#196** (MEDIUM/security) — docker-compose NODE_ENV default → PR #208
- **#194** (MEDIUM/security) — Nginx H2C smuggling regression → PR #209
- **#193** (MEDIUM/security) — Nginx proxy_set_header $host regression → PR #209
- **#195** (MEDIUM/design) — Builder store hardcoded hex color → PR #210

### Remaining open (LOW priority — deferred)

- **#201** (LOW/design) — Admin login hardcoded rgba()
- **#200** (MEDIUM/design) — Backtest chart axes font
- **#199** (LOW/design) — Landing page inline SVG icons

### Quality gates

- Lint: all 17 packages pass (0 errors)
- Typecheck: user-app clean; shared-db failure pre-existing (Prisma client not generated)
- Build: user-app builds successfully

### Next session focus

1. Merge approved PRs (#207–#210) during PR Review session (18 UTC)
2. Address remaining LOW/MEDIUM design issues (#199, #200, #201)
3. Monitor for new audit issues from nightly agents
