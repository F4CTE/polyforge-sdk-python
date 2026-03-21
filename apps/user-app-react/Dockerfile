FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for dependency resolution
COPY packages/ui/package.json packages/ui/
COPY packages/api-client/package.json packages/api-client/
COPY apps/user-app-react/package.json apps/user-app-react/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ui/ packages/ui/
COPY packages/api-client/ packages/api-client/
COPY apps/user-app-react/ apps/user-app-react/

# Build
RUN pnpm --filter @polyforge/user-app-react build

# Runtime
FROM nginx:1.27-alpine
COPY --from=builder /app/apps/user-app-react/dist /usr/share/nginx/html
COPY apps/user-app-react/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
