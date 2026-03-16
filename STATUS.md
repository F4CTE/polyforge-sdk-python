# Polyforge — Build Status

> Living tracker. Update this file as each item ships.
> Full detail per phase: [`docs/11-roadmap.md`](./docs/11-roadmap.md)

---

## Next Up

1. `signer-service` — AES-256-GCM envelope encryption, EIP712 signing, Builder Program HMAC
2. `order-service` — Redis Stream consumer, order batching, full lifecycle
3. `api-service` — markets REST, strategies CRUD, WebSocket gateway

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

### order-service

- [ ] Redis Stream consumer (`stream:orders`)
- [ ] Order batching (up to 15 per request)
- [ ] Full order lifecycle (PENDING → CONFIRMED)
- [ ] Exponential backoff retry (3 attempts) → DLQ
- [ ] WebSocket event emission (ORDER_PLACED, ORDER_FILLED, etc.)
- [ ] Manual close position (FOK sell, partial size)

### strategy-engine

- [ ] Tick loop (min 200ms)
- [ ] Event loop (price event triggers)
- [ ] Block evaluation order: SAFETY → TRIGGER → CONDITION → ACTION
- [ ] All 36 blocks implemented (6 safety, 6 event triggers, 7 tick triggers, 9 conditions, 8 actions)
- [ ] Stale data detection (pause if cache > 5s)
- [ ] `OrderIntent` publish to `stream:orders`
- [ ] Start / Stop / Pause / Resume per strategy

---

## Phase 4 — API, Paper & Backtest

### paper-order-service

- [ ] Simulated fills using real Redis price cache
- [ ] Price improvement applied from order book
- [ ] Paper P&L tracked separately from real P&L
- [ ] Paper reset endpoint

### backtest-service

- [ ] Historical replay on TimescaleDB `price_snapshots`
- [ ] Async queue + WebSocket progress (`BACKTEST_PROGRESS` 0–100%)
- [ ] Quick mode (synchronous, last 7 days, inline result)
- [ ] Metrics: P&L, win rate, max drawdown, Sharpe ratio, equity curve
- [ ] Data gap warning in results

### api-service (port 3002)

- [ ] Markets REST: list, detail, price-history, order book
- [ ] Strategies REST: CRUD, start/stop/pause/resume/fork/like
- [ ] Comments, reports, templates
- [ ] Discover feed + leaderboard
- [ ] Orders REST + close position
- [ ] Portfolio + P&L charts
- [ ] Price alerts (max 50 per user)
- [ ] Paper summary + reset
- [ ] Backtests REST
- [ ] Social: profiles, follow, settings
- [ ] WebSocket gateway (auth, prices, strategies, orders, backtests, markets)
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

- [ ] `notification-service` (AWS SES, Telegram, Discord, in-app WebSocket)
- [ ] `bot-service` (Telegram + Discord, 14 commands, JWT bot tokens)
- [ ] `admin-api-service` (health dashboard, user management, DLQ, moderation, Builder Program)
- [ ] Angular `admin-app`

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
