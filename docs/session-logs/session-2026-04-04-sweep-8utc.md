## Session — 2026-04-04 08:00 UTC (Issue Sweep)

### Workflow
ISSUE SWEEP — UTC hour 08 (not a reserved audit hour)

### Shipped
- **PR #172** `fix/issues-143-144-157-security-high` — 3 HIGH security fixes:
  - #157: `isDev` in signing.service.ts and gas-sponsor.service.ts now uses explicit allowlist (`env === 'development' || env === 'test'`) — stub signer no longer activates on staging/QA
  - #143: `{ authTagLength: TAG_LEN }` added to both `createDecipheriv` calls in encryption.service.ts — truncated-tag acceptance prevented
  - #144: `metadata_options { http_tokens = "required", http_put_response_hop_limit = 1 }` added to EC2 Terraform — IMDSv2 enforced, SSRF-based credential theft blocked

- **PR #173** `fix/issues-139-146-155-156-158-160-security-medium` — 6 MEDIUM security fixes:
  - #160: `req.body.apiKey` and `req.body.apiPassphrase` added to Pino logger redaction
  - #158: Signer-service global throttle reduced from 1000/min → 60/min; `@Throttle({ limit: 20 })` added to `POST /sign/order`
  - #156: mock-polymarket CORS restricted to `localhost` regex (was wildcard)
  - #155: nginx `proxy_set_header Host $server_name` replaces `$host` in nginx.prod.conf
  - #146: ECR `image_tag_mutability = "IMMUTABLE"` in ecr.tf
  - #139: `.env.prod` added to .gitignore

- **PR #174** `fix/issue-159-gas-sponsor-dev-address` — MEDIUM:
  - #159: Invalid Ethereum address `"0x00000000000000000000000000000000GasSponsor"` replaced with valid `"0x0000000000000000000000000000000000000001"`

### Decisions Made
- Batched 3 HIGH issues into one PR (related signer-service + infra)
- Batched 6 MEDIUM issues into one PR (all security hardening with no dependencies)
- Issue #159 got its own PR (different file set, cleaner diff)
- Used `$server_name` for nginx Host (not hardcoded domain string) for portability across dev-ssl config variants

### Blocked
- Issues #145 (H2C smuggling via WebSocket upgrade) deferred — requires nginx websocket proxy config changes that need more analysis to avoid breaking WS connections
- Issues #147 (public subnet auto-assign public IPs) deferred — VPC/subnet Terraform change; needs validation against user-data bootstrap scripts

### Next Session Focus
1. Merge PRs #172, #173, #174 after CI passes
2. Address #145 (H2C smuggling) — research nginx `proxy_set_header Upgrade ""` for non-upgrade requests
3. Fix #147 (public subnet) — `map_public_ip_on_launch = false` in vpc.tf
4. Begin design issue batch (#163 Badge border-radius, #165 Dialog imperative style, #164 missing shared components)
