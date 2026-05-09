# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:26-alpine@sha256:30f5a66e7265ef70aac56b4753ffa7905e54eca1084bc25503893ad8e9273f05 AS builder

WORKDIR /app

RUN npm install -g pnpm@9.0.0 && \
    npm install -g typescript@5.9.3

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

COPY packages/shared-db/package.json           ./packages/shared-db/
COPY packages/shared-redis/package.json        ./packages/shared-redis/
COPY packages/shared-types/package.json        ./packages/shared-types/
COPY packages/shared-auth/package.json     ./packages/shared-auth/
COPY packages/logger/package.json              ./packages/logger/
COPY services/backtest-service/package.json    ./services/backtest-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install \
    --filter @polyforge/shared-db \
    --filter @polyforge/shared-redis \
    --filter @polyforge/shared-types \
    --filter @polyforge/shared-auth \
    --filter @polyforge/logger \
    --filter @polyforge/backtest-service... \
    --frozen-lockfile

COPY packages/shared-db/           ./packages/shared-db/
COPY packages/shared-redis/        ./packages/shared-redis/
COPY packages/shared-types/        ./packages/shared-types/
COPY packages/shared-auth/         ./packages/shared-auth/
COPY packages/logger/              ./packages/logger/
COPY services/backtest-service/    ./services/backtest-service/
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
    (cd services/backtest-service && /usr/local/bin/tsc -p tsconfig.build.json)

# ── Runtime ──────────────────────────────────────────────────────────────────
# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:26-alpine@sha256:30f5a66e7265ef70aac56b4753ffa7905e54eca1084bc25503893ad8e9273f05

WORKDIR /app

RUN npm install -g pnpm@9.0.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json           ./packages/shared-db/
COPY packages/shared-redis/package.json        ./packages/shared-redis/
COPY packages/shared-types/package.json        ./packages/shared-types/
COPY packages/shared-auth/package.json     ./packages/shared-auth/
COPY packages/logger/package.json              ./packages/logger/
COPY services/backtest-service/package.json    ./services/backtest-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install --filter @polyforge/backtest-service... --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/packages/shared-db/dist/         ./packages/shared-db/dist/
COPY --from=builder /app/packages/shared-redis/dist/      ./packages/shared-redis/dist/
COPY --from=builder /app/packages/shared-types/dist/      ./packages/shared-types/dist/
COPY --from=builder /app/packages/shared-auth/dist/      ./packages/shared-auth/dist/
COPY --from=builder /app/packages/logger/dist/            ./packages/logger/dist/
COPY --from=builder /app/services/backtest-service/dist   ./services/backtest-service/dist

COPY --from=builder /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/engines  ./node_modules/@prisma/engines

WORKDIR /app/services/backtest-service

EXPOSE 3009

USER node

CMD ["node", "--max-old-space-size=512", "--optimize-for-size", "dist/main"]
