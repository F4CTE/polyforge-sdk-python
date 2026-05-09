# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine AS builder
RUN npm install -g pnpm@9.0.0
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for dependency resolution
COPY packages/ui/package.json packages/ui/
COPY packages/api-client/package.json packages/api-client/
COPY apps/admin-app/package.json apps/admin-app/

RUN pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install --frozen-lockfile

# Copy source
COPY packages/ui/ packages/ui/
COPY packages/api-client/ packages/api-client/
COPY tsconfig.json ./
COPY apps/admin-app/ apps/admin-app/

# Build
RUN pnpm --filter @polyforge/admin-app build

# Runtime
# NOTE: Production should pin to a specific digest, e.g. nginx:1.27-alpine@sha256:...
FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de
COPY --from=builder /app/apps/admin-app/dist /usr/share/nginx/html
COPY apps/admin-app/nginx.conf /etc/nginx/conf.d/default.conf
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup && \
    mkdir -p /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp /var/cache/nginx/fastcgi_temp /var/cache/nginx/uwsgi_temp /var/cache/nginx/scgi_temp && \
    chown -R appuser:appgroup /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html && \
    touch /run/nginx.pid && chown appuser:appgroup /run/nginx.pid

EXPOSE 80

USER appuser

CMD ["nginx", "-g", "daemon off;"]
