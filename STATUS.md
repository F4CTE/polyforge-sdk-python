# Polyforge — Build Status

> Living tracker. Update this file as each item ships.
> Full detail per phase: [`docs/11-roadmap.md`](./docs/11-roadmap.md)

---

## Next Up

🎉 All phases complete. Polyforge is production-ready.

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
- [x] OpenAPI pipeline: `swagger.json` written to `dist/` on every startup; Swagger UI at `/api/v1/docs` in dev; all 11 controllers tagged + JWT bearer auth documented

---

## Phase 5 — Angular User App

### Scaffold + Auth (done)

- [x] Angular 21 + PrimeNG 21 standalone app (`apps/user-app/`)
- [x] Aura theme preset with custom dark surface palette (`#0d1117` base)
- [x] `app.config.ts` — `provideRouter` (view transitions), `provideHttpClient` (fetch + interceptors), `provideAnimationsAsync`, `providePrimeNG`
- [x] `AuthStore` — signals (`user`, `loading`, `isAuthenticated`, `isVerified`, `isConnected`), bootstraps from token on init
- [x] `TokenService` — localStorage JWT, decode/expiry check
- [x] `AuthApiService` — all auth-service endpoints (login, register, logout, me, verify-email, forgot/reset-password, TOTP, credentials, bot-link)
- [x] `authInterceptor` — attaches Bearer token to all requests
- [x] `errorInterceptor` — redirects to /login on 401
- [x] Guards: `authGuard`, `verifiedGuard`, `connectedGuard`
- [x] `LayoutComponent` — collapsible sidebar nav (Trade + Social sections), top bar with user menu, `<router-outlet>`
- [x] `LoginComponent` — email+password form, inline TOTP step on `TOTP_REQUIRED` error
- [x] `RegisterComponent` — email/username/password/ToS form with inline validation
- [x] `VerifyEmailComponent` — auto-verifies from `?token=` query param, waiting/resend state
- [x] `ForgotPasswordComponent` — email form, always-200 response handling
- [x] `ResetPasswordComponent` — password+confirm form with match validation, reads `?token=`
- [x] Dev proxy (`proxy.conf.json`) — `/auth/v1` → `:3001`, `/api/v1` → `:3002` (with WS)
- [x] Lazy-loaded route skeleton for all features (markets, strategies, portfolio, orders, backtest, discover, leaderboard, profile, settings)

### Design System (done)

- [x] `PolyforgeTheme` PrimeNG preset (cyan primary, dark blue-night surface, component overrides)
- [x] `tokens.css` — all `--pf-*` CSS custom properties
- [x] `chart.config.ts` — Chart.js defaults (Polyforge palette)
- [x] `styles.scss` — Outfit + JetBrains Mono fonts, `--pf-*` variables, all global utilities
- [x] Always-dark mode (`darkModeSelector: false`)

### Markets (done)

- [x] `MarketsApiService` — list, get, price-history, order-book
- [x] `WebSocketService` — connect, reconnect, subscribe/unsubscribe prices, ping
- [x] `MarketsListComponent` — searchable/sortable table, live YES/NO prices, pagination
- [x] `MarketDetailComponent` — OHLCV line chart (1m/1h/1d), order book depth, live prices, market info

### Strategies (done)

- [x] `StrategiesApiService` — list, get, create, update, delete, start/stop/pause/resume, fork
- [x] `WebSocketService` — strategy event subscription (STARTED/STOPPED/PAUSED/RESUMED/ERROR)
- [x] `StrategiesListComponent` — filter tabs, status badges with pulse dot, inline start/stop/pause/resume actions
- [x] `StrategyDetailComponent` — block summary, live event log via WebSocket, action buttons
- [x] `StrategyBuilderComponent` — all 36 blocks (safety/triggers/conditions/actions), config forms, create + edit mode

### Portfolio + Orders (done)

- [x] `PortfolioApiService` — portfolio, pnl, paper summary/reset, orders, close-position
- [x] `PortfolioComponent` — Live/Paper tabs, P&L chart (color-coded), positions table with close button, paper summary
- [x] `OrdersComponent` — status filter tabs, full order table (side/outcome/size/price/fill/status), pagination

### Social + Settings (done)

- [x] `SocialApiService` — discover, leaderboard, profile, follow, update profile/notifications/password
- [x] `DiscoverComponent` — public strategy grid with sort tabs (popular/newest/top_pnl/most_forked), pagination
- [x] `LeaderboardComponent` — trader rank table (7d/30d/allTime), P&L/win-rate/trade count, profile links
- [x] `MyProfileComponent` — own profile view (avatar, display name, bio, status chips, quick links)
- [x] `PublicProfileComponent` — any user profile with follow/unfollow, follower/following/strategy counts
- [x] `SettingsComponent` — tabbed: Profile (displayName/bio/avatar/twitter), Security (password + TOTP enable/disable), Notifications (toggle list)
- [x] `TradingAccountComponent` — Polymarket credentials import/delete, bot link code generator

