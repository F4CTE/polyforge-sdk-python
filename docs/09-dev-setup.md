# Polyforge — Developer Setup Guide

> Get from zero to a fully running local Polyforge instance.
> Estimated time: **20–30 minutes**

> **Current implementation status:** `auth-service` (register + login) is the only service implemented so far. Steps 8–10 relating to seeding, Angular apps, and other services describe the full target state — skip them until those services exist.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Install Dependencies](#3-install-dependencies)
4. [Configure Environment](#4-configure-environment)
5. [Generate Local SSL Certificates](#5-generate-local-ssl-certificates)
6. [Start Docker Compose](#6-start-docker-compose)
7. [Run Database Migrations](#7-run-database-migrations)
8. [Seed Test Data](#8-seed-test-data)
9. [Generate API Clients](#9-generate-api-clients)
10. [Verify Everything Works](#10-verify-everything-works)
11. [Daily Development Commands](#11-daily-development-commands)
12. [Mock Scenarios](#12-mock-scenarios)
13. [Common Issues & Fixes](#13-common-issues--fixes)
14. [Project Structure Quick Reference](#14-project-structure-quick-reference)

---

## 1. Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 24.x | https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm` |
| Docker Desktop | 4.x | https://docker.com/products/docker-desktop |
| Docker Compose | v2 (bundled with Docker Desktop) | — |
| Git | 2.x | https://git-scm.com |
| mkcert | latest | See below |

### Verify your setup

```bash
node --version         # v24.x.x
pnpm --version         # 9.x.x
docker --version       # Docker version 24+
docker compose version # Docker Compose version v2+
git --version          # git version 2+
```

### Install mkcert (local HTTPS)

mkcert generates locally-trusted SSL certificates so the dev environment runs on HTTPS.

**macOS:**
```bash
brew install mkcert
brew install nss  # needed for Firefox
mkcert -install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
mkcert -install
```

**Windows:**
```powershell
choco install mkcert
mkcert -install
```

---

## 2. Clone the Repository

```bash
git clone git@github.com:your-org/polyforge.git
cd polyforge
```

---

## 3. Install Dependencies

```bash
pnpm install
```

This installs dependencies for all packages and services in one go via pnpm workspaces. Expect 2–3 minutes on first run.

**What gets installed:**
- All shared packages (`shared-types`, `shared-auth`, `shared-db`, `shared-redis`, `logger`)
- All NestJS services (currently: `auth-service`)
- Dev tooling

---

## 3b. Build Shared Packages

Shared packages must be compiled to `dist/` before any service can start. Node.js cannot execute TypeScript source at runtime.

```bash
pnpm --filter "./packages/**" build
```

Run this once after `pnpm install`, and again whenever you change code inside a package.

> **Why:** Each package has `"main": "./dist/index.js"`. When NestJS compiles `auth-service` to JavaScript and runs it with Node, the `require('@polyforge/shared-db')` call resolves through the pnpm symlink to the package's `dist/index.js`. If `dist/` doesn't exist, Node throws `ERR_MODULE_NOT_FOUND`.

---

## 4. Configure Environment

```bash
cp .env.example .env
```

The `.env.example` file contains development defaults for everything. **You do not need to change anything to get started** — all values point to local mock services.

> **Security note:** `.env` is gitignored. Never commit real secrets or production values.

See `09-env-reference.md` for the complete variable reference.

---

## 5. Generate Local SSL Certificates

```bash
pnpm dev:certs
```

This runs `mkcert` and generates certificates in `./nginx/certs/`. Nginx uses them to serve HTTPS locally.

**Expected output:**
```
Created a new local CA
The local CA is now installed in the system trust store.
Created a new certificate valid for:
 - "localhost"
 - "127.0.0.1"
Certificates saved to: ./nginx/certs/
```

> If browsers still show "Not Secure" after this, restart the browser completely.

---

## 6. Start Docker Compose

```bash
docker compose -f docker-compose.dev.yml up --build
```

**What happens on first run (~5 minutes):**
1. Docker pulls base images and builds all 13 service images
2. PostgreSQL starts + TimescaleDB extension installed
3. PgBouncer starts and connects to Postgres
4. Redis starts
5. MailHog starts (catches all outgoing emails)
6. `mock-polymarket` starts and begins emitting fake price data
7. All NestJS services start
8. Nginx starts on ports 80 and 443

**Expected final state:**
```
✔ Container postgres              Started
✔ Container redis                 Started
✔ Container pgbouncer             Started
✔ Container mailhog               Started
✔ Container mock-polymarket       Started
✔ Container signer-service        Started
✔ Container auth-service          Started
✔ Container api-service           Started
✔ Container admin-auth-service    Started
✔ Container admin-api-service     Started
✔ Container market-data-service   Started
✔ Container strategy-engine       Started
✔ Container order-service         Started
✔ Container paper-order-service   Started
✔ Container backtest-service      Started
✔ Container notification-service  Started
✔ Container bot-service           Started
✔ Container gateway               Started
```

**Subsequent runs (after first build):** ~30 seconds.

---

## 7. Run Database Migrations

In a new terminal tab:

```bash
pnpm migrate
```

This runs `prisma migrate deploy` using a direct database connection (bypassing PgBouncer — required for migrations).

**Expected output:**
```
Applying migration `20260101000001_initial`
Applying migration `20260101000002_timescaledb_hypertables`
Applying migration `20260101000003_indexes`
All migrations have been applied.
```

> Run `pnpm migrate` every time you pull changes that include new migration files.

---

## 8. Seed Test Data

```bash
pnpm seed
```

**Accounts created:**

| Account | Email | Password | State | Notes |
|---|---|---|---|---|
| Admin | admin@polyforge.app | `Admin1234!` | — | Admin panel access |
| Alice | alice@test.com | `Test1234!` | Connected | 3 strategies, running |
| Bob | bob@test.com | `Test1234!` | Connected | 2 public strategies |
| Carol | carol@test.com | `Test1234!` | Verified | Paper trading only |
| Dave | dave@test.com | `Test1234!` | Verified | Suspended account |

**Additional seed data:**
- 8 strategies (mix of PRIVATE/PUBLIC, IDLE/RUNNING/PAPER)
- 50 orders across all users (mix of statuses)
- 3 backtest runs (COMPLETED, RUNNING, FAILED)
- Follow relationships, likes, comments
- 10 mock markets (aligned with mock-polymarket fixture data)

---

## 9. Generate API Clients

```bash
pnpm generate:api
```

This runs the full OpenAPI generation pipeline:

1. Builds `swagger.json` from the NestJS swagger decorators (`api-service`)
2. Builds `swagger-admin.json` from the admin service
3. Runs `hey-api/openapi-ts` with the `typescript-angular` generator to produce typed Angular HTTP services for both apps

**Expected output:**
```
✔ api-service   → swagger.json (247 operations)
✔ admin-service → swagger-admin.json (68 operations)
✔ user-app      → generated in apps/user-app/src/app/api/
✔ admin-app     → generated in apps/admin-app/src/app/api/
```

**Generated structure:**
```
apps/user-app/src/app/api/
├── models/                     # TypeScript interfaces for every DTO
│   ├── strategy.model.ts
│   ├── order.model.ts
│   └── ...
└── services/                   # Injectable Angular services
    ├── auth.service.ts
    ├── strategies.service.ts
    ├── orders.service.ts
    └── ...
```

> **Rule:** Re-run `pnpm generate:api` every time you add, remove, or change an API endpoint. Commit the generated files together with your backend change. CI diffs generated files and fails the build if they're out of sync.

See `03-openapi-codegen.md` for the full pipeline documentation.

---

## 10. Verify Everything Works

Open these URLs and confirm they load correctly:

| URL | Expected | Credentials |
|---|---|---|
| https://localhost | Polyforge user app | alice@test.com / Test1234! |
| https://localhost/discover | Public strategy feed | — |
| https://localhost/portfolio | Portfolio with mock positions | alice@test.com |
| http://localhost:8025 | MailHog web UI (all emails) | — |
| https://admin.polyforge.app | Admin panel | admin@polyforge.app / Admin1234! |

> **Admin app:** Add to `/etc/hosts` first:
> ```bash
> echo "127.0.0.1 admin.polyforge.app" | sudo tee -a /etc/hosts
> ```

### Test the health endpoint

```bash
curl -k https://localhost/api/v1/health
# Expected: {"status":"healthy", "services": {...}}
```

### Test WebSocket

Open browser DevTools on https://localhost and run:

```javascript
const token = localStorage.getItem('token');  // after logging in
const ws = new WebSocket('wss://localhost/ws');
ws.onopen = () => ws.send(JSON.stringify({ type: 'AUTH', token: `Bearer ${token}` }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
// You should see PRICE_UPDATE messages every second
```

### Test email delivery

1. Log out of the app
2. Click "Forgot Password" → enter alice@test.com
3. Open http://localhost:8025
4. The password reset email should appear in MailHog

---

## 11. Daily Development Commands

```bash
# Build all shared packages (run once, and after any package change)
pnpm --filter "./packages/**" build

# Start a single service in watch mode
pnpm --filter "@polyforge/auth-service" start:dev

# Start a service via Turborepo (auto-builds package deps first)
turbo dev --filter="@polyforge/auth-service"

# Start Docker infrastructure
docker compose up -d

# View logs for a specific service
docker compose logs -f auth-service

# Stop infrastructure
docker compose down

# Wipe database and reseed from scratch
pnpm reset

# Regenerate Angular API clients (run after any endpoint change)
pnpm generate:api

# TypeScript check all packages and services
pnpm typecheck

# Run all tests across the monorepo
pnpm test

# Run tests for a single service
cd services/auth-service && pnpm test

# Run tests in watch mode
cd services/strategy-engine && pnpm test -- --watch

# Build everything
pnpm build
```

---

## 12. Mock Scenarios

The `mock-polymarket` service supports different behaviour modes. Set `SCENARIO` in `.env` and restart:

```bash
# In .env:
SCENARIO=normal       # Default: realistic price movement, fills in ~2s
SCENARIO=volatile     # Fast price swings, instant fills
SCENARIO=api_down     # REST returns 503, WebSocket disconnects periodically
SCENARIO=rate_limited # 429 after 10 requests/min (tests backoff logic)
SCENARIO=slow         # All responses delayed 2–5 seconds

# Restart to apply:
docker compose -f docker-compose.dev.yml restart mock-polymarket
```

Use `volatile` when testing strategy execution speed, `api_down` when testing resilience and reconnection logic, and `rate_limited` when testing the Polymarket API budget guard.

---

## 13. Common Issues & Fixes

### Port 80 or 443 already in use

```bash
# Find what's using the port
sudo lsof -i :80
sudo lsof -i :443

# Kill it or stop the other service, then:
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up
```

### Database migrations fail (can't reach database)

Postgres may not be fully ready yet:

```bash
sleep 10 && pnpm migrate
```

If it keeps failing, check Postgres is healthy:
```bash
docker compose -f docker-compose.dev.yml ps postgres
```

### "Cannot connect to signer-service"

signer-service waits for Redis. Check Redis health:
```bash
docker compose -f docker-compose.dev.yml ps redis
# If not "healthy", give it 30 more seconds
```

### SSL certificate not trusted in browser

```bash
mkcert -uninstall
mkcert -install
pnpm dev:certs
# Restart your browser completely
```

### Angular app shows a blank page

The first Angular build takes ~2 minutes. Check build progress:
```bash
docker compose -f docker-compose.dev.yml logs -f gateway
# Wait for: "Compiled successfully"
```

### Out of disk space (Docker)

```bash
docker system prune -a     # removes unused images and build cache
docker compose -f docker-compose.dev.yml up --build
```

### `pnpm generate:api` fails: "Cannot find swagger.json"

`swagger.json` must exist before running the generator. Build it first:

```bash
pnpm build:swagger
pnpm generate:api
```

### Generated API clients are out of sync (CI fails)

Run locally and commit:
```bash
pnpm generate:api
git add apps/user-app/src/app/api apps/admin-app/src/app/api swagger.json swagger-admin.json
git commit -m "chore: regenerate API clients"
```

### `ERR_MODULE_NOT_FOUND` when starting a service

Packages are not built. Run:
```bash
pnpm --filter "./packages/**" build
```
Then retry `start:dev`.

---

## 14. Project Structure Quick Reference

```
polyforge/
├── apps/
│   ├── user-app/                  # 🔜 Angular 17 — user interface
│   │   └── src/app/api/           # ← GENERATED — never edit manually
│   └── admin-app/                 # 🔜 Angular 17 — admin dashboard
│       └── src/app/api/           # ← GENERATED — never edit manually
│
├── services/
│   ├── gateway/                   # 🔜 Nginx config + SSL certs
│   ├── auth-service/              # ✅ Registration + login (port 3001)
│   ├── api-service/               # 🔜 User REST API + WebSocket
│   ├── admin-auth-service/        # 🔜 Admin login
│   ├── admin-api-service/         # 🔜 Admin REST API
│   ├── market-data-service/       # 🔜 Polymarket data feed + cache writer
│   ├── strategy-engine/           # 🔜 Block evaluator + tick runner
│   ├── order-service/             # 🔜 CLOB order submission
│   ├── paper-order-service/       # 🔜 Simulated order fills
│   ├── backtest-service/          # 🔜 Historical replay
│   ├── notification-service/      # 🔜 Email + Telegram + Discord outbound
│   ├── bot-service/               # 🔜 Interactive Telegram + Discord bots
│   ├── signer-service/            # 🔜 Credential vault + EIP712 signing
│   └── mock-polymarket/           # 🔜 (dev only) Fake Polymarket APIs
│
├── packages/
│   ├── shared-types/              # ✅ All TypeScript interfaces and enums
│   ├── shared-schemas/            # 🔜 Zod validation schemas
│   ├── shared-auth/               # ✅ JWT guards + internal service client
│   ├── shared-db/                 # ✅ Prisma client NestJS module
│   ├── shared-redis/              # ✅ ioredis factory + stream helpers
│   └── logger/                    # ✅ pino + nestjs-pino
│
├── prisma/
│   ├── schema.prisma              # Database schema (source of truth)
│   ├── migrations/                # Migration history
│   └── seed.ts                    # Seed script
│
├── scripts/
│   ├── health-check.sh            # Checks all services are up
│   ├── reset.sh                   # Wipes DB + reseeds
│   └── dev-certs.sh               # Generates mkcert certificates
│
├── nginx/
│   ├── nginx.dev.conf             # Dev Nginx config
│   ├── nginx.prod.conf            # Prod Nginx config
│   └── certs/                     # ← GENERATED by mkcert (gitignored)
│
├── docker-compose.yml             # Infrastructure (Postgres, Redis, MailHog, PgBouncer)
├── turbo.json                     # Turborepo task graph
├── pnpm-workspace.yaml            # pnpm workspace definition
├── package.json                   # Root — scripts
├── tsconfig.json                  # Shared TypeScript base config
├── .env.example                   # Environment template (committed)
└── .env                           # Local env (gitignored)
```

---

*Next: [Codebase Guide](./02-codebase-guide.md) | [OpenAPI Codegen](./03-openapi-codegen.md)*
