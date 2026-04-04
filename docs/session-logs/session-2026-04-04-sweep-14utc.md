## Issue Sweep — 2026-04-04 14:00 UTC

### Shipped (PRs open, pending merge)

**PR #175** — `fix/issues-157-143-158-159-signer`
- **#157 (HIGH)**: Dev stub signer guard changed from `!== 'production'` to `=== 'development'` — staging/QA now use real EIP712 signing
- **#143 (HIGH)**: GCM `createDecipheriv` calls now pass explicit `{ authTagLength: 16 }` — prevents truncated-tag acceptance in `decryptDek` and `decryptField`
- **#158 (MEDIUM)**: Signer global throttle cut from 1000/min to 120/min; `SigningController` overrides to 30/min (1 sign per 2s per client)
- **#159 (MEDIUM)**: Gas sponsor dev placeholder replaced with valid 20-byte zero address `0x000...000`; same `=== 'development'` guard applied

**PR #176** — `fix/issue-160-logger-redaction`
- **#160 (MEDIUM)**: `apiKey` and `apiPassphrase` added to pino redact list in `@polyforge/logger` — prevents credential leakage in request logs

**PR #177** — `fix/issues-139-145-155-156-nginx-gitignore-cors`
- **#145 (MEDIUM)**: nginx upgrade map changed to `~*websocket upgrade / default close` in both dev and prod configs — blocks H2C cleartext upgrade smuggling
- **#155 (MEDIUM)**: nginx `proxy_set_header Host $host` replaced with `localhost` (dev, catch-all `server_name _;`) and `$server_name` (prod, explicit names)
- **#156 (MEDIUM)**: mock-polymarket `enableCors()` wildcard replaced with `{ origin: ['http://localhost', 'http://localhost:4200', 'http://localhost:3000'] }`
- **#139 (MEDIUM)**: `.env.prod` added to `.gitignore`

### Issues Remaining Open (deferred to next session or infra team)

- **#157 (HIGH)**: Already fixed in PR #175
- **#144 (HIGH)**: EC2 IMDSv1 — requires Terraform/CDK infra change, not a code fix (infra team)
- **#147 (MEDIUM)**: Public subnet auto-assign public IPs — Terraform fix needed
- **#146 (MEDIUM)**: ECR mutable image tags — Terraform fix needed
- Design issues #148–#168 — batched for design session

### Decisions Made

- Throttle for signing endpoint set to 30/min (vs issue suggestion of "tighter") — balances defence-in-depth with legitimate burst signing (e.g., strategy execution placing multiple orders in quick succession)
- Used `$server_name` in prod nginx instead of hardcoding — future-proof if server_name changes

### Next Session Focus
1. Merge PRs #175, #176, #177 once CI passes
2. Address infra issues #144, #146, #147 (Terraform PRs)
3. Batch design issues #148–#168 for frontend agent