### Backtest (done)

- [x] `BacktestApiService` — list, run, get
- [x] `WebSocketService` — backtest event types (PROGRESS/COMPLETED/FAILED)
- [x] `BacktestComponent` — run panel (strategy picker, date range), live progress via WS, history table with expandable results (P&L/win-rate/order counts)

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

- [x] Angular 21 + PrimeNG 21 standalone app (`apps/admin-app/`)
- [x] `AdminTheme` — same dark blue-night palette, cyan primary, always-dark
- [x] `AdminAuthStore` — decodes JWT payload to restore session (no server call, 1h JWT)
- [x] `AdminAuthApiService` — login/logout → `/auth/v1` (port 3003)
- [x] `AdminApiService` — all admin API methods (health, users, strategies, orders, DLQ, backtests, cache, rate limits, reports, builder stats, audit/event/login logs, invites, waitlist, config flags, admin management)
- [x] `TokenService`, `authInterceptor`, `errorInterceptor`, `authGuard`
- [x] `LayoutComponent` — collapsible sidebar (Monitor / Manage / Moderation / System sections); System section visible to SUPER_ADMIN only
- [x] `LoginComponent` — email + password, IP restriction note
- [x] `DashboardComponent` — health status banner + service grid + infra cards (DB/Redis), auto-refresh 15s, Launch Control card (invite-only toggle)
- [x] `UsersListComponent` — search + status + suspended filters, paginated table with user detail links
- [x] `UserDetailComponent` — identity / security / limits / activity cards; suspend/unsuspend + edit limits dialogs
- [x] `StrategiesComponent` — all strategies table with force-stop (ConfirmationService) + unpublish
- [x] `OrdersComponent` — orders table + DLQ tab (replay/discard per entry)
- [x] `BacktestsComponent` — all backtest runs with status badges and progress bars
- [x] `CacheComponent` — cache stats + pattern hit-rate breakdown + manual flush + rate limits table
- [x] `ReportsComponent` — moderation queue; approve/dismiss with admin note dialog
- [x] `LogsComponent` — three tabs: Audit / Events / Logins, paginated
- [x] `BuilderComponent` — tier card + weekly reward + attributed volume + bar chart + weekly breakdown table
- [x] `InvitesComponent` — invite code generation + active codes table + waitlist management (send invite, remove); correct admin CSS class names
- [x] `AdminsComponent` — SUPER_ADMIN-only; list all admins, create admin (dialog), edit name/role/active/password (dialog), deactivate/reactivate; every action audit-logged
- [x] `styles.scss` — all admin-specific utility classes and component styles

---

## Phase 7 — QA & Production

- [x] Unit tests: strategy-engine 36 blocks coverage (169 tests, 98%+ stmts/lines/funcs, 79% branches)
- [x] Integration tests: signer-service (72 tests, AES-256-GCM roundtrip, signing pipeline) + order-service (46 tests, full lifecycle, retry/DLQ, CLOB/signer clients)
- [x] E2E tests (Playwright): smoke (7 tests) + auth-flow (10 tests) + credentials (5 tests) + strategy-lifecycle (8 tests), POMs for login/register/builder/trading-account/strategies-list, MailHog + direct-API helpers
- [x] Load tests: k6 suite — auth (50 VUs), REST (130 VUs), WebSocket (200 VUs), strategy pipeline (100 strats × 1000 ticks/sec), resilience (api_down + WS reconnect)
- [x] AWS infrastructure — Terraform: VPC, EC2 c5.2xlarge + Elastic IP, RDS pg16+TimescaleDB Multi-AZ, ElastiCache Redis7, 13 ECR repos, Secrets Manager, SES + DKIM, 9 CloudWatch alarms + dashboard, IAM roles
- [x] Production deploy (`docker-compose.prod.yml` + gateway Dockerfile + nginx.prod.conf + scripts/deploy.sh + fetch-secrets.sh + issue-certs.sh)
- [x] Builder Program registration with Polymarket — registered, API keys obtained
- [x] Soft launch (invite only) — invite gate in auth-service, admin invite CRUD (POST/GET/DELETE /api/v1/invites), launch runbook (`docs/13-launch-runbook.md`)

---

## Pre-launch Polish

