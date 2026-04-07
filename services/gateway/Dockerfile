# ─── Polyforge Gateway — Production ──────────────────────────────────────────
#
# Multi-stage build:
#   Stage 1 (user-app-builder)  — builds the Angular user app
#   Stage 2 (admin-app-builder) — builds the Angular admin app
#   Stage 3 (runtime)           — nginx:alpine with both built apps + nginx config
#
# The resulting image contains:
#   /usr/share/nginx/html/user-app/   ← Angular user app (dist/)
#   /usr/share/nginx/html/admin-app/  ← Angular admin app (dist/)
#   /etc/nginx/nginx.conf             ← production nginx config

# ─── Stage 1: user-app build ─────────────────────────────────────────────────

# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS user-app-builder

WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install deps (only the packages needed for user-app)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/user-app/package.json ./apps/user-app/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --filter @polyforge/user-app... --frozen-lockfile

# Copy source
COPY apps/user-app/       ./apps/user-app/
COPY packages/shared-types/ ./packages/shared-types/

# Build shared-types first, then Angular app
RUN pnpm --filter @polyforge/shared-types run build && \
    pnpm --filter @polyforge/user-app run build -- --configuration production

# ─── Stage 2: admin-app build ────────────────────────────────────────────────

# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS admin-app-builder

WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/admin-app/package.json ./apps/admin-app/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm install --filter @polyforge/admin-app... --frozen-lockfile

COPY apps/admin-app/        ./apps/admin-app/
COPY packages/shared-types/ ./packages/shared-types/

RUN pnpm --filter @polyforge/shared-types run build && \
    pnpm --filter @polyforge/admin-app run build -- --configuration production

# ─── Stage 3: nginx runtime ──────────────────────────────────────────────────

# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' nginx:1.27-alpine
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy production nginx config and entrypoint
COPY services/gateway/nginx.prod.conf /etc/nginx/nginx.conf
COPY services/gateway/docker-entrypoint.sh /docker-entrypoint.sh

# Copy built Angular apps from previous stages
COPY --from=user-app-builder /build/apps/user-app/dist/user-app/browser /usr/share/nginx/html/user-app
COPY --from=admin-app-builder /build/apps/admin-app/dist/admin-app/browser /usr/share/nginx/html/admin-app

# Landing page — static files copied directly (no build step)
COPY apps/landing/index.html      /usr/share/nginx/html/landing/
COPY apps/landing/styles.css      /usr/share/nginx/html/landing/
COPY apps/landing/favicon.svg     /usr/share/nginx/html/landing/
COPY apps/landing/og-image.png    /usr/share/nginx/html/landing/
COPY apps/landing/og-image.svg    /usr/share/nginx/html/landing/
COPY apps/landing/robots.txt      /usr/share/nginx/html/landing/
COPY apps/landing/sitemap.xml     /usr/share/nginx/html/landing/

# Create certbot ACME challenge directory
RUN mkdir -p /var/www/certbot

RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup && \
    mkdir -p /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp /var/cache/nginx/fastcgi_temp /var/cache/nginx/uwsgi_temp /var/cache/nginx/scgi_temp && \
    chown -R appuser:appgroup /var/cache/nginx /var/run /var/log/nginx /var/www/certbot && \
    touch /run/nginx.pid && chown appuser:appgroup /run/nginx.pid && \
    touch /etc/nginx/admin_allowlist.conf && chown appuser:appgroup /etc/nginx/admin_allowlist.conf

EXPOSE 80 443

USER appuser

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
