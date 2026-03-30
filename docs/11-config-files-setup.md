# Polyforge — Config Files Setup Tutorial

> Step-by-step guide to create the 6 files needed before running any command.  
> Follow the steps in order — each file depends on the previous ones.

---

## What you will create

| Step | File | Why it's needed |
|---|---|---|
| 1 | `package.json` (root) | Defines the monorepo workspace and all `pnpm` scripts |
| 2 | `turbo.json` | Defines the Turborepo task graph (build order, caching) |
| 3 | `.env.example` | Environment variable template — copied to `.env` before running |
| 4 | `docker-compose.dev.yml` | Spins up all 20 containers for local development |
| 5 | `prisma/schema.prisma` | User database schema (polyforge) |
| 6 | `prisma/schema.admin.prisma` | Admin database schema (polyforge_admin) |
| 7 | `openapi-ts.config.ts` | hey-api codegen config for user-app |
| 8 | `openapi-ts.admin.config.ts` | hey-api codegen config for admin-app |

---

## Step 1 — `package.json` (root)

Create this file at the **root of the repository**.

```json
{
  "name": "polyforge",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "services/*",
    "apps/*"
  ],
  "scripts": {
    "build":               "turbo run build",
    "test":                "turbo run test",
    "typecheck":           "turbo run typecheck",
    "lint":                "turbo run lint",
    "dev:certs":           "bash scripts/dev-certs.sh",
    "migrate":             "dotenv -e .env -- prisma migrate deploy --schema prisma/schema.prisma",
    "migrate:admin":       "dotenv -e .env -- prisma migrate deploy --schema prisma/schema.admin.prisma",
    "migrate:dev":         "dotenv -e .env -- prisma migrate dev --schema prisma/schema.prisma",
    "migrate:dev:admin":   "dotenv -e .env -- prisma migrate dev --schema prisma/schema.admin.prisma",
    "generate":            "prisma generate --schema prisma/schema.prisma && prisma generate --schema prisma/schema.admin.prisma",
    "seed":                "dotenv -e .env -- ts-node prisma/seed.ts",
    "seed:admin":          "dotenv -e .env -- ts-node prisma/seed.admin.ts",
    "reset":               "bash scripts/reset.sh",
    "health-check":        "bash scripts/health-check.sh",
    "generate:api":        "openapi-ts --config openapi-ts.config.ts && openapi-ts --config openapi-ts.admin.config.ts",
    "format":              "prettier --write \"**/*.{ts,json,md}\""
  },
  "devDependencies": {
    "turbo":                               "^2.0.0",
    "typescript":                          "^5.4.0",
    "prettier":                            "^3.2.0",
    "dotenv-cli":                          "^7.4.0",
    "@hey-api/openapi-ts": "0.x.y",
    "ts-node":                             "^10.9.0",
    "prisma":                              "^5.12.0",
    "@types/node":                         "^20.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

**Key differences vs a single-DB setup:**

- `migrate` and `migrate:admin` are separate scripts — they use different schema files and different `DATABASE_URL` / `ADMIN_DATABASE_URL`
- `generate` runs Prisma client generation for **both** schemas in one command
- `seed` and `seed:admin` are separate scripts — user seed data and admin account creation are independent

---

## Step 2 — `turbo.json`

Create this file at the **root of the repository**, next to `package.json`.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs":    ["src/**", "tsconfig*.json", "package.json"],
      "outputs":   ["dist/**"]
    },
    "build:swagger": {
      "dependsOn": ["^build"],
      "inputs":    ["src/**"],
      "outputs":   ["../../swagger.json", "../../swagger-admin.json"],
      "cache":     false
    },
    "generate:api": {
      "dependsOn": ["build:swagger"],
      "inputs":    ["../../swagger.json", "../../swagger-admin.json", "../../openapi-ts.config.ts", "../../openapi-ts.admin.config.ts"],
      "outputs":   ["src/app/api/**"],
      "cache":     false
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs":    ["src/**", "test/**"],
      "outputs":   ["coverage/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs":    ["src/**", "tsconfig*.json"]
    },
    "lint": {
      "inputs": ["src/**", ".eslintrc*"]
    },
    "dev": {
      "cache":      false,
      "persistent": true
    }
  }
}
```

---

## Step 3 — `.env.example`

Create this file at the **root of the repository**. Developers copy it to `.env` before running anything.

