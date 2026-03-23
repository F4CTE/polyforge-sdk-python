# NOTE: Production should pin to a specific digest, e.g. node:24-alpine3.20@sha256:...
FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm + typescript (globally, so tsc is always available in PATH)
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    npm install -g typescript

# Copy workspace manifests (all packages so pnpm can resolve the full dep tree)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY services/mock-polymarket/package.json ./services/mock-polymarket/
# Stub out other workspace package.json files so pnpm install doesn't fail
# on missing workspace members referenced in pnpm-lock.yaml
COPY packages/shared-db/package.json        ./packages/shared-db/
COPY packages/shared-redis/package.json     ./packages/shared-redis/
COPY packages/shared-auth/package.json      ./packages/shared-auth/
COPY packages/shared-types/package.json     ./packages/shared-types/
COPY packages/logger/package.json           ./packages/logger/

# Use hoisted node_modules so tsc can find packages via standard traversal
RUN echo "shamefully-hoist=true" >> .npmrc && \
    pnpm install --filter @polyforge/mock-polymarket --frozen-lockfile

# Copy source
COPY services/mock-polymarket/ ./services/mock-polymarket/

# Build using globally-installed tsc
RUN cd services/mock-polymarket && tsc -p tsconfig.build.json

# ── Runtime ──────────────────────────────────────────────────────────────────
# NOTE: Production should pin to a specific digest, e.g. node:24-alpine3.20@sha256:...
FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/mock-polymarket/package.json ./services/mock-polymarket/
COPY packages/shared-db/package.json        ./packages/shared-db/
COPY packages/shared-redis/package.json     ./packages/shared-redis/
COPY packages/shared-auth/package.json      ./packages/shared-auth/
COPY packages/shared-types/package.json     ./packages/shared-types/
COPY packages/logger/package.json           ./packages/logger/

RUN echo "shamefully-hoist=true" > .npmrc && \
    pnpm install --filter @polyforge/mock-polymarket --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/services/mock-polymarket/dist ./services/mock-polymarket/dist

WORKDIR /app/services/mock-polymarket

EXPOSE 3096 3097 3098 3099

USER node

CMD ["node", "dist/main"]
