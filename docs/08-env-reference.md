# Polyforge — Environment Variables Reference

> Complete reference for every environment variable used in Polyforge.  
> Copy `.env.example` to `.env` before running anything locally.

---

## Runtime

| Variable | Dev default | Description |
|---|---|---|
| `NODE_ENV` | **required** (no default) | `development` \| `production` \| `test`. Controls rate-limit strictness: production uses tight per-route limits (5–10 req/hr); dev/test uses relaxed limits (500–10000) to support E2E testing. **Must be explicitly set** — `docker-compose.infra.yml` uses `${NODE_ENV:?}` and will fail to start if unset. |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error`. Default changed from `debug` to `info` to avoid exposing internal state; use `debug` only for local troubleshooting. |
| `ENABLE_SWAGGER` | `false` (in `.env.example`) | Set to `"true"` to enable Swagger/OpenAPI docs at `/api/v1/docs`, `/api/v1/swagger`, and `/api/v1/docs/openapi.json`. Defaults to **disabled** if unset. Emits a warning if enabled with `NODE_ENV=production`. |
| `COOKIE_SECURE` | _(unset)_ | Optional local-only override for auth cookies. Leave unset outside local HTTP development; cookies default to secure unless explicitly set to `"false"`. |

---

## User Database

Used by all user-facing services: `auth-service`, `api-service`, `strategy-engine`, `order-service`, `paper-order-service`, `backtest-service`, `notification-service`, `bot-service`, `signer-service`, `market-data-service`.

| Variable | Dev default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://poly:devpass@pgbouncer:5432/polyforge?pgbouncer=true&connection_limit=1` | Points to PgBouncer (transaction mode). Used by all user-facing services at runtime. |
| `DIRECT_DATABASE_URL` | `postgresql://poly:devpass@postgres:5432/polyforge` | Points directly to Postgres, bypassing PgBouncer. Used **only** by `prisma migrate`. |
| `PRISMA_POOL_SIZE` | `10` | Connections in the per-service Prisma `PrismaPg` pool. `api-service` sets this to `20` in `docker-compose.infra.yml` to prevent connection-pool saturation during E2E runs. |

---

## Admin Database

Used **exclusively** by `admin-auth-service` and `admin-api-service`. No user-facing service has these variables in its environment.

| Variable | Dev default | Description |
|---|---|---|
| `ADMIN_DATABASE_URL` | `postgresql://poly_admin:devpass_admin@pgbouncer-admin:5433/polyforge_admin?pgbouncer=true&connection_limit=1` | Points to PgBouncer-admin. Used by admin services at runtime. |
| `ADMIN_DIRECT_DATABASE_URL` | `postgresql://poly_admin:devpass_admin@postgres-admin:5434/polyforge_admin` | Points directly to the admin Postgres instance. Used **only** by `prisma migrate --schema prisma/schema.admin.prisma`. |
| `PRISMA_ADMIN_POOL_SIZE` | `5` | Connections in the admin Prisma pool used by `admin-auth-service` and `admin-api-service`. |

---

## Redis