```bash
# ─────────────────────────────────────────────────────────────
# RUNTIME
# ─────────────────────────────────────────────────────────────
NODE_ENV=development
LOG_LEVEL=debug

# ─────────────────────────────────────────────────────────────
# USER DATABASE
# Accessed by: all user-facing services
# ─────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://poly:devpass@pgbouncer:5432/polyforge?pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL=postgresql://poly:devpass@postgres:5432/polyforge

# ─────────────────────────────────────────────────────────────
# ADMIN DATABASE
# Accessed by: admin-auth-service and admin-api-service ONLY
# ─────────────────────────────────────────────────────────────
ADMIN_DATABASE_URL=postgresql://poly_admin:devpass_admin@pgbouncer-admin:5433/polyforge_admin?pgbouncer=true&connection_limit=1
ADMIN_DIRECT_DATABASE_URL=postgresql://poly_admin:devpass_admin@postgres-admin:5434/polyforge_admin

# ─────────────────────────────────────────────────────────────
# REDIS
# ─────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ─────────────────────────────────────────────────────────────
# JWT SECRETS — dev values only, never use in production
# ─────────────────────────────────────────────────────────────
USER_JWT_SECRET=dev-user-jwt-secret-change-in-production
ADMIN_JWT_SECRET=dev-admin-jwt-secret-change-in-production
BOT_JWT_SECRET=dev-bot-jwt-secret-change-in-production
INTERNAL_JWT_SECRET=dev-internal-jwt-secret-change-in-production

# ─────────────────────────────────────────────────────────────
# ENCRYPTION — dev values only (32-byte hex zeroes)
# ─────────────────────────────────────────────────────────────
MASTER_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
TOTP_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# ─────────────────────────────────────────────────────────────
# EMAIL
# ─────────────────────────────────────────────────────────────
EMAIL_DRIVER=mailhog
MAILHOG_HOST=mailhog
MAILHOG_PORT=1025
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@polyforge.app

# ─────────────────────────────────────────────────────────────
# POLYMARKET APIs — mock in dev
# ─────────────────────────────────────────────────────────────
GAMMA_API_URL=http://mock-polymarket:3096
CLOB_API_URL=http://mock-polymarket:3099
CLOB_WS_URL=ws://mock-polymarket:3098
DATA_API_URL=http://mock-polymarket:3097
SCENARIO=normal

# ─────────────────────────────────────────────────────────────
# POLYMARKET BUILDER PROGRAM
# ─────────────────────────────────────────────────────────────
POLY_BUILDER_API_KEY=dev-builder-api-key
POLY_BUILDER_SECRET=dev-builder-secret
POLY_BUILDER_PASSPHRASE=dev-builder-passphrase

# ─────────────────────────────────────────────────────────────
# BLOCKCHAIN
# ─────────────────────────────────────────────────────────────
CHAIN_ID=137

# ─────────────────────────────────────────────────────────────
# BOTS
# ─────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=dev-disabled
DISCORD_BOT_TOKEN=dev-disabled

# ─────────────────────────────────────────────────────────────
# CORS & DOMAINS
# ─────────────────────────────────────────────────────────────
FRONTEND_URL=https://localhost
ADMIN_URL=https://admin.polyforge.app
CORS_ORIGINS=https://localhost
ADMIN_CORS_ORIGINS=https://admin.polyforge.app

# ─────────────────────────────────────────────────────────────
# SERVICE PORTS
# ─────────────────────────────────────────────────────────────
AUTH_SERVICE_PORT=3001
API_SERVICE_PORT=3002
ADMIN_AUTH_SERVICE_PORT=3003
ADMIN_API_SERVICE_PORT=3004
MARKET_DATA_SERVICE_PORT=3005
STRATEGY_ENGINE_PORT=3006
ORDER_SERVICE_PORT=3007
PAPER_ORDER_SERVICE_PORT=3008
BACKTEST_SERVICE_PORT=3009
NOTIFICATION_SERVICE_PORT=3010
BOT_SERVICE_PORT=3011
SIGNER_SERVICE_PORT=3012
MOCK_POLYMARKET_PORT=3096
```

**After creating this file**, copy it:

```bash
cp .env.example .env
```

---

## Step 4 — `docker-compose.dev.yml`

Create this file at the **root of the repository**.

This file defines **20 containers**: 2 Postgres instances, 2 PgBouncers, Redis, MailHog, mock-polymarket, 13 NestJS services, and Nginx.

