# Polyforge — Developer Setup Guide

> Get from zero to a fully running local Polyforge instance.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install Dependencies & Build Packages](#2-install-dependencies--build-packages)
3. [Configure Environment](#3-configure-environment)
4. [Start the Stack](#4-start-the-stack)
5. [Verify Everything Works](#5-verify-everything-works)
6. [Run the Angular Apps](#6-run-the-angular-apps)
7. [Daily Development Commands](#7-daily-development-commands)
8. [Mock Scenarios](#8-mock-scenarios)
9. [Common Issues & Fixes](#9-common-issues--fixes)

---

## 1. Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 24.x | https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm` |
| Docker Desktop | 4.x | https://docker.com/products/docker-desktop |

```bash
node --version         # v24.x.x
pnpm --version         # 9.x.x
docker compose version # Docker Compose version v2+
```

---

## 2. Install Dependencies & Build Packages

```bash
pnpm install
pnpm --filter "./packages/**" build
```

The second command compiles all shared packages to `dist/`. Run it once after `pnpm install`, and again whenever you change code inside a `packages/` directory.

---

## 3. Configure Environment

```bash
cp .env.example .env
```

The defaults work out of the box for local dev — no changes needed. All values point to local Docker services.

---

## 4. Start the Stack

```bash
docker compose -f docker-compose.infra.yml up --build
```

This starts everything: databases, Redis, MailHog, mock-polymarket, migrations, and all NestJS services (including auth-service and admin-auth-service).

**First run** takes 5–10 minutes to build all images. Subsequent runs start in ~30 seconds.

**Services and exposed ports:**

| Service | Port | Notes |
|---|---|---|
| auth-service | 3001 | `POST /auth/v1/register`, `/login`, etc. |
| api-service | 3002 | REST API + WebSocket |
| admin-auth-service | 3003 | Admin login |
| admin-api-service | 3004 | Admin REST API |
| market-data-service | 3005 | Polymarket data feed |
| strategy-engine | 3006 | Strategy tick runner |
| order-service | 3007 | CLOB order submission |
| paper-order-service | 3008 | Simulated fills |
| backtest-service | 3009 | Historical replay |
| notification-service | 3010 | Email + Telegram + Discord |
| bot-service | 3011 | Telegram/Discord bots |
| PostgreSQL | 5432 | User DB (direct) |
| PostgreSQL admin | 5434 | Admin DB (direct) |
| Redis | 6379 | — |
| MailHog UI | 8025 | http://localhost:8025 |
| mock-polymarket | 3096–3099 | Gamma, Data, CLOB WS APIs |

---

## 5. Verify Everything Works

```bash
# Health checks
curl http://localhost:3001/health | jq .
curl http://localhost:3002/health | jq .
curl http://localhost:3003/health | jq .
curl http://localhost:3004/health | jq .
```

All should return `{"status":"ok"}` or similar.

**Test registration + email:**
```bash
curl -s -X POST http://localhost:3001/auth/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"Test1234!","tosAccepted":true}' | jq .
```

Check http://localhost:8025 — the verification email should appear in MailHog.

---

## 6. Run the Angular Apps

Open two terminal tabs:

**User app** (http://localhost:4200):
```bash
cd apps/user-app
pnpm start
```

**Admin app** (http://localhost:4300):
```bash
cd apps/admin-app
pnpm start
```

Both apps use `proxy.conf.json` to route API calls to the running Docker services:
- `/auth/v1/*` → `localhost:3001` (user app) / `localhost:3003` (admin app)
- `/api/v1/*` → `localhost:3002` (user app) / `localhost:3004` (admin app)

No nginx needed for local dev.

**Default test accounts** (created by migrations seed):

| App | Email | Password |
|---|---|---|
| Admin panel | admin@polyforge.app | Admin1234! |
| User app | alice@test.com | Test1234! |
| User app | bob@test.com | Test1234! |

---

## 7. Daily Development Commands

```bash
# Start/stop infrastructure
docker compose -f docker-compose.infra.yml up -d
docker compose -f docker-compose.infra.yml down

# View logs for a specific service
docker compose -f docker-compose.infra.yml logs -f auth-service
docker compose -f docker-compose.infra.yml logs -f api-service

# Rebuild a single service after code changes
docker compose -f docker-compose.infra.yml up --build auth-service

# Run migrations (if you add a new Prisma migration)
dotenv -e .env -- prisma migrate deploy --schema prisma/schema.prisma
dotenv -e .env -- prisma migrate deploy --schema prisma/schema.admin.prisma

# Regenerate Prisma clients (after schema change)
pnpm generate

# TypeScript check all packages and services
pnpm typecheck

# Run all tests
pnpm test

# Run tests for a specific service
cd services/auth-service && pnpm test

# Build everything
pnpm build

# Rebuild shared packages only
pnpm --filter "./packages/**" build
```

---

## 8. Mock Scenarios

The `mock-polymarket` service supports different behaviour modes. Set `SCENARIO` in `.env` and restart:

```bash
# In .env:
SCENARIO=normal       # Default: realistic price movement, fills in ~2s
SCENARIO=volatile     # Fast price swings, instant fills
SCENARIO=api_down     # REST returns 503, WebSocket disconnects periodically
SCENARIO=rate_limited # 429 after 10 requests/min (tests backoff logic)
SCENARIO=slow         # All responses delayed 2–5 seconds

# Apply:
docker compose -f docker-compose.infra.yml restart mock-polymarket
```

---

## 9. Common Issues & Fixes

### "Cannot connect" / service exits immediately

Check if migrations completed:
```bash
docker compose -f docker-compose.infra.yml logs migrate-user
docker compose -f docker-compose.infra.yml logs migrate-admin
```
If they failed, check that postgres is healthy and rerun:
```bash
docker compose -f docker-compose.infra.yml up migrate-user migrate-admin
```

### `ERR_MODULE_NOT_FOUND` when starting a service

Shared packages aren't compiled. Run:
```bash
pnpm --filter "./packages/**" build
```

### Port already in use

```bash
# Find what's using the port
netstat -ano | findstr :3001   # Windows
lsof -i :3001                  # Mac/Linux
```
Stop the conflicting process, or change the port mapping in `docker-compose.infra.yml`.

### Angular app shows "proxy error"

The corresponding NestJS service isn't running. Check:
```bash
docker compose -f docker-compose.infra.yml ps
```

### Email not appearing in MailHog

Confirm `EMAIL_DRIVER=mailhog` in `.env` and that the mailhog container is running. Open http://localhost:8025.

### Out of disk space (Docker)

```bash
docker system prune -a
docker compose -f docker-compose.infra.yml up --build
```

---

*Next: [Architecture](./01-architecture.md) · [API Catalog](./06-api-catalog.md) · [Database & Redis](./04-database-and-redis.md)*
