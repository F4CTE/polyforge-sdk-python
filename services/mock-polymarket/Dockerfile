FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/mock-polymarket/package.json ./services/mock-polymarket/

# Install only mock-polymarket deps (no other workspaces needed)
RUN pnpm install --filter @polyforge/mock-polymarket --frozen-lockfile

# Copy source
COPY services/mock-polymarket/ ./services/mock-polymarket/

# Build
WORKDIR /app/services/mock-polymarket
RUN pnpm exec tsc -p tsconfig.build.json

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/mock-polymarket/package.json ./services/mock-polymarket/

RUN pnpm install --filter @polyforge/mock-polymarket --frozen-lockfile --prod

COPY --from=builder /app/services/mock-polymarket/dist ./services/mock-polymarket/dist

WORKDIR /app/services/mock-polymarket

EXPOSE 3096 3097 3098 3099

CMD ["node", "dist/main"]
