# Database Seed Reference

This document describes the SQL seed files for the PolyForge database, what each one populates, how to run them, and the current record counts after running them against a standard data import.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Table Name Mapping](#2-table-name-mapping)
3. [Seed Files](#3-seed-files)
   - [`seed-news-whales.sql`](#31-seed-news-whalessql)
   - [`seed-whale-alerts.sql`](#32-seed-whale-alertssql)
   - [`seed.ts`](#33-seedts)
   - [`seed.admin.ts`](#34-seedadmints)
4. [How to Run](#4-how-to-run)
5. [Current Seed State](#5-current-seed-state)
6. [Common Issues](#6-common-issues)

---

## 1. Overview

PolyForge uses two categories of seed data:

| Category | Files | Purpose |
|---|---|---|
| **SQL seeds** | `seed-news-whales.sql`, `seed-whale-alerts.sql` | Populate live-data tables (news, signals, whale tracking) with realistic sample content for development and QA |
| **TypeScript seeds** | `seed.ts`, `seed.admin.ts` | Populate reference data and admin accounts via the Prisma client (run via `prisma db seed`) |

The SQL seeds are designed to be run against a database that already has market and token data populated (via the market sync pipeline). They use `SELECT` queries against the real `markets` and `tokens` tables to pick up live market IDs, which means the seeded records reference real data rather than hardcoded UUIDs.

---

## 2. Table Name Mapping

### Why PascalCase Fails in Raw SQL

Prisma generates TypeScript models with PascalCase names (e.g. `User`, `Market`, `Token`). When Prisma creates database tables it applies the following naming rules:

1. If the model has an explicit `@@map("table_name")` directive, that name is used as-is.
2. If no `@@map` is present, Prisma lowercases the model name and applies snake_case conversion.

The result is that the SQL table names are lowercase snake_case, not PascalCase. Writing `FROM "User"` in raw SQL will fail with `relation "User" does not exist` because PostgreSQL's unquoted identifiers are case-insensitive but double-quoted identifiers are case-sensitive — and the actual table name is `users`, not `User`.

### Mapping Table

| Prisma Model Name | PostgreSQL Table Name | Notes |
|---|---|---|
| `User` | `users` | Standard lowercase mapping |
| `Market` | `markets` | Standard lowercase mapping |
| `Token` | `tokens` | Standard lowercase mapping |
| `Order` | `orders` | Standard lowercase mapping |
| `Strategy` | `strategies` | Standard lowercase mapping |
| `NewsArticle` | `news_articles` | camelCase → snake_case |
| `NewsSignal` | `news_signals` | camelCase → snake_case |
| `WhaleProfile` | `whale_profiles` | camelCase → snake_case |
| `WhaleAlert` | `whale_alerts` | camelCase → snake_case |

### Column Names with Preserved Casing

Some columns use camelCase names that are preserved in PostgreSQL with explicit double-quoting because Prisma uses `@map` or because they were defined with mixed case in the migration. These must be quoted in raw SQL:

| Column (as used in SQL) | Table | Notes |
|---|---|---|
| `"approvedAt"` | `users` | Quoted — Prisma preserves camelCase for this field |
| `"publishedAt"` | `news_articles` | Quoted |
| `"ingestedAt"` | `news_articles` | Quoted |
| `"marketId"` | `tokens` | Quoted |
| `volume24h` | `markets` | Unquoted — all lowercase |
| `closed` | `markets` | Unquoted boolean column (`TRUE`/`FALSE`) |

> **Important:** Use `WHERE closed = FALSE` to find open markets, not `WHERE "closedAt" IS NULL`. The `closed` field is a `Boolean` column, not a nullable timestamp.

---

## 3. Seed Files

### 3.1 `seed-news-whales.sql`

**File:** `prisma/seed-news-whales.sql`

**Populates:**
- `users.approved` — sets all unapproved seed users to approved
- `news_articles` — 10 sample articles from realistic news sources
- `news_signals` — 22 signals linking articles to markets with sentiment, confidence, and impact data
- `whale_profiles` — 8 fictional high-volume trader profiles
- (Whale alerts are covered by the separate `seed-whale-alerts.sql`)

**Structure:**

```
BEGIN
  ├─ UPDATE users SET approved = TRUE (all unapproved)
  ├─ CREATE TEMP TABLE _markets  (top 10 open markets by volume)
  ├─ INSERT INTO news_articles (10 rows, deterministic UUIDs)
  ├─ INSERT INTO news_signals  (22 rows, referencing article + market UUIDs)
  └─ INSERT INTO whale_profiles (8 rows)
COMMIT
```

The seed uses deterministic UUIDs in the `a0000000-*` namespace for news articles and `w0000000-*` for whale profiles. This makes the seed idempotent for the article/profile rows: re-running it after truncating those tables produces the same UUIDs and allows the signals to reference them by ID.

**Sample articles cover:**
- Middle East geopolitics (ceasefire deadline)
- Crypto markets (Bitcoin surge)
- Sports (March Madness)
- Economics (Fed rate cut signal)
- Technology (AI model launches)
- Climate, ESG, entertainment, elections, biotech

---

### 3.2 `seed-whale-alerts.sql`

**File:** `prisma/seed-whale-alerts.sql`

**Populates:**
- `whale_alerts` — 15 alerts linking whale profiles to token positions with size, price, and direction data

**Structure:**

```
BEGIN
  ├─ CREATE TEMP TABLE _markets (top 8 open markets by volume)
  ├─ DO $$ DECLARE block
  │    ├─ SELECT market IDs into m1–m8
  │    ├─ SELECT token IDs into t1–t5 (YES/NO tokens per market)
  │    ├─ Guard: RAISE NOTICE and RETURN if m1 IS NULL
  │    └─ INSERT INTO whale_alerts (15 rows, using whale profile UUIDs)
  └─ COMMIT
```

**Prerequisites:** Requires whale profiles to already exist in `whale_profiles`. Run `seed-news-whales.sql` first if starting from an empty database.

The `DO $$` PL/pgSQL block is used to avoid repeating the market/token ID lookups across 15 insert rows. If the database has no open markets, the block emits a `RAISE NOTICE` and returns cleanly without inserting anything.

---

### 3.3 `seed.ts`

**File:** `prisma/seed.ts`

**Run via:** `pnpm prisma db seed` (configured in `package.json` under `prisma.seed`)

**Populates:** Reference data for the main database — default configuration records, demo user accounts, and any data required for integration tests to have a known baseline.

**Security:** Passwords are dynamically generated using `crypto.randomBytes(16)` on each run and logged to the console. A `NODE_ENV !== 'development'` guard prevents accidental execution in non-development environments.

**How to run:**

```bash
# From the repo root
pnpm prisma db seed
```

---

### 3.4 `seed.admin.ts`

**File:** `prisma/seed.admin.ts`

**Run via:** Configured in the admin prisma config (`prisma.admin.config.ts`)

**Populates:** Admin database (separate schema) — admin user accounts, permission sets, and default admin configuration.

**Security:** The admin password is dynamically generated using `crypto.randomBytes(16)` on each run and logged to the console. A `NODE_ENV !== 'development'` guard prevents accidental execution in non-development environments.

**How to run:**

```bash
# From the repo root
pnpm prisma --config prisma.admin.config.ts db seed
```

---

## 4. How to Run

All SQL seeds are designed to be piped into `psql` through the running Postgres container. The commands below assume the standard `docker-compose.infra.yml` setup.

### Run `seed-news-whales.sql`

```bash
docker compose -f docker-compose.infra.yml exec -T postgres \
  psql -U polyforge -d polyforge < prisma/seed-news-whales.sql
```

Expected output:

```
BEGIN
UPDATE 41
CREATE TABLE
INSERT 0 10
INSERT 0 22
INSERT 0 8
COMMIT
```

### Run `seed-whale-alerts.sql`

```bash
docker compose -f docker-compose.infra.yml exec -T postgres \
  psql -U poly -d polyforge < prisma/seed-whale-alerts.sql
```

> **Note:** This seed uses the username `poly`, not `polyforge`. Ensure the `poly` role has write access to the `polyforge` database.

Expected output:

```
BEGIN
CREATE TABLE
DO
COMMIT
```

If no open markets exist, you will see:

```
NOTICE:  No open markets found — skipping whale alerts
```

### Run Both Seeds Together

```bash
docker compose -f docker-compose.infra.yml exec -T postgres \
  psql -U polyforge -d polyforge < prisma/seed-news-whales.sql && \
docker compose -f docker-compose.infra.yml exec -T postgres \
  psql -U poly -d polyforge < prisma/seed-whale-alerts.sql
```

### Run TypeScript Seeds

```bash
# Main database seed
pnpm prisma db seed

# Admin database seed
pnpm prisma --config prisma.admin.config.ts db seed
```

### Re-seeding (Idempotency)

The SQL seeds use `INSERT` without `ON CONFLICT DO NOTHING`. Running them a second time against a non-empty database will produce duplicate key violations on the deterministic UUID rows in `news_articles` and `whale_profiles`. To re-seed safely:

```bash
# Truncate the target tables first
docker compose -f docker-compose.infra.yml exec -T postgres \
  psql -U polyforge -d polyforge -c "
    TRUNCATE whale_alerts, whale_profiles, news_signals, news_articles CASCADE;
    UPDATE users SET approved = FALSE, \"approvedAt\" = NULL;
  "

# Then run the seeds
docker compose -f docker-compose.infra.yml exec -T postgres \
  psql -U polyforge -d polyforge < prisma/seed-news-whales.sql
```

---

## 5. Current Seed State

Record counts after running both SQL seeds against a database with the standard market data import (as of 2026-03-28):

| Table | Count | Notes |
|---|---|---|
| `users` (approved) | 41 | All seed users set to approved |
| `news_articles` | 10 | Deterministic UUIDs `a0000000-*` |
| `news_signals` | 22 | Link articles to markets with sentiment metadata |
| `whale_profiles` | 8 | Deterministic UUIDs `w0000000-*` |
| `whale_alerts` | 15 | Linked to top 8 open markets by volume |

---

## 6. Common Issues

### `relation "User" does not exist`

You are using PascalCase in raw SQL. Replace `"User"` with `users`, `"Market"` with `markets`, `"Token"` with `tokens`. See [Section 2](#2-table-name-mapping) for the full mapping.

### `column "closedAt" does not exist`

The market closed status is stored as a boolean column named `closed`, not a nullable timestamp. Use `WHERE closed = FALSE` to filter open markets.

### `NOTICE: No open markets found — skipping whale alerts`

The `seed-whale-alerts.sql` found no open markets in the `markets` table. This means either:
- The market sync pipeline has not run yet.
- All markets in the database are marked as closed.

Run the market sync pipeline before running the whale alerts seed.

### Duplicate key violations on re-seed

The news article and whale profile seeds use deterministic UUIDs and will fail with `duplicate key value violates unique constraint` if the rows already exist. Truncate the relevant tables first (see [Re-seeding](#re-seeding-idempotency) above).

### Wrong username for `seed-whale-alerts.sql`

`seed-news-whales.sql` uses `-U polyforge` and `seed-whale-alerts.sql` uses `-U poly`. These are different Postgres roles. If your environment uses a unified role name, update the `-U` flag in the command accordingly.
