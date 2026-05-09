# ─── Polyforge Gateway — Production ──────────────────────────────────────────
#
# Multi-stage build:
#   Stage 1 (user-app-builder)   — builds the Angular user app
#   Stage 2 (admin-app-builder)  — builds the Angular admin app
#   Stage 3 (landing-builder)    — builds the Next.js landing as a static export
#   Stage 4 (runtime)            — nginx:alpine with all built apps + nginx config
#
# The resulting image contains:
#   /usr/share/nginx/html/user-app/     ← Angular user app (dist/)
#   /usr/share/nginx/html/admin-app/    ← Angular admin app (dist/)
#   /usr/share/nginx/html/landing/      ← Next.js static export (out/)
#   /etc/nginx/nginx.conf               ← production nginx config

# ─── Stage 1: user-app build ─────────────────────────────────────────────────

# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine AS user-app-builder

WORKDIR /build

RUN npm install -g pnpm@9.0.0

# Install deps (only the packages needed for user-app)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/user-app/package.json ./apps/user-app/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install --filter @polyforge/user-app... --frozen-lockfile

# Copy source
COPY apps/user-app/       ./apps/user-app/
COPY packages/shared-types/ ./packages/shared-types/

# Build shared-types first, then Angular app
RUN pnpm --filter @polyforge/shared-types run build && \
    pnpm --filter @polyforge/user-app run build -- --configuration production

# ─── Stage 2: admin-app build ────────────────────────────────────────────────

# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine AS admin-app-builder

WORKDIR /build

RUN npm install -g pnpm@9.0.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/admin-app/package.json ./apps/admin-app/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install --filter @polyforge/admin-app... --frozen-lockfile

COPY apps/admin-app/        ./apps/admin-app/
COPY packages/shared-types/ ./packages/shared-types/

RUN pnpm --filter @polyforge/shared-types run build && \
    pnpm --filter @polyforge/admin-app run build -- --configuration production

# ─── Stage 3: landing build (Next.js static export) ──────────────────────────
#
# NEXT_STATIC_EXPORT=true triggers output:'export' in next.config.ts, producing
# an out/ directory of pre-rendered HTML + _next/static/ assets. No Node.js
# server is needed in production — nginx serves everything as static files.

# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' node:24-alpine
FROM node:24-alpine AS landing-builder

WORKDIR /build

RUN npm install -g pnpm@9.0.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY apps/landing/package.json ./apps/landing/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm config set store-dir /tmp/pnpm-store && \
    pnpm install --filter @polyforge/landing... --frozen-lockfile

COPY apps/landing/ ./apps/landing/
COPY packages/ui/  ./packages/ui/

ENV NEXT_STATIC_EXPORT=true
RUN pnpm --filter @polyforge/landing build

# ─── Stage 4: nginx runtime ──────────────────────────────────────────────────

# SECURITY: Pin to digest in production. Run: docker inspect --format='{{index .RepoDigests 0}}' nginx:1.27-alpine
FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy production nginx config and entrypoint
COPY services/gateway/nginx.prod.conf /etc/nginx/nginx.conf
COPY services/gateway/docker-entrypoint.sh /docker-entrypoint.sh

# Copy built Angular apps from previous stages
COPY --from=user-app-builder /build/apps/user-app/dist/user-app/browser /usr/share/nginx/html/user-app
COPY --from=admin-app-builder /build/apps/admin-app/dist/admin-app/browser /usr/share/nginx/html/admin-app

# Landing page — Next.js static export (out/ directory contains all HTML + _next/ assets)
COPY --from=landing-builder /build/apps/landing/out /usr/share/nginx/html/landing

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
