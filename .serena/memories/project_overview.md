# PolyForge Monorepo — Project Overview

## Purpose
PolyForge is a prediction-market trading platform. This monorepo contains the full backend (14 NestJS microservices), 4 frontend apps (Angular), and 11 shared packages.

## Tech Stack
- **Monorepo:** pnpm workspaces + Turborepo
- **Backend:** NestJS (Fastify adapter), TypeScript 5.x, strict mode
- **Frontend:** Angular apps (user-app, admin-app, landing, gateway)
- **Database:** Prisma ORM (2 schemas: main + admin), PostgreSQL
- **Cache/Auth:** Redis (ElastiCache)
- **Infra:** Docker Compose (dev/prod/ssl/infra), nginx gateway
- **Testing:** Jest (via turbo), k6 load tests
- **Linting:** ESLint + Prettier
- **API Client Generation:** openapi-ts

## Structure
```
services/          — 14 NestJS microservices
  admin-api-service, admin-auth-service, api-service, auth-service,
  backtest-service, bot-service, gateway, market-data-service,
  mock-polymarket, notification-service, order-service,
  paper-order-service, signer-service, strategy-engine

apps/              — 4 Angular frontend apps
  admin-app, gateway, landing, user-app

packages/          — 11 shared packages
  api-client, logger, polyforge-crypto, polyforge-crypto-native,
  polyforge-engine, shared-auth, shared-db, shared-redis,
  shared-schemas, shared-types, ui

prisma/            — Database schemas + migrations + seeds
docs/              — Architecture/deployment documentation
infra/             — Terraform / IaC
scripts/           — Utility scripts
tests/             — Integration + load tests
```

## Key Design Rules
- All services use Fastify adapter (not Express)
- JWT auth with HttpOnly cookies (`pf_token` / `pf_admin_token`)
- Zod + class-validator for input validation at boundaries
- Every new API endpoint needs a matching MCP tool (polyforge-mcp repo)
- Security headers via Fastify `onSend` hook + nginx
