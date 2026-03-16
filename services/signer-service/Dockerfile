FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

COPY packages/shared-db/package.json      ./packages/shared-db/
COPY packages/logger/package.json         ./packages/logger/
COPY packages/shared-auth/package.json    ./packages/shared-auth/
COPY services/signer-service/package.json ./services/signer-service/

RUN pnpm install --filter @polyforge/signer-service... --frozen-lockfile

COPY packages/shared-db/       ./packages/shared-db/
COPY packages/logger/          ./packages/logger/
COPY packages/shared-auth/     ./packages/shared-auth/
COPY services/signer-service/  ./services/signer-service/
COPY prisma/                   ./prisma/

RUN pnpm --filter @polyforge/shared-db run build && \
    pnpm --filter @polyforge/logger run build && \
    pnpm --filter @polyforge/shared-auth run build && \
    pnpm --filter @polyforge/signer-service run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-db/package.json      ./packages/shared-db/
COPY packages/logger/package.json         ./packages/logger/
COPY packages/shared-auth/package.json    ./packages/shared-auth/
COPY services/signer-service/package.json ./services/signer-service/

RUN pnpm install --filter @polyforge/signer-service... --frozen-lockfile --prod

COPY --from=builder /app/packages/shared-db/src/     ./packages/shared-db/src/
COPY --from=builder /app/packages/logger/src/         ./packages/logger/src/
COPY --from=builder /app/packages/shared-auth/src/    ./packages/shared-auth/src/
COPY --from=builder /app/services/signer-service/dist ./services/signer-service/dist

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/services/signer-service

# signer-service listens on localhost only — no EXPOSE needed
# The container is on signer-only network with no published ports.

CMD ["node", "dist/main"]
