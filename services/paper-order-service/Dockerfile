# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate && \
    npm install -g typescript@5.9.3

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

COPY packages/shared-db/package.json           ./packages/shared-db/
COPY packages/shared-redis/package.json        ./packages/shared-redis/
COPY packages/shared-types/package.json        ./packages/shared-types/
COPY packages/shared-auth/package.json     ./packages/shared-auth/
COPY packages/logger/package.json              ./packages/logger/
COPY services/paper-order-service/package.json ./services/paper-order-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install \
    --filter @polyforge/shared-db \
    --filter @polyforge/shared-redis \
    --filter @polyforge/shared-types \
    --filter @polyforge/shared-auth \
    --filter @polyforge/logger \
    --filter @polyforge/paper-order-service... \
    --frozen-lockfile

COPY packages/shared-db/           ./packages/shared-db/
COPY packages/shared-redis/        ./packages/shared-redis/
COPY packages/shared-types/        ./packages/shared-types/
COPY packages/shared-auth/         ./packages/shared-auth/
COPY packages/logger/              ./packages/logger/
COPY services/paper-order-service/ ./services/paper-order-service/
COPY prisma/                       ./prisma/

RUN DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.prisma --config ./prisma/prisma.config.ts && \
    DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.admin.prisma --config ./prisma/prisma.admin.config.ts && \
    (cd packages/shared-db     && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-redis  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-types  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-auth   && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/logger        && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd services/paper-order-service && /usr/local/bin/tsc -p tsconfig.build.json)

# ── Runtime ──────────────────────────────────────────────────────────────────
# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json           ./packages/shared-db/
COPY packages/shared-redis/package.json        ./packages/shared-redis/
COPY packages/shared-types/package.json        ./packages/shared-types/
COPY packages/shared-auth/package.json     ./packages/shared-auth/
COPY packages/logger/package.json              ./packages/logger/
COPY services/paper-order-service/package.json ./services/paper-order-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install --filter @polyforge/paper-order-service... --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/packages/shared-db/dist/           ./packages/shared-db/dist/
COPY --from=builder /app/packages/shared-redis/dist/        ./packages/shared-redis/dist/
COPY --from=builder /app/packages/shared-types/dist/        ./packages/shared-types/dist/
COPY --from=builder /app/packages/shared-auth/dist/      ./packages/shared-auth/dist/
COPY --from=builder /app/packages/logger/dist/              ./packages/logger/dist/
COPY --from=builder /app/services/paper-order-service/dist  ./services/paper-order-service/dist

COPY --from=builder /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/engines  ./node_modules/@prisma/engines

WORKDIR /app/services/paper-order-service

EXPOSE 3008

USER node

CMD ["node", "--max-old-space-size=512", "--optimize-for-size", "dist/main"]
