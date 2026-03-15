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
                      backtest-service, strategy-engine
                      → api-service (WebSocket to users)
                      → admin-api-service (WebSocket to admins)
                      → notification-service
stream:notifications  notification-service internal queue
```

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

### user-app (Angular 17 + PrimeNG)

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
| `/terms` | Terms of Service | Public |
| `/privacy` | Privacy Policy | Public |

### admin-app (Angular 17 + PrimeNG)

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
| `/logs/notifications` | Notification delivery history |

### Angular HTTP clients

**Angular apps must never contain hand-written HTTP calls.** All API communication goes through services generated from the OpenAPI spec. See `03-openapi-codegen.md` for the full pipeline.

### PrimeNG Components

Use the following PrimeNG components for the specified UI patterns:

- `p-table` — sortable, filterable data tables
- `p-chart` — P&L charts, latency charts (Chart.js wrapper)
- `p-meterGroup` — rate limit budget visualization
- `p-knob` — service health indicators
- `p-badge`, `p-tag` — status indicators
- `p-virtualScroller` — infinite scroll lists (order flow)
- `p-timeline` — order history timeline
- `p-dialog`, `p-confirmDialog` — modals
- `p-skeleton` — loading placeholders
- `p-toast` — toast notifications
- `p-progressBar` — backtest progress

---

## 5. Authentication & Security

### JWT Types

| Type | Secret | Expiry | Used by |
|---|---|---|---|
| User JWT | USER_JWT_SECRET | 7 days | Users → api-service |
| Admin JWT | ADMIN_JWT_SECRET | 1 hour | Admins → admin-api-service |
| Bot JWT | BOT_JWT_SECRET | 30 days | Bots → api-service (scoped) |
| Internal JWT | INTERNAL_JWT_SECRET | 30 seconds | Service → service |
| 2FA temp | USER_JWT_SECRET | 5 minutes | Login 2FA challenge |

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

### Content Security

```
HTTPS:         TLS 1.2/1.3 only, strong cipher suites
Headers:       HSTS, X-Frame-Options, CSP, X-Content-Type-Options
CORS:          polyforge.app, admin.polyforge.app, localhost only
Rate limiting: Redis sliding window per userId per endpoint
Validation:    Zod (runtime) + class-validator (NestJS controllers)
SQL injection: Prisma parameterized queries — no raw SQL
XSS:           Angular escapes output by default
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
                           Angular WS            Angular WS
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
{ type: 'AUTH_ERROR',          message }
```

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
  /              → user-app static files (Angular)
  /api/v1/*      → api-service
  /auth/v1/*     → auth-service
  /ws            → api-service WebSocket (Upgrade headers)

admin.polyforge.app:
  /              → admin-app static files [IP allowlist]
  /api/v1/*      → admin-api-service
  /auth/v1/*     → admin-auth-service
  /ws            → admin-api-service WebSocket
```

Security headers on all responses: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy`.

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

---

## 15. Build System

### Monorepo Structure (Turborepo + pnpm Workspaces)

```
polyforge/
├── apps/
│   ├── user-app/          Angular 17 + PrimeNG
│   └── admin-app/         Angular 17 + PrimeNG
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
     openapi-generator-cli (typescript-angular)
               ↓
both Angular apps (parallel — import generated api/ clients)
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
| API client generation | @hey-api/openapi-ts (typescript-angular generator) |
| Redis client | ioredis |
| Logging | pino + nestjs-pino |
| Testing | Vitest + Supertest |
| Frontend | Angular 17 |
| UI library | PrimeNG |
| Real-time | Socket.io (WebSocket) |
| Build system | Turborepo 2 + pnpm workspaces |
| Containers | Docker + Docker Compose |
| Runtime | Node.js 24 |

---

*Polyforge Architecture Specification v1.0 — polyforge.app*
