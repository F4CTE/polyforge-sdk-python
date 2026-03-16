# Polyforge — Build Status

> Living tracker. Update this file as each item ships.
> Full detail per phase: [`docs/11-roadmap.md`](./docs/11-roadmap.md)

---

## Next Up

1. Angular user app (Phase 5)

---

## Phase 1 — Foundations

### Monorepo & Infrastructure

- [x] Turborepo 2 + pnpm workspaces configured
- [x] Root `tsconfig.json` (shared base config)
- [x] `packages/shared-types` — all TypeScript interfaces and enums
- [x] `packages/shared-db` — Prisma NestJS module (two DBs: polyforge + polyforge_admin)
- [x] `packages/shared-redis` — ioredis factory + stream helpers
- [x] `packages/shared-auth` — JWT guards + internal service client
- [x] `packages/logger` — pino + nestjs-pino
- [x] `packages/shared-schemas` — Zod validation schemas (orders, streams, WebSocket)
- [x] Package build pipeline — `dist/` output, `main`/`types` pointing to compiled JS
- [x] Docker Compose — Postgres, PgBouncer, Redis, MailHog, migrations container
- [x] `.env.example` — all variables documented
- [x] Vitest test infrastructure — auth-service (64 tests, 99% cov) + admin-auth-service (15 tests, 100% cov)
- [x] CI/CD — GitHub Actions: lint → typecheck → test → build

### Prisma Schema & Migrations

- [x] Prisma 7.5.0 configured (two schemas: `polyforge` + `polyforge_admin`)
- [x] Initial migration applied
- [x] Complete schema (all 29 tables per [`Polyforge-Database-Schema.pdf`](./Polyforge-Database-Schema.pdf))
- [x] TimescaleDB hypertables (`price_snapshots`, `pnl_snapshots`)
- [x] Critical indexes (31 indexes across 10 tables)
- [x] `seed.ts` (alice, bob, charlie, carol, dave + strategies, orders, positions, social, backtest)

### mock-polymarket

- [x] REST mock: Gamma API, CLOB API, Data API
- [x] WebSocket mock: price feed, order book, order lifecycle events
- [x] 5 scenarios (`normal`, `volatile`, `api_down`, `rate_limited`, `slow`)
- [x] 10 fixture markets aligned with seed data

---

## Phase 2 — Auth & Market Data

### auth-service (port 3001)

- [x] NestJS 11 + Fastify, global prefix `auth/v1`
- [x] `POST /auth/v1/register` — create account, bcrypt password, spec-compliant response + error codes
- [x] `POST /auth/v1/login` — JWT (7 days), spec-compliant response + error codes, suspended/TOTP handling
- [x] `GlobalExceptionFilter`, `ValidationPipe`
- [x] `GET /health` endpoint
- [x] `GET /auth/v1/me`
- [x] `POST /auth/v1/logout`
- [x] Email verification (send on register, `POST /auth/v1/verify-email`)
- [x] `POST /auth/v1/forgot-password` + `POST /auth/v1/reset-password`
- [x] 2FA/TOTP: setup, confirm, 10 backup codes, disable
- [x] Polymarket credentials import (forward to signer-service, marks user CONNECTED)
- [x] Credentials delete (marks user disconnected, notifies signer-service)
- [x] Bot-link (6-digit code, TTL 5 min, one-time consume)
- [x] Rate limiting per IP on sensitive routes

### market-data-service (port 3005)

- [x] Polymarket WebSocket with exponential reconnect (1s→30s, factor 2)
- [x] Write price snapshots to TimescaleDB (5s batch flush, OHLCV)
- [x] Redis cache: `cache:price:{tokenId}` (TTL 10s), `cache:book:{tokenId}` (TTL 5s)
- [x] Data gap detection and recording (30s threshold, writes `dataGap` records)
- [x] Binary-only market filter (exclude neg-risk)
- [x] Gamma API polling every 60s — upserts markets + tokens, subscribes WS
- [x] Docker image + docker-compose integration

