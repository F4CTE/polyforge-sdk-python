# Contributing to Polyforge

## Development Setup

See the [Local Dev Quickstart](docs/18-local-dev-quickstart.md) for full setup instructions.

```bash
pnpm install
docker compose -f docker-compose.infra.yml up -d --build
```

## Code Conventions

### TypeScript

- Strict mode enabled everywhere
- Use typed interfaces for all public APIs
- No `any` types in new code (use `unknown` + type guards)
- Prefer `const` over `let`; never use `var`
- Maximum file length: 500 lines

### NestJS Services

- One module per feature domain
- Use DTOs with class-validator for all controller inputs
- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`
- Use Prisma for all database access (no raw SQL string concatenation)
- Add `@ApiTags`, `@ApiOperation`, and `@ApiResponse` decorators to all controllers

### React Components

- Functional components only
- Use Zustand for state management
- Tailwind CSS v4 with design tokens (CSS custom properties)
- shadcn/ui for base components
- Prefer composition over inheritance

### File Organization

```
services/<name>/src/
  app.module.ts          # Root module
  main.ts                # Bootstrap
  <feature>/
    <feature>.module.ts
    <feature>.controller.ts
    <feature>.service.ts
    <feature>.service.spec.ts
    dto/
      <action>.dto.ts
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific service
pnpm --filter @polyforge/auth-service test

# Run with coverage
pnpm --filter @polyforge/auth-service test -- --coverage
```

- Write tests before or alongside code (TDD encouraged)
- Use Vitest for unit and integration tests
- Mock external dependencies (Redis, HTTP, Prisma)
- Test file naming: `*.spec.ts` or `*.test.ts`
- Minimum coverage target: 80% for new code

## Git Workflow

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Run `pnpm test` and `pnpm typecheck` before pushing
4. Open a PR with a description of changes
5. All CI checks must pass before merge

### Commit Messages

```
<type>: <short description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `security`

## Security

- Never hardcode secrets, API keys, or credentials
- Never commit `.env` files
- Validate all user input at system boundaries
- Use Prisma parameterized queries
- See [SECURITY.md](SECURITY.md) for the full security policy

### Pinned Images

All container images in Docker Compose files must be pinned to prevent supply-chain drift:

- **Pin by version tag** at minimum: `postgres:16-alpine`, not `postgres:latest`.
- **Prefer SHA256 digests** for security-critical images: `posthog/posthog@sha256:...`
  See the Dockerfiles (e.g. `Dockerfile.migrate`) for digest-pin examples.
- **Never use `:latest`** in any `image:` line in `docker-compose*.yml`.
  A semgrep rule (`.semgrep/docker-compose-no-latest.yml`) enforces this.
- **Upgrade procedure**: See `STATUS.md` "PostHog Image Upgrade" for the
  documented workflow (pull, capture digest, update compose file, deploy, verify).

Rationale: floating tags allow silent supply-chain drift — two engineers
running `docker compose up` on different days get different binaries.
See [#1312](https://github.com/F4CTE/PolyForge/issues/1312) and
[#394](https://github.com/F4CTE/PolyForge/issues/394) for prior incidents.

## Architecture Decisions

Key architectural decisions are documented in `docs/01-architecture.md`. When making significant changes:

1. Discuss the approach in an issue first
2. Document the decision and rationale
3. Update relevant docs if the change affects the architecture
