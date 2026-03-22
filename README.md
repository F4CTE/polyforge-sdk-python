# Polyforge

> **Build status:** [`STATUS.md`](./STATUS.md)

Strategy automation platform for [Polymarket](https://polymarket.com) — users build automated trading strategies using a drag-and-drop block interface, backtest them against historical data, paper trade in simulation, and deploy live strategies that trade on their behalf. Includes an in-app support ticket system for user-to-admin communication with auto-reminders and real-time notifications.

### Key Features

- **Advanced strategy builder** — 2D drag-and-drop canvas with pan/zoom, bezier connection lines, color-coded blocks, auto-layout, logic blocks (IF/THEN/ELSE, AND/OR/NOT, Delay), calculation blocks (Math, Aggregation, Comparison), visual variable nodes, sub-strategy composition (fire-and-forget/managed/scoped), and `.polyforge` JSON import/export
- **Market cards** — Polymarket-style card grid with images, probability bars, multi-outcome support, and card/table toggle
- **Market detail page** — Stats bar and "Run Strategy" dialog with strategy selector
- **Support ticket system** — User-to-admin tickets with assignment, priority, reminders, and email notifications
- **Real-time updates** — WebSocket-driven order fills, strategy events, notification bell, and ticket polling
- **API key management** — Generate scoped API keys (READ / WRITE / TRADE) for external tool integration, AI agents, and programmatic access
- **Interactive UI** — Tooltips, drag-and-drop reordering, sparkline charts, hover effects, page animations
- **Dark/light theme toggle** — Sun/moon switcher with localStorage persistence on both user-app and admin-app
- **API documentation page** — Interactive API reference at `/api-docs` in user-app
- **Design system** — Dark theme aligned with shadcn slate palette, design tokens (section colors, status colors, typography scale), loading screen with animated logo, custom scrollbars
- **Accessibility** — `focus-visible` outlines, `aria-label` attributes, responsive mobile layouts
- **OnPush change detection** — Key components use `ChangeDetectionStrategy.OnPush` for rendering performance
- **Local HTTPS** — Self-signed cert generation and `docker-compose.ssl.yml` for secure local development
- **CI/CD pipeline** — Lint, typecheck, test, build, and E2E stages with Playwright

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
| Frontend (v3.0) | React 19, Vite, shadcn/ui, Tailwind CSS v4, React Flow, Recharts |
| Landing (v3.0) | Next.js 15 (App Router, SSR/SEO) |
| Frontend (legacy) | Angular 21 + PrimeNG 21 |
| Build system | Turborepo 2 + pnpm workspaces |
| Containers | Docker + Docker Compose |
| Runtime | Node.js 24 |

---

## Monorepo Structure

```
polyforge/
├── apps/
│   ├── user-app-react/            # 🆕 React 19 + Vite user SPA (v3.0)
│   ├── admin-app-react/           # 🆕 React 19 + Vite admin SPA (v3.0)
│   ├── landing-next/              # 🆕 Next.js 15 landing page (v3.0)
│   ├── user-app/                  # Angular 21 user SPA (legacy)
│   ├── admin-app/                 # Angular 21 admin console (legacy)
│   └── landing/                   # Static landing page (legacy)
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
    ├── ui/                        # 🆕 Shared shadcn/ui components + Tailwind theme (v3.0)
    ├── api-client/                # 🆕 Shared @hey-api/client-fetch generated client (v3.0)
    ├── shared-types/              # All TypeScript interfaces and enums
    ├── shared-schemas/            # Zod schemas (streams, WebSocket, orders)
    ├── shared-auth/               # JWT guards + internal service client
    ├── shared-db/                 # Prisma client NestJS module
    ├── shared-redis/              # ioredis factory + stream helpers
    └── logger/                    # pino + nestjs-pino
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
| https://localhost | User app over HTTPS (requires `docker-compose.ssl.yml` overlay) |
| https://localhost:8443 | Admin console over HTTPS |
| http://localhost:8025 | MailHog — inspect all outbound emails |

> **HTTPS:** To enable local HTTPS, generate self-signed certificates with `bash scripts/generate-certs.sh` and start with `docker compose -f docker-compose.infra.yml -f docker-compose.ssl.yml up -d`. See [`docs/09-dev-setup.md`](./docs/09-dev-setup.md) for details.

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
| [`docs/00-features-and-functionalities.md`](./docs/00-features-and-functionalities.md) | Product specification and feature backlog |
| [`docs/06-api-catalog.md`](./docs/06-api-catalog.md) | Complete REST + WebSocket endpoint reference |
| [`docs/07-deployment.md`](./docs/07-deployment.md) | Production deployment guide |
| [`docs/13-design-charter.md`](./docs/13-design-charter.md) | Design system, UI patterns, interactivity |
| [`docs/09-dev-setup.md`](./docs/09-dev-setup.md) | Local development setup |
| [`docs/10-env-reference.md`](./docs/10-env-reference.md) | Environment variable reference |
| [`docs/11-roadmap.md`](./docs/11-roadmap.md) | Feature roadmap |
| [`docs/polyforge_competitor_audit.md`](./docs/polyforge_competitor_audit.md) | 199-platform competitor analysis |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release history |
