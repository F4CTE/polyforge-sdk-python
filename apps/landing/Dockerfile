# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:26-alpine
FROM node:26-alpine@sha256:e71ac5e964b9201072425d59d2e876359efa25dc96bb1768cb73295728d6e4ea AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json packages/ui/
COPY apps/landing/package.json apps/landing/
RUN npm install -g pnpm@9.15.9 && \
    pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY packages/ui/ packages/ui/
COPY apps/landing/ apps/landing/
RUN pnpm --filter @polyforge/landing build

# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:26-alpine
FROM node:26-alpine@sha256:e71ac5e964b9201072425d59d2e876359efa25dc96bb1768cb73295728d6e4ea
WORKDIR /app
COPY --from=builder /app/apps/landing/.next/standalone ./
COPY --from=builder /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder /app/apps/landing/public ./apps/landing/public
EXPOSE 3000

USER node

CMD ["node", "apps/landing/server.js"]
