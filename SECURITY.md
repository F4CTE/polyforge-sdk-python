# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in Polyforge, please report it responsibly:

- **Email:** security@polyforge.app
- **Do NOT** open a public GitHub issue for security vulnerabilities
- We aim to respond within 48 hours and provide a fix within 7 days for critical issues

## Security Architecture

### Authentication

- **Access tokens:** JWT with 5-minute expiry, signed with RS256
- **Refresh tokens:** Random UUID, stored as SHA-256 hash in Redis (7-day TTL)
- **API keys:** Prefixed (`pf_`), SHA-256 hashed, scoped (READ/WRITE/TRADE), max 10 per user
- **Admin auth:** Separate JWT with server-side Redis sessions (1-hour expiry)
- **2FA:** TOTP (Time-based One-Time Password) for both users and admins
- **Password hashing:** bcrypt with 12 rounds, offloaded to worker threads

### Cryptography

- **Wallet credentials:** AES-256-GCM envelope encryption (KEK/DEK architecture) via **Rust NAPI-RS addon** (`@polyforge/crypto-native`)
- **Memory safety:** Private keys handled exclusively in Rust with `Zeroizing<Vec<u8>>` — never enter V8 heap. No JavaScript fallback; signer-service refuses to start without the Rust addon.
- **Strategy evaluation:** Sandboxed in **Rust WASM** (`@polyforge/engine`) — eliminates expression injection and prototype pollution attacks. No `expr-eval` fallback.
- **Fresh IV:** Random initialization vector per encryption operation (Rust `OsRng`)
- **Order signing:** HMAC-SHA256 for Polymarket Builder API headers
- **Internal service auth:** JWT with `jti` (unique ID) replay protection via Redis atomic SET NX
- **Login lockout:** Per-account Redis counter (10 failures = 15-minute lockout)
- **Refresh token rotation:** Old token revoked on each refresh, new token issued
- **CSRF protection:** `X-Requested-With` custom header required via CORS enforcement

### Infrastructure

- **Signer service isolation:** No published ports, dedicated `signer-only` Docker network, read-only filesystem, `no-new-privileges` security option, tmpfs with `noexec,nosuid`
- **Network segmentation:** 4 Docker networks (internal, admin-only, signer-only, public)
- **Database isolation:** Separate PostgreSQL instances for user and admin data
- **Connection pooling:** PgBouncer with TLS in production
- **Rate limiting:** ThrottlerModule on all services with per-endpoint configuration

### Headers & Transport

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (configured per environment)
- HSTS in production (max-age=31536000; includeSubDomains; preload)

### Input Validation

- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`
- class-validator decorators with regex patterns on all DTOs
- Prisma parameterized queries (no raw SQL string concatenation)
- Request body size limits (`client_max_body_size 1m`)
- WebSocket message size limit (64KB)

### Access Control

- RBAC for admin roles (SUPER_ADMIN, ADMIN, VIEWER)
- API key scope enforcement via guard + decorator pattern
- Geoblocking (33+ restricted countries and sub-national regions)
- CORS with explicit allow-list per service

### Monitoring

- All authentication events logged (login, logout, password change, 2FA enable/disable)
- Admin audit trail for write operations
- Failed login tracking with IP and user agent
- Anti-enumeration on auth endpoints (consistent 200 responses)

## Production Checklist

- [ ] Replace all `dev-*` and `CHANGE_ME` secrets with cryptographically random values
- [ ] Set `MASTER_ENCRYPTION_KEY` to a random 64-character hex string (startup validates non-zero)
- [ ] Set `TOTP_ENCRYPTION_KEY` to a random 64-character hex string (startup validates non-zero)
- [ ] Verify Rust NAPI addon loads: signer-service log should show "Rust NAPI-RS encryption active"
- [ ] Verify WASM engine loads: strategy-engine should start without "WASM module not available" error
- [ ] Enable Redis TLS (use `rediss://` URLs)
- [ ] Enable PostgreSQL TLS via PgBouncer
- [ ] Pin Docker base images to SHA256 digests
- [ ] Set `NODE_ENV=production` on all containers
- [ ] Remove Swagger/OpenAPI docs access (auto-gated by NODE_ENV)
- [ ] Configure HSTS header in production nginx
- [ ] Run `pnpm audit` and resolve critical/high CVEs
- [ ] Verify GitHub security scanning posture in `docs/ops/08-github-security-scanning.md`;
      enable GitHub-native code/secret scanning when the private-repo entitlement is available,
      otherwise keep the documented CI replacement controls active
- [ ] Enable AWS CloudTrail / audit logging
- [ ] Configure WAF rules for API endpoints
- [ ] Set up alerting for failed auth attempts and anomalous patterns

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Agent Credential Hygiene

PolyForge's AI agents (via Paperclip) are injected with `PAPERCLIP_*` environment variables
including short-lived run JWTs (`PAPERCLIP_API_KEY`). These credentials must never appear in:

- Run transcripts (captured stdout/stderr)
- Paperclip issue comments or bodies
- Git commit messages
- Source code, config files, or `.env` examples
- Sentry events, log output, or error messages

### Guardrails

1. **Never dump environment variables.** Agents are forbidden from running `env`, `printenv`,
   `declare -p`, `set`, or any command that enumerates shell environment variables.
2. **Check existence, never values.** Use `[ -n "$VAR" ] && echo "VAR is set"` to verify a
   secret env var exists. Never print the value.
3. **Redact before posting.** If command output may contain credentials (e.g., an HTTP
   response with a JWT), redact credential-looking patterns before including output in
   comments or issues.
4. **The `packages/logger` Pino configuration** redacts known Paperclip credential fields
   (`PAPERCLIP_API_KEY`, `PAPERCLIP_JWT`, `PAPERCLIP_JWT_TOKEN`, `PAPERCLIP_ACCESS_TOKEN`,
   `PAPERCLIP_SESSION_TOKEN`, `PAPERCLIP_SECRET`, `PAPERCLIP_PASSWORD`,
   `PAPERCLIP_COMPANY_ID`, `PAPERCLIP_AGENT_ID`), `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY`, `GITHUB_TOKEN`, `GITHUB_PAT`, and similarly sensitive patterns (both
   root-level and nested) from all structured logs.

### Secret Prefixes

The following environment variable patterns are considered secret and must never be
printed, logged, or committed: `PAPERCLIP_*`, `DEEPSEEK_*`, `ANTHROPIC_*`, `OPENAI_*`,
`GITHUB_*`, `JWT_*`, `MASTER_*`, `TOTP_*`, `DATABASE_URL`, `REDIS_URL`, and any variable
containing `KEY`, `SECRET`, `TOKEN`, or `PASSWORD`.

### Response to Exposure

If a `PAPERCLIP_*` credential is discovered in any persistent artifact (transcript,
comment, commit), the run JWT is short-lived (single heartbeat) and will expire
automatically. For longer-lived credentials, follow the incident response process in
`docs/ops/05-incident-response.md` and rotate the credential immediately.

## Security Audit History

- **Round 10 (2026-03-25):** 3 HIGH, 7 MEDIUM, 3 LOW findings — all remediated
- **Rounds 6-9 (2026-03):** 4 consecutive clean audits
- **Rounds 1-5 (2026-02):** 63 findings identified and fixed
