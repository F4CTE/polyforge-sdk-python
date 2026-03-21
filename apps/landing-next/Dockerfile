FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json packages/ui/
COPY apps/landing-next/package.json apps/landing-next/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/ui/ packages/ui/
COPY apps/landing-next/ apps/landing-next/
RUN pnpm --filter @polyforge/landing-next build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/apps/landing-next/.next/standalone ./
COPY --from=builder /app/apps/landing-next/.next/static ./apps/landing-next/.next/static
COPY --from=builder /app/apps/landing-next/public ./apps/landing-next/public
EXPOSE 3000
CMD ["node", "apps/landing-next/server.js"]