| Variable | Dev default | Description |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379` | Shared Redis instance. Used by all services. |

---

## JWT Secrets

All JWT secrets are **required** — services will fail to start if unset. Generate dev values with `openssl rand -base64 32`. In production, all are fetched from AWS Secrets Manager at boot — never stored in environment files.

| Variable | Description |
|---|---|
| `USER_JWT_SECRET` | Signs user JWTs (7 day TTL). Used by `auth-service` and all services that verify user tokens. |
| `JWT_SECRET` | Container-local alias for `USER_JWT_SECRET` in `api-service`. `docker-compose.infra.yml` maps `USER_JWT_SECRET` to `JWT_SECRET` because the API bootstrap validates the legacy name. |
| `ADMIN_JWT_SECRET` | Signs admin JWTs (1 hour TTL). Used by `admin-auth-service` and `admin-api-service`. |
| `BOT_JWT_SECRET` | Signs bot JWTs (30 day TTL). Used by `auth-service` and `bot-service`. |
| `INTERNAL_JWT_SECRET` | Signs service-to-service JWTs (30 second TTL). Used by every service for internal calls. |
| `*_INTERNAL_JWT_AUDIENCE` | Service-specific expected `aud` value for services using the shared internal guard, mapped to `INTERNAL_JWT_AUDIENCE` inside each container. |
| `*_INTERNAL_JWT_ISSUERS` | Comma-separated allowed `iss` values for services using the shared internal guard, mapped to `INTERNAL_JWT_ISSUERS` inside each container. |

---

## Encryption

All encryption keys are **required** — services will fail to start if unset. Generate dev values with `openssl rand -hex 32`. In production, real random values are stored in AWS Secrets Manager.

| Variable | Description |
|---|---|
| `MASTER_ENCRYPTION_KEY` | 32-byte hex. Master key for envelope encryption (KEK). Used **only** by `signer-service` to encrypt/decrypt DEKs. Never passed to any other service. |
| `MASTER_ENCRYPTION_KEY_VERSION` | Integer (default: `1`). Tracks the current KEK version. Increment when rotating the master key. |
| `MASTER_ENCRYPTION_KEY_PREVIOUS` | 32-byte hex (optional). Previous KEK, loaded during rotation grace period for decrypt-only. Remove after all DEKs are rotated. |
| `TOTP_ENCRYPTION_KEY` | 32-byte hex. Key for encrypting TOTP secrets at rest. Used **only** by `auth-service`. |

---

## Email

| Variable | Dev default | Description |
|---|---|---|
| `EMAIL_DRIVER` | `mailhog` | `mailhog` (dev — all emails captured) \| `ses` (production) |
| `MAILHOG_HOST` | `mailhog` | MailHog SMTP hostname (dev only) |
| `MAILHOG_PORT` | `1025` | MailHog SMTP port (dev only) |
| `AWS_SES_REGION` | `us-east-1` | AWS region for SES (production only) |
| `AWS_SES_FROM_EMAIL` | `noreply@polyforge.app` | Sender address for all outgoing emails |
| `AWS_SES_SMTP_USER` | _(empty)_ | SES SMTP username. Required at startup when `EMAIL_DRIVER=ses`. |
| `AWS_SES_SMTP_PASSWORD` | _(empty)_ | SES SMTP password. Required at startup when `EMAIL_DRIVER=ses`. |

---

## Polymarket APIs

| Variable | Dev default | Description |
|---|---|---|
| `GAMMA_API_URL` | `https://gamma-api.polymarket.com` | Polymarket Gamma API (market metadata). Real data in dev (hybrid mode). |
| `CLOB_API_URL` | `https://clob.polymarket.com` | Polymarket CLOB REST API (order submission). Required in all environments. |
| `CLOB_WS_URL` | `wss://ws-subscriptions-clob.polymarket.com/ws/market` | Polymarket CLOB WebSocket (live prices). Real data in dev. |
| `POLYMARKET_DATA_API_URL` | `https://data-api.polymarket.com` | Polymarket Data API (historical prices). Real data in dev. Replaces the old unused `DATA_API_URL` template entry. |
| `RTDS_WS_URL` | `wss://ws-live-data.polymarket.com` | Polymarket real-time data WebSocket used by market-data-service. |
| `SPORTS_WS_URL` | `wss://sports-api.polymarket.com/ws` | Polymarket sports WebSocket used by market-data-service. |

### Polymarket US Rail

| Variable | Dev default | Description |
|---|---|---|
| `POLYMARKET_US_ENABLED` | `false` | Enables the CFTC-regulated Polymarket US adapter and related US rail behavior. |
| `POLYMARKET_US_API_URL` | `https://api.polymarket.us` | Polymarket US REST API base URL. |
| `POLYMARKET_US_WS_URL` | `wss://ws.polymarket.us` | Polymarket US WebSocket base URL. |

### Kalshi Rail

| Variable | Dev default | Description |
|---|---|---|
| `KALSHI_ENABLED` | `false` | Enables Kalshi venue registration, reads, and order routing. |
| `KALSHI_BASE_URL` | `https://demo-api.kalshi.co/trade-api/v2` | Kalshi REST API base URL. |
| `KALSHI_WS_URL` | `wss://demo-api.kalshi.co/trade-api/ws/v2` | Kalshi WebSocket URL. |
| `KALSHI_KEY_ID` | _(empty)_ | Kalshi API key id used by signer-service when signing Kalshi JWTs. |
| `KALSHI_PRIVATE_KEY_PEM` | _(empty)_ | RSA private key PEM used by signer-service to sign Kalshi JWTs. Store only in a secrets manager outside local dev. |