### admin-auth-service (port 3003)

- [x] NestJS 11 + Fastify, global prefix `auth/v1`
- [x] `POST /auth/v1/login` — admin JWT (1 hour), Redis session storage
- [x] `POST /auth/v1/logout` — Redis session revocation
- [x] `GET /health` endpoint

---

## Phase 3 — Trading Critical Path

### signer-service (port 3012)

- [x] AES-256-GCM envelope encryption (DEK per user, KEK from env / AWS Secrets Manager)
- [x] EIP712 signing — stub in dev, `@polymarket/clob-client` in prod (dynamic import)
- [x] Builder Program HMAC attribution on every order
- [x] `signer-only` network isolation (no published Docker ports)
- [x] Canary credential honeypot (seeded on startup)
- [x] Internal JWT auth guard with jti replay protection
- [x] Docker image + docker-compose integration

### order-service (port 3007)

- [x] Redis Stream consumer (`stream:orders`) with consumer group + at-least-once ACK
- [x] Order batching (up to 15 per user per request, concurrent by userId)
- [x] Full order lifecycle (PENDING → SUBMITTED → LIVE/MATCHED → CONFIRMED)
- [x] Exponential backoff retry (3 attempts, base 1s) → DLQ (`stream:orders:dlq`)
- [x] Event emission to `stream:events` (ORDER_PLACED, ORDER_FILLED, ORDER_FAILED, ORDER_CANCELLED)
- [x] Manual close position (FOK SELL via internal endpoint)
- [x] Internal JWT auth guard (aud: order-service) on close endpoint
- [x] Docker image + docker-compose integration

### strategy-engine (port 3006)

- [x] Tick loop (floor 200ms, configurable tickMs per strategy)
- [x] Event loop (price event triggers for EVENT/HYBRID mode)
- [x] Block evaluation order: SAFETY → TRIGGER → CONDITION → ACTION
- [x] All 36 blocks implemented (6 safety, 6 event triggers, 7 tick triggers, 9 conditions, 8 actions)
- [x] Stale data detection — auto-pause if cache:price > 5s, auto-resume when fresh
- [x] `OrderIntent` publish to `stream:orders` (XADD)
- [x] Start / Stop / Pause / Resume per strategy (internal JWT endpoints)
- [x] Per-strategy Redis state (betsToday, dailyPnl, consecutive losses, etc.) — resets at midnight UTC
- [x] Docker image + docker-compose integration

---

## Phase 4 — API, Paper & Backtest

### paper-order-service (port 3008)

- [x] Redis Stream consumer (`stream:paper_orders`) with consumer group + at-least-once ACK
- [x] Price improvement: fill at best ask/bid when better than intent price (from `cache:book:{tokenId}`)
- [x] Falls back to `cache:price:{tokenId}` or intent price when no book data
- [x] Writes to `paper_orders` + upserts `paper_positions` (weighted avg, close tracking)
- [x] Realized P&L tracked in Redis `paper:{userId}:pnl` (real-time incrbyfloat)
- [x] Emits `PAPER_ORDER_FILLED` to `stream:events` (relayed to WebSocket by api-service)
- [x] strategy-engine routes PAPER strategies to `stream:paper_orders` (not `stream:orders`)
- [x] Docker image + docker-compose integration

### backtest-service (port 3009)

- [x] Historical replay on TimescaleDB `price_snapshots`
- [x] Async queue (`stream:backtests`) with consumer group + at-least-once ACK
- [x] Progress updates: Redis `backtest:{runId}:progress` + `BACKTEST_PROGRESS` events to `stream:events`
- [x] Metrics: total P&L, win rate, max drawdown, annualised Sharpe ratio, equity curve per fill
- [x] Data gap detection from `data_gaps` table (warns in result)
- [x] Writes `backtest_orders` with per-fill equityCurve (batch flush, 500/flush)
- [x] Block evaluator: 30 supported blocks, pure in-memory (no live Redis touched)
- [x] Docker image + docker-compose integration