```yaml
name: polyforge-dev

networks:
  public:
  internal:
  signer-only:
  admin-only:

volumes:
  postgres-data:
  postgres-admin-data:
  redis-data:

services:

  # ─── USER DATABASE STACK ───────────────────────────────────

  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_USER: poly
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: polyforge
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks: [internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U poly -d polyforge"]
      interval: 5s
      timeout: 5s
      retries: 10

  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      DATABASE_URL: postgres://poly:devpass@postgres:5432/polyforge
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 100
      DEFAULT_POOL_SIZE: 20
      SERVER_RESET_QUERY: DISCARD ALL
    depends_on:
      postgres: { condition: service_healthy }
    networks: [internal]

  # ─── ADMIN DATABASE STACK ──────────────────────────────────
  # No TimescaleDB — admin DB has no hypertables
  # On admin-only network — user services can never connect to it

  postgres-admin:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: poly_admin
      POSTGRES_PASSWORD: devpass_admin
      POSTGRES_DB: polyforge_admin
    ports:
      - "5434:5432"   # Exposed for local admin migrations (ADMIN_DIRECT_DATABASE_URL)
    volumes:
      - postgres-admin-data:/var/lib/postgresql/data
    networks: [admin-only]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U poly_admin -d polyforge_admin"]
      interval: 5s
      timeout: 5s
      retries: 10

  pgbouncer-admin:
    image: edoburu/pgbouncer:latest
    environment:
      DATABASE_URL: postgres://poly_admin:devpass_admin@postgres-admin:5432/polyforge_admin
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 20
      DEFAULT_POOL_SIZE: 5
      SERVER_RESET_QUERY: DISCARD ALL
    ports:
      - "5433:5432"   # Exposed for local admin service connections
    depends_on:
      postgres-admin: { condition: service_healthy }
    networks: [admin-only]

  # ─── SHARED INFRASTRUCTURE ─────────────────────────────────

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - redis-data:/data
    networks: [internal, signer-only]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "8025:8025"   # Web UI
      - "1025:1025"   # SMTP
    networks: [internal]

  # ─── MOCK POLYMARKET (dev only) ────────────────────────────

  mock-polymarket:
    build:
      context: .
      dockerfile: services/mock-polymarket/Dockerfile
    environment:
      SCENARIO: ${SCENARIO:-normal}
    ports:
      - "3096:3096"
      - "3097:3097"
      - "3098:3098"
      - "3099:3099"
    networks: [internal]

  # ─── USER-FACING SERVICES (use DATABASE_URL) ───────────────

  signer-service:
    build:
      context: .
      dockerfile: services/signer-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${SIGNER_SERVICE_PORT:-3012}
    depends_on:
      redis:    { condition: service_healthy }
      postgres: { condition: service_healthy }
    networks: [signer-only]   # ONLY signer-only, never public or admin-only
    restart: unless-stopped

  auth-service:
    build:
      context: .
      dockerfile: services/auth-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${AUTH_SERVICE_PORT:-3001}
    depends_on:
      postgres:       { condition: service_healthy }
      redis:          { condition: service_healthy }
      signer-service: { condition: service_started }
    networks: [public, internal, signer-only]
    restart: unless-stopped

  api-service:
    build:
      context: .
      dockerfile: services/api-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${API_SERVICE_PORT:-3002}
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    networks: [public, internal]
    restart: unless-stopped

  market-data-service:
    build:
      context: .
      dockerfile: services/market-data-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${MARKET_DATA_SERVICE_PORT:-3005}
    depends_on:
      postgres:        { condition: service_healthy }
      redis:           { condition: service_healthy }
      mock-polymarket: { condition: service_started }
    networks: [internal]
    restart: unless-stopped

  strategy-engine:
    build:
      context: .
      dockerfile: services/strategy-engine/Dockerfile
    env_file: .env
    environment:
      PORT: ${STRATEGY_ENGINE_PORT:-3006}
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    networks: [internal]
    restart: unless-stopped

  order-service:
    build:
      context: .
      dockerfile: services/order-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${ORDER_SERVICE_PORT:-3007}
    depends_on:
      redis:           { condition: service_healthy }
      signer-service:  { condition: service_started }
      mock-polymarket: { condition: service_started }
    networks: [internal, signer-only]
    restart: unless-stopped

  paper-order-service:
    build:
      context: .
      dockerfile: services/paper-order-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${PAPER_ORDER_SERVICE_PORT:-3008}
    depends_on:
      redis:    { condition: service_healthy }
      postgres: { condition: service_healthy }
    networks: [internal]
    restart: unless-stopped

  backtest-service:
    build:
      context: .
      dockerfile: services/backtest-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${BACKTEST_SERVICE_PORT:-3009}
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    networks: [internal]
    restart: unless-stopped

  notification-service:
    build:
      context: .
      dockerfile: services/notification-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${NOTIFICATION_SERVICE_PORT:-3010}
    depends_on:
      redis:    { condition: service_healthy }
      postgres: { condition: service_healthy }
    networks: [internal]
    restart: unless-stopped

  bot-service:
    build:
      context: .
      dockerfile: services/bot-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${BOT_SERVICE_PORT:-3011}
    depends_on:
      redis:    { condition: service_healthy }
      postgres: { condition: service_healthy }
    networks: [internal]
    restart: unless-stopped

  # ─── ADMIN SERVICES (use ADMIN_DATABASE_URL) ───────────────

  admin-auth-service:
    build:
      context: .
      dockerfile: services/admin-auth-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${ADMIN_AUTH_SERVICE_PORT:-3003}
    depends_on:
      postgres-admin: { condition: service_healthy }
      redis:          { condition: service_healthy }
    networks: [admin-only]    # Never on public or internal
    restart: unless-stopped

  admin-api-service:
    build:
      context: .
      dockerfile: services/admin-api-service/Dockerfile
    env_file: .env
    environment:
      PORT: ${ADMIN_API_SERVICE_PORT:-3004}
    depends_on:
      postgres-admin: { condition: service_healthy }
      redis:          { condition: service_healthy }
    networks: [admin-only]
    restart: unless-stopped

  # ─── GATEWAY (Nginx) ───────────────────────────────────────

  gateway:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.dev.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
      - ./apps/user-app/dist:/usr/share/nginx/html/user:ro
      - ./apps/admin-app/dist:/usr/share/nginx/html/admin:ro
    depends_on:
      - auth-service
      - api-service
      - admin-auth-service
      - admin-api-service
    networks: [public, admin-only]
    restart: unless-stopped
```

