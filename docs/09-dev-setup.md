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
8. [Volume-Mount Dev Mode (no rebuild)](#8-volume-mount-dev-mode-no-rebuild)
9. [Mock Scenarios](#9-mock-scenarios)
10. [Common Issues & Fixes](#10-common-issues--fixes)

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

This starts everything: databases, Redis, MailHog, mock-polymarket, migrations, all NestJS services, Angular frontends, and the nginx gateway.

**First run** takes 5–10 minutes to build all images. Subsequent runs start in ~30 seconds.

**Browser access:**

| URL | What you see |
|---|---|
| http://localhost | User app (landing page at `/`, Angular SPA at all other paths) |
| http://localhost:8080 | Admin console |
| http://localhost:8025 | MailHog — all outbound emails |

**Services and exposed ports (direct access):**

| Service | Port | Notes |
|---|---|---|
| gateway (nginx) | 80, 8080 | Reverse proxy — main entry point |
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
# Health checks (direct)
curl http://localhost:3001/health | jq .
curl http://localhost:3002/health | jq .
curl http://localhost:3003/health | jq .
curl http://localhost:3004/health | jq .

# Health check through gateway
curl http://localhost/api/v1/health | jq .
```

All should return `{"status":"ok"}` or similar.

**Test registration + email (through gateway):**
```bash
curl -s -X POST http://localhost/auth/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"Test1234!","tosAccepted":true}' | jq .
```

Check http://localhost:8025 — the verification email should appear in MailHog.

---

## 6. Frontend Apps

The Angular apps are built and served by Docker — **no separate `ng serve` needed**.

After `docker compose up`:

| App | URL |
|---|---|
| User app | http://localhost |
| Admin console | http://localhost:8080 |

The nginx gateway (`services/gateway/nginx.dev.conf`) handles routing:
- `/auth/v1/*` → auth-service (port 3001)
- `/api/v1/*` → api-service (port 3002)
- `/ws` → api-service WebSocket
- All other paths → Angular SPA (`try_files`)

**If you need live-reload during frontend development**, you can still run `ng serve` locally:

```bash
# User app with proxy (http://localhost:4200)
cd apps/user-app && npm start

# Admin app with proxy (http://localhost:4300)
cd apps/admin-app && npm start
```

Both apps include a `proxy.conf.json` that forwards API calls to the Docker services.

**Default accounts:**

| App | Email | Password | Notes |
|---|---|---|---|
| Admin console | superadmin@dev.local | superadmin123 | SUPER_ADMIN — run `pnpm seed:admin` first |
| User app | alice@test.com | Test1234! | Seeded by migrations |
| User app | bob@test.com | Test1234! | Seeded by migrations |

To seed the admin database (first time only):
```bash
ADMIN_DIRECT_DATABASE_URL=postgresql://poly_admin:devpass_admin@localhost:5434/polyforge_admin pnpm seed:admin
```

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

# Run E2E tests (requires Docker stack running)
BASE_URL=http://localhost pnpm --filter @polyforge/e2e test

# Build everything
pnpm build

# Rebuild shared packages only
pnpm --filter "./packages/**" build
```

---

## 8. Volume-Mount Dev Mode (no rebuild)

The `docker-compose.override.yml` file mounts local `dist/` directories into running containers so you can iterate on code without running `docker compose build`. Docker Compose merges the override file automatically when it sits alongside the main compose file.

**How it works:**

- **NestJS services**: the override mounts each service's `dist/` folder and all shared package `dist/` folders into the container, then overrides the command to `node --watch dist/main.js`. When you rebuild locally, Node detects the changed files and restarts automatically.
- **Frontend apps** (user-app, admin-app): the override mounts the local build output (`dist/<app>/browser`) into the nginx html root. After a local `pnpm build --filter @polyforge/user-app`, refresh the browser to see changes.
- **Landing page**: the override mounts the `apps/landing/` directory directly into nginx.

**Quick start:**

```bash
# 1. Build everything locally first (one-time)
pnpm install
pnpm build

# 2. Start the stack — override is merged automatically
docker compose -f docker-compose.infra.yml up -d

# 3. Edit code, then rebuild whichever part you changed:
pnpm --filter @polyforge/auth-service build          # single NestJS service
pnpm --filter "./packages/**" build                  # all shared packages
pnpm --filter @polyforge/user-app build              # Angular user app

# The running container picks up the new dist/ files — no docker build needed.
```

**Rebuild a single service + its dependencies:**

```bash
# NestJS service (auto-restarts via node --watch)
pnpm --filter @polyforge/api-service... build

# Frontend app (refresh browser after build)
pnpm --filter @polyforge/admin-app build
```

**Disabling the override:**

If you want a clean Docker-only build (no host mounts), rename or remove the override file:

```bash
mv docker-compose.override.yml docker-compose.override.yml.bak
docker compose -f docker-compose.infra.yml up --build
```

> **Note:** The override file does not mount `node_modules` or Prisma client files. If you add new npm dependencies or change Prisma schemas, you still need to rebuild the Docker image for that service with `docker compose -f docker-compose.infra.yml up --build <service>`.

---

## 9. Mock Scenarios

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

## 10. Common Issues & Fixes

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

### 502 Bad Gateway after rebuilding a service

nginx caches container IPs at startup. After a rebuild the container gets a new IP, but the gateway resolves it automatically every 10 seconds — just wait and retry. If it persists:
```bash
docker compose -f docker-compose.infra.yml restart gateway
```

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

## Local HTTPS (Optional)

For testing HTTPS locally (WebSocket `wss://`, secure cookies, CORS matching production):

### 1. Generate self-signed certificates

```bash
bash scripts/generate-dev-certs.sh
```

This creates `services/gateway/certs/dev.crt` and `dev.key` (gitignored).

### 2. Start with HTTPS

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.ssl.yml up -d
```

### 3. Access

| URL                          | App       |
|------------------------------|-----------|
| `https://localhost`          | User app  |
| `https://localhost:8443`     | Admin app |
| `wss://localhost/ws`         | WebSocket |

Your browser will show a certificate warning (self-signed) — accept it to proceed.

> **Note:** HTTP on ports 80/8080 automatically redirects to HTTPS.

### 4. Switch back to HTTP

```bash
docker compose -f docker-compose.infra.yml up -d
```

---

*Next: [Architecture](./01-architecture.md) · [API Catalog](./06-api-catalog.md) · [Database & Redis](./04-database-and-redis.md)*
