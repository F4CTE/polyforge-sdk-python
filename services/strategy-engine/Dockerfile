# ── Rust build stage: compile WASM strategy evaluator ─────────────────────────
FROM rust:1-slim@sha256:81099830a1e1d244607b9a7a30f3ff6ecadc52134a933b4635faba24f52840c9 AS wasm-builder

RUN rustup target add wasm32-unknown-unknown && \
    cargo install wasm-pack

WORKDIR /app
COPY packages/polyforge-engine/ ./packages/polyforge-engine/

RUN cd packages/polyforge-engine && wasm-pack build --target nodejs --release

# ── TypeScript build stage ────────────────────────────────────────────────────
# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9.0.0 && \
    npm install -g typescript@5.9.3

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

COPY packages/shared-db/package.json        ./packages/shared-db/
COPY packages/shared-redis/package.json     ./packages/shared-redis/
COPY packages/logger/package.json           ./packages/logger/
COPY packages/shared-types/package.json     ./packages/shared-types/
COPY packages/shared-auth/package.json     ./packages/shared-auth/
COPY services/strategy-engine/package.json  ./services/strategy-engine/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install \
    --filter @polyforge/shared-db \
    --filter @polyforge/shared-redis \
    --filter @polyforge/shared-types \
    --filter @polyforge/shared-auth \
    --filter @polyforge/logger \
    --filter @polyforge/strategy-engine... \
    --frozen-lockfile

COPY packages/shared-db/        ./packages/shared-db/
COPY packages/shared-redis/     ./packages/shared-redis/
COPY packages/logger/           ./packages/logger/
COPY packages/shared-types/     ./packages/shared-types/
COPY packages/shared-auth/      ./packages/shared-auth/
COPY services/strategy-engine/  ./services/strategy-engine/
COPY prisma/                    ./prisma/

RUN DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.prisma --config ./prisma/prisma.config.ts && \
    DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.admin.prisma --config ./prisma/prisma.admin.config.ts && \
    (cd packages/shared-db     && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-redis  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/logger        && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-types  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-auth   && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd services/strategy-engine && /usr/local/bin/tsc -p tsconfig.build.json)

# ── Runtime ──────────────────────────────────────────────────────────────────
# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine

WORKDIR /app

RUN npm install -g pnpm@9.0.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json        ./packages/shared-db/
COPY packages/shared-redis/package.json     ./packages/shared-redis/
COPY packages/logger/package.json           ./packages/logger/
COPY packages/shared-types/package.json     ./packages/shared-types/
COPY packages/shared-auth/package.json     ./packages/shared-auth/
COPY services/strategy-engine/package.json  ./services/strategy-engine/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install --filter @polyforge/strategy-engine... --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/packages/shared-db/dist/         ./packages/shared-db/dist/
COPY --from=builder /app/packages/shared-redis/dist/      ./packages/shared-redis/dist/
COPY --from=builder /app/packages/logger/dist/            ./packages/logger/dist/
COPY --from=builder /app/packages/shared-types/dist/      ./packages/shared-types/dist/
COPY --from=builder /app/packages/shared-auth/dist/      ./packages/shared-auth/dist/
COPY --from=builder /app/services/strategy-engine/dist    ./services/strategy-engine/dist

# SECURITY: Rust WASM strategy evaluator — mandatory for sandboxed expression evaluation
COPY --from=wasm-builder /app/packages/polyforge-engine/pkg/ ./node_modules/@polyforge/engine/
COPY packages/polyforge-engine/index.ts ./node_modules/@polyforge/engine/index.ts

COPY --from=builder /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/engines  ./node_modules/@prisma/engines

WORKDIR /app/services/strategy-engine

EXPOSE 3006

USER node

CMD ["node", "--max-old-space-size=512", "--optimize-for-size", "dist/main"]
