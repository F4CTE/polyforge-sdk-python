# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for dependency resolution
COPY packages/ui/package.json packages/ui/
COPY packages/api-client/package.json packages/api-client/
COPY apps/admin-app/package.json apps/admin-app/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ui/ packages/ui/
COPY packages/api-client/ packages/api-client/
COPY apps/admin-app/ apps/admin-app/

# Build
RUN pnpm --filter @polyforge/admin-app build

# Runtime
# NOTE: Production should pin to a specific digest, e.g. nginx:1.27-alpine@sha256:...
FROM nginx:1.27-alpine
COPY --from=builder /app/apps/admin-app/dist /usr/share/nginx/html
COPY apps/admin-app/nginx.conf /etc/nginx/conf.d/default.conf
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup

EXPOSE 80

USER appuser

CMD ["nginx", "-g", "daemon off;"]
