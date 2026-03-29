# Polyforge

> **Build status:** [`STATUS.md`](./STATUS.md)

Strategy automation platform for [Polymarket](https://polymarket.com) — users build automated trading strategies using a drag-and-drop block interface, backtest them against historical data, paper trade in simulation, and deploy live strategies that trade on their behalf. Includes an in-app support ticket system for user-to-admin communication with auto-reminders and real-time notifications.

### Key Features

- **Advanced strategy builder** — 2D drag-and-drop canvas with pan/zoom, bezier connection lines, color-coded blocks, auto-layout, logic blocks (IF/THEN/ELSE, AND/OR/NOT, Delay), calculation blocks (Math, Aggregation, Comparison), visual variable nodes, sub-strategy composition (fire-and-forget/managed/scoped), and `.polyforge` JSON import/export; meaningful wiring semantics (safety=global, triggers/actions require wires, conditions act as global gate when unwired); real-time block validation with field-level hints; execution animations (section-pulsed glow, fired-block flash, edge brightening)
- **Market cards** — Polymarket-style card grid with images, probability bars, multi-outcome support, and card/table toggle
- **Market detail page** — Stats bar, "Run Strategy" dialog with strategy selector, and direct trading panel (buy/sell without a strategy)
- **Support ticket system** — User-to-admin tickets with assignment, priority, reminders, and email notifications
- **Real-time updates** — WebSocket-driven order fills, strategy events, notification bell, and ticket polling
- **Dual registration flow** — Invite-gated and approval-gated registration coexist: users can join with an invite code or register for admin approval (PENDING status), with email notifications at each step
- **API key management** — Full CRUD lifecycle for scoped API keys (READ / WRITE / TRADE) for external tool integration, AI agents, and programmatic access
- **Interactive UI** — Tooltips, drag-and-drop reordering, sparkline charts, hover effects, page animations
- **Dark/light theme toggle** — Sun/moon switcher with localStorage persistence on both user-app and admin-app
- **Design system** — Dark theme aligned with shadcn slate palette, design tokens (section colors, status colors, typography scale), loading screen with animated logo, custom scrollbars
- **Accessibility** — `focus-visible` outlines, `aria-label` attributes, responsive mobile layouts, design token compliance (153 fixes)
- **UI/UX polish** — 50 fixes across landing page, login, markets, strategies, portfolio, orders, copy trading, whales, leaderboard, backtest, settings, and admin app; en-US locale enforcement, session expiry banners, dark mode consistency
- **Security audit** — 120+ findings fixed across 13 audit rounds; covers envelope encryption, JWT validation, TOTP re-authentication, CSP headers, rate limiting, refresh token rotation, SSRF protection, CSRF, login lockout, admin role guards
- **Rust security hardening** — Private key encryption via NAPI-RS addon with `Zeroize` memory safety (keys never enter V8 heap); strategy evaluation sandboxed in Rust WASM (no `expr-eval` fallback); homebrew KDF deleted
- **Real Polymarket integration** — 20,000+ live markets synced from Polymarket Gamma API with real-time WebSocket price feeds; hybrid mode (real reads, mock order execution)
- **OnPush change detection** — Key components use `ChangeDetectionStrategy.OnPush` for rendering performance
- **Local HTTPS** — Self-signed cert generation and `docker-compose.ssl.yml` for secure local development
- **CI/CD pipeline** — Lint, typecheck, test, build, and E2E stages with Playwright; dependency audit via `pnpm audit`
- **Load testing** — k6 suite with 7 scenarios (auth, markets, strategies, orders, WebSocket, spike)
- **Whale tracking & alerts** — real-time whale activity feed, top whales leaderboard, address profiles, follow/unfollow with notifications
- **Copy trading** — mirror trades from followed traders with risk controls (max position, daily loss limit, drawdown breaker), session management, trade attribution
- **Advanced order types** — take-profit/stop-loss, trailing stop, limit orders, pegged orders, conditional order evaluator
- **AI news-to-trade pipeline** — real-time news ingestion, LLM signal extraction (Claude + GPT-4o fallback), confidence-scored trade signals
- **AI-friendly API** — OpenAPI spec endpoint, Swagger UI, actions catalog, batch API, webhook callbacks with HMAC-SHA256 signatures, natural language query endpoint, strategy-from-description via LLM, and standalone MCP server (`polyforge-mcp`, 23 tools) compatible with Claude Desktop, Claude Code, Cursor, Windsurf, Zed, and Continue
- **Official SDKs** — typed REST clients for TypeScript (`@polyforge/sdk`), Python (`polyforge`), and Rust (`polyforge`) with full API coverage
- **Comprehensive API documentation** — interactive reference at `/api-docs` with copy buttons, response examples, Try It Out playground, Cmd+K search, "On this page" TOC, OpenAPI/Postman downloads, status badges, and a Changelog section; covers trading, conditional orders, copy trading, webhooks, whale feed, news signals, scores, and MCP setup for all supported AI clients
- **Operational docs** — Backup & Recovery (RDS/Redis/EBS), Incident Response (P0-P3), Performance Tuning guides
- **AWS infrastructure** — Terraform with tfvars template (20 variables), budget alerts ($800/month)
- **Gasless trading** — platform absorbs Polygon gas fees with per-user daily budget tracking
- **Educational onboarding** — guided tour, checklist widget, and 5 pre-built strategy templates for new users
- **Future features planned** — arbitrage scanner, multi-platform aggregation, browser extension, mobile app, fund management, UMA oracle dashboard, LP/market making (see [`docs/19-future-features.md`](./docs/19-future-features.md))

> **Current version: v6.8.0.** API docs redesigned with 9 new features (Try It Out, search, copy buttons, response examples, TOC, Changelog); MCP server now documented for Claude, Cursor, Windsurf, Zed, and Continue; admin app design tokens standardized; light theme WCAG contrast fixed. See [`CHANGELOG.md`](./CHANGELOG.md) for the full release history.

---

## Stack

| Layer | Technology |
|---|---|
| Backend framework | NestJS 11.1.16 + Fastify adapter |
| Language | TypeScript 5.9 |
| ORM | Prisma 7.5.0 (two databases: `polyforge` + `polyforge_admin`) |
| Validation | Zod (streams/internal) + class-validator (HTTP controllers) |
| Redis client | ioredis |
| Logging | pino + nestjs-pino |
| Testing | Vitest + Supertest |
| Frontend | React 19, Vite, shadcn/ui, Tailwind CSS v4, React Flow, Recharts |
| Landing | Next.js 15 (App Router, SSR/SEO) |
| Crypto (WASM) | Rust + wasm-bindgen (AES-256-GCM, SHA-256, HMAC-SHA256) |
| Build system | Turborepo 2 + pnpm workspaces |
| Containers | Docker + Docker Compose |
| Runtime | Node.js 24 |

---

## Monorepo Structure

```
polyforge/
├── apps/
│   ├── user-app/                  # React 19 + Vite user SPA
│   ├── admin-app/                 # React 19 + Vite admin SPA
│   ├── landing/                   # Next.js 15 landing page
│   └── gateway/                   # nginx reverse proxy
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
│   ├── notification-service/      # ✅ Email + Telegram + Discord + Webhooks
│   ├── bot-service/               # ✅ Interactive bots
│   ├── signer-service/            # ✅ Credential vault + EIP712 signing
│   └── mock-polymarket/           # ✅ Dev-only fake Polymarket APIs
│
└── packages/
    ├── ui/                        # Shared shadcn/ui components + Tailwind theme
    ├── api-client/                # Shared @hey-api/client-fetch generated client
    ├── shared-types/              # All TypeScript interfaces and enums
    ├── shared-schemas/            # Zod schemas (streams, WebSocket, orders)
    ├── shared-auth/               # JWT guards + internal service client
    ├── shared-db/                 # Prisma client NestJS module
    ├── shared-redis/              # ioredis factory + stream helpers
    ├── logger/                    # pino + nestjs-pino
    ├── polyforge-engine/          # Rust WASM strategy engine
    ├── polyforge-crypto-native/   # NAPI-RS native crypto addon
    └── polyforge-crypto/          # Rust WASM crypto (AES-GCM, SHA-256, HMAC)
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

## AI-Friendly API

Polyforge exposes a full AI integration layer for Claude, GPT, and other AI assistants:

- **OpenAPI spec** at `GET /api/v1/docs/openapi.json` and interactive Swagger UI at `GET /api/v1/docs`
- **Actions catalog** at `GET /api/v1/actions` for programmatic capability discovery
- **Batch API** at `POST /api/v1/batch` for executing up to 10 requests in one call
- **Webhooks** with HMAC-SHA256 signed payloads for real-time event callbacks
- **Natural language query** at `POST /api/v1/ai/query` for structured data retrieval
- **Strategy from description** at `POST /api/v1/strategies/from-description` for LLM-generated strategies
- **Strategy execution SSE** at `GET /api/v1/strategies/:id/events` for live execution watching (TypeScript/Python/Rust SDKs expose `watchStrategy`/`watch_strategy`)

### Claude Desktop Integration (MCP Server)

The MCP server has moved to a standalone repo: [`polyforge-mcp`](https://github.com/polyforge/polyforge-mcp).

```bash
# Install and run the MCP server
npx @polyforge/mcp-server

# Required environment variables
export POLYFORGE_API_URL=http://localhost:3002   # or your production URL
export POLYFORGE_API_KEY=pf_your_api_key_here    # API key with desired scopes
```

The MCP server provides 23 tools for Claude Desktop covering markets, strategies, portfolio, orders (including `place_order` and `cancel_order`), whales, news, scores, alerts, copy trading, webhooks, and `get_strategy_events` for polling live execution events.

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
| [`docs/19-future-features.md`](./docs/19-future-features.md) | Future feature plans (arbitrage, mobile, etc.) |
| [`docs/polyforge_competitor_audit.md`](./docs/polyforge_competitor_audit.md) | 199-platform competitor analysis |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release history |
| [`SECURITY.md`](./SECURITY.md) | Security policy, architecture, production checklist |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Development guidelines and code conventions |
