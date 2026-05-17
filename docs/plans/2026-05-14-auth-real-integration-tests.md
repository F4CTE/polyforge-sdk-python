# Auth Real Integration Tests — Implementation Plan

> **For Forge:** Execute this plan task-by-task. Tests should gracefully skip when no real DB is available.

**Goal:** Create integration tests for auth flows that exercise real PostgreSQL and Redis instead of the current FakePrismaService/FakeRedisService in-memory stubs. Keep existing fake-based component tests (they're valuable for speed and coverage).

**Architecture:** Boot a real NestJS Fastify application connected to actual PostgreSQL and Redis test instances. Use `TRUNCATE ... RESTART IDENTITY CASCADE` between tests for isolation. Tests auto-skip when test databases are unavailable so CI doesn't break until infra is ready.

**Tech Stack:** Vitest + NestJS TestingModule + FastifyAdapter + PrismaService + Redis (ioredis) + bcrypt

---

## Problem Summary

The current `test/auth.integration.spec.ts` (1637 lines) and `test/auth.integration.spec.ts` (admin, 959 lines) use `FakePrismaService` and `FakeRedisService` — in-memory Map-based implementations. These are **component tests** (boot full NestJS app with faked boundaries), not true **integration tests** (boot full app against real infrastructure). The docs explicitly prescribe real Postgres + Redis for integration tests with `TRUNCATE`-based cleanup.

This plan creates **real integration tests** that run against actual PostgreSQL and Redis, catching:
- Schema errors (constraints, cascading deletes, indexes)
- Real bcrypt password hashing behavior
- Redis TTL expiration and atomic Lua scripts
- Real Prisma query generation issues

---

### Task 1: Create test Docker Compose for test databases

**Objective:** Provide lightweight PostgreSQL and Redis containers for integration testing.

**Files:**
- Create: `services/auth-service/test/docker-compose.test.yml`

**Step 1: Write the compose file**

```yaml
# Test databases for auth-service integration tests.
# Start before running tests:
#   docker compose -f services/auth-service/test/docker-compose.test.yml up -d
# Stop after:
#   docker compose -f services/auth-service/test/docker-compose.test.yml down -v
name: polyforge-auth-test

services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: poly_test
      POSTGRES_PASSWORD: poly_test
      POSTGRES_DB: polyforge_test
    ports:
      - "127.0.0.1:5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U poly_test -d polyforge_test"]
      interval: 2s
      timeout: 2s
      retries: 10
      start_period: 5s

  redis-test:
    image: redis:7-alpine
    ports:
      - "127.0.0.1:6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 2s
      retries: 10
```

**Step 2: Verify it starts**

Run:
```bash
docker compose -f services/auth-service/test/docker-compose.test.yml up -d
docker compose -f services/auth-service/test/docker-compose.test.yml ps
```

Expected: both services healthy.

**Step 3: Stop and verify cleanup**

```bash
docker compose -f services/auth-service/test/docker-compose.test.yml down -v
```

Expected: containers and volumes removed.

---

### Task 2: Create vitest global setup for running migrations

**Objective:** Run Prisma migrations against the test database before integration tests start.

**Files:**
- Create: `services/auth-service/test/global-setup.ts`

**Step 1: Write global setup**

```typescript
// services/auth-service/test/global-setup.ts
import { execSync } from 'child_process';

export async function setup() {
  const dbUrl = process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    console.log(
      '[global-setup] TEST_DATABASE_URL not set — real integration tests will skip.',
    );
    return async () => {};
  }

  console.log('[global-setup] Running Prisma migrations against test DB...');
  execSync(
    `npx prisma migrate deploy --schema prisma/schema.prisma --config prisma/prisma.config.ts`,
    {
      env: {
        ...process.env,
        DIRECT_DATABASE_URL: dbUrl,
        DATABASE_URL: dbUrl,
      },
      stdio: 'inherit',
    },
  );
  console.log('[global-setup] Migrations complete.');
}

export async function teardown() {
  // Containers are managed externally via docker-compose.
  // No teardown needed here.
}
```

**Step 2: Not needed for vitest — globalSetup runs in a separate process and vitest handles teardown differently.**

---

### Task 3: Update auth-service vitest config for real integration tests

**Objective:** Configure vitest to support real integration tests with globalSetup and test DB env vars.

**Files:**
- Modify: `services/auth-service/vitest.config.ts`

**Step 1: Update vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    env: {
      // Unit/component test env (no real DB)
      USER_JWT_SECRET: 'test-user-jwt-secret-min-32-chars!',
      INTERNAL_JWT_SECRET: 'test-user-jwt-secret-min-32-chars!',
      INTERNAL_JWT_AUDIENCE: 'polyforge-internal',
      INTERNAL_JWT_ISSUERS: 'auth-service,api-service',
      ADMIN_JWT_SECRET: 'test-user-jwt-secret-min-32-chars!',
      TOTP_ENCRYPTION_KEY: '0'.repeat(64),
      COOKIE_SECURE: 'false',
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:4200',
      EMAIL_DRIVER: 'mailhog',
      MAILHOG_HOST: 'localhost',
      MAILHOG_PORT: '1025',
      REDIS_URL: 'redis://localhost:6379',
      // Real integration test env (overrides for infra tests)
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      TEST_REDIS_URL: process.env.TEST_REDIS_URL ?? '',
    },
    coverage: { /* ... existing config unchanged ... */ },
  },
});
```

---

### Task 4: Create test DB cleanup helper

**Objective:** Provide a helper to clean all auth-related tables between tests.

**Files:**
- Create: `services/auth-service/test/helpers/clean-db.ts`

**Step 1: Write the cleanup helper**

```typescript
// services/auth-service/test/helpers/clean-db.ts
import { PrismaService } from '@polyforge/shared-db';