---

## Polymarket Builder Program

| Variable | Dev default | Description |
|---|---|---|
| `POLY_BUILDER_API_KEY` | `dev-builder-api-key` | Builder program API key. |
| `POLY_BUILDER_SECRET` | `dev-builder-secret` | Builder program secret. |
| `POLY_BUILDER_PASSPHRASE` | `dev-builder-passphrase` | Builder program passphrase. |
| `POLYMARKET_BUILDER_CODE` | _(empty)_ | Builder address (0x…) embedded in EIP-712 order struct for volume attribution. Obtain from Polymarket Builder Profile. |
| `BUILDER_TIER` | `UNVERIFIED` | Builder tier used by admin API builder status: `UNVERIFIED`, `VERIFIED`, or `MARKET_MAKER`. |
| `BUILDER_API_URL` | _(empty)_ | Optional upstream Builder Program API base URL for admin builder syncs. |

### Bridge & Relayer

| Variable | Dev default | Description |
|---|---|---|
| `POLYMARKET_BRIDGE_URL` | `https://bridge.polymarket.com` | Polymarket Bridge API for deposits/withdrawals across chains. |
| `POLYMARKET_RELAYER_URL` | `https://relayer-v2.polymarket.com` | Polymarket Relayer API for gasless transaction execution. |
| `POLYMARKET_RAIL` | `auto` | Venue routing preference for Polymarket rails: `auto`, `polymarket`, or `polymarket_us`. |
| `POLYMARKET_CHAIN_ID` | `137` | Chain id passed to the CLOB client. Defaults to Polygon. |
| `RELAYER_API_KEY` | _(empty)_ | Relayer API key for authenticated endpoints (submit, recent-transactions, api-keys). |
| `RELAYER_API_KEY_ADDRESS` | _(empty)_ | Ethereum address associated with the Relayer API key. |

---

## Blockchain

| Variable | Dev default | Description |
|---|---|---|
| `CHAIN_ID` | `137` | Polygon mainnet. Do not change. |
| `SIGNING_MODE` | _(auto)_ | `stub` \| `production`. Controls whether `signer-service` uses a stub signer (fake signatures for dev) or real EIP-712 signing. Defaults to `stub` when `NODE_ENV=development`, `production` otherwise. **Setting `stub` when `NODE_ENV=production` is a fatal error.** |
| `POLYGON_RPC_URL` | `https://polygon-rpc.com` | Polygon JSON-RPC URL used by signer-service for production signing and gas sponsorship. Production must use a private provider URL. |
| `GAS_SPONSOR_ENABLED` | `false` | Enables gas sponsorship. |
| `GAS_SPONSOR_PRIVATE_KEY` | _(empty)_ | Private key for the gas sponsor wallet. Store only in a secrets manager outside local dev. |
| `GAS_DAILY_LIMIT_MATIC` | `0.5` | Daily MATIC spend cap exposed in user settings. |
| `GAS_ESTIMATE_MATIC` | `0.002` | Estimated MATIC per sponsored transaction for capacity calculations. |

---

## Beta Limits

These values are read from the environment at service startup.

| Variable | Dev default | Description |
|---|---|---|
| `BETA_MAX_ACTIVE_STRATEGIES` | `3` | Max active strategies per user. |
| `BETA_MAX_CONCURRENT_BACKTESTS` | `1` | Max concurrent backtests. |
| `BETA_MAX_BACKTEST_HISTORY_DAYS` | `90` | Max lookback window for backtests. |
| `BETA_MAX_MONTHLY_VOLUME_USDC` | `5000` | Monthly trading volume cap in USDC. |
| `BETA_MAX_POSITION_SIZE_USDC` | `500` | Max order position size in USDC. |
| `BETA_MARKET_DATA_RATE_LIMIT` | `100` | Per-minute market-data route rate limit. CI defaults to `10000` when unset. |
| `BETA_MAX_MARKETPLACE_LISTINGS` | `2` | Max published marketplace listings. |
| `BETA_MAX_DAILY_STRATEGY_EXECUTIONS` | `500` | Max daily executions per strategy. |

---

## AI News Pipeline

