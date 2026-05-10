# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:26-alpine
FROM node:26-alpine@sha256:e71ac5e964b9201072425d59d2e876359efa25dc96bb1768cb73295728d6e4ea AS builder

WORKDIR /app

RUN npm install -g pnpm@9.15.9 && \
    npm install -g typescript@5.9.3

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

COPY packages/shared-db/package.json         ./packages/shared-db/
COPY packages/shared-redis/package.json      ./packages/shared-redis/
COPY packages/shared-auth/package.json       ./packages/shared-auth/
COPY packages/shared-types/package.json      ./packages/shared-types/
COPY packages/logger/package.json            ./packages/logger/
COPY services/bot-service/package.json       ./services/bot-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install \
    --filter @polyforge/shared-db \
    --filter @polyforge/shared-redis \
    --filter @polyforge/shared-auth \
    --filter @polyforge/shared-types \
    --filter @polyforge/logger \
    --filter @polyforge/bot-service... \
    --frozen-lockfile

COPY packages/shared-db/      ./packages/shared-db/
COPY packages/shared-redis/   ./packages/shared-redis/
COPY packages/shared-auth/    ./packages/shared-auth/
COPY packages/shared-types/   ./packages/shared-types/
COPY packages/logger/         ./packages/logger/
COPY services/bot-service/    ./services/bot-service/
COPY prisma/                  ./prisma/

RUN DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.prisma --config ./prisma/prisma.config.ts && \
    DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.admin.prisma --config ./prisma/prisma.admin.config.ts && \
    (cd packages/shared-types  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-db     && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-redis  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/logger        && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-auth   && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd services/bot-service && /usr/local/bin/tsc -p tsconfig.build.json)

# ── Runtime ──────────────────────────────────────────────────────────────────
# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:26-alpine
FROM node:26-alpine@sha256:e71ac5e964b9201072425d59d2e876359efa25dc96bb1768cb73295728d6e4ea

WORKDIR /app

RUN npm install -g pnpm@9.15.9

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json         ./packages/shared-db/
COPY packages/shared-redis/package.json      ./packages/shared-redis/
COPY packages/shared-auth/package.json       ./packages/shared-auth/
COPY packages/shared-types/package.json      ./packages/shared-types/
COPY packages/logger/package.json            ./packages/logger/
COPY services/bot-service/package.json       ./services/bot-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install --filter @polyforge/bot-service... --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/packages/shared-db/dist/       ./packages/shared-db/dist/
COPY --from=builder /app/packages/shared-redis/dist/    ./packages/shared-redis/dist/
COPY --from=builder /app/packages/shared-auth/dist/     ./packages/shared-auth/dist/
COPY --from=builder /app/packages/shared-types/dist/    ./packages/shared-types/dist/
COPY --from=builder /app/packages/logger/dist/          ./packages/logger/dist/
COPY --from=builder /app/services/bot-service/dist      ./services/bot-service/dist

COPY --from=builder /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/engines  ./node_modules/@prisma/engines

WORKDIR /app/services/bot-service

EXPOSE 3011

USER node

CMD ["node", "--max-old-space-size=512", "--optimize-for-size", "dist/main"]
