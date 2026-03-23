# NOTE: Production should pin to a specific digest, e.g. node:24-alpine3.20@sha256:...
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json packages/ui/
COPY apps/landing/package.json apps/landing/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/ui/ packages/ui/
COPY apps/landing/ apps/landing/
RUN pnpm --filter @polyforge/landing build

# NOTE: Production should pin to a specific digest, e.g. node:24-alpine3.20@sha256:...
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/apps/landing/.next/standalone ./
COPY --from=builder /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder /app/apps/landing/public ./apps/landing/public
EXPOSE 3000

USER node

CMD ["node", "apps/landing/server.js"]