| Variable | Dev default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-xxx` | Anthropic key for LLM-based news analysis. Placeholder values are rejected in production. |
| `OPENAI_API_KEY` | `sk-xxx` | OpenAI key for LLM-based news analysis. Placeholder values are rejected in production. |
| `NEWS_RSS_FEEDS` | Reuters/CNN examples | Comma-separated RSS feed URLs for news ingestion. |
| `ARBITRAGE_THRESHOLD_PCT` | `3` | Minimum cross-venue price spread percent before market-data-service reports an arbitrage opportunity. |

---

## Bots

| Variable | Dev default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `dev-disabled` | Telegram bot token from @BotFather. Set a real token to test the bot locally. `dev-disabled` disables the bot. |
| `DISCORD_BOT_TOKEN` | `dev-disabled` | Discord bot token. `dev-disabled` disables the bot. |
| `WHATSAPP_TOKEN` | `dev-disabled` | WhatsApp Cloud API token. `dev-disabled` disables WhatsApp delivery. |
| `WHATSAPP_PHONE_ID` | _(empty)_ | WhatsApp Cloud API phone number id. Required when WhatsApp delivery is enabled. |
| `WHATSAPP_VERIFY_TOKEN` | generated value | Webhook verification token for Meta callback setup. Do not use the old predictable `polyforge-verify` value outside tests. |
| `WHATSAPP_APP_SECRET` | generated value | Meta app secret used for webhook HMAC verification. Required when WhatsApp delivery is enabled. |

---

## Geo-Blocking

| Variable | Dev default | Description |
|---|---|---|
| `GEO_BLOCKED_COUNTRIES` | production blocked-country list | Comma-separated ISO country codes fully blocked from trading actions. |
| `GEO_CLOSE_ONLY_COUNTRIES` | `PL,SG,TH,TW` | Comma-separated ISO country codes allowed only to close/redeem existing positions. |

---

## Launch Flags

| Variable | Dev default | Description |
|---|---|---|
| `INVITE_ONLY` | `true` in `.env.example` | Requires invite codes for registration when true. Can be overridden at runtime via Redis/admin controls. |

---

## Observability

| Variable | Dev default | Description |
|---|---|---|
| `SENTRY_DSN` | _(empty)_ | Backend Sentry DSN. When set, all NestJS services (api, auth, admin-api, admin-auth, order, paper-order, signer, strategy-engine, backtest, bot, market-data, notification) initialise `@sentry/nestjs` and register `SentryGlobalFilter`. When unset, Sentry is inactive (`beforeSend` returns null, zero overhead). |
| `VITE_SENTRY_DSN` | _(empty)_ | Public Sentry/GlitchTip-compatible DSN for the Vite user and admin apps. When unset, their `@sentry/react` browser wrappers initialize with a `beforeSend` drop guard and skip user/error reporting calls. |
| `NEXT_PUBLIC_SENTRY_DSN` | _(empty)_ | Public Sentry/GlitchTip-compatible DSN for the Next.js landing app. When unset, landing Sentry initialization drops events before send so local builds do not report. |
| `NEXT_PUBLIC_SENTRY_TUNNEL` | _(build-derived)_ | Public landing Sentry tunnel path injected by `apps/landing/next.config.ts`. Server-backed builds set `/monitoring`; static export builds set an empty value so browser events go directly to the DSN because no Next.js tunnel route exists. |
| `NEXT_STATIC_EXPORT` | `false` | Set to `"true"` for static landing exports. Disables runtime-only Sentry tunnel/server instrumentation paths. |
| `SENTRY_AUTH_TOKEN` | _(empty)_ | Enables landing source-map upload during `next build` when paired with `SENTRY_ORG` and `SENTRY_PROJECT`. Leave unset for local builds and static export builds. |
| `SENTRY_ORG` | _(empty)_ | Sentry organization slug used by the landing `withSentryConfig` source-map upload step. |
| `SENTRY_PROJECT` | _(empty)_ | Sentry project slug used by the landing `withSentryConfig` source-map upload step. |
| `SENTRY_DSN` | _(empty)_ | Backend Sentry DSN used by Nest services. When unset, backend instrumentation drops events before send. |
| `VITE_SENTRY_DSN` | _(empty)_ | Browser Sentry DSN for Vite apps. |
| `POSTHOG_API_KEY` | _(empty)_ | Server-side PostHog project API key. When unset, shared PostHog capture is a no-op. |
| `POSTHOG_HOST` | `http://posthog:8000` | PostHog host for server-side capture. |
| `POSTHOG_DB_PASSWORD` | generated value | PostHog CE database password used by `docker-compose.infra.yml`. |
| `POSTHOG_SECRET_KEY` | generated value | PostHog CE Django secret key used by `docker-compose.infra.yml`. |
| `NEXT_PUBLIC_POSTHOG_KEY` | _(empty)_ | Public PostHog key for the Next.js landing app. |
| `NEXT_PUBLIC_POSTHOG_HOST` | `http://posthog.polyforge-lab:8000` | Public PostHog host for the Next.js landing app. |
| `VITE_POSTHOG_KEY` | _(empty)_ | Public PostHog key for Vite apps. |
| `VITE_POSTHOG_HOST` | `http://posthog.polyforge-lab:8000` | Public PostHog host for Vite apps. |