/**
 * Truncate all tables relevant to auth testing, in dependency order.
 */
export async function cleanAuthDb(prisma: PrismaService): Promise<void> {
  // Tables are truncated in dependency order (children first, then parents).
  // This avoids foreign key constraint violations.
  const tables = [
    // Children first (FK dependencies)
    'public.user_login_history',
    'public.email_verifications',
    'public.password_reset_tokens',
    'public.user_credentials',
    'public.kalshi_credentials',
    'public.polymarket_us_credentials',
    'public.api_keys',
    'public.notification_preferences',
    'public.strategies',
    'public.bot_connections',
    'public.webhooks',
    'public.follows',
    'public.user_limits',
    'public.notification_history',
    'public.strategy_versions',
    'public.strategy_likes',
    'public.strategy_comments',
    'public.strategy_forks',
    'public.strategy_status_history',
    'public.strategy_events',
    'public.orders',
    'public.smart_orders',
    'public.positions',
    'public.paper_orders',
    'public.paper_positions',
    'public.backtest_runs',
    'public.reports',
    'public.price_alerts',
    'public.copy_configs',
    'public.copy_trades',
    'public.conditional_orders',
    'public.watchlist_items',
    'public.journal_entries',
    // Parent last
    'public.users',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`,
      );
    } catch {
      // Table might not exist yet (e.g., if migrations haven't been run)
      // Silently ignore — tables will be created by migration on next run
    }
  }
}
```

---

### Task 5: Create test Redis cleanup helper

**Objective:** Provide a helper to flush all Redis keys between tests.

**Files:**
- Create: `services/auth-service/test/helpers/clean-redis.ts`

**Step 1: Write the Redis cleanup helper**

```typescript
// services/auth-service/test/helpers/clean-redis.ts
import { Redis } from 'ioredis';

export async function cleanAuthRedis(redis: Redis): Promise<void> {
  await redis.flushdb();
}
```

---

### Task 6: Create the real auth integration test file

**Objective:** Write integration tests that exercise auth endpoints against real PostgreSQL + Redis.

**Files:**
- Create: `services/auth-service/test/auth.infra.spec.ts`

**Step 1: Write the test file**

This file tests against real PostgreSQL and Redis. It skips the entire suite if `TEST_DATABASE_URL` or `TEST_REDIS_URL` aren't set.

Key tests to include (mirroring the most important scenarios from the fake integration test):
1. **POST /register** — creates user in real DB, persists password hash, sends verification email
2. **POST /login** — authenticates against real bcrypt hash, sets cookies
3. **GET /me** — returns profile from real DB
4. **POST /refresh** — refresh token rotation (real Redis Lua script)
5. **POST /logout** — revokes refresh token (real Redis deletion)
6. **Full lifecycle** — register → verify email → login → refresh → logout → post-logout checks
7. **Edge cases** — duplicate email (real unique constraint), login lockout (real Redis counter), password reset (real token verification)
8. **DELETE /account** — PII anonymization in real DB

```typescript
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Global, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import fastifyCookie from '@fastify/cookie';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';

import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { PosthogService } from '@polyforge/shared-posthog';
import { MailService } from '../src/mail/mail.service';
import { cleanAuthDb } from './helpers/clean-db';
import { cleanAuthRedis } from './helpers/clean-redis';

// ... (test implementation)
```

---

### Task 7: Verify the tests run and skip gracefully without test DB

**Objective:** Ensure the tests don't break when no test database is available.

**Step 1: Run tests without test database**

```bash
cd services/auth-service && npx vitest run test/auth.infra.spec.ts
```

Expected: all tests skipped with clear message about missing `TEST_DATABASE_URL`.

**Step 2: Verify existing tests still pass**

```bash
cd services/auth-service && npx vitest run
```

Expected: all existing tests pass, new tests skip.

---

### Task 8: Spin up test databases and run integration tests

**Objective:** Run the new integration tests against real databases.

**Step 1: Start test databases**

```bash
docker compose -f services/auth-service/test/docker-compose.test.yml up -d --wait
```

**Step 2: Run migrations**

```bash
export DIRECT_DATABASE_URL="postgresql://poly_test:poly_test@localhost:5433/polyforge_test"
cd services/auth-service
npx prisma migrate deploy --schema ../../prisma/schema.prisma
```

**Step 3: Run integration tests**

```bash
TEST_DATABASE_URL="postgresql://poly_test:poly_test@localhost:5433/polyforge_test?pgbouncer=true" \
TEST_REDIS_URL="redis://localhost:6380" \
npx vitest run test/auth.infra.spec.ts
```

Expected: all tests pass against real databases.

**Step 4: Tear down**

```bash
docker compose -f services/auth-service/test/docker-compose.test.yml down -v
```

---

### Task 9: Verify coverage thresholds maintained

**Objective:** Ensure the new tests don't break the existing coverage thresholds.

**Step 1: Run full test suite**

```bash
cd services/auth-service && npx vitest run --coverage
```

**Step 2: Check thresholds**

Expected: lines >= 85%, functions >= 80%, branches >= 78%, statements >= 85%.

---

### Task 10: Paperclip comment with results

**Objective:** Document the completed work in the issue.

**Step 1: Post comment to POLA-4882**

Using the Paperclip API, post a comment with:
- Summary of what was created
- File listing
- How to run the tests
- Test count added
