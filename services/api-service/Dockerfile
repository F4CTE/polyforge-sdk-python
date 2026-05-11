# SECURITY: Pinned to manifest-list digest (node:24-slim). Run: docker buildx imagetools inspect node:24-slim
FROM node:24-slim@sha256:24dc26ef1e3c3690f27ebc4136c9c186c3133b25563ae4d7f0692e4d1fe5db0e AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@9.15.9 && \
    npm install -g typescript@5.9.3

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

COPY packages/shared-db/package.json        ./packages/shared-db/
COPY packages/shared-redis/package.json     ./packages/shared-redis/
COPY packages/shared-auth/package.json      ./packages/shared-auth/
COPY packages/shared-types/package.json     ./packages/shared-types/
COPY packages/shared-posthog/package.json   ./packages/shared-posthog/
COPY packages/logger/package.json           ./packages/logger/
COPY services/api-service/package.json      ./services/api-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install \
    --filter @polyforge/shared-db \
    --filter @polyforge/shared-redis \
    --filter @polyforge/shared-auth \
    --filter @polyforge/shared-types \
    --filter @polyforge/shared-posthog \
    --filter @polyforge/logger \
    --filter @polyforge/api-service... \
    --frozen-lockfile

COPY packages/shared-db/        ./packages/shared-db/
COPY packages/shared-redis/     ./packages/shared-redis/
COPY packages/shared-auth/      ./packages/shared-auth/
COPY packages/shared-types/     ./packages/shared-types/
COPY packages/shared-posthog/   ./packages/shared-posthog/
COPY packages/logger/           ./packages/logger/
COPY services/api-service/      ./services/api-service/
COPY prisma/                    ./prisma/

RUN DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.prisma --config ./prisma/prisma.config.ts && \
    DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.admin.prisma --config ./prisma/prisma.admin.config.ts && \
    (cd packages/shared-types  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-db     && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-redis  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/logger        && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-auth   && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-posthog && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd services/api-service && /usr/local/bin/tsc -p tsconfig.build.json)

# ── Runtime ──────────────────────────────────────────────────────────────────
# SECURITY: Pinned to manifest-list digest (node:24-alpine). Run: docker buildx imagetools inspect node:24-alpine
FROM node:24-alpine@sha256:d1b3b4da11eefd5941e7f0b9cf17783fc99d9c6fc34884a665f40a06dbdfc94f

WORKDIR /app

RUN npm install -g pnpm@9.15.9

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json        ./packages/shared-db/
COPY packages/shared-redis/package.json     ./packages/shared-redis/
COPY packages/shared-auth/package.json      ./packages/shared-auth/
COPY packages/shared-types/package.json     ./packages/shared-types/
COPY packages/shared-posthog/package.json   ./packages/shared-posthog/
COPY packages/logger/package.json           ./packages/logger/
COPY services/api-service/package.json      ./services/api-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install --filter @polyforge/api-service... --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/packages/shared-db/dist/       ./packages/shared-db/dist/
COPY --from=builder /app/packages/shared-redis/dist/    ./packages/shared-redis/dist/
COPY --from=builder /app/packages/shared-auth/dist/     ./packages/shared-auth/dist/
COPY --from=builder /app/packages/shared-types/dist/    ./packages/shared-types/dist/
COPY --from=builder /app/packages/shared-posthog/dist/  ./packages/shared-posthog/dist/
COPY --from=builder /app/packages/logger/dist/          ./packages/logger/dist/
COPY --from=builder /app/services/api-service/dist      ./services/api-service/dist

COPY --from=builder /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/engines  ./node_modules/@prisma/engines

WORKDIR /app/services/api-service

# Allow node user to write swagger.json in dev mode
RUN chown -R node:node /app/services/api-service

EXPOSE 3002

USER node

CMD ["node", "--max-old-space-size=512", "--optimize-for-size", "dist/main"]
