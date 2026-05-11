# Polyforge — Roadmap

> Current English roadmap. Historical legacy frontend and queue-worker planning notes
> were replaced after the v3 React migration and Redis Streams implementation.

---

## Summary

| Phase | Theme | Status |
|---|---|---|
| [Phase 1](#phase-1--foundation) | Foundation | Complete |
| [Phase 2](#phase-2--auth--market-data) | Auth & market data | Complete |
| [Phase 3](#phase-3--critical-trading-path) | Critical trading path | Complete |
| [Phase 4](#phase-4--api-paper-trading--backtesting) | API, paper trading & backtesting | Complete |
| [Phase 5](#phase-5--react-user-app) | React user app | Complete |
| [Phase 6](#phase-6--admin-bots--notifications) | Admin, bots & notifications | Complete |
| [Phase 7](#phase-7--qa--production-hardening) | QA & production hardening | Complete |
| [Phase 8](#phase-8--competitive-features) | Competitive features | Complete |
| [Phase 9](#phase-9--gasless-onboarding--future-planning) | Gasless, onboarding & future planning | Complete |
| [Phase 10](#phase-10--security-audit--deployment-readiness) | Security audit & deployment readiness | Complete |
| [Phase 11](#phase-11--execution-intelligence--platform-moat) | Execution intelligence & platform moat | Complete through v6.15.0 |
| [Phase 12](#phase-12--post-launch-feature-expansion) | Post-launch feature expansion | In progress |

---

## Phase 1 — Foundation

**Complete**

- Turborepo + pnpm workspaces
- Shared TypeScript config, ESLint, and CI pipeline
- Twelve workspace packages:
  - `api-client`
  - `logger`
  - `polyforge-crypto`
  - `polyforge-crypto-native`
  - `polyforge-engine`
  - `shared-auth`
  - `shared-db`
  - `shared-posthog`
  - `shared-redis`
  - `shared-schemas`
  - `shared-types`
  - `ui`
- `docker-compose.infra.yml` local stack: PostgreSQL/TimescaleDB, PgBouncer, Redis with password auth, Nginx, MailHog, PostHog CE, and NestJS services
- `.env.example` with generated-secret placeholders

---

## Phase 2 — Auth & Market Data

**Complete**

- User registration, email verification, login, logout, refresh-token rotation, account deletion
- 2FA/TOTP setup, confirmation, backup-code regeneration, and disable
- Polymarket, Polymarket US, and Kalshi credential import/removal
- Market data ingestion from Polymarket Gamma, CLOB WebSocket, sports RTDS, and Kalshi feed services
- Redis price/book caches plus Redis Stream observability helpers
- Admin auth with IP allowlist at the gateway

---

## Phase 3 — Critical Trading Path

**Complete**

- `signer-service` for encrypted credential handling, EIP-712 signing, Builder attribution, Kalshi JWT signing, and gas sponsorship controls
- `order-service` for CLOB submission, cancel, split/merge, redemption, reconciliation, and DLQ handling
- `strategy-engine` block evaluation, tick runner, state persistence, safety checks, and venue propagation
- `paper-order-service` simulation path for paper orders
- Network isolation: signer-sensitive traffic is restricted to `signer-only` plus internal service access; auth-service is on `internal` in the current dev stack

---

## Phase 4 — API, Paper Trading & Backtesting

**Complete**

- User REST API under `/api/v1`
- Auth REST API under `/auth/v1`
- Native WebSocket gateway via `@nestjs/platform-ws`
- Redis Streams for async work dispatch and progress/events
- Backtesting service with quick and persisted backtest flows
- Paper trading summaries, resets, and simulated fills
- OpenAPI generation through `@nestjs/swagger` and `@hey-api/openapi-ts`

---

## Phase 5 — React User App

**Complete**

The legacy frontend plan was superseded by the v3 React migration.

- Vite + React 19 + React Router user app
- Shared `packages/ui` components and Tailwind design tokens
- Generated API client (via `@hey-api/openapi-ts` with fetch plugin)
- Auth, market browser, strategy builder, portfolio, orders, alerts, profile, settings, and social surfaces
- Native WebSocket subscriptions for prices, strategy events, whales, and news signals

---

## Phase 6 — Admin, Bots & Notifications

**Complete**

- React admin app for dashboard, users, strategies, orders, tickets, logs, cache, reports, sentiment, revenue, waitlist, config flags, venues, builder stats, and admin management
- Admin auth and admin API services backed by a separate admin database
- Telegram, Discord, and WhatsApp bot integration
- Notification service for email, bot channels, in-app notifications, webhook dispatch, and digest behavior

---

## Phase 7 — QA & Production Hardening

**Complete**

- Playwright E2E suite and focused service/unit coverage
- Docker image pinning, TLS/cert scripts, Nginx H2C checks, and CI guardrails
- Backup/recovery, incident response, deployment, runner, and performance tuning docs
- Terraform for AWS infrastructure under `infra/terraform`

---

## Phase 8 — Competitive Features

**Complete**

- Copy trading with risk controls
- Whale tracking, smart-money scoring, alerts, and whale feed WebSocket events
- AI news-to-trade pipeline and sentiment intelligence
- Advanced orders, conditional orders, smart orders, and execution controls
- Multi-venue foundations for Polymarket, Polymarket US, and Kalshi
- Strategy marketplace, public profiles, comments, forks, likes, reports, and templates
- Advanced strategy builder import/export, variables, logic/calculation blocks, and sub-strategies

---

## Phase 9 — Gasless, Onboarding & Future Planning

**Complete**

- Gas sponsorship controls in signer-service
- Per-user gas budget surfaced through `GET /api/v1/settings/gas`
- Gasless indicators in user surfaces
- Seeded strategy templates and onboarding checklist/tour
- Admin key-rotation endpoints
- Phase 9 future-feature documentation moved to [`docs/14-future-features.md`](./14-future-features.md)

---

## Phase 10 — Security Audit & Deployment Readiness

**Complete**

- SQL injection and cascading-delete audit fixes
- Secret length validation and safer env handling
- CSP/static asset hardening in Nginx
- Error boundaries across frontend apps
- SDK/MCP path alignment to `/api/v1/*`
- TypeScript and dependency standardization
- Remaining operational target: AWS eu-west-2 deployment and Polymarket Builders Program submission

---

## Phase 11 — Execution Intelligence & Platform Moat

**Complete through v6.15.0**

Polyforge remains a self-custodial automation layer over prediction markets. It
enhances information, execution, and automation without custodying or managing
user funds.

- Smart order execution: bracket, DCA, TWAP, scale-in/scale-out, iceberg, post-only
- Portfolio risk intelligence: drawdown circuit breaker, Kelly sizing, P&L attribution, correlation analysis
- Merge arbitrage scanner, alerts, execution, matching, and risk dashboard
- Strategy marketplace with listings, purchases, ratings, and creator views
- Prediction accuracy and calibration scoring
- AI portfolio optimizer
- Sentiment intelligence
- LP / market making endpoint and UI

---

## Phase 12 — Post-Launch Feature Expansion

**In progress**

- Analytics dashboard, P&L attribution, category correlation, and portfolio risk panels
- Trading journal, tax report export, strategy version history, comparison mode, and strategy performance alerts
- Social feed reactions, threaded comments, trader follow, achievements, and marketplace moderation
- Watchlist, market collections, advanced search, mobile bottom nav, live P&L strip, onboarding modal, and keyboard shortcuts
- See [`docs/14-future-features.md`](./14-future-features.md) for future feature concepts that are not yet committed roadmap scope

---

## Implementation Notes

- Real-time app traffic uses native WebSocket support through `@nestjs/platform-ws`.
- Async execution uses Redis Streams and service consumers.
- User and admin frontends are React 19. Legacy framework references should not be used for new work.
- Local infrastructure uses `docker-compose.infra.yml`; do not use the removed legacy dev-compose filename.
