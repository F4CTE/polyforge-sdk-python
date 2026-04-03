# Code Style & Conventions

## TypeScript
- Strict mode, ES2022 target
- ESLint + Prettier enforced
- NestJS patterns: decorators, DI, guards, pipes, interceptors

## Backend Services
- NestJS with Fastify adapter (NOT Express)
- class-validator decorators on all DTOs
- Global ValidationPipe on all services
- Prisma for DB access (shared-db package)
- Redis via shared-redis package
- Shared auth via shared-auth package

## Frontend Apps
- Angular with standalone components
- Tailwind CSS with design token system (pf-* prefix)
- OpenAPI-generated API clients

## Naming
- camelCase for variables/functions
- PascalCase for classes/interfaces/types
- kebab-case for file names
- Services: `{domain}-service` directory naming
- DTOs: `{Action}Dto` naming (e.g., `LoginDto`, `RegisterDto`)

## Task Completion Checklist
1. `pnpm run build` — verify all packages compile
2. `pnpm run lint` — no lint errors
3. `pnpm run test` — all tests pass
4. If DB changes: run `pnpm run generate` + `pnpm run migrate:dev`