Landing Sentry runs on `@sentry/nextjs` v10. The SDK now uses OpenTelemetry v2 internally and should be paired with a Sentry-compatible backend that supports self-hosted Sentry 24.4.2 or newer. The landing app keeps the existing `/monitoring` tunnel route for server-backed builds through both the client SDK `tunnel` option and a Next.js rewrite; static export mode disables the tunnel and server function instrumentation because there is no Next.js runtime.

The Vite user and admin apps run on `@sentry/react` v10 without Replay, BrowserTracing, a Sentry Vite plugin, a tunnel route, or source-map upload. Add those pieces in a dedicated observability change if frontend release artifact upload or tunneling becomes required.

### Redis Stream observability

Every NestJS service that hosts a Redis Stream consumer (`order-service`, `paper-order-service`, `backtest-service`, `notification-service`) registers a **`StreamMonitorService`** and **`PelReclaimService`** from `@polyforge/shared-redis` on boot. No env vars control these — defaults are encoded in the helpers:

- **Monitor**: polls `XLEN` + `XPENDING` + `XINFO CONSUMERS` every 30 s. Emits a `Logger.warn` line and a `redis-stream` Sentry breadcrumb when stream length exceeds 10 000, pending count exceeds 500, or oldest pending age exceeds 5 minutes.
- **PEL reclaim**: runs every 60 s. Calls `XAUTOCLAIM` (Redis 6.2+) with a 5-minute idle threshold so abandoned entries from a crashed pod are reassigned to the live consumer, optionally re-run through the consumer's handler, and ACKed only on success.

Both helpers degrade silently when the host process has no `@sentry/nestjs` initialised (the breadcrumb path uses a runtime require with a try/catch).

---

## CORS & Domains

| Variable | Dev default | Description |
|---|---|---|
| `FRONTEND_URL` | `https://localhost` | User app URL. Used in email links and CORS config. |
| `ADMIN_URL` | `https://admin.polyforge.app` | Admin app URL. Used in CORS config. |
| `CORS_ORIGINS` | `https://localhost` | Comma-separated list of allowed origins for user-facing services. |
| `ADMIN_CORS_ORIGINS` | `https://admin.polyforge.app` | Allowed origins for admin services. |
| `ADMIN_ALLOWED_IPS` | _(empty — loopback only)_ | Comma-separated CIDRs for admin panel access at the nginx gateway. If unset, admin panel is restricted to `127.0.0.1` only. Example: `203.0.113.1/32,10.8.0.0/24`. |
| `APP_URL` | `http://localhost:5173/api-docs` fallback | Landing app rewrite target for API docs. |
| `API_URL` | service-specific fallback | API service base URL used by landing/user app development rewrites. |
| `AUTH_API_URL` | `http://localhost:3001` | User app auth API URL override for Vite dev builds. |
| `ADMIN_API_URL` | `http://localhost:3004` | Admin app API URL override for Vite dev builds. |
| `ADMIN_AUTH_API_URL` | `http://localhost:3003` | Admin app auth API URL override for Vite dev builds. |
| `WS_URL` | app fallback | User app WebSocket URL override for Vite dev builds. |

---

## Internal Service URLs

Docker Compose sets most of these to internal service DNS names. Override only when running services outside the Compose network.

