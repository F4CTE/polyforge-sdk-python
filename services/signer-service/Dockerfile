# ── Rust build stage: compile NAPI-RS crypto addon ────────────────────────────
FROM rust:1-slim@sha256:81099830a1e1d244607b9a7a30f3ff6ecadc52134a933b4635faba24f52840c9 AS rust-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY packages/polyforge-crypto-native/ ./packages/polyforge-crypto-native/

RUN cd packages/polyforge-crypto-native && \
    npm init -y > /dev/null 2>&1 && \
    npm install @napi-rs/cli@2 && \
    npx napi build --platform --release

# ── TypeScript build stage ────────────────────────────────────────────────────
# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9.15.9 && \
    npm install -g typescript@5.9.3

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./

COPY packages/shared-db/package.json      ./packages/shared-db/
COPY packages/shared-redis/package.json   ./packages/shared-redis/
COPY packages/shared-types/package.json   ./packages/shared-types/
COPY packages/logger/package.json         ./packages/logger/
COPY packages/shared-auth/package.json    ./packages/shared-auth/
COPY packages/polyforge-crypto-native/package.json ./packages/polyforge-crypto-native/
COPY services/signer-service/package.json ./services/signer-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install \
    --filter @polyforge/shared-db \
    --filter @polyforge/shared-redis \
    --filter @polyforge/shared-types \
    --filter @polyforge/logger \
    --filter @polyforge/shared-auth \
    --filter @polyforge/signer-service... \
    --frozen-lockfile

COPY packages/shared-db/       ./packages/shared-db/
COPY packages/shared-redis/    ./packages/shared-redis/
COPY packages/shared-types/    ./packages/shared-types/
COPY packages/logger/          ./packages/logger/
COPY packages/shared-auth/     ./packages/shared-auth/
COPY packages/polyforge-crypto-native/index.js   ./packages/polyforge-crypto-native/
COPY packages/polyforge-crypto-native/index.d.ts ./packages/polyforge-crypto-native/
COPY services/signer-service/  ./services/signer-service/
COPY prisma/                   ./prisma/

RUN DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.prisma --config ./prisma/prisma.config.ts && \
    DIRECT_DATABASE_URL=placeholder ADMIN_DIRECT_DATABASE_URL=placeholder \
    npx prisma generate --schema ./prisma/schema.admin.prisma --config ./prisma/prisma.admin.config.ts && \
    (cd packages/shared-db     && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-redis  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-types  && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/logger        && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd packages/shared-auth   && /usr/local/bin/tsc -p tsconfig.json) && \
    (cd services/signer-service && /usr/local/bin/tsc -p tsconfig.build.json)

# ── Runtime ──────────────────────────────────────────────────────────────────
# SECURITY: Using Debian slim (not Alpine) because the Rust NAPI addon requires glibc.
# The signer-service is the ONLY service that uses Debian — all others use Alpine.
FROM node:24-slim

WORKDIR /app

RUN npm install -g pnpm@9.15.9

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json      ./packages/shared-db/
COPY packages/shared-redis/package.json   ./packages/shared-redis/
COPY packages/shared-types/package.json   ./packages/shared-types/
COPY packages/logger/package.json         ./packages/logger/
COPY packages/shared-auth/package.json    ./packages/shared-auth/
COPY services/signer-service/package.json ./services/signer-service/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install --filter @polyforge/signer-service... --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/packages/shared-db/dist/        ./packages/shared-db/dist/
COPY --from=builder /app/packages/shared-redis/dist/     ./packages/shared-redis/dist/
COPY --from=builder /app/packages/shared-types/dist/     ./packages/shared-types/dist/
COPY --from=builder /app/packages/logger/dist/           ./packages/logger/dist/
COPY --from=builder /app/packages/shared-auth/dist/      ./packages/shared-auth/dist/
COPY --from=builder /app/services/signer-service/dist    ./services/signer-service/dist

# SECURITY: Rust NAPI-RS crypto addon — mandatory for memory-safe key handling
COPY --from=rust-builder /app/packages/polyforge-crypto-native/*.node ./node_modules/@polyforge/crypto-native/
COPY --from=rust-builder /app/packages/polyforge-crypto-native/index.js ./node_modules/@polyforge/crypto-native/
COPY --from=rust-builder /app/packages/polyforge-crypto-native/package.json ./node_modules/@polyforge/crypto-native/

COPY --from=builder /app/node_modules/.prisma          ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/engines  ./node_modules/@prisma/engines

WORKDIR /app/services/signer-service

# signer-service listens on localhost only — no EXPOSE needed
# The container is on signer-only network with no published ports.

USER node

CMD ["node", "--max-old-space-size=512", "--optimize-for-size", "dist/main"]