- [x] Legal pages — `/terms` (Terms of Service, 14 sections) and `/privacy` (Privacy Policy, 12 sections) in user-app
- [x] 404 page — `NotFoundComponent` with gradient "404", bolt icon, links to `/markets` and `/strategies`
- [x] Landing page (`apps/landing/`) — full SEO static page: OG meta, Twitter Card, JSON-LD, hero + feature grid + how-it-works + CTA, zero-JS waitlist form
- [x] Favicon — SVG favicon (32×32 dark rounded square + cyan bolt) in landing, user-app, admin-app
- [x] OG image — `og-image.png` (1200×630) generated from SVG via `@resvg/resvg-js` script
- [x] Waitlist backend — `POST /auth/v1/waitlist` (throttled 3/hr), Redis ZSET `waitlist:emails`, confirmation email on first join
- [x] Admin waitlist panel — `Invites & Waitlist` page: Waitlist tab with list, send-invite, and remove; `GET/DELETE/POST /api/v1/waitlist`
- [x] Admin send-invite — `POST /api/v1/waitlist/:email/send-invite` generates 1-use code + emails it via `AdminMailService`
- [x] Branded email templates — shared `emailLayout()` function (dark header + bolt logo + footer); verification, password reset, waitlist confirmation, invite emails all using layout
- [x] CORS — `app.enableCors()` in auth-service `main.ts` with allowed origins: `polyforge.app`, `www.polyforge.app`, dev `localhost:42xx`
- [x] nginx landing routing — `location = /` serves `apps/landing/index.html`; regex block for landing static assets; Angular SPA as fallback
- [x] INVITE_ONLY runtime toggle — `config:invite_only` Redis key; `GET /api/v1/config` + `PATCH /api/v1/config/invite-only`; auth-service checks Redis first, falls back to env var; admin dashboard "Launch Control" card
- [x] Retention docs — `waitlist:emails` and `config:invite_only` noted as excluded from retention jobs
- [x] CORS — api-service, admin-auth-service, admin-api-service all have `app.enableCors()` with correct origin allowlists
- [x] Register page invite-code field — reads `?invite=CODE` query param, auto-fills + uppercases, shows on `INVITE_REQUIRED`/`INVITE_INVALID` errors
- [x] `robots.txt` — user-app serves `public/robots.txt` blocking `/login`, `/register`, `/settings`, `/portfolio` from crawlers
- [x] Cookie consent banner — `CookieBannerComponent` fixed-bottom bar, localStorage-dismissed, links to Privacy Policy
- [x] Launch runbook updated — Step 12 uses runtime toggle via admin panel / API instead of env var + restart; waitlist send-invite steps added

---

## Post-Launch Polish & Fixes (2026-03-18)

### Docker Frontend Serving

- [x] `apps/user-app/Dockerfile` — multi-stage (Node 24 + `npm install` + `ng build --configuration production`) → nginx:1.27-alpine serving `dist/user-app/browser/`
- [x] `apps/admin-app/Dockerfile` — same pattern, serves `dist/admin-app/browser/`
- [x] `apps/landing/Dockerfile` — nginx:1.27-alpine serving static files directly (no build step)
- [x] `apps/user-app/nginx.conf` + `apps/admin-app/nginx.conf` + `apps/landing/nginx.conf` — per-app nginx configs with `try_files $uri $uri/ /index.html` for SPA routing
- [x] `.dockerignore` — excludes `**/node_modules`, `**/dist`, `**/.angular`, `**/.turbo` from Docker build context
- [x] `docker-compose.infra.yml` — added `user-app`, `admin-app`, `landing` services; all on `internal` network
- [x] `services/gateway/nginx.dev.conf` — dev nginx gateway: port 80 → user app (landing + SPA + api-service + auth-service + WebSocket), port 8080 → admin app (admin-app + admin-api-service + admin-auth-service)
- [x] Docker DNS auto-resolution — `resolver 127.0.0.11 valid=10s ipv6=off` + `set $upstream` variables in all nginx location blocks; no manual reload needed after service rebuilds
- [x] `gateway` service added to docker-compose: image `nginx:1.27-alpine`, ports `80:80` + `8080:8080`

### Bug Fixes

- [x] `environment.prod.ts` (user-app) — `authApiUrl`, `apiUrl`, `wsUrl` set to `''` (relative) so API calls route through the gateway in Docker dev
- [x] `app.config.ts` (user-app) — `MessageService` added to global providers, fixing `NG0201` crash that caused blank pages
- [x] CORS — `http://localhost` added to allowed origins in `auth-service` + `api-service`; `http://localhost:8080` added to `admin-auth-service` + `admin-api-service`
- [x] `.env` — `FRONTEND_URL` changed from `http://localhost:4200` to `http://localhost` so invite email links work through the gateway
- [x] `admin-api-service` docker-compose env — added `EMAIL_DRIVER`, `MAILHOG_HOST`, `MAILHOG_PORT`, `FRONTEND_URL`, `mailhog` depends_on (fixes send-invite)
- [x] `InvitesComponent` — corrected CSS class names from user-app style to admin-app style (`admin-card`, `admin-section-title`, `admin-form-field`, `admin-form-label`, `strategy-filter-tabs`, `filter-tab`)
- [x] `RegisterComponent` — added "Confirm password" field with cross-field validator; blocks submission if passwords don't match

