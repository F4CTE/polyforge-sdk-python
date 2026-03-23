# NOTE: Production should pin to a specific digest, e.g. node:24-alpine3.20@sha256:...
FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate && \
    npm install -g typescript

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

COPY packages/shared-db/package.json         ./packages/shared-db/
COPY packages/shared-redis/package.json      ./packages/shared-redis/
COPY packages/shared-types/package.json      ./packages/shared-types/
COPY packages/logger/package.json            ./packages/logger/
COPY services/bot-service/package.json       ./services/bot-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install \
    --filter @polyforge/shared-db \
    --filter @polyforge/shared-redis \
    --filter @polyforge/shared-types \
    --filter @polyforge/logger \
    --filter @polyforge/bot-service... \
    --frozen-lockfile

COPY packages/shared-db/      ./packages/shared-db/
COPY packages/shared-redis/   ./packages/shared-redis/
COPY packages/shared-types/   ./packages/shared-types/
COPY packages/logger/         ./packages/logger/
COPY services/bot-service/    ./services/bot-service/
COPY prisma/                  ./prisma/

RUN DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.prisma --config ./prisma/prisma.config.ts && \
    DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.admin.prisma --config ./prisma/prisma.admin.config.ts && \
    (cd packages/shared-db     && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-redis  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-types  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/logger        && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd services/bot-service && /usr/local/bin/tsc -p tsconfig.build.json)

# ── Runtime ──────────────────────────────────────────────────────────────────
# NOTE: Production should pin to a specific digest, e.g. node:24-alpine3.20@sha256:...
FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json         ./packages/shared-db/
COPY packages/shared-redis/package.json      ./packages/shared-redis/
COPY packages/shared-types/package.json      ./packages/shared-types/
COPY packages/logger/package.json            ./packages/logger/
COPY services/bot-service/package.json       ./services/bot-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install --filter @polyforge/bot-service... --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/packages/shared-db/dist/       ./packages/shared-db/dist/
COPY --from=builder /app/packages/shared-redis/dist/    ./packages/shared-redis/dist/
COPY --from=builder /app/packages/shared-types/dist/    ./packages/shared-types/dist/
COPY --from=builder /app/packages/logger/dist/          ./packages/logger/dist/
COPY --from=builder /app/services/bot-service/dist      ./services/bot-service/dist

COPY --from=builder /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/engines  ./node_modules/@prisma/engines

WORKDIR /app/services/bot-service

EXPOSE 3011

USER node

CMD ["node", "dist/main"]
