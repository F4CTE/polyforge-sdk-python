# Polyforge — Architecture

**Version:** 1.0  
**Date:** March 2026  
**Domain:** polyforge.app  
**Status:** Development Specification

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [System Architecture](#2-system-architecture)
3. [Services](#3-services)
4. [Frontend Applications](#4-frontend-applications)
5. [Authentication & Security](#5-authentication--security)
6. [Polymarket Integration](#6-polymarket-integration)
7. [Strategy System](#7-strategy-system)
8. [Real-Time Communication](#8-real-time-communication)
9. [Notifications & Bots](#9-notifications--bots)
10. [Social Features](#10-social-features)
11. [Backtesting & Paper Trading](#11-backtesting--paper-trading)
12. [Infrastructure](#12-infrastructure)
13. [Logging & Observability](#13-logging--observability)
14. [Data Retention Policy](#14-data-retention-policy)
15. [Build System](#15-build-system)
16. [Tech Stack](#16-tech-stack)

---

## 1. Product Overview

Polyforge is a strategy automation platform for Polymarket — the world's largest prediction market. Users build automated trading strategies using a drag-and-drop block interface, backtest them against historical data, paper trade in simulation, and deploy live strategies that trade on their behalf.

### Core Features

- **Strategy Builder** — drag-and-drop block-based strategy editor (36 blocks, 4 categories)
- **Live Trading** — automated order placement via Polymarket CLOB API
- **Paper Trading** — simulated trading with real prices, no real orders placed
- **Backtesting** — replay historical price data through strategies
- **Social** — public strategies, profiles, follows, forks, likes, comments
- **Notifications** — Email, Telegram, Discord alerts
- **Interactive Bots** — Telegram and Discord bots with command interface
- **Builder Program** — platform earns USDC weekly rewards from Polymarket for attributed volume
- **Whale Tracking** — real-time whale detection stream, activity feed, address profiles, follow/alerts
- **Copy Trading** — mirror trades from followed traders with risk controls (position limits, loss limits, drawdown breaker)
- **Advanced Orders** — take-profit, stop-loss, trailing stop, limit, and pegged conditional order types
- **AI News Pipeline** — news ingestion, LLM dual-provider signal extraction (Claude + GPT-4o fallback)

### User States

| State | Access |
|---|---|
| Unverified | Browse markets only |
| Verified | Backtest + Paper trade + Build strategies |
| Connected | Everything including live trading |

---

## 2. System Architecture

### High-Level Overview

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Nginx Gateway (polyforge.app / admin.polyforge.app) │
│  SSL termination, routing, IP allowlist for admin    │
└────────────────────────┬────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  auth-service     api-service     admin-auth-service
  admin-api-service                              
        │                │
        └────────────────┼──────────────────────────────┐
                         ▼                              │
                   ┌──────────┐                         │
                   │  Redis   │◄──── market-data-service │
                   │ Streams  │                         │
                   └──────────┘                         │
                    │        │                          │
              ┌─────┘        └──────┐                  │
              ▼                     ▼                   │
      strategy-engine          order-service            │
              │                     │                   │
              │              ┌──────┘                   │
              │              ▼                          │
              │        signer-service                   │
              │        (signer-only network)            │
              │                                         │
              ├── paper-order-service                   │
              ├── backtest-service                      │
              ├── notification-service                  │
              └── bot-service                           │
                                                        │
                   PostgreSQL + TimescaleDB ◄───────────┘
```

### Docker Networks

Four isolated networks control exactly which services can communicate:

| Network | Services | Internet | Purpose |
|---|---|---|---|
| `public` | gateway, auth-service, api-service | Yes | User-facing traffic |
| `internal` | all services, Redis, Postgres, PgBouncer | No | Backend bus |
| `signer-only` | signer-service, order-service, auth-service, Redis | No | Key isolation |
| `admin-only` | admin-auth-service, admin-api-service | No | Admin isolation |

**Security properties to enforce:**
- `signer-service` must have zero public exposure — unreachable from internet under any circumstance
- `admin-auth-service` must not be on the public network — Nginx IP allowlist is the only entry point
- Redis and Postgres must be on `internal` only

---

## 3. Services

### Complete Service List (13 NestJS + 1 Nginx)

| Service | Runtime | Networks | Responsibility |
|---|---|---|---|
| `gateway` | Nginx | public, admin-only | SSL, routing, IP allowlist, WS upgrade |
| `auth-service` | NestJS | public, internal, signer-only | Email/password auth, 2FA, credential import |
| `api-service` | NestJS | public, internal | User REST /api/v1/*, WebSocket gateway |
| `admin-auth-service` | NestJS | admin-only, internal | Admin email/password, admin JWT |
| `admin-api-service` | NestJS | admin-only, internal | Admin REST /api/v1/* |
| `market-data-service` | NestJS | internal | Polymarket WS+REST, cache writer, gap detection |
| `strategy-engine` | NestJS | internal | Block evaluator, tick runner, safety checks |
| `order-service` | NestJS | internal, signer-only | CLOB submission, batch orders, DLQ |
| `paper-order-service` | NestJS | internal | Simulated fills, paper positions |
| `backtest-service` | NestJS | internal | Historical replay, equity curve |
| `notification-service` | NestJS | internal | AWS SES, Telegram, Discord outbound |
| `bot-service` | NestJS | internal | Interactive Telegram + Discord bots |
| `signer-service` | NestJS | signer-only | Key vault, EIP712, Builder HMAC |

> **Dev only:** `mock-polymarket` — a NestJS service that mocks the Polymarket APIs for local development. Never deployed to production.

### Inter-Service Communication

**Internal HTTP (synchronous)** — every call must carry a service JWT (30s TTL, jti replay protection):

```
auth-service      → signer-service  (register/delete credentials)
order-service     → signer-service  (sign orders)
api-service       → strategy-engine (start/stop strategy)
admin-api-service → strategy-engine (force stop)
admin-api-service → all services    (health checks)
bot-service       → api-service     (execute bot commands)
auth-service      → api-service     (credential connection status)
```

**Redis Streams (asynchronous):**

```
stream:orders         strategy-engine → order-service
stream:paper_orders   strategy-engine → paper-order-service
stream:backtests      api-service     → backtest-service
stream:events         order-service, paper-order-service,
                      backtest-service, strategy-engine,
                      api-service (ticket events),
                      admin-api-service (ticket events)
                      → api-service (WebSocket to users)
                      → admin-api-service (WebSocket to admins)
                      → notification-service
stream:notifications  notification-service internal queue
stream:whale_txns     market-data-service → api-service (whale detection)
stream:copy_trades    api-service → order-service (copy trade execution)
stream:news_signals   api-service → notification-service (signal alerts)
```

### Phase 8 Subsystems

**Whale Detection Stream** — `market-data-service` monitors on-chain Polymarket transactions against configurable size thresholds and publishes whale activity to `stream:whale_txns`. `api-service` consumes the stream, persists whale profiles, and pushes real-time updates to WebSocket subscribers who follow whale addresses.

**Copy Trading Engine** — when a followed trader executes a trade, `api-service` evaluates all active copy sessions targeting that trader. Each session applies its risk controls (max position size, daily loss limit, per-trade cap, drawdown circuit breaker) before publishing a sized copy order to `stream:copy_trades` for execution by `order-service`. Sessions can be paused/resumed independently.

**Conditional Order Evaluator** — a background worker in `api-service` subscribes to price updates from `market-data-service` Redis cache and evaluates pending conditional orders (TP/SL/trailing/limit/pegged) on each tick. When trigger conditions are met, the order is converted to a market order and submitted to `stream:orders`. Trailing stops dynamically update their trigger price on favorable movement.

**LLM Dual-Provider Pattern** — the news-to-trade pipeline uses Claude as the primary LLM for news analysis and signal extraction. If the Claude API is unavailable or returns an error, the system falls back to GPT-4o. Both providers use identical structured output schemas for signal generation (direction, confidence score, reasoning). Provider selection and fallback are transparent to downstream consumers.

### AI Integration Layer (v5.0.0)

The AI integration layer enables external AI agents (Claude, GPT, custom assistants) to interact with the platform programmatically:

**MCP Server** ([`polyforge-mcp`](https://github.com/polyforge/polyforge-mcp)) — a standalone Model Context Protocol server (previously `packages/mcp-server`, now its own repo for independent versioning) that exposes 22 tools for Claude Desktop and other MCP-compatible AI assistants. It proxies authenticated API calls using a user-provided API key (`POLYFORGE_API_KEY`). Communicates over stdio transport. Tools cover markets, strategies, portfolio, orders (including `place_order` and `cancel_order`), whales, news, scores, alerts, copy trading, and webhooks.

**Batch API** (`POST /api/v1/batch`) — allows AI agents to execute up to 10 API requests in a single HTTP call. Each sub-request runs in parallel using `Promise.allSettled`, with the caller's auth token forwarded to each. Results are correlated by client-provided `id` fields. 15-second timeout per sub-request.

**Webhook Dispatcher** (`notification-service`) — when platform events occur (order fills, strategy errors, whale trades, news signals), the dispatcher queries active webhooks matching the event type and user, signs each payload with HMAC-SHA256 using the webhook's secret, and delivers via HTTP POST. Fire-and-forget with a single retry on failure. 5-second delivery timeout.

**Natural Language Query Engine** (`POST /api/v1/ai/query`) — accepts plain English queries and maps them to platform data using regex-based intent classification. Supports 10 intent types: strategies, portfolio, orders, whale feed, news signals, scores, alerts, copy configs, and market search. Returns structured data alongside a human-readable summary.

**Actions Catalog** (`GET /api/v1/actions`) — a public endpoint returning all available API actions with method, path, scope, category, and parameter definitions. AI agents use this for capability discovery without needing static documentation.

**OpenAPI Spec** (`GET /api/v1/docs/openapi.json`) — auto-generated OpenAPI 3.1 specification served as a public endpoint. Consumed by SDK generators, Postman, and AI agents for schema-aware API interaction.

### API Versioning

All routes must be versioned from day one:

```
User API:      /api/v1/*
User Auth:     /auth/v1/*
Admin API:     /api/v1/*        (on admin subdomain)
Admin Auth:    /auth/v1/*       (on admin subdomain)
WebSocket:     wss://polyforge.app/ws
Admin WS:      wss://admin.polyforge.app/ws
```

### Service JWT Authentication (Internal HTTP)

Every internal HTTP call must carry a short-lived service JWT:

```json
{
  "iss": "order-service",
  "aud": "signer-service",
  "jti": "uuid-v4",
  "iat": 1234567890,
  "exp": 1234567920
}
```

- Sign with `INTERNAL_JWT_SECRET`
- 30 second expiry, enforced
- `jti` stored in Redis on first use (TTL 60s) — replay attack protection
- Wrong `aud` → reject immediately

---

## 4. Frontend Applications

### user-app (React 19 + Shadcn UI)

Served at `polyforge.app`

| Route | Page | Auth Required |
|---|---|---|
| `/login` | Email + password + 2FA | No |
| `/onboarding` | Username, wallet setup, notifications | Post-registration |
| `/markets` | Market browser, search, filter | Verified |
| `/discover` | Public strategy marketplace | Verified |
| `/leaderboard` | Top traders by P&L, win rate, forks | Verified |
| `/strategies` | My strategies (all visibility) | Verified |
| `/strategies/new` | Drag-and-drop strategy builder | Verified |
| `/strategies/:id` | Strategy detail + backtest history | Verified |
| `/portfolio` | Real + paper positions, P&L charts | Verified |
| `/orders` | Real + paper order history | Verified |
| `/backtest` | Run config, progress bar, results | Verified |
| `/profile/me` | Edit profile, earnings | Verified |
| `/profile/:username` | Public profile view | Public |
| `/settings` | Notifications, bot linking, 2FA | Verified |
| `/settings/trading-account` | Polymarket credential import | Verified |
| `/support` | Support tickets list + detail | Verified |
| `/terms` | Terms of Service | Public |
| `/privacy` | Privacy Policy | Public |

### admin-app (React 19 + Shadcn UI)

Served at `admin.polyforge.app` — IP allowlisted at the Nginx level.

| Route | Page |
|---|---|
| `/login` | Admin email + password |
| `/health` | All 13 services live status + latency chart |
| `/users` | User management, limits, activity |
| `/users/:id` | User detail, strategies, orders |
| `/strategies` | All strategies across all users |
| `/orders` | Order flow monitor |
| `/backtests` | Backtest job queue |
| `/cache` | Cache hit rate, freshness metrics |
| `/rate-limits` | Polymarket API budget dashboard |
| `/notifications` | Delivery stats, failure log |
| `/content` | Report moderation queue |
| `/builder` | Builder Program volume + rewards |
| `/logs/audit` | Admin action history |
| `/logs/events` | System event log |
| `/logs/logins` | User login activity |
| `/tickets` | Ticket management (list, detail, reply, assign) |
| `/logs/notifications` | Notification delivery history |

### React HTTP Clients

**React apps use `@hey-api/openapi-ts` generated clients.** All API communication goes through services generated from the OpenAPI spec (`swagger.json` / `swagger-admin.json`). See `03-openapi-codegen.md` for the full pipeline.

### Shadcn UI Components

The design system uses Shadcn UI components for consistent styling and accessibility across user-app and admin-app. All interactive components follow Shadcn patterns with Tailwind CSS customization.

---

## 5. Authentication & Security

### JWT Types

| Type | Secret | Expiry | Used by |
|---|---|---|---|
| User access JWT | USER_JWT_SECRET | 5 minutes | Users → api-service (short-lived, auto-refreshed) |
| User refresh token | USER_JWT_SECRET | 7 days | Users → auth-service (token rotation) |
| Admin JWT | ADMIN_JWT_SECRET | 1 hour | Admins → admin-api-service |
| Bot JWT | BOT_JWT_SECRET | 30 days | Bots → api-service (scoped) |
| Internal JWT | INTERNAL_JWT_SECRET | 30 seconds | Service → service |
| 2FA temp | USER_JWT_SECRET | 5 minutes | Login 2FA challenge |
| API Key | — (SHA256 hashed at rest) | Configurable expiry (optional) | External tools → api-service (scoped: READ/WRITE/TRADE) |

### User Auth Flow

```
Registration:
  POST /auth/v1/register { email, password, username }
  → bcrypt password (cost 12)
  → send verification email
  → return JWT

Login (no 2FA):
  POST /auth/v1/login { email, password }
  → return { token: JWT(7d) }

Login (with 2FA):
  POST /auth/v1/login { email, password }
  → return { requires2FA: true, tempToken: JWT(5min) }
  POST /auth/v1/2fa/verify { code }
  → return { token: JWT(7d) }
```

### Refresh Token Revocation

When a user changes their password, all active refresh tokens and sessions are revoked immediately. This prevents continued access from previously authenticated sessions after a password change.

**Flow:**
1. User submits password change via `PATCH /auth/v1/password`
2. auth-service verifies current password
3. auth-service hashes new password (bcrypt cost 12)
4. All refresh tokens for the user are deleted from Redis
5. All active JWT sessions are invalidated by incrementing the user's token version
6. The current session receives a new JWT with the updated token version

### Polymarket Credential Import

Users import existing Polymarket credentials — Polyforge never generates them.

**Import endpoint:**
```
POST /auth/v1/credentials {
  privateKey,        // EOA private key
  apiKey,            // L2 API key
  apiSecret,         // L2 API secret
  apiPassphrase,     // L2 passphrase
  safeAddress?       // optional, for sig_type 1 or 2
}
```

**Process:**
1. auth-service receives credentials over HTTPS
2. Forwards to signer-service via internal JWT-authenticated HTTP
3. signer-service validates credentials against Polymarket API
4. Encrypts with AES-256-GCM envelope encryption
5. Stores encrypted blobs in `user_credentials` table
6. auth-service sets `users.polymarket_connected = true`
7. Plaintext credentials must never be persisted anywhere

### Credential Encryption (Envelope Encryption)

```
Master Key (KEK)
  └── Stored in AWS Secrets Manager ONLY
  └── Never in DB, never in code, never in logs
  └── Rotate quarterly

Per-user DEK (Data Encryption Key)
  └── 32 random bytes generated on import
  └── Encrypted with Master Key (AES-256-GCM)
  └── Encrypted DEK stored in user_credentials table

User credentials
  └── Each field encrypted with DEK (AES-256-GCM)
  └── Fresh IV per field (12 bytes)
  └── GCM auth tag per field (tamper detection)
  └── Stored as bytea in user_credentials table
```

Simultaneously compromising both the database AND AWS Secrets Manager is required to decrypt any credentials.

### signer-service Security Layers

All 9 layers are mandatory:

1. **Network** — signer-only Docker network (`internal: true`, no internet access)
2. **Auth** — internal service JWT, strict `aud` validation, `jti` dedup
3. **Encryption** — AES-256-GCM envelope encryption at rest
4. **Key storage** — master key in AWS Secrets Manager only
5. **Process** — distroless container, non-root user, read-only filesystem
6. **Logging** — zero key material ever logged — metadata only
7. **Audit** — every signing operation logged with `requestId`
8. **Canary** — honeypot credentials for breach detection
9. **Rotation** — quarterly master key rotation

### Redis Authentication

All Redis instances require password authentication. Unauthenticated connections are rejected. The Redis password is set via the `REDIS_PASSWORD` environment variable and configured in `docker-compose.infra.yml` with the `--requirepass` flag.

- All services connect via `ioredis` with the `password` option set from `REDIS_PASSWORD`
- Redis is on the `internal` Docker network only — never exposed to the public network
- Connection failures due to missing authentication are logged and the service exits with a non-zero code

### Content Security

```
HTTPS:         TLS 1.2/1.3 only, strong cipher suites
Headers:       HSTS, X-Frame-Options, CSP, X-Content-Type-Options
CORS:          polyforge.app, admin.polyforge.app, localhost, 127.0.0.1, localhost:5173
Rate limiting: Redis sliding window per userId per endpoint
Validation:    Zod (runtime) + class-validator (NestJS controllers)
SQL injection: Prisma parameterized queries — no raw SQL
XSS:           React escapes output by default; Shadcn UI follows React escaping
CSRF:          JWT bearer tokens (not cookies)
```

---

## 6. Polymarket Integration

### APIs Used

| API | URL | Purpose |
|---|---|---|
| Gamma API | gamma-api.polymarket.com | Market discovery |
| CLOB API | clob.polymarket.com | Order submission, order book |
| CLOB WebSocket | wss://ws-subscriptions-clob.polymarket.com | Live prices/books |
| Data API | data-api.polymarket.com | Positions, trade history |

**Rule:** `market-data-service` is the ONLY service that may call Polymarket APIs directly. All other services must read from the Redis cache.

### Builder Program

Every order placed by any user must carry builder attribution headers:

```
POLY_BUILDER_API_KEY
POLY_BUILDER_TIMESTAMP
POLY_BUILDER_PASSPHRASE
POLY_BUILDER_SIGNATURE    (HMAC of request)
```

Generated by `signer-service` using `@polymarket/clob-client`. The platform earns weekly USDC rewards proportional to attributed volume.

### Order Placement Flow

```
strategy-engine emits OrderIntent
       ↓
order-service batches intents (up to 15 per user per request)
       ↓
order-service calls signer-service (internal JWT)
       ↓
signer-service builds ClobClient:
  signer:        user EOA private key
  funder:        user Safe address (if sig_type 2)
  signatureType: 0 | 1 | 2
  apiCreds:      user L2 credentials
  builderConfig: platform builder HMAC
       ↓
signer-service returns signed order + builder headers
       ↓
order-service submits to Polymarket CLOB API
       ↓
order-service subscribes to WebSocket for status updates
       ↓
MATCHED → MINED → CONFIRMED → emit ORDER_FILLED to stream:events
```

### Order Status Lifecycle

```
PENDING     → created intent, not yet submitted
SUBMITTED   → sent to CLOB
LIVE        → resting on book (GTC/GTD orders)
MATCHED     → matched, awaiting on-chain settlement
DELAYED     → sports market 3s delay
MINED       → transaction mined
CONFIRMED   → final fill ✓ terminal
PARTIAL     → partially filled, remainder live
CANCELLED   → cancelled ✓ terminal
UNMATCHED   → no match found ✓ terminal
FAILED      → permanent failure ✓ terminal
ERROR       → internal error before submission ✓ terminal
```

### v1 Scope Limitation

Binary markets only. Negative risk (multi-outcome) markets must be filtered out by `market-data-service`. Full neg-risk support is deferred.

### Heartbeat Service (30s interval)

`order-service` runs a `HeartbeatService` that checks the health of GTC orders every 30 seconds. For each LIVE GTC order, it verifies the order is still resting on the Polymarket CLOB book. If a LIVE order has disappeared from the book without a local status update, the heartbeat marks it for reconciliation.

### Trade Reconciliation (2min cron)

`order-service` runs a `TradeReconcilerService` on a 2-minute cron schedule. For each connected user with LIVE orders, it fetches trades from the Polymarket CLOB API (`GET /trades?user={address}`) and compares against local order statuses. Orders that were filled on-chain but missed locally (status stuck at LIVE) are updated to CONFIRMED. All discrepancies are logged for audit.

### Position Reconciliation (5min cron)

Operates independently from trade reconciliation. Every 5 minutes, `order-service` reconciles local position records against on-chain state from the Polymarket Data API. Detects phantom positions (local but not on-chain) and orphan positions (on-chain but not local) and flags them for manual review.

### User WebSocket Channel

Each connected user gets a dedicated Polymarket WebSocket subscription via `market-data-service`. The service multiplexes per-user channels to track real-time order status updates and price changes for tokens the user holds positions in. Status changes received over WebSocket are applied immediately to local order records.

### Builder API Integration

`admin-api-service` fetches attributed trade data from the Polymarket Builder API (`GET /builder-trades`) to display real tier status and weekly USDC rewards in the admin dashboard. The service authenticates using `POLY_BUILDER_API_KEY`, `POLY_BUILDER_SECRET`, and `POLY_BUILDER_PASSPHRASE` environment variables. On API failure, it falls back to computing an estimated tier from local order volume.

### Bulk Cancel

`order-service` supports bulk cancellation through the CLOB API:
- `DELETE /cancel-all` — cancels all open orders for a user
- `DELETE /cancel-orders?market={marketId}` — cancels all open orders in a specific market

The `cancel_all_orders` strategy block evaluator emits a sentinel intent (`tokenId: __cancel_all__`) that the order-service stream consumer intercepts and routes to the appropriate bulk cancel endpoint.

---

## 7. Strategy System

### Block Registry (36 blocks total)

#### TRIGGERS (13)

**Event-based (6):**
| Block | Parameters |
|---|---|
| `new_bet_opens` | seriesSlug |
| `price_crosses_up` | tokenId, threshold |
| `price_crosses_down` | tokenId, threshold |
| `time_before_close` | minutesBefore |
| `win_streak` | count |
| `loss_streak` | count |

**Tick-based (7):**
| Block | Parameters |
|---|---|
| `price_above_tick` | tokenId, price |
| `price_below_tick` | tokenId, price |
| `spread_below_tick` | tokenId, maxSpread |
| `volume_rate_tick` | tokenId, minRate |
| `price_momentum_tick` | tokenId, direction, threshold |
| `rsi_threshold_tick` | tokenId, period, level, direction |
| `every_tick` | — |

#### CONDITIONS (9)
| Block | Parameters |
|---|---|
| `min_liquidity` | minUsdc |
| `max_position` | maxUsdc |
| `max_bets_per_day` | max |
| `daily_loss_limit` | maxLossUsdc |
| `cooldown_after_trade` | cooldownMs |
| `price_in_range` | tokenId, min, max |
| `no_reentry` | — |
| `no_existing_position` | — |
| `time_window` | startHH, startMM, endHH, endMM |

#### ACTIONS (8)
| Block | Parameters |
|---|---|
| `buy_yes` | size, orderType |
| `buy_no` | size, orderType |
| `set_stop_loss` | pct |
| `take_profit` | pct |
| `scale_in` | additionalSize |
| `scale_out` | reduceBySize |
| `cancel_all_orders` | — |
| `skip_bet` | — |

#### SAFETY (6) — user-controlled circuit breakers
| Block | Parameters |
|---|---|
| `stop_if_daily_loss` | maxLossUsdc |
| `stop_if_orders_per_min` | maxOrders |
| `stop_if_consecutive_loss` | maxLosses |
| `stop_if_exposure_exceeds` | maxUsdc |
| `pause_after_fill` | pauseMs |
| `max_orders_total` | max |

Safety blocks evaluate first, before any action can fire.

### WASM Tick Evaluator

The CPU-intensive tick evaluation loop runs inside a Rust WASM module (`@polyforge/engine`) for zero GC pauses and deterministic latency. The module receives serialized block arrays and market context, evaluates the full pipeline (safety -> triggers -> conditions -> actions), and returns action intents. A TypeScript fallback is available when the WASM binary is not built. See `docs/15-rust-wasm-modules.md` for details.

### Execution Modes

| Mode | Behaviour |
|---|---|
| EVENT | Evaluates only when a trigger event fires |
| TICK | Evaluates on every tick interval (minimum 200ms) |
| HYBRID | Both — event triggers OR tick evaluation, whichever fires first |

### Block Evaluation Order

```
FOR EACH TICK:
  1. Evaluate SAFETY blocks → any fail → stop strategy immediately
  2. Evaluate TRIGGER blocks → any fail → skip this tick
  3. Evaluate CONDITION blocks → any fail → skip this tick
  4. Evaluate ACTION blocks → build OrderIntent
  5. Publish OrderIntent to stream:orders
```

### Stateful Blocks

Blocks that need memory across ticks use `strategy:{id}:state` in Redis (TTL: midnight UTC — resets daily). State is also written to Postgres after each change for durability.

Blocks that write strategy state:
- `max_bets_per_day` → increments `betsToday`
- `daily_loss_limit` → tracks `dailyPnl`
- `cooldown_after_trade` → reads/writes `lastTradeAt`
- `win_streak` / `loss_streak` → tracks `streak`
- `no_reentry` → tracks `tradedToday` array

### Cache Staleness Protection

If `cache:price:{tokenId}` age exceeds 5 seconds, strategy-engine must pause affected strategies and emit `STRATEGY_PAUSED` with reason `stale_market_data`. It must resume automatically when fresh data returns.

### Atomic State Transitions

Strategy status changes (IDLE -> RUNNING, RUNNING -> STOPPED, etc.) use atomic Redis operations to prevent race conditions. The state transition is performed as a compare-and-swap: the current status is checked and the new status is set in a single atomic operation. If the expected current status does not match, the transition is rejected. This prevents issues such as double-start or stopping an already-stopped strategy.

Runner cleanup logic executes in `finally` blocks to ensure resources are released even when an error occurs during evaluation.

### Graceful Shutdown

Five services implement graceful shutdown with a 10-second `SIGTERM` timeout:

- `strategy-engine` — stops all running strategy tick loops, flushes pending state to Redis/Postgres
- `order-service` — completes in-flight order submissions before exiting
- `paper-order-service` — completes in-flight simulated fills
- `backtest-service` — checkpoints active backtests
- `notification-service` — flushes pending notification queue

On receiving `SIGTERM`, each service stops accepting new work, waits up to 10 seconds for in-flight operations to complete, then exits. If the timeout is exceeded, the process exits immediately.

---

## 8. Real-Time Communication

### Architecture

```
Polymarket WS ──► market-data-service ──► Redis Streams
                                              │
                                              ▼
                                        api-service
                                        Redis consumer
                                              │
                                              ▼
                                        WebSocket Gateway
                                              │
                                    ┌─────────┴──────────┐
                                    ▼                    ▼
                              user-app              admin-app
                            React WS              React WS
```

**Rule:** Only `market-data-service` connects to Polymarket's WebSocket. The frontend connects to our WebSocket only.

### WebSocket Protocol

**Endpoint:** `wss://polyforge.app/ws`

**Authentication:** JWT sent in the initial handshake message:
```json
{ "type": "AUTH", "token": "Bearer eyJ..." }
```

**Client → Server messages:**
```typescript
{ type: 'SUBSCRIBE_PRICES',     tokenIds: string[] }
{ type: 'UNSUBSCRIBE_PRICES',   tokenIds: string[] }
{ type: 'SUBSCRIBE_STRATEGY',   strategyId: string }
{ type: 'UNSUBSCRIBE_STRATEGY', strategyId: string }
{ type: 'PING' }
```

**Server → Client messages:**
```typescript
{ type: 'PONG' }
{ type: 'PRICE_UPDATE',        tokenId, price, timestamp }
{ type: 'BOOK_UPDATE',         tokenId, book }
{ type: 'ORDER_FILLED',        orderId, fillPrice, pnl }
{ type: 'ORDER_PLACED',        orderId, intentId }
{ type: 'ORDER_CANCELLED',     orderId, reason }
{ type: 'STRATEGY_STARTED',    strategyId }
{ type: 'STRATEGY_STOPPED',    strategyId, reason? }
{ type: 'STRATEGY_ERROR',      strategyId, error }
{ type: 'STRATEGY_PAUSED',     strategyId, reason }
{ type: 'MARKET_RESOLVED',     marketId, outcome }
{ type: 'PAPER_ORDER_FILLED',  orderId, simulatedPrice }
{ type: 'BACKTEST_PROGRESS',   runId, progress }
{ type: 'NOTIFICATION',        title, body, severity }
{ type: 'TICKET_REPLY',       ticketId, subject, adminName }
{ type: 'TICKET_CLOSED',      ticketId, subject }
{ type: 'AUTH_ERROR',          message }
```

**Origin validation:** WebSocket upgrade requests are validated against an allowlist of permitted origins (`polyforge.app`, `admin.polyforge.app`, `localhost`, `127.0.0.1`, `localhost:5173`). Connections from unlisted origins are rejected during the handshake phase before authentication.

**Subscription cap:** Each client is limited to 5000 active subscriptions (price feeds + strategy events combined). Subscription requests beyond the cap are rejected with an error message. On disconnect, all subscriptions for the client are cleaned up immediately to prevent resource leaks.

**Keepalive:** client sends `PING` every 30 seconds, server responds `PONG`. Connection dropped after 90 seconds of inactivity.

---

## 9. Notifications & Bots

### Email (AWS SES)

**From address:** `noreply@polyforge.app`

Required DNS records:
```
TXT  @       "v=spf1 include:amazonses.com ~all"
TXT  _dmarc  "v=DMARC1; p=quarantine; rua=mailto:dmarc@polyforge.app"
CNAME        (3 DKIM records generated by AWS SES)
```

Email delivery categories:

| Category | Delivery | Examples |
|---|---|---|
| Transactional | Immediate | Email verification, password reset, 2FA backup codes |
| Trading | Immediate or hourly | Order filled, strategy error, daily loss limit |
| Social | Daily digest | Fork, follow, comment, like |

### Telegram Bot

**Account linking flow:**
1. User clicks "Connect Telegram" in settings
2. Server generates a 6-digit one-time code (Redis TTL 10 min)
3. User opens @polyforgebot and sends `/connect <code>`
4. Bot links `chat_id → userId`

**Supported commands:**
```
/start              welcome + link instructions
/connect <code>     link Polymarket account
/status             all running strategies + P&L
/stop <name>        stop a named strategy
/pause <name>       pause a named strategy
/resume <name>      resume a paused strategy
/pnl                today's P&L across all strategies
/pnl <name>         P&L for a specific strategy
/orders             last 5 orders
/positions          current open positions
/paper              paper trading summary
/alerts             configure alert thresholds
/disconnect         unlink account
/help               command list
```

Bot JWTs are scoped tokens with limited claims:
```json
{
  "sub": "userId",
  "role": "bot",
  "scopes": ["read:strategies", "read:pnl", "write:strategy:stop"],
  "channel": "telegram"
}
```

### Discord Bot

Same command set as Telegram. Account linking via the same one-time code flow. Requires a separate `DISCORD_BOT_TOKEN`.

---

## 10. Social Features

### Strategy Visibility

| Visibility | Owner | Others |
|---|---|---|
| PRIVATE | Full access | No access |
| PUBLIC | Full access | View + fork + run + like + comment |
| UNLISTED | Full access | View + fork + run (direct link only) |

### Public Profile

Displays: username, display name, bio, auto-generated identicon avatar, public strategies, aggregate stats (P&L + win rate — opt-in), followers/following count, join date.

### Leaderboard Tabs

- Top P&L (all time / 30d / 7d / 24h)
- Best win rate
- Most forked strategies
- Most followers

### Content Moderation

1. User reports a strategy or comment (reason: spam / inappropriate / misleading / other)
2. If report count ≥ 3 → auto-hide pending review
3. Admin reviews in `/content` queue
4. Admin approves (restore) or removes (permanent)
5. Reporter is notified of outcome

### Strategy Templates

Admin-created strategies with `template: true` are shown in the strategy builder as starting points. Users can select and customize them.

---

## 11. Backtesting & Paper Trading

### Backtesting

**Architecture:** Dedicated `backtest-service` — CPU-bound, completely isolated from live trading.

**Flow:**
1. User configures: strategy, date range, starting capital
2. `POST /api/v1/backtests` → creates `backtest_runs` row (status: `QUEUED`)
3. Publishes `BACKTEST_QUEUED` to `stream:backtests`
4. backtest-service consumes → loads strategy → streams `price_history` in chunks
5. Runs block evaluator tick-by-tick (no real orders emitted)
6. Writes progress to `backtest:{runId}:progress` in Redis
7. Writes equity curve to `backtest_orders`
8. Calculates: win_rate, total_pnl, max_drawdown, sharpe_ratio
9. Marks job complete → publishes `BACKTEST_COMPLETED`
10. Frontend receives live progress via WebSocket

**Data gap handling:** check `data_gaps` table before running. If gaps exist, include a warning in results and show "⚠ Data gaps detected — results may be inaccurate" in the UI.

### Paper Trading

Strategies with status `PAPER` route to `stream:paper_orders` instead of `stream:orders`.

`paper-order-service` simulates fills using real market prices:
- If buying at 0.55 and best ask is 0.52 → simulate fill at 0.52 (price improvement)
- Writes to `paper_orders` and `paper_positions`
- Emits `PAPER_ORDER_FILLED` to `stream:events`

Paper P&L tracked in `paper:{userId}:pnl` (Redis, real-time) and `pnl_snapshots` (Postgres, hourly snapshot).

---

## 12. Infrastructure

### Production Infrastructure

```
Internet → EC2 (Nginx + 13 services + PgBouncer)
               ↓              ↓
           AWS RDS         ElastiCache
        (PostgreSQL 16)    (Redis 7)
               ↓
         AWS Secrets Manager (all secrets)
         AWS SES             (email)
         AWS ECR             (Docker images)
         AWS CloudWatch      (logs + alarms)
```

### DNS Records

```
A      polyforge.app           <EC2 Elastic IP>
A      admin.polyforge.app     <EC2 Elastic IP>
TXT    @                       "v=spf1 include:amazonses.com ~all"
TXT    _dmarc                  "v=DMARC1; p=quarantine; rua=mailto:dmarc@polyforge.app"
CNAME  (3x SES DKIM records — generated by AWS SES)
```

### SSL

```bash
certbot certonly --nginx -d polyforge.app
certbot certonly --nginx -d admin.polyforge.app

# Auto-renewal cron
0 0 * * * certbot renew --quiet --deploy-hook "docker exec gateway nginx -s reload"
```

### Nginx Routing

```
HTTP (port 80)   → redirect all to HTTPS

polyforge.app:
  /              → user-app static files (React 19)
  /api/v1/*      → api-service
  /auth/v1/*     → auth-service
  /ws            → api-service WebSocket (Upgrade headers)

admin.polyforge.app:
  /              → admin-app static files (React 19) [IP allowlist]
  /api/v1/*      → admin-api-service
  /auth/v1/*     → admin-auth-service
  /ws            → admin-api-service WebSocket
```

Security headers on all responses via `@fastify/helmet` (registered in every NestJS service with CSP disabled — gateway manages CSP): `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`, `X-Permitted-Cross-Domain-Policies`, `X-Download-Options`.

---

## 13. Logging & Observability

### Log Format (pino)

Every log line must include:

```json
{
  "level": "info",
  "time": "2026-03-12T10:00:00.000Z",
  "service": "api-service",
  "requestId": "uuid",
  "userId": "uuid-or-null",
  "msg": "Human readable message"
}
```

### Health Endpoint

Every service must expose `GET /health`:

```json
{
  "status": "ok",
  "service": "strategy-engine",
  "uptime": 3600,
  "redis": "connected",
  "db": "connected",
  "lag": 42
}
```

`admin-api-service` polls all `/health` endpoints every 10s. Results cached in Redis `health:{serviceName}` (TTL 15s).

### CloudWatch Alarms

| Alarm | Threshold | Action |
|---|---|---|
| Service error rate | > 1% | Alert admin |
| Service down | health check fails | Alert admin |
| EC2 memory | > 80% | Alert admin |
| Redis memory | > 80% | Alert admin |
| RDS CPU | > 70% | Alert admin |
| RDS backup failed | any | Alert admin |

### Admin Audit Trail

Admin actions are captured in `audit_logs`. The table is immutable — no updates or deletes, ever. Retention: forever.

Actions that must be logged:
```
SUSPEND_USER, UNSUSPEND_USER, DELETE_ACCOUNT,
UPDATE_USER_LIMITS, FORCE_STOP_STRATEGY,
UNPUBLISH_STRATEGY, DELETE_COMMENT,
REVIEW_REPORT, CREATE_ADMIN, REVOKE_ADMIN,
CHANGE_ADMIN_ROLE, VIEW_USER_DETAIL, EXPORT_DATA
```

---

## 14. Data Retention Policy

| Data | Retention | Implementation |
|---|---|---|
| orders | 7 years | Manual archive job |
| audit_logs | Forever | Never deleted |
| pnl_snapshots | Forever | TimescaleDB |
| price_history (daily) | Forever | TimescaleDB continuous aggregate |
| price_history (hourly) | 90 days | TimescaleDB policy |
| price_history (raw) | 7 days | TimescaleDB policy |
| user_login_history | 90 days | Nightly cron |
| notification_history | 90 days | Nightly cron |
| paper_orders | 90 days | Nightly cron |
| event_log (fills) | 1 year | Nightly cron |
| event_log (other) | 30 days | Nightly cron |
| rate_limit_usage | 30 days | TimescaleDB policy |
| cache_stats | 30 days | TimescaleDB policy |
| strategy_events | 7 days | Nightly cron |
| CloudWatch logs | 30 days | Log group setting |
| backtest_orders | With parent run | Cascade delete |

Retention jobs run nightly at 3am UTC via `@Cron` decorator in `admin-api-service`.

### Ticket Reminder Cron

`admin-api-service` runs a ticket reminder cron (`@Cron("15 * * * *")`) that:
1. Queries tickets in `AWAITING_USER` status with `updatedAt` older than the configured reminder threshold
2. Sends a single branded reminder email per ticket with a "View your ticket" CTA
3. Sets `reminderSentAt` on the ticket to prevent repeat reminders
4. Threshold is configurable via Redis key `config:ticket_reminder_hours` (default: 48h)
5. Continues processing remaining tickets if one email fails (error resilience)

---

## 15. Build System

### Monorepo Structure (Turborepo + pnpm Workspaces)

```
polyforge/
├── apps/
│   ├── user-app/          React 19 + Shadcn UI
│   ├── admin-app/         React 19 + Shadcn UI
│   └── landing/           Next.js 15
├── services/
│   ├── gateway/           Nginx config
│   ├── auth-service/      NestJS
│   ├── api-service/       NestJS
│   ├── admin-auth-service/NestJS
│   ├── admin-api-service/ NestJS
│   ├── market-data-service/NestJS
│   ├── strategy-engine/   NestJS
│   ├── order-service/     NestJS
│   ├── paper-order-service/NestJS
│   ├── backtest-service/  NestJS
│   ├── notification-service/NestJS
│   ├── bot-service/       NestJS
│   ├── signer-service/    NestJS
│   └── mock-polymarket/   NestJS (dev only)
└── packages/
    ├── shared-types/      All interfaces, enums, WebSocket messages
    ├── shared-schemas/    Zod validation schemas
    ├── shared-auth/       JWT guards, internal service client
    ├── shared-db/         Prisma client NestJS module
    ├── shared-redis/      ioredis factory, stream helpers
    └── logger/            pino + nestjs-pino
```

### Build Order

```
shared-types
    ↓
shared-schemas ──── logger ──── shared-redis
    ↓                               ↓
shared-auth ──────────── shared-db
    ↓
all services (parallel)
    ↓
api-service build:swagger     admin-api-service build:swagger
    └──────────┬──────────────────────────────┘
               ▼
     swagger.json  swagger-admin.json
               ↓
     @hey-api/openapi-ts + @hey-api/client-fetch
               ↓
both React apps (parallel — import generated src/api/ clients)
```

See `03-openapi-codegen.md` for the full OpenAPI generation pipeline.

---

## 16. Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | NestJS 11.1.16 + Fastify adapter |
| Language | TypeScript 5 (strict mode everywhere) |
| ORM | Prisma 7.5.0 (schema-first, type-safe) |
| Validation | Zod (streams/internal) + class-validator (HTTP controllers) |
| API documentation | @nestjs/swagger — OpenAPI 3.1 spec generated at build time |
| API client generation | @hey-api/openapi-ts (typescript-fetch generator) |
| Redis client | ioredis |
| Logging | pino + nestjs-pino |
| Testing | Vitest + Supertest |
| Crypto (WASM) | Rust + wasm-bindgen — `@polyforge/crypto` (AES-256-GCM, SHA-256, HMAC-SHA256, CSPRNG) |
| Frontend (User & Admin) | React 19 |
| Frontend (Landing) | Next.js 15 |
| UI library | Shadcn UI + Tailwind CSS |
| Real-time | Socket.io (WebSocket) |
| Build system | Turborepo 2 + pnpm workspaces |
| Containers | Docker + Docker Compose |
| Runtime | Node.js 24 |

---

*Polyforge Architecture Specification v1.0 — polyforge.app*
