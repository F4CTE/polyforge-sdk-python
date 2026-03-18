# Polyforge

> **Build status:** [`STATUS.md`](./STATUS.md)

Strategy automation platform for [Polymarket](https://polymarket.com) — users build automated trading strategies using a drag-and-drop block interface, backtest them against historical data, paper trade in simulation, and deploy live strategies that trade on their behalf.

---

## Stack

| Layer | Technology |
|---|---|
| Backend framework | NestJS 11.1.16 + Fastify adapter |
| Language | TypeScript 5 (strict mode everywhere) |
| ORM | Prisma 7.5.0 (two databases: `polyforge` + `polyforge_admin`) |
| Validation | Zod (streams/internal) + class-validator (HTTP controllers) |
| Redis client | ioredis |
| Logging | pino + nestjs-pino |
| Testing | Vitest + Supertest |
| Frontend | Angular 21 + PrimeNG 21 |
| Build system | Turborepo 2 + pnpm workspaces |
| Containers | Docker + Docker Compose |
| Runtime | Node.js 24 |

---

## Monorepo Structure

```
polyforge/
├── apps/
│   ├── user-app/                  # ✅ Angular 21 user SPA — served at http://localhost
│   ├── admin-app/                 # ✅ Angular 21 admin console — served at http://localhost:8080
│   └── landing/                   # ✅ Static landing page with waitlist form
│
├── services/
│   ├── gateway/                   # ✅ nginx dev gateway (ports 80 + 8080)
│   ├── auth-service/              # ✅ Registration, login — port 3001
│   ├── admin-auth-service/        # ✅ Admin login — port 3003
│   ├── api-service/               # ✅ User REST + WebSocket — port 3002
│   ├── admin-api-service/         # ✅ Admin REST — port 3004
│   ├── market-data-service/       # ✅ Polymarket feed + Redis cache writer
│   ├── strategy-engine/           # ✅ Block evaluator + tick runner
│   ├── order-service/             # ✅ CLOB order submission
│   ├── paper-order-service/       # ✅ Simulated fills
│   ├── backtest-service/          # ✅ Historical replay
│   ├── notification-service/      # ✅ Email + Telegram + Discord
│   ├── bot-service/               # ✅ Interactive bots
│   ├── signer-service/            # ✅ Credential vault + EIP712 signing
│   └── mock-polymarket/           # ✅ Dev-only fake Polymarket APIs
│
└── packages/
    ├── shared-types/              # ✅ All TypeScript interfaces and enums
    ├── shared-schemas/            # ✅ Zod schemas (streams, WebSocket, orders)
    ├── shared-auth/               # ✅ JWT guards + internal service client
    ├── shared-db/                 # ✅ Prisma client NestJS module
    ├── shared-redis/              # ✅ ioredis factory + stream helpers
    └── logger/                    # ✅ pino + nestjs-pino
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 24.x |
| pnpm | 9.x |
| Docker Desktop | 4.x |

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start the full stack (infrastructure + services + frontends)

```bash
docker compose -f docker-compose.infra.yml up --build -d
```

### 3. Build shared packages

Packages compile to `dist/` before services can run. Run once, and again after any package change.

```bash
pnpm --filter "./packages/**" build
```

### 4. Run database migrations

```bash
pnpm migrate
```

### 5. Start a service in dev mode

```bash
pnpm --filter "@polyforge/auth-service" start:dev
```

Or via Turborepo (auto-builds dependencies first):

```bash
turbo dev --filter="@polyforge/auth-service"
```

---

## Package Build Convention

Workspace packages always compile TypeScript to `dist/` — the `main` field in `package.json` must point to the compiled output, never to TypeScript source.

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

This is required because NestJS CLI compiles services to JavaScript before running them with Node.js. Node cannot execute `.ts` files at runtime.

---

## Common Commands

```bash
# Build all packages
pnpm --filter "./packages/**" build

# Build a single package
pnpm --filter "@polyforge/shared-db" build

# Start auth-service in watch mode
pnpm --filter "@polyforge/auth-service" start:dev

# Typecheck entire monorepo
pnpm typecheck

# Run all tests
pnpm test

# Build all services
pnpm build
```

---

## Access (dev)

| URL | What you get |
|---|---|
| http://localhost | User app (landing at `/`, Angular SPA, api-service, auth-service, WebSocket) |
| http://localhost:8080 | Admin console (admin-app, admin-api-service, admin-auth-service) |
| http://localhost:8025 | MailHog — inspect all outbound emails |

## Service Ports (direct, dev)

| Service | Port |
|---|---|
| auth-service | 3001 |
| api-service | 3002 |
| admin-auth-service | 3003 |
| admin-api-service | 3004 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MailHog UI | 8025 |
| PgBouncer | 6432 |

---

See [`docs/06-api-catalog.md`](./docs/06-api-catalog.md) for the full endpoint reference.

---

## Documentation

| File | Contents |
|---|---|
| [`docs/01-architecture.md`](./docs/01-architecture.md) | System architecture, services, networks, auth flows |
| [`docs/02-codebase-guide.md`](./docs/02-codebase-guide.md) | How to add features, conventions, code style |
| [`docs/03-openapi-codegen.md`](./docs/03-openapi-codegen.md) | OpenAPI generation pipeline |
| [`docs/04-database-and-redis.md`](./docs/04-database-and-redis.md) | Prisma schema, Redis keys, migrations |
| [`docs/05-testing-and-practices.md`](./docs/05-testing-and-practices.md) | Testing conventions |
| [`docs/06-api-catalog.md`](./docs/06-api-catalog.md) | Complete REST + WebSocket endpoint reference |
| [`docs/07-deployment.md`](./docs/07-deployment.md) | Production deployment guide |
| [`docs/09-dev-setup.md`](./docs/09-dev-setup.md) | Local development setup |
| [`docs/10-env-reference.md`](./docs/10-env-reference.md) | Environment variable reference |
| [`docs/11-roadmap.md`](./docs/11-roadmap.md) | Feature roadmap |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release history |
