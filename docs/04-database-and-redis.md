# Polyforge — Database & Redis

> Schema reference, Redis key catalog, and data access rules.

---

## Table of Contents

1. [Database Architecture](#1-database-architecture)
2. [User Database — schema (3 groups)](#2-user-database)
3. [Admin Database — schema (3 tables)](#3-admin-database)
4. [Schema: analytics (TimescaleDB)](#4-schema-analytics-timescaledb)
5. [Redis Architecture](#5-redis-architecture)
6. [Data Access Rules](#6-data-access-rules)

---

## 1. Database Architecture

Polyforge runs **two physically separate PostgreSQL instances** — one for user-facing services, one for admin services. They share no tables, no connections, and no credentials.

```
┌─────────────────────────────────────────────────────────────────┐
│  User-facing services                                           │
│  auth-service, api-service, strategy-engine, order-service,    │
│  paper-order-service, backtest-service, notification-service,  │
│  bot-service, signer-service, market-data-service              │
│                │                                                │
│         PgBouncer :5432 (transaction mode, 20 connections)     │
│                │                                                │
│    PostgreSQL 16 + TimescaleDB — polyforge                      │
│    ├── users, credentials, strategies, orders, positions...     │
│    └── price_history, pnl_snapshots... (TimescaleDB)           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Admin services only                                            │
│  admin-auth-service, admin-api-service                         │
│                │                                                │
│    PgBouncer-admin :5433 (transaction mode, 5 connections)     │
│                │                                                │
│    PostgreSQL 16 — polyforge_admin                             │
│    └── admins, admin_sessions, audit_logs                      │
└─────────────────────────────────────────────────────────────────┘
```

### Why two databases

- **Security isolation** — a compromise of the user DB does not expose admin accounts or audit logs
- **Clean separation** — two backends, two frontends, two databases; the architecture is consistent end-to-end
- **Independent backups** — `audit_logs` can have a "retain forever" backup policy without impacting the user DB
- **No accidental cross-service queries** — admin services cannot accidentally query `user_credentials`; user services cannot read `audit_logs`

### Connection strings

| Variable | Used by | Points to |
|---|---|---|
| `DATABASE_URL` | All user-facing services | PgBouncer → `polyforge` |
| `DIRECT_DATABASE_URL` | Prisma migrations (user) | Postgres → `polyforge` directly |
| `ADMIN_DATABASE_URL` | admin-auth-service, admin-api-service | PgBouncer-admin → `polyforge_admin` |
| `ADMIN_DIRECT_DATABASE_URL` | Prisma migrations (admin) | Postgres-admin → `polyforge_admin` directly |

### Prisma schema files

| File | Generator output | Database |
|---|---|---|
| `prisma/schema.prisma` | `@prisma/client` | polyforge (user) |
| `prisma/schema.admin.prisma` | `@prisma/admin-client` | polyforge_admin (admin) |

---

## 2. User Database

**Instance:** `polyforge`  
**Version:** PostgreSQL 16 + TimescaleDB  
**Connection pooler:** PgBouncer (transaction mode, 20 real connections max)

### users

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | varchar(255) unique | |
| password_hash | varchar(255) | bcrypt cost 12 |
| username | varchar(30) unique | @handle |
| display_name | varchar(50) nullable | |
| bio | varchar(500) nullable | |
| avatar_url | text nullable | |
| twitter_handle | varchar(50) nullable | |
| show_pnl | boolean | default false |
| show_winrate | boolean | default false |
| totp_secret | varchar(255) nullable | AES-256 encrypted |
| totp_enabled | boolean | default false |
| totp_backup_codes | text[] | bcrypt hashed |
| totp_enabled_at | timestamptz nullable | |
| polymarket_connected | boolean | default false |
| polymarket_sig_type | smallint nullable | 0, 1, or 2 |
| polymarket_address | varchar(42) nullable | display only |
| tos_accepted_at | timestamptz nullable | |
| email_verified | boolean | default false |
| email_verified_at | timestamptz nullable | |
| suspended | boolean | default false |
| suspended_reason | text nullable | |
| deleted | boolean | default false |
| deleted_at | timestamptz nullable | |
| created_at | timestamptz | |
| last_seen | timestamptz | |

### user_credentials

Encrypted Polymarket credentials. **Accessible only by signer-service.** No other service may query this table, ever.

| Column | Type | Notes |
|---|---|---|
| user_id | uuid PK FK → users | |
| encrypted_dek | bytea | DEK encrypted with master key |
| dek_iv | bytea | IV for DEK encryption |
| private_key_ct | bytea | ciphertext |
| private_key_iv | bytea | IV (unique per field) |
| private_key_tag | bytea | GCM auth tag |
| api_key_ct / _iv / _tag | bytea | |
| api_secret_ct / _iv / _tag | bytea | |
| api_passphrase_ct / _iv / _tag | bytea | |
| safe_address | varchar(42) nullable | plaintext (not sensitive) |
| sig_type | smallint | 0, 1, or 2 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### strategies

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| name | varchar(255) | |
| description | text nullable | |
| visibility | enum | PRIVATE, PUBLIC, UNLISTED |
| exec_mode | enum | EVENT, TICK, HYBRID |
| tick_ms | int nullable | min 200ms, null if EVENT |
| triggers | jsonb | Block[] |
| conditions | jsonb | Block[] |
| actions | jsonb | Block[] |
| safety | jsonb | Block[], default [] |
| status | enum | IDLE, RUNNING, PAUSED, ERROR, PAPER, ARCHIVED |
| error_message | text nullable | |
| forked_from_id | uuid nullable FK → strategies | self-reference |
| forked_from_user_id | uuid nullable | |
| fork_count | int | default 0, denormalized |
| like_count | int | default 0, denormalized |
| template | boolean | default false |
| tags | text[] | |
| version | int | default 1, increments on edit |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### orders

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| intent_id | uuid unique | idempotency key |
| clob_order_id | varchar(255) nullable | from Polymarket |
| user_id | uuid FK → users | |
| strategy_id | uuid nullable FK → strategies | |
| market_id | varchar(255) | |
| token_id | varchar(255) | |
| side | enum | BUY, SELL |
| outcome | enum | YES, NO |
| size | decimal(20,6) | always string in TypeScript |
| price | decimal(10,6) | |
| order_type | enum | GTC, GTD, FOK, FAK |
| status | enum | PENDING→CONFIRMED and failure states |
| fill_size | decimal(20,6) nullable | |
| fill_price | decimal(10,6) nullable | |
| fee | decimal(20,6) nullable | |
| error_message | text nullable | |
| placed_at | timestamptz nullable | |
| filled_at | timestamptz nullable | |
| created_at | timestamptz | Retention: 7 years |

### positions

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| market_id | varchar(255) | |
| token_id | varchar(255) | |
| outcome | enum | YES, NO |
| size | decimal(20,6) | |
| avg_price | decimal(10,6) | weighted average entry |
| current_price | decimal(10,6) | latest market price |
| unrealized_pnl | decimal(20,6) | |
| realized_pnl | decimal(20,6) | default 0 |
| resolution_status | enum | UNRESOLVED, RESOLVING, RESOLVED, DISPUTED |
| resolution_outcome | enum nullable | YES_WIN, NO_WIN, FIFTY_FIFTY, CANCELLED |
| redemption_value | decimal(10,6) nullable | |
| redeemed | boolean | default false |
| redemption_tx_hash | varchar(66) nullable | |
| updated_at | timestamptz | |

Unique constraint: `(user_id, token_id)`

### Other user tables

- **user_login_history** — login attempts (ip, user_agent, success, country). Retention: 90 days
- **notification_preferences** — per-user channel toggles and event preferences
- **bot_connections** — Telegram/Discord account links (channel, chatId, token_hash)
- **follows** — social graph (follower_id → following_id, composite PK, no self-follow)
- **user_limits** — admin-set per-user hard limits (max_running_strategies, max_orders_per_day, etc.)
- **password_reset_tokens** — single-use reset tokens, TTL 1h
- **email_verifications** — email confirmation tokens, TTL 24h
- **notification_history** — sent notifications log. Retention: 90 days
- **strategy_versions** — full edit history per strategy
- **strategy_likes** — user ↔ strategy M2M
- **strategy_comments** — threaded, soft delete
- **strategy_forks** — fork lineage graph
- **strategy_status_history** — why strategies changed status
- **strategy_events** — per-tick debug log. Retention: 7 days
- **reports** — user reports on strategies/comments. Auto-hide at 3 reports
- **paper_orders** — simulated orders (same shape as orders)
- **paper_positions** — simulated positions
- **backtest_runs** — job metadata + summary stats
- **price_alerts** — user price threshold alerts (max 50 per user)
- **data_gaps** — price history gap tracking
- **tickets** — support tickets (userId, subject, category, status, priority, assignedTo, closedBy, closedAt, reminderSentAt). Indexes on userId, status, assignedTo, (status, updatedAt)
- **ticket_messages** — conversation messages per ticket (senderId, senderName, isAdmin, body). Index on (ticketId, createdAt). Admin messages denormalize sender display name for cross-DB resolution

---

## 3. Admin Database

**Instance:** `polyforge_admin`  
**Version:** PostgreSQL 16 (no TimescaleDB — not needed)  
**Connection pooler:** PgBouncer-admin (transaction mode, 5 real connections max)  
**Accessible by:** admin-auth-service and admin-api-service **only**

### admins

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | varchar(255) unique | |
| password_hash | varchar(255) | bcrypt cost 12 |
| display_name | varchar(100) | |
| role | enum | SUPER_ADMIN, ADMIN, SUPPORT, VIEWER |
| active | boolean | default true |
| created_at | timestamptz | |
| last_seen | timestamptz | |

### admin_sessions

JWT revocation for admin accounts.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = sessionId in JWT |
| admin_id | uuid FK → admins | |
| ip | varchar(45) | |
| user_agent | text | |
| expires_at | timestamptz | TTL 1h |
| revoked | boolean | default false |
| created_at | timestamptz | |

### audit_logs

**Immutable.** Insert only — no updates, no deletes, no truncates. Retention: forever.

| Column | Type | Notes |
|---|---|---|
| id | bigserial PK | auto-increment |
| admin_id | uuid FK → admins | |
| action | varchar(100) | e.g. SUSPEND_USER, FORCE_STOP_STRATEGY |
| target_type | varchar(50) | user, strategy, comment, admin |
| target_id | uuid nullable | UUID from user DB — no FK constraint (cross-DB) |
| payload | jsonb nullable | before/after state snapshot |
| ip | varchar(45) | |
| created_at | timestamptz | |

> `target_id` references entities in the user database. There is no foreign key constraint between the two databases — referential integrity is enforced at the application level in admin-api-service.

---

## 4. Schema: analytics (TimescaleDB)

These tables live in the **user database** (`polyforge`) and are hypertables managed by TimescaleDB. They cannot be expressed directly in Prisma and must be created via raw SQL in the migration file.

### price_history

Raw price ticks from the Polymarket WebSocket. Written by market-data-service only.

```sql
CREATE TABLE price_history (
  time      TIMESTAMPTZ   NOT NULL,
  token_id  VARCHAR(255)  NOT NULL,
  price     DECIMAL(10,6) NOT NULL,
  source    VARCHAR(4)               -- 'ws' or 'rest'
);
SELECT create_hypertable('price_history', 'time');
```

**Continuous aggregates (OHLCV candles):**

```sql
-- Hourly candles
CREATE MATERIALIZED VIEW price_history_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  token_id,
  first(price, time) AS open,
  max(price)         AS high,
  min(price)         AS low,
  last(price, time)  AS close,
  count(*)           AS volume
FROM price_history
GROUP BY bucket, token_id;

-- Daily candles
CREATE MATERIALIZED VIEW price_history_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  token_id,
  first(price, time) AS open,
  max(price)         AS high,
  min(price)         AS low,
  last(price, time)  AS close,
  count(*)           AS volume
FROM price_history
GROUP BY bucket, token_id;
```

**Retention policies:**
- Raw ticks: 7 days
- Hourly candles: 90 days
- Daily candles: forever

### pnl_snapshots

Hourly P&L snapshots per user. Written by order-service.

```sql
CREATE TABLE pnl_snapshots (
  time      TIMESTAMPTZ   NOT NULL,
  user_id   UUID          NOT NULL,
  real_pnl  DECIMAL(20,6) NOT NULL,
  paper_pnl DECIMAL(20,6) NOT NULL
);
SELECT create_hypertable('pnl_snapshots', 'time');
-- Retention: forever
```

### rate_limit_usage

Polymarket API budget tracking. Written by market-data-service.

```sql
CREATE TABLE rate_limit_usage (
  time            TIMESTAMPTZ NOT NULL,
  endpoint        VARCHAR(100),
  request_count   INT,
  budget_pct_used DECIMAL(5,2)
);
SELECT create_hypertable('rate_limit_usage', 'time');
SELECT add_retention_policy('rate_limit_usage', INTERVAL '30 days');
```

### cache_stats

Redis cache performance. Written by api-service.

```sql
CREATE TABLE cache_stats (
  time        TIMESTAMPTZ NOT NULL,
  key_pattern VARCHAR(100),
  hits        INT,
  misses      INT,
  hit_rate    DECIMAL(5,4)
);
SELECT create_hypertable('cache_stats', 'time');
SELECT add_retention_policy('cache_stats', INTERVAL '30 days');
```

---

## 5. Redis Architecture

**Deployment:** ElastiCache replication group with automatic failover (primary + 1 replica across AZs).  
**Persistence:** AOF mode with `fsync every second` — maximum 1 second data loss on crash.  
**Resilience:** `RedisService` includes automatic reconnection with exponential backoff and health tracking (`isHealthy` / `ping()`).  
**Shared by:** all services (user and admin alike access the same Redis instance via the `internal` network).

### Cache Keys

| Key Pattern | Value | TTL | Writer |
|---|---|---|---|
| `cache:price:{tokenId}` | PriceData | 1s | market-data-service |
| `cache:book:{tokenId}` | OrderBook | 2s | market-data-service |
| `cache:market:{id}` | Market | 2min | market-data-service |
| `cache:markets:all` | Market[] | 2min | market-data-service |
| `cache:series:all` | Series[] | 10min | market-data-service |
| `cache:positions:{userId}` | Position[] | 10s | order-service |
| `cache:profile:{username}` | UserProfile | 5min | api-service |
| `cache:leaderboard:pnl` | LeaderboardRow[] | 5min | api-service |
| `cache:leaderboard:winrate` | LeaderboardRow[] | 5min | api-service |
| `cache:leaderboard:forks` | LeaderboardRow[] | 5min | api-service |
| `cache:discover:{page}:{filters}` | Strategy[] | 1min | api-service |

### Strategy State Keys

| Key Pattern | Value | TTL |
|---|---|---|
| `strategy:{id}:state` | StrategyState JSON | Midnight UTC |

```typescript
// StrategyState shape
{
  betsToday:   number
  dailyPnl:    string        // decimal string — never float
  lastTradeAt: number | null
  streak:      number        // positive = wins, negative = losses
  lastBetSize: string | null
  tradedToday: string[]      // marketIds traded today
}
```

### Paper Trading Keys

| Key | Value | TTL |
|---|---|---|
| `paper:{userId}:positions` | SimPosition[] | 24h |
| `paper:{userId}:pnl` | string | 24h |

### Security Keys

| Key | Value | TTL | Purpose |
|---|---|---|---|
| `jti:{uuid}` | '1' | 60s | Internal JWT replay protection |
| `admin:session:{sessionId}` | '1' | 1h | Admin session revocation |
| `bot:link:{code}` | userId | 10min | Bot account linking |
| `ratelimit:{userId}:{window}` | count | window | Per-user API rate limiting |

### Invite & Waitlist Keys

| Key | Type | Value | TTL | Writer | Notes |
|---|---|---|---|---|---|
| `invite:{CODE}` | string | remaining uses (integer) | set at creation | admin-api-service | Uppercase code; deleted when uses reach 0 |
| `waitlist:emails` | ZSET | score = epoch-ms joined | none | auth-service | `ZADD NX` deduplication; admin reads via `ZRANGE WITHSCORES` |
| `config:invite_only` | string | `'true'` / `'false'` | none | admin-api-service | Runtime override for `INVITE_ONLY` env var; auth-service checks this first |
| `config:ticket_reminder_hours` | string | integer (default 48) | none | admin-api-service | Hours to wait before sending a reminder email for tickets in AWAITING_USER status |

> **Retention note:** `waitlist:emails`, `config:invite_only`, and `config:ticket_reminder_hours` are excluded from nightly retention jobs. These are managed manually by admins.

### Miscellaneous Keys

| Key | Value | TTL |
|---|---|---|
| `backtest:{runId}:progress` | 0–100 | 1h |
| `health:{serviceName}` | ServiceHealth | 15s |

### Redis Streams

| Stream | Producer | Consumer(s) |
|---|---|---|
| `stream:orders` | strategy-engine | order-service |
| `stream:paper_orders` | strategy-engine | paper-order-service |
| `stream:backtests` | api-service | backtest-service |
| `stream:events` | all services | api-service, admin-api-service, notification-service |
| `stream:notifications` | notification-service | notification-service (internal queue) |

---

## 6. Data Access Rules

These rules must be enforced by every service without exception.

- **`user_credentials` table** — only `signer-service` may query this table. No other service, ever.
- **Admin database** — only `admin-auth-service` and `admin-api-service` may connect to `polyforge_admin`. No user-facing service has `ADMIN_DATABASE_URL` in its environment.
- **Polymarket APIs** — only `market-data-service` may call Polymarket directly. All other services read from Redis cache.
- **`audit_logs` table** — insert only. No updates, no deletes, no truncates, ever.
- **Cross-DB references** — `audit_logs.target_id` references user DB entities. There is no FK constraint. Referential integrity is the application's responsibility.
- **Redis access** — always via `@polyforge/shared-redis`. Never instantiate `new Redis()` directly in a service.
- **Database access** — always via `@polyforge/shared-db` (user) or `@polyforge/shared-admin-db` (admin). Never instantiate Prisma directly in a service.
- **Raw SQL** — forbidden. Use Prisma query builder exclusively. Parameterised queries only.
- **Monetary values** — always `string` (decimal) in TypeScript and `decimal(20,6)` in Postgres. Never `number` or `float`.

### Least-privilege DB users (M7)

The Prisma connection strings use database-level users with minimal grants. Create these users in PostgreSQL before first deployment:

```sql
-- ── User DB (polyforge) ───────────────────────────────────────────────

-- Application user — used by all user-facing services via PgBouncer
CREATE ROLE poly_app LOGIN PASSWORD '<generate-strong>';
GRANT CONNECT ON DATABASE polyforge TO poly_app;
GRANT USAGE  ON SCHEMA public TO poly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO poly_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO poly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO poly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO poly_app;

-- Explicitly deny destructive DDL
REVOKE CREATE ON SCHEMA public FROM poly_app;

-- Migration user — only used by the `migrate-user` container on startup
CREATE ROLE poly_migrate LOGIN PASSWORD '<generate-strong>';
GRANT ALL PRIVILEGES ON DATABASE polyforge TO poly_migrate;

-- ── Admin DB (polyforge_admin) ────────────────────────────────────────

CREATE ROLE poly_admin LOGIN PASSWORD '<generate-strong>';
GRANT CONNECT ON DATABASE polyforge_admin TO poly_admin;
GRANT USAGE  ON SCHEMA public TO poly_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO poly_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO poly_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO poly_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO poly_admin;
REVOKE CREATE ON SCHEMA public FROM poly_admin;

CREATE ROLE poly_admin_migrate LOGIN PASSWORD '<generate-strong>';
GRANT ALL PRIVILEGES ON DATABASE polyforge_admin TO poly_admin_migrate;
```

Then set in `.env` / Secrets Manager:

```
DATABASE_URL=postgresql://poly_app:<password>@pgbouncer:5432/polyforge
ADMIN_DATABASE_URL=postgresql://poly_admin:<password>@localhost:5434/polyforge_admin
DIRECT_DATABASE_URL=postgresql://poly_migrate:<password>@postgres:5432/polyforge
ADMIN_DIRECT_DATABASE_URL=postgresql://poly_admin_migrate:<password>@postgres-admin:5432/polyforge_admin
```

The `audit_logs` table should additionally have an `INSERT`-only trigger policy enforced at the DB level:

```sql
-- Prevent UPDATE and DELETE on audit_logs at the DB level
CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
```

---

*Previous: [OpenAPI Codegen](./03-openapi-codegen.md) | Next: [Testing & Practices](./05-testing-and-practices.md)*