### Admin Management Feature

- [x] `services/admin-api-service/src/admins/` — new module: `GET/POST /api/v1/admins`, `PATCH/DELETE /api/v1/admins/:id`; SUPER_ADMIN-only; bcryptjs password hashing; every action audit-logged
- [x] `apps/admin-app/features/admins/` — `AdminsComponent`: table of all admins, create dialog, edit dialog (name/role/active/password reset), deactivate/reactivate with confirmation; SUPER_ADMIN sidebar item only
- [x] `admin.model.ts` — added `AdminView` interface
- [x] `AdminApiService` — added `listAdmins`, `createAdmin`, `updateAdmin`, `deactivateAdmin` methods

### Security Audit & Fixes (2026-03-18)

- [x] **C1** — Removed all hardcoded JWT secret fallbacks (`?? 'dev-secret'`, `?? 'dev-admin-secret'`) from `shared-auth`, `admin-auth-service`, `admin-api-service`; startup env validation (exits if secrets missing) added to `auth-service`, `admin-auth-service`, `admin-api-service`, `signer-service`
- [x] **C4** — Added `@nestjs/throttler` to `admin-auth-service`; 10 req/15 min rate limit on `POST /auth/v1/login`
- [x] **H1** — Explicit `expiresIn: '1h'` on `jwtService.sign()` call in admin-auth-service (defence-in-depth over module config)
- [x] **H2** — Fixed X-Forwarded-For spoofing: `adminIp` now uses only the first IP in the chain
- [x] **H4** — Added `@MaxLength(100)` to `password` field in `auth-service` LoginDto
- [x] **H5** — `AdminsService.update/deactivate` now invalidate all Redis sessions for the target admin immediately
- [x] **H6** — Added `@Matches(/^POLY-[A-Z0-9]{6}$/)` to `inviteCode` in RegisterDto
- [x] **H7** — Signer-service `InternalAuthGuard` JTI replay protection migrated from in-process `Set` to Redis `SET NX` (60s TTL); added `@polyforge/shared-redis` dependency
- [x] **M1** — Tightened CORS in `auth-service` and `api-service` dev origins: removed `4201`, `4300`; kept `localhost` (gateway) + `localhost:4200` (ng serve)
- [x] **M2** — Startup validation rejects all-zero `TOTP_ENCRYPTION_KEY` in production
- [x] **M3** — Added `@Matches(/^\d{6}$/)` to `totpCode` in LoginDto
- [x] **M4** — Audit log sanitization: IP sanitized (strip non-printable chars, max 64 chars); `@Param('id')` now uses `ParseUUIDPipe` in admins controller
- [x] **M5** — Added `@Throttle()` (10/hr) to `verify-email` and `reset-password` endpoints in auth-service
- [x] **M6** — Transparent bcrypt re-hash on login for accounts with < 12 rounds (fire-and-forget in `UsersService.rehashIfNeeded`)
- [x] **L1** — Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`) added to all services via Fastify `onSend` hook, and globally in nginx gateway
- [x] **L2** — Swagger `persistAuthorization` set to `false`
- [x] **L4** — Replaced `console.error` in bootstrap catch handlers with `process.stderr.write`; all `main.ts` files use `bootstrap().catch(...)` pattern
- [x] **C2** — HttpOnly `pf_token` / `pf_admin_token` cookies replace localStorage; `@fastify/cookie` registered in all 4 services; JWT strategy and admin guard accept cookie OR Bearer header; WebSocket gateway authenticates from upgrade-request cookie; Angular interceptors send `withCredentials: true` instead of injecting Bearer header; auth stores call `/me` on init; admin-auth-service gains `GET /auth/v1/me` endpoint
- [x] **C3** — HSTS already present in `nginx.prod.conf` (`max-age=63072000; includeSubDomains; preload`); confirmed
- [x] **H3** — CSRF: `SameSite=Lax` cookies prevent cross-origin state-changing requests in all modern browsers; no additional CSRF token needed
- [x] **L3** — JWT secret rotation SOP documented in `docs/07-deployment.md` (zero-downtime procedure, grace period, per-secret TTL guidance)
- [x] **M7** — DB least-privilege documented in `docs/04-database-and-redis.md` (poly_app / poly_admin / poly_migrate roles, audit_logs INSERT-only rule)