### api-service (port 3002)

- [x] NestJS 11 + Fastify, global prefix `api/v1`
- [x] Markets REST: list, detail, price-history (TimescaleDB), order book (Redis cache)
- [x] Strategies REST: CRUD, start/stop/pause/resume/fork/like
- [x] Comments, reports, templates
- [x] Discover feed + leaderboard
- [x] Orders REST + close position (FOK via stream:orders)
- [x] Portfolio + P&L charts (pnl_snapshots TimescaleDB)
- [x] Price alerts (max 50 per user)
- [x] Paper summary + reset (PaperOrder/PaperPosition models)
- [x] Backtests REST (list + create, quickMode stub)
- [x] Social: profiles, follow/unfollow, settings (profile/notifications/password)
- [x] WebSocket gateway (native ws on /ws — auth, prices, strategies, orders, events relay from stream:events)
- [x] Docker image + docker-compose integration
- [ ] OpenAPI pipeline: `swagger.json` generated at build time

---

## Phase 5 — Angular User App

- [ ] Routing + guards (`AuthGuard`, `ConnectedGuard`, `VerifiedGuard`)
- [ ] PrimeNG theme + design system
- [ ] Auth pages (register, login, 2FA, credentials import)
- [ ] Market browser + OHLCV charts
- [ ] Strategy Builder (drag-and-drop, 36 blocks, quick backtest)
- [ ] Strategy management (status badges, live logs)
- [ ] Portfolio + orders
- [ ] Social (discover, leaderboard, profiles, comments)
- [ ] Settings + notifications centre + price alerts
- [ ] Backtest runner + results

---

## Phase 6 — Admin, Bots & Notifications

### notification-service (port 3010)

- [x] Consumes `stream:events` (consumer group `notification-service`)
- [x] Routes events to NotificationEventType: ORDER_FILLED, STRATEGY_ERROR, BACKTEST_COMPLETE, PRICE_ALERT, DAILY_LOSS_LIMIT, MARKET_RESOLVED, social events
- [x] Checks `notification_preferences` per user (Redis-cached 5min, TTL)
- [x] `minFillNotifyUsdc` threshold respected for ORDER_FILLED
- [x] Email dispatch: nodemailer → MailHog in dev, SES SMTP in prod
- [x] Telegram dispatch: Bot API via fetch (disabled when `TELEGRAM_BOT_TOKEN=dev-disabled`)
- [x] Discord dispatch: Bot API via fetch (disabled when `DISCORD_BOT_TOKEN=dev-disabled`)
- [x] In-app push: always emits `NOTIFICATION` event to `stream:events` (relayed by api-service WebSocket)
- [x] Frequency modes: IMMEDIATE (dispatch now), HOURLY/DAILY (Redis list digest, flush on timer)
- [x] Writes `notification_history` per send attempt (success + error)
- [x] HTML email templates per event type with severity colour coding
- [x] Docker image + docker-compose integration

### bot-service (port 3011)

- [x] Telegram long-polling (fetch-based, no library, disabled when `TELEGRAM_BOT_TOKEN=dev-disabled`)
- [x] Discord gateway via discord.js v14 (DM-only, disabled when `DISCORD_BOT_TOKEN=dev-disabled`)
- [x] Linking flow: `/connect <code>` reads `bot:link:{code}` from Redis, deactivates old connections, issues 30-day bot JWT, writes `BotConnection`
- [x] `/disconnect` → marks `BotConnection.active = false`
- [x] 14 commands: `/start`, `/connect`, `/disconnect`, `/help`, `/status`, `/stop`, `/pause`, `/resume`, `/pnl`, `/orders`, `/positions`, `/paper`, `/alerts` (14 total matching spec)
- [x] Strategy control via internal JWT → strategy-engine `/internal/strategies/:id/{pause|resume}` + DELETE
- [x] Push-out via `TelegramService.send()` / `DiscordService.send()` — called by notification-service
- [x] Docker image + docker-compose integration

