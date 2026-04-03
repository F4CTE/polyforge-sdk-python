# Suggested Commands

## Build & Dev
```bash
pnpm install               # Install all workspace dependencies
pnpm run build             # Build all packages/services (turbo)
pnpm run dev               # Dev mode with watch (turbo)
pnpm run lint              # Lint all packages (turbo)
pnpm run typecheck         # Type-check all packages (turbo)
```

## Testing
```bash
pnpm run test              # Run all tests (turbo)
pnpm run test:cov          # Tests with coverage
pnpm run load-test         # k6 spike test
```

## Database
```bash
pnpm run generate          # Prisma generate (both schemas)
pnpm run migrate:dev       # Prisma migrate dev (main schema)
pnpm run migrate:dev:admin # Prisma migrate dev (admin schema)
pnpm run seed              # Seed main DB
pnpm run seed:admin        # Seed admin DB
```

## API Client
```bash
pnpm run generate:api      # Re-generate OpenAPI TypeScript clients
```

## Formatting
```bash
pnpm run format            # Prettier on all ts/tsx/md/json
```

## Docker
```bash
docker compose up -d                        # Dev infra (postgres, redis, etc.)
docker compose -f docker-compose.prod.yml up # Production mode
```

## System (Windows + Git Bash)
```bash
git status / git log / git diff
```
