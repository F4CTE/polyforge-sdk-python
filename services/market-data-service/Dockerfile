# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:26-alpine@sha256:30f5a66e7265ef70aac56b4753ffa7905e54eca1084bc25503893ad8e9273f05 AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && \
    npm install -g typescript@5.9.3

# Workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

# Package manifests (shared packages + this service)
COPY packages/shared-db/package.json      ./packages/shared-db/
COPY packages/shared-redis/package.json   ./packages/shared-redis/
COPY packages/logger/package.json         ./packages/logger/
COPY packages/shared-types/package.json   ./packages/shared-types/
COPY packages/shared-auth/package.json     ./packages/shared-auth/
COPY services/market-data-service/package.json ./services/market-data-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install \
    --filter @polyforge/shared-db \
    --filter @polyforge/shared-redis \
    --filter @polyforge/shared-types \
    --filter @polyforge/shared-auth \
    --filter @polyforge/logger \
    --filter @polyforge/market-data-service... \
    --frozen-lockfile

# Source
COPY packages/shared-db/       ./packages/shared-db/
COPY packages/shared-redis/    ./packages/shared-redis/
COPY packages/logger/          ./packages/logger/
COPY packages/shared-types/    ./packages/shared-types/
COPY packages/shared-auth/     ./packages/shared-auth/
COPY services/market-data-service/ ./services/market-data-service/
COPY prisma/                   ./prisma/

# Build shared packages first, then service
RUN DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.prisma --config ./prisma/prisma.config.ts && \
    DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.admin.prisma --config ./prisma/prisma.admin.config.ts && \
    (cd packages/shared-types  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-db     && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-redis  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/logger        && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-auth   && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd services/market-data-service && /usr/local/bin/tsc -p tsconfig.build.json)

# ── Runtime ──────────────────────────────────────────────────────────────────
# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:26-alpine@sha256:30f5a66e7265ef70aac56b4753ffa7905e54eca1084bc25503893ad8e9273f05

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json      ./packages/shared-db/
COPY packages/shared-redis/package.json   ./packages/shared-redis/
COPY packages/logger/package.json         ./packages/logger/
COPY packages/shared-types/package.json   ./packages/shared-types/
COPY packages/shared-auth/package.json     ./packages/shared-auth/
COPY services/market-data-service/package.json ./services/market-data-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install --filter @polyforge/market-data-service... --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/packages/shared-db/dist/         ./packages/shared-db/dist/
COPY --from=builder /app/packages/shared-redis/dist/      ./packages/shared-redis/dist/
COPY --from=builder /app/packages/logger/dist/            ./packages/logger/dist/
COPY --from=builder /app/packages/shared-types/dist/      ./packages/shared-types/dist/
COPY --from=builder /app/packages/shared-auth/dist/      ./packages/shared-auth/dist/
COPY --from=builder /app/services/market-data-service/dist ./services/market-data-service/dist

# Prisma client
COPY --from=builder /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/engines  ./node_modules/@prisma/engines

WORKDIR /app/services/market-data-service

EXPOSE 3005

USER node

CMD ["node", "--max-old-space-size=512", "--optimize-for-size", "dist/main"]