### admin-api-service (port 3004)

- [x] NestJS 11 + Fastify, global prefix `api/v1`, admin JWT guard (Redis session check)
- [x] `GET /api/v1/health` — polls all 11 services every 10s (cached in Redis TTL 15s), DB + Redis stats
- [x] `GET /api/v1/users` — paginated list with search, status, suspended filter
- [x] `GET /api/v1/users/:id` — full detail (login history, strategies, counts); audit-logs VIEW_USER_DETAIL
- [x] `PATCH /api/v1/users/:id/suspend` + `/unsuspend` — audit-logs SUSPEND_USER / UNSUSPEND_USER
- [x] `PATCH /api/v1/users/:id/limits` — upsert UserLimit; audit-logs UPDATE_USER_LIMITS
- [x] `GET /api/v1/strategies` — all strategies across all users (paginated, filterable)
- [x] `POST /api/v1/strategies/:id/force-stop` — calls strategy-engine via internal JWT, updates DB; audit-logs FORCE_STOP_STRATEGY
- [x] `PATCH /api/v1/strategies/:id/unpublish` — sets visibility PRIVATE; audit-logs UNPUBLISH_STRATEGY
- [x] `GET /api/v1/orders` — all orders (paginated, filterable by user/status/date)
- [x] `GET /api/v1/orders/dlq` — reads stream:orders:dlq entries
- [x] `POST /api/v1/orders/dlq/:intentId/replay` — re-publishes to stream:orders
- [x] `POST /api/v1/orders/dlq/:intentId/discard` — removes from DLQ stream
- [x] `GET /api/v1/cache/stats` — Redis memory, key counts by prefix
- [x] `DELETE /api/v1/cache/:pattern` — flush keys matching pattern (cache:* only)
- [x] `GET /api/v1/backtests` — all backtest runs (paginated)
- [x] `GET /api/v1/reports` — report moderation queue (filterable by status)
- [x] `PATCH /api/v1/reports/:id` — review/dismiss; audit-logs REVIEW_REPORT
- [x] `POST /api/v1/notifications/broadcast` — publishes NOTIFICATION events to stream:events for all/subset users
- [x] `GET /api/v1/notifications/stats` — total/last24h/failed counts from notification_history
- [x] `GET /api/v1/logs/audit` — audit_logs from admin DB (paginated, filterable)
- [x] `GET /api/v1/logs/events` — event_log from user DB
- [x] `GET /api/v1/logs/logins` — user_login_history
- [x] `GET /api/v1/logs/notifications` — notification_history
- [x] `GET /api/v1/builder/stats` — attributed volume, active strategies, connected users
- [x] Nightly retention cron (3am UTC): login_history 90d, notification_history 90d, paper_orders 90d, strategy_events 7d, event_log 30d/1y
- [x] AuditService — writes to audit_logs (admin DB) for all destructive admin actions
- [x] Docker image + docker-compose integration

### Angular admin-app

- [ ] All admin views

---

## Phase 7 — QA & Production

- [ ] Unit tests: strategy-engine 36 blocks coverage
- [ ] Integration tests: auth → signer → order end-to-end
- [ ] E2E tests (Playwright): register → credentials → strategy → live order
- [ ] Load tests: 100 strategies, 1000 ticks/sec
- [ ] AWS infrastructure (EC2, RDS, ElastiCache, ECR, Secrets Manager, SES, CloudWatch)
- [ ] Production deploy (`docker-compose.prod.yml`)
- [ ] Builder Program registration with Polymarket (start in Phase 3 — external delay)
- [ ] Soft launch (invite only)
