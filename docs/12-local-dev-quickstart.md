# Polyforge — Local Dev Quickstart

> From clone to running in **5 minutes**. For the full developer guide, see [09-dev-setup.md](./09-dev-setup.md).

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 24.x | https://nodejs.org |
| pnpm | 9.x | `npm install -g pnpm` |
| Docker Desktop | 4.x (Compose v2) | https://docker.com/products/docker-desktop |

Verify:

```bash
node --version          # v24.x.x
pnpm --version          # 9.x.x
docker compose version  # Docker Compose version v2.x.x
```

---

## Setup

### 1. Clone and install

```bash
git clone git@github.com:your-org/polyforge.git
cd polyforge
pnpm install
pnpm --filter "./packages/**" build
```

### 2. Configure environment

```bash
cp .env.dev .env
```

Dev-safe defaults work out of the box. See `.env.example` for the full variable reference.

### 3. Start the stack

```bash
docker compose -f docker-compose.infra.yml up --build
```

First run takes 5-10 minutes to build all images. Subsequent starts take ~30 seconds.

### 4. Seed test data

In a separate terminal:

```bash
# Seed user database (alice@test.com, bob@test.com)
pnpm seed

# Seed admin database (superadmin@dev.local)
ADMIN_DIRECT_DATABASE_URL=postgresql://poly_admin:devpass_admin@localhost:5434/polyforge_admin pnpm seed:admin
```

### 5. Open the app

| URL | What |
|---|---|
| http://localhost | User app |
| http://localhost:8080 | Admin console |
| http://localhost:8025 | MailHog (catches all emails) |

---

## Test Accounts

| App | Email | Password | Role |
|---|---|---|---|
| Admin console | superadmin@dev.local | superadmin123 | SUPER_ADMIN |
| User app | alice@test.com | Test1234! | Regular user |
| User app | bob@test.com | Test1234! | Regular user |

> Run `pnpm seed` and `pnpm seed:admin` before first login.

---

## Common Commands

```bash
# Start / stop
docker compose -f docker-compose.infra.yml up -d
docker compose -f docker-compose.infra.yml down

# View logs for a service
docker compose -f docker-compose.infra.yml logs -f auth-service

# Rebuild a single service
docker compose -f docker-compose.infra.yml up --build auth-service

# TypeScript check
pnpm typecheck

# Lint
pnpm lint

# Run all tests
pnpm test

# Run tests for one service
cd services/auth-service && pnpm test

# Build everything
pnpm build

# Rebuild shared packages (after editing packages/*)
pnpm --filter "./packages/**" build

# Regenerate Prisma clients (after schema changes)
pnpm generate

# Run database migrations (after adding a new migration)
dotenv -e .env -- prisma migrate deploy --schema prisma/schema.prisma
dotenv -e .env -- prisma migrate deploy --schema prisma/schema.admin.prisma

# Run E2E tests
BASE_URL=http://localhost pnpm --filter @polyforge/e2e test
```

---

## Service Ports

| Service | Port | Notes |
|---|---|---|
| Gateway (nginx) | 80, 8080 | Main entry point (user + admin) |
| auth-service | 3001 | Registration, login, JWT |
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
| PostgreSQL (user) | 5432 | Direct access |
| PostgreSQL (admin) | 5434 | Direct access |
| Redis | 6379 | No password in dev |
| MailHog | 8025 | Email UI |

---

## Troubleshooting

**Service exits immediately / "Cannot connect"**
Migrations may not have run. Check: `docker compose -f docker-compose.infra.yml logs migrate-user`. If they failed, restart: `docker compose -f docker-compose.infra.yml up migrate-user migrate-admin`.

**`ERR_MODULE_NOT_FOUND` on startup**
Shared packages need compiling: `pnpm --filter "./packages/**" build`

**Port already in use**
Find the conflict: `lsof -i :3001` (Mac/Linux) or `netstat -ano | findstr :3001` (Windows). Stop the process or change the port in `docker-compose.infra.yml`.

**502 Bad Gateway after rebuild**
The nginx gateway resolves container IPs every 10 seconds. Wait a moment and retry. If it persists: `docker compose -f docker-compose.infra.yml restart gateway`

**Email not appearing in MailHog**
Verify `EMAIL_DRIVER=mailhog` in `.env` and that the mailhog container is running. Open http://localhost:8025.

**Out of disk space**
`docker system prune -a` then rebuild.

---

*Full setup guide: [09-dev-setup.md](./09-dev-setup.md) | Architecture: [01-architecture.md](./01-architecture.md) | API Catalog: [06-api-catalog.md](./06-api-catalog.md)*
