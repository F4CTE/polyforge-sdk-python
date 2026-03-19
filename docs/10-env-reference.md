# Polyforge — Environment Variables Reference

> Complete reference for every environment variable used in Polyforge.  
> Copy `.env.example` to `.env` before running anything locally.

---

## Runtime

| Variable | Dev default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `production` \| `test`. Controls rate-limit strictness: production uses tight per-route limits (5–10 req/hr); dev/test uses relaxed limits (500–10000) to support E2E testing. |
| `LOG_LEVEL` | `debug` | `debug` \| `info` \| `warn` \| `error` |

---

## User Database

Used by all user-facing services: `auth-service`, `api-service`, `strategy-engine`, `order-service`, `paper-order-service`, `backtest-service`, `notification-service`, `bot-service`, `signer-service`, `market-data-service`.

| Variable | Dev default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://poly:devpass@pgbouncer:5432/polyforge?pgbouncer=true&connection_limit=1` | Points to PgBouncer (transaction mode). Used by all user-facing services at runtime. |
| `DIRECT_DATABASE_URL` | `postgresql://poly:devpass@postgres:5432/polyforge` | Points directly to Postgres, bypassing PgBouncer. Used **only** by `prisma migrate`. |

---

## Admin Database

Used **exclusively** by `admin-auth-service` and `admin-api-service`. No user-facing service has these variables in its environment.

| Variable | Dev default | Description |
|---|---|---|
| `ADMIN_DATABASE_URL` | `postgresql://poly_admin:devpass_admin@pgbouncer-admin:5433/polyforge_admin?pgbouncer=true&connection_limit=1` | Points to PgBouncer-admin. Used by admin services at runtime. |
| `ADMIN_DIRECT_DATABASE_URL` | `postgresql://poly_admin:devpass_admin@postgres-admin:5434/polyforge_admin` | Points directly to the admin Postgres instance. Used **only** by `prisma migrate --schema prisma/schema.admin.prisma`. |

---

## Redis

| Variable | Dev default | Description |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379` | Shared Redis instance. Used by all services. |

---

## JWT Secrets

Dev values are placeholder strings. In production, all are fetched from AWS Secrets Manager at boot — never stored in environment files.

| Variable | Description |
|---|---|
| `USER_JWT_SECRET` | Signs user JWTs (7 day TTL). Used by `auth-service` and all services that verify user tokens. |
| `ADMIN_JWT_SECRET` | Signs admin JWTs (1 hour TTL). Used by `admin-auth-service` and `admin-api-service`. |
| `BOT_JWT_SECRET` | Signs bot JWTs (30 day TTL). Used by `auth-service` and `bot-service`. |
| `INTERNAL_JWT_SECRET` | Signs service-to-service JWTs (30 second TTL). Used by every service for internal calls. |

---

## Encryption

Dev values are 32-byte hex zero strings. In production, real random values are stored in AWS Secrets Manager.

| Variable | Description |
|---|---|
| `MASTER_ENCRYPTION_KEY` | 32-byte hex. Master key for envelope encryption (KEK). Used **only** by `signer-service` to encrypt/decrypt DEKs. Never passed to any other service. |
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

---

## Polymarket APIs

| Variable | Dev default | Description |
|---|---|---|
| `GAMMA_API_URL` | `http://mock-polymarket:3096` | Polymarket Gamma API (market metadata). Points to mock in dev. |
| `CLOB_API_URL` | `http://mock-polymarket:3099` | Polymarket CLOB REST API (order submission). Points to mock in dev. |
| `CLOB_WS_URL` | `ws://mock-polymarket:3098` | Polymarket CLOB WebSocket (price feed). Points to mock in dev. |
| `DATA_API_URL` | `http://mock-polymarket:3097` | Polymarket Data API (historical prices). Points to mock in dev. |
| `SCENARIO` | `normal` | Mock behaviour: `normal` \| `volatile` \| `api_down` \| `rate_limited` \| `slow` |

---

## Polymarket Builder Program

| Variable | Dev default | Description |
|---|---|---|
| `POLY_BUILDER_API_KEY` | `dev-builder-api-key` | Builder program API key. Ignored by mock-polymarket in dev. |
| `POLY_BUILDER_SECRET` | `dev-builder-secret` | Builder program secret. |
| `POLY_BUILDER_PASSPHRASE` | `dev-builder-passphrase` | Builder program passphrase. |

---

## Blockchain

| Variable | Dev default | Description |
|---|---|---|
| `CHAIN_ID` | `137` | Polygon mainnet. Do not change. |

---

## Bots

| Variable | Dev default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `dev-disabled` | Telegram bot token from @BotFather. Set a real token to test the bot locally. `dev-disabled` disables the bot. |
| `DISCORD_BOT_TOKEN` | `dev-disabled` | Discord bot token. `dev-disabled` disables the bot. |

---

## CORS & Domains

| Variable | Dev default | Description |
|---|---|---|
| `FRONTEND_URL` | `https://localhost` | User app URL. Used in email links and CORS config. |
| `ADMIN_URL` | `https://admin.polyforge.app` | Admin app URL. Used in CORS config. |
| `CORS_ORIGINS` | `https://localhost` | Comma-separated list of allowed origins for user-facing services. |
| `ADMIN_CORS_ORIGINS` | `https://admin.polyforge.app` | Allowed origins for admin services. |

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
| `MOCK_POLYMARKET_PORT` | `3096` | mock-polymarket (dev only) |

---

## Production — AWS Secrets Manager

In production, secrets are never stored in environment files. All sensitive variables are fetched from AWS Secrets Manager at service boot using the EC2 IAM role.

**Secret paths (one secret per variable):**

```
polyforge/USER_JWT_SECRET
polyforge/ADMIN_JWT_SECRET
polyforge/BOT_JWT_SECRET
polyforge/INTERNAL_JWT_SECRET
polyforge/MASTER_ENCRYPTION_KEY
polyforge/TOTP_ENCRYPTION_KEY
polyforge/DATABASE_URL
polyforge/DIRECT_DATABASE_URL
polyforge/ADMIN_DATABASE_URL
polyforge/ADMIN_DIRECT_DATABASE_URL
polyforge/POLY_BUILDER_API_KEY
polyforge/POLY_BUILDER_SECRET
polyforge/POLY_BUILDER_PASSPHRASE
polyforge/TELEGRAM_BOT_TOKEN
polyforge/DISCORD_BOT_TOKEN
```

Non-sensitive config (`NODE_ENV`, `LOG_LEVEL`, `SCENARIO`, ports, URLs) can remain in the production `.env` or be passed via Docker environment.

---

*Reference: [Dev Setup Guide](./09-dev-setup.md) · [Config Files Tutorial](./12-config-files-setup.md)*
