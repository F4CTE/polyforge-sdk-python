# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ && \
    corepack enable && corepack prepare pnpm@latest --activate && \
    npm install -g typescript@5

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

COPY packages/shared-db/package.json        ./packages/shared-db/
COPY packages/shared-redis/package.json     ./packages/shared-redis/
COPY packages/shared-auth/package.json      ./packages/shared-auth/
COPY packages/shared-types/package.json     ./packages/shared-types/
COPY packages/logger/package.json           ./packages/logger/
COPY services/api-service/package.json      ./services/api-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install \
    --filter @polyforge/shared-db \
    --filter @polyforge/shared-redis \
    --filter @polyforge/shared-auth \
    --filter @polyforge/shared-types \
    --filter @polyforge/logger \
    --filter @polyforge/api-service... \
    --frozen-lockfile

COPY packages/shared-db/        ./packages/shared-db/
COPY packages/shared-redis/     ./packages/shared-redis/
COPY packages/shared-auth/      ./packages/shared-auth/
COPY packages/shared-types/     ./packages/shared-types/
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
    (cd services/api-service && /usr/local/bin/tsc -p tsconfig.build.json)

# ── Runtime ──────────────────────────────────────────────────────────────────
# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json        ./packages/shared-db/
COPY packages/shared-redis/package.json     ./packages/shared-redis/
COPY packages/shared-auth/package.json      ./packages/shared-auth/
COPY packages/shared-types/package.json     ./packages/shared-types/
COPY packages/logger/package.json           ./packages/logger/
COPY services/api-service/package.json      ./services/api-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install --filter @polyforge/api-service... --frozen-lockfile --prod

COPY --from=builder /app/packages/shared-db/dist/       ./packages/shared-db/dist/
COPY --from=builder /app/packages/shared-redis/dist/    ./packages/shared-redis/dist/
COPY --from=builder /app/packages/shared-auth/dist/     ./packages/shared-auth/dist/
COPY --from=builder /app/packages/shared-types/dist/    ./packages/shared-types/dist/
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
