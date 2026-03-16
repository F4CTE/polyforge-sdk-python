FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# Package manifests (shared packages + this service)
COPY packages/shared-db/package.json      ./packages/shared-db/
COPY packages/shared-redis/package.json   ./packages/shared-redis/
COPY packages/logger/package.json         ./packages/logger/
COPY packages/shared-types/package.json   ./packages/shared-types/
COPY services/market-data-service/package.json ./services/market-data-service/

RUN pnpm install --filter @polyforge/market-data-service... --frozen-lockfile

# Source
COPY packages/shared-db/       ./packages/shared-db/
COPY packages/shared-redis/    ./packages/shared-redis/
COPY packages/logger/          ./packages/logger/
COPY packages/shared-types/    ./packages/shared-types/
COPY services/market-data-service/ ./services/market-data-service/
COPY prisma/                   ./prisma/

# Build shared packages first, then service
RUN pnpm --filter @polyforge/shared-types run build && \
    pnpm --filter @polyforge/shared-db run build && \
    pnpm --filter @polyforge/shared-redis run build && \
    pnpm --filter @polyforge/logger run build && \
    pnpm --filter @polyforge/market-data-service run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json      ./packages/shared-db/
COPY packages/shared-redis/package.json   ./packages/shared-redis/
COPY packages/logger/package.json         ./packages/logger/
COPY packages/shared-types/package.json   ./packages/shared-types/
COPY services/market-data-service/package.json ./services/market-data-service/

RUN pnpm install --filter @polyforge/market-data-service... --frozen-lockfile --prod

COPY --from=builder /app/packages/shared-db/src/       ./packages/shared-db/src/
COPY --from=builder /app/packages/shared-redis/src/    ./packages/shared-redis/src/
COPY --from=builder /app/packages/logger/src/          ./packages/logger/src/
COPY --from=builder /app/packages/shared-types/src/    ./packages/shared-types/src/
COPY --from=builder /app/services/market-data-service/dist ./services/market-data-service/dist

# Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/services/market-data-service

EXPOSE 3005

CMD ["node", "dist/main"]
