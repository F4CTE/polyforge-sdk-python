## Issue Sweep — 2026-04-05 20:00 UTC

### Workflow
Issue Sweep (hour 20 UTC)

### Situation
- 30+ open issues across security, design, code quality
- 10 open PRs all failing CI (GitHub Actions runner allocation failures — jobs completing in 2-3s with no steps executed)
- All CI failures were infrastructure-related, not code issues

### Actions Taken

#### 1. CI Retrigger (all 10 failing PRs)
Verified locally that code passes lint + typecheck + build on all critical PRs, then pushed empty commits to retrigger CI:
- **PR #305** (closes #285 — CRITICAL: hex opacity CSS var concatenation) — code passes locally
- **PR #307** (closes #296 — HIGH security: placeholder secrets not rejected) — code passes locally
- **PR #306** (closes #302 — HIGH security: key rotation inert) — code passes locally
- **PR #308** (closes #303 — MEDIUM security: ConfigService JWT injection) — code passes locally
- PRs #294, #281, #277, #276, #273, #272, #271 (design token PRs) — retriggered

#### 2. New Fixes Implemented

| PR | Issue | Priority | Description |
|----|-------|----------|-------------|
| #310 | #300 | MEDIUM/security | Disabled `enableImplicitConversion` in api-service ValidationPipe; added explicit `@Type(() => Number)` and `@Transform()` decorators across 9 DTO files; fixed BrowseQueryDto manual parseInt |
| #309 | #290 | MEDIUM/security | Added `@Throttle({ limit: 5, ttl: 3_600_000 })` to `POST /key-rotation/start` — caps JWT rotation to 5/hour |
| #311 | #297 | MEDIUM/security | Upgraded `Dockerfile.migrate` and `Dockerfile.migrate.admin` from `node:20-alpine` (EOL 2026-04-30) to `node:24-alpine` |
| #312 | #298 | MEDIUM/security | Tightened nginx WebSocket upgrade map: exact `"websocket"` match instead of `~*websocket` regex, `default ""` instead of `close` — 4th regression fix for H2C smuggling |

### Remaining Open Issues (security, medium — no PR yet)
- #299: ClobClient retains HMAC credential strings after zeroCredentials()
- #303: Already has PR #308

### Next Session Focus
1. Verify CI passes on retriggered PRs (hour 22 nightly prep or hour 6 morning session)
2. Fix #299 (ClobClient credential retention)
3. Review and merge ready PRs