| Variable | Default |
|---|---|
| `AUTH_SERVICE_URL` | `http://auth-service:3001` |
| `API_SERVICE_URL` | `http://api-service:3002` |
| `ADMIN_AUTH_SERVICE_URL` | `http://admin-auth-service:3003` |
| `MARKET_DATA_SERVICE_URL` | `http://market-data-service:3005` |
| `STRATEGY_ENGINE_URL` | `http://strategy-engine:3006` |
| `ORDER_SERVICE_URL` | `http://order-service:3007` |
| `PAPER_ORDER_SERVICE_URL` | `http://paper-order-service:3008` |
| `BACKTEST_SERVICE_URL` | `http://backtest-service:3009` |
| `NOTIFICATION_SERVICE_URL` | `http://notification-service:3010` |
| `BOT_SERVICE_URL` | `http://bot-service:3011` |
| `SIGNER_SERVICE_URL` | `http://signer-service:3012` |

---

## Service Ports

Internal Docker network ports. No need to change these in dev or production.

| Variable | Default | Service |
|---|---|---|
| `AUTH_SERVICE_PORT` | `3001` | auth-service |
| `API_SERVICE_PORT` | `3002` | api-service |
| `ADMIN_AUTH_SERVICE_PORT` | `3003` | admin-auth-service |
| `ADMIN_API_SERVICE_PORT` | `3004` | admin-api-service |
| `MARKET_DATA_SERVICE_PORT` | `3005` | market-data-service |
| `STRATEGY_ENGINE_PORT` | `3006` | strategy-engine |
| `ORDER_SERVICE_PORT` | `3007` | order-service |
| `PAPER_ORDER_SERVICE_PORT` | `3008` | paper-order-service |
| `BACKTEST_SERVICE_PORT` | `3009` | backtest-service |
| `NOTIFICATION_SERVICE_PORT` | `3010` | notification-service |
| `BOT_SERVICE_PORT` | `3011` | bot-service |
| `SIGNER_SERVICE_PORT` | `3012` | signer-service |

---

## Production — AWS Secrets Manager

In production, secrets are never stored in environment files. All sensitive variables are fetched from AWS Secrets Manager at service boot using the EC2 IAM role.

**Secret paths (one secret per variable):**

```
polyforge/USER_JWT_SECRET
polyforge/ADMIN_JWT_SECRET
polyforge/BOT_JWT_SECRET
polyforge/INTERNAL_JWT_SECRET
polyforge/AWS_SES_SMTP_USER
polyforge/AWS_SES_SMTP_PASSWORD
polyforge/API_SERVICE_INTERNAL_JWT_AUDIENCE
polyforge/API_SERVICE_INTERNAL_JWT_ISSUERS
polyforge/AUTH_SERVICE_INTERNAL_JWT_AUDIENCE
polyforge/AUTH_SERVICE_INTERNAL_JWT_ISSUERS
polyforge/MARKET_DATA_SERVICE_INTERNAL_JWT_AUDIENCE
polyforge/MARKET_DATA_SERVICE_INTERNAL_JWT_ISSUERS
polyforge/MASTER_ENCRYPTION_KEY
polyforge/TOTP_ENCRYPTION_KEY
polyforge/DATABASE_URL
polyforge/DIRECT_DATABASE_URL
polyforge/ADMIN_DATABASE_URL
polyforge/ADMIN_DIRECT_DATABASE_URL
polyforge/POLY_BUILDER_API_KEY
polyforge/POLY_BUILDER_SECRET
polyforge/POLY_BUILDER_PASSPHRASE
polyforge/POLYGON_RPC_URL
polyforge/GAS_SPONSOR_PRIVATE_KEY
polyforge/KALSHI_KEY_ID
polyforge/KALSHI_PRIVATE_KEY_PEM
polyforge/POSTHOG_API_KEY
polyforge/TELEGRAM_BOT_TOKEN
polyforge/DISCORD_BOT_TOKEN
polyforge/WHATSAPP_TOKEN
polyforge/WHATSAPP_APP_SECRET
```

Non-sensitive config (`NODE_ENV`, `LOG_LEVEL`, `SCENARIO`, ports, URLs) can remain in the production `.env` or be passed via Docker environment.

---

*Reference: [Dev Setup Guide](./09-dev-setup.md) · [Config Files Tutorial](./11-config-files-setup.md)*