**Network isolation summary:**

| Container | Networks |
|---|---|
| `postgres` | internal only |
| `pgbouncer` | internal only |
| `postgres-admin` | admin-only only |
| `pgbouncer-admin` | admin-only only |
| `redis` | internal + signer-only |
| `signer-service` | signer-only only |
| `auth-service` | public + internal + signer-only |
| `api-service` | public + internal |
| `admin-auth-service` | admin-only only |
| `admin-api-service` | admin-only only |
| `gateway` | public + admin-only |
| All other user services | internal only |

---

## Step 5 — `prisma/schema.prisma` (user database)

Create the `prisma/` directory at the root, then create `schema.prisma` inside it.

```bash
mkdir -p prisma
```

This schema is for the **user database** (`polyforge`). It contains all user-facing tables: auth, trading, and the TimescaleDB analytics tables.

> The full schema content is in `11-config-files-setup.md` (previous version). Copy the `schema.prisma` content from there — it is unchanged except that `UserCredential`, `AuditLog`, `Admin`, and `AdminSession` models have been removed (they now live in `schema.admin.prisma`).

After creating the file, generate the Prisma client:

```bash
pnpm generate
```

---

## Step 6 — `prisma/schema.admin.prisma` (admin database)

Create `schema.admin.prisma` in the same `prisma/` directory.

```prisma
generator adminClient {
  provider = "prisma-client-js"
  output   = "../node_modules/@prisma/admin-client"
}

datasource db {
  provider  = "postgresql"
  url       = env("ADMIN_DATABASE_URL")
  directUrl = env("ADMIN_DIRECT_DATABASE_URL")
}

enum AdminRole {
  SUPER_ADMIN
  ADMIN
  VIEWER
}

model Admin {
  id           String    @id @default(uuid())
  email        String    @unique @db.VarChar(255)
  passwordHash String    @db.VarChar(255)
  displayName  String    @db.VarChar(100)
  role         AdminRole
  active       Boolean   @default(true)
  createdAt    DateTime  @default(now())
  lastSeen     DateTime  @default(now())

  sessions  AdminSession[]
  auditLogs AuditLog[]

  @@map("admins")
}

model AdminSession {
  id        String   @id @default(uuid())
  adminId   String
  ip        String   @db.VarChar(45)
  userAgent String
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())

  admin Admin @relation(fields: [adminId], references: [id])

  @@map("admin_sessions")
}

// Insert only — never update, never delete, never truncate
model AuditLog {
  id         BigInt   @id @default(autoincrement())
  adminId    String
  action     String   @db.VarChar(100)
  targetType String   @db.VarChar(50)
  targetId   String?                   // UUID from user DB — no FK (cross-DB reference)
  payload    Json?
  ip         String   @db.VarChar(45)
  createdAt  DateTime @default(now())

  admin Admin @relation(fields: [adminId], references: [id])

  @@map("audit_logs")
}
```

