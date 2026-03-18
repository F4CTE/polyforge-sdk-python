FROM node:24-alpine AS builder

WORKDIR /build

COPY apps/admin-app/package.json ./

RUN npm install

COPY apps/admin-app/ ./

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /build/dist/admin-app/browser /usr/share/nginx/html

COPY apps/admin-app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
