FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

COPY packages/shared-db/package.json         ./packages/shared-db/
COPY packages/shared-redis/package.json      ./packages/shared-redis/
COPY packages/shared-types/package.json      ./packages/shared-types/
COPY packages/logger/package.json            ./packages/logger/
COPY services/bot-service/package.json       ./services/bot-service/

RUN pnpm install --filter @polyforge/bot-service... --frozen-lockfile

COPY packages/shared-db/      ./packages/shared-db/
COPY packages/shared-redis/   ./packages/shared-redis/
COPY packages/shared-types/   ./packages/shared-types/
COPY packages/logger/         ./packages/logger/
COPY services/bot-service/    ./services/bot-service/
COPY prisma/                  ./prisma/

RUN pnpm --filter @polyforge/shared-db run build && \
    pnpm --filter @polyforge/shared-redis run build && \
    pnpm --filter @polyforge/shared-types run build && \
    pnpm --filter @polyforge/logger run build && \
    pnpm --filter @polyforge/bot-service run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json         ./packages/shared-db/
COPY packages/shared-redis/package.json      ./packages/shared-redis/
COPY packages/shared-types/package.json      ./packages/shared-types/
COPY packages/logger/package.json            ./packages/logger/
COPY services/bot-service/package.json       ./services/bot-service/

RUN pnpm install --filter @polyforge/bot-service... --frozen-lockfile --prod

COPY --from=builder /app/packages/shared-db/src/       ./packages/shared-db/src/
COPY --from=builder /app/packages/shared-redis/src/    ./packages/shared-redis/src/
COPY --from=builder /app/packages/shared-types/src/    ./packages/shared-types/src/
COPY --from=builder /app/packages/logger/src/          ./packages/logger/src/
COPY --from=builder /app/services/bot-service/dist     ./services/bot-service/dist

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/services/bot-service

EXPOSE 3011

CMD ["node", "dist/main"]