---

## Step 7 — `openapi-ts.config.ts` (user-app)

Create this file at the **root of the repository**.

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input:  'services/api-service/dist/swagger.json',
  output: {
    path:   'apps/user-app/src/app/api',
    format: 'prettier',
  },
  plugins: [
    { name: '@hey-api/typescript', enums: 'javascript' },
    { name: '@hey-api/sdk' },
    { name: '@hey-api/client-angular' },
  ],
});
```

---

## Step 8 — `openapi-ts.admin.config.ts` (admin-app)

Create this file at the **root of the repository**.

```typescript
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input:  'services/admin-api-service/dist/swagger-admin.json',
  output: {
    path:   'apps/admin-app/src/app/api',
    format: 'prettier',
  },
  plugins: [
    { name: '@hey-api/typescript', enums: 'javascript' },
    { name: '@hey-api/sdk' },
    { name: '@hey-api/client-angular' },
  ],
});
```

> **Version pinning:** After installing, replace `0.x.y` in `package.json` with the exact installed version. Run `pnpm ls @hey-api/openapi-ts` to get it. Remove the `^` prefix.

---

## Final verification

After creating all 8 files, your structure should look like:

```
polyforge/
├── package.json                  ✅ Step 1
├── turbo.json                    ✅ Step 2
├── .env.example                  ✅ Step 3
├── .env                          ← copy of .env.example (gitignored)
├── docker-compose.dev.yml        ✅ Step 4
├── openapi-ts.config.ts          ✅ Step 7 — hey-api user-app
├── openapi-ts.admin.config.ts    ✅ Step 8 — hey-api admin-app
└── prisma/
    ├── schema.prisma             ✅ Step 5 — user database
    └── schema.admin.prisma       ✅ Step 6 — admin database
```

Run the full setup sequence:

```bash
# 1. Copy env
cp .env.example .env

# 2. Install all dependencies
pnpm install

# 3. Generate both Prisma clients
pnpm generate

# 4. Generate Angular API clients (requires swagger.json — run after first build:swagger)
pnpm generate:api

# 4. Generate SSL certs for localhost HTTPS
pnpm dev:certs

# 5. Start all 20 containers
docker compose -f docker-compose.dev.yml up --build

# 6. Run user DB migrations (in a new terminal)
pnpm migrate

# 7. Run admin DB migrations
pnpm migrate:admin

# 8. Seed user test data
pnpm seed

# 9. Seed admin account
pnpm seed:admin

# 10. Verify
curl -k https://localhost/api/v1/health
```

---

## TimescaleDB migration note

After `pnpm migrate:dev`, open the generated migration file in `prisma/migrations/*/migration.sql` and append these SQL statements **before applying it**:

```sql
-- TimescaleDB hypertables (user DB only — admin DB does not use TimescaleDB)
SELECT create_hypertable('price_history',   'time');
SELECT create_hypertable('pnl_snapshots',   'time');
SELECT create_hypertable('rate_limit_usage','time');
SELECT create_hypertable('cache_stats',     'time');

-- Continuous aggregates
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

-- Retention policies
SELECT add_retention_policy('price_history',    INTERVAL '7 days');
SELECT add_retention_policy('rate_limit_usage', INTERVAL '30 days');
SELECT add_retention_policy('cache_stats',      INTERVAL '30 days');
```

The admin migration (`pnpm migrate:dev:admin`) does not need any TimescaleDB additions — `polyforge_admin` is plain PostgreSQL.

---

*Reference: [Dev Setup Guide](./09-dev-setup.md) · [Database & Redis](./04-database-and-redis.md) · [Env Reference](./08-env-reference.md)*
