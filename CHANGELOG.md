# Changelog

All notable changes are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [1.4.0] — 2026-03-18

### Security

- **HIGH #2** — Admin login now returns HTTP 200 instead of 201; added `@HttpCode(HttpStatus.OK)` and updated Swagger `@ApiResponse` status in `admin-auth-service/auth.controller.ts`
- **HIGH #1** — Admin password DTOs now enforce complexity: uppercase + lowercase + digit + special char via `@Matches` in `CreateAdminDto` and `UpdateAdminDto`; also added `@MaxLength(100)` cap
- **MEDIUM #2** — X-Forwarded-For parsing in `admin-jwt.guard.ts`: trim entire header string before splitting to handle leading-space edge case (`xff.trim().split(',')[0].trim()`)
- **MEDIUM #3** — Standardized bcrypt library: `auth-service` migrated from `bcrypt` (native binary) to `bcryptjs` (pure JS) — removes native build dependency, consistent with `admin-api-service`; updated all imports and `package.json`
- **LOW #1** — Removed unused `INTERNAL_JWT_SECRET` from `admin-auth-service` startup `validateEnv()` (service does not sign internal JWTs)
- **LOW #2** — `api-service/src/main.ts` bootstrap error handler changed from `console.error` to `process.stderr.write` (consistent with all other services)
- **LOW #3** — `auth-service` `LoginDto` password `@MinLength` raised from 1 to 8 for defense-in-depth (matches registration policy)

---

## [1.3.0] — 2026-03-18

### Security

- **C2** — HttpOnly cookie auth: JWT tokens now stored in `pf_token` / `pf_admin_token` HttpOnly Secure SameSite=Lax cookies instead of `localStorage`
  - `@fastify/cookie` registered in `auth-service`, `admin-auth-service`, `admin-api-service`, `api-service`
  - `auth-service` controller sets/clears cookie on login/register/logout
  - `admin-auth-service` controller sets/clears cookie on login/logout; added `GET /auth/v1/me` endpoint for session restore
  - `packages/shared-auth` JWT strategy: extracts from `pf_token` cookie OR `Authorization: Bearer` header (backward compat for API clients)
  - `admin-api-service` `AdminJwtGuard`: extracts from `pf_admin_token` cookie OR Bearer header
  - `api-service` WebSocket gateway: authenticates from `pf_token` cookie in HTTP upgrade request; explicit AUTH message still supported for non-browser clients
  - Angular `authInterceptor` (user-app + admin-app): replaced Bearer header injection with `withCredentials: true`
  - `AuthStore` / `AdminAuthStore`: `init()` now calls `/me` directly; no localStorage read/write
  - `TokenService` (user-app): stripped to utility-only; `TokenService` (admin-app): empty stub
  - `error.interceptor.ts` (both apps): no longer calls `TokenService.clear()` — server clears the cookie on logout
- **C3** — HSTS confirmed present in `nginx.prod.conf` (`max-age=63072000; includeSubDomains; preload`)
- **H3** — CSRF mitigated by `SameSite=Lax` cookie policy; no additional CSRF token required
- **L3** — JWT secret rotation SOP documented in `docs/07-deployment.md`
- **M7** — DB least-privilege user setup documented in `docs/04-database-and-redis.md`

### Fixed

- `auth.controller.spec.ts` (auth-service, admin-auth-service): updated test stubs to pass `FastifyReply` mock to controller methods

---

## [1.2.0] — 2026-03-18

### Security

- **C1** — Removed all hardcoded JWT secret fallbacks (`?? 'dev-secret'`, `?? 'dev-admin-secret'`) from `packages/shared-auth`, `admin-auth-service/auth.module.ts`, `admin-api-service/admin-jwt.guard.ts`
- **C1** — Added startup env validation to `auth-service`, `admin-auth-service`, `admin-api-service`, `signer-service`: exits immediately if required secrets/DB URLs are missing
- **C4** — Added `@nestjs/throttler` to `admin-auth-service`; 10 req/15 min rate limit on admin login
- **H1** — Explicit `expiresIn: '1h'` on `jwtService.sign()` in admin-auth-service (defence-in-depth)
- **H2** — Fixed X-Forwarded-For IP spoofing: `adminIp` now uses only the first (leftmost) IP in the `X-Forwarded-For` chain
- **H4** — Added `@MaxLength(100)` to `password` in `auth-service` `LoginDto` (prevent bcrypt long-password DoS)
- **H5** — `AdminsService.update` and `AdminsService.deactivate` now scan and delete all Redis sessions for the target admin when role or active status changes
- **H6** — Added `@Matches(/^POLY-[A-Z0-9]{6}$/)` to `inviteCode` in `RegisterDto`
- **H7** — `signer-service` `InternalAuthGuard` JTI replay protection migrated from in-process `Set` to Redis `SET NX` (60s TTL); works correctly across restarts and multiple replicas
- **M1** — Tightened CORS in `auth-service` and `api-service`: removed unused dev origins (4201, 4300)
- **M2** — Startup check rejects all-zero `TOTP_ENCRYPTION_KEY` in production
- **M3** — Added `@Matches(/^\d{6}$/)` to `totpCode` in `LoginDto`
- **M4** — Audit log IP field sanitized (strip non-printable chars, max 64 chars); `admins` controller params validated with `ParseUUIDPipe`
- **M5** — Added `@Throttle()` (10/hr) to `verify-email` and `reset-password` endpoints in auth-service
- **M6** — Transparent bcrypt re-hash on login for accounts with < 12 rounds (`UsersService.rehashIfNeeded`, fire-and-forget)
- **L1** — Security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`) added via Fastify `onSend` hook in all four HTTP services, and globally in nginx gateway
- **L2** — Swagger `persistAuthorization` changed from `true` to `false`
- **L4** — Bootstrap `console.error` replaced with `process.stderr.write`; all `main.ts` use `bootstrap().catch(...)` pattern

### Fixed

- `auth-service` spec (`auth.service.spec.ts`) — updated constructor call to include `ConfigService` and `RedisService` mocks after `AuthService` DI signature change

---

## [1.1.0] — 2026-03-18

### Added

#### Docker Frontend Serving
- `apps/user-app/Dockerfile` — multi-stage build (Node 24 → nginx:1.27-alpine), serves Angular production build
- `apps/admin-app/Dockerfile` — same pattern for admin app
- `apps/landing/Dockerfile` — nginx:1.27-alpine serving static landing files
- Per-app `nginx.conf` files with `try_files $uri $uri/ /index.html` for Angular client-side routing
- `.dockerignore` — excludes `node_modules`, `dist`, `.angular`, `.turbo`, `coverage` from Docker build context

#### nginx Gateway (`services/gateway/`)
- `nginx.dev.conf` — single nginx container proxying:
  - Port 80 → user app (landing at `/`, Angular SPA, `/api/v1/*` → api-service, `/auth/v1/*` → auth-service, `/ws` → WebSocket)
  - Port 8080 → admin app (Angular SPA, `/api/v1/*` → admin-api-service, `/auth/v1/*` → admin-auth-service)
- Docker DNS auto-resolution via `resolver 127.0.0.11 valid=10s ipv6=off` + `set $upstream` variables — nginx re-resolves container IPs automatically after rebuilds

#### Admin Management Feature
- `services/admin-api-service/src/admins/` — new NestJS module:
  - `GET /api/v1/admins` — list all admin accounts
  - `POST /api/v1/admins` — create admin (email, displayName, password, role)
  - `PATCH /api/v1/admins/:id` — update display name, role, active status, or password
  - `DELETE /api/v1/admins/:id` — deactivate admin account
  - All endpoints restricted to `SUPER_ADMIN` role; every action is audit-logged
  - Self-protection: cannot change your own role, deactivate yourself
- `apps/admin-app/src/app/features/admins/` — `AdminsComponent`:
  - Table of all admins with role badges and active/inactive status
  - Create dialog (name, email, password, role)
  - Edit dialog (name, role, active toggle, optional password reset; role/active hidden when editing yourself)
  - Deactivate (confirm dialog) / Reactivate actions
- Sidebar "System" section (visible to SUPER_ADMIN only) with Admins nav item
- `AdminView` interface added to `admin.model.ts`
- `listAdmins`, `createAdmin`, `updateAdmin`, `deactivateAdmin` methods added to `AdminApiService`

#### Register Form — Confirm Password
- Added "Confirm password" field to `RegisterComponent`
- Cross-field validator blocks submission if passwords don't match
- Error message shown only after field is touched

### Fixed

- **`NG0201: No provider for MessageService`** — Added `MessageService` to global providers in `apps/user-app/src/app/app.config.ts`, fixing blank page on all routes
- **`environment.prod.ts` hardcoded URLs** — Changed `authApiUrl`, `apiUrl`, `wsUrl` to `''` (relative), so API calls route through the nginx gateway in Docker dev
- **CORS origins** — Added `http://localhost` to `auth-service` and `api-service`; added `http://localhost:8080` to `admin-auth-service` and `admin-api-service`
- **`FRONTEND_URL` in `.env`** — Changed from `http://localhost:4200` to `http://localhost`; invite email links now point to the correct gateway URL
- **`admin-api-service` missing mail env vars** — Added `EMAIL_DRIVER`, `MAILHOG_HOST`, `MAILHOG_PORT`, `FRONTEND_URL` and `mailhog` depends_on to docker-compose; send-invite now works correctly
- **`InvitesComponent` CSS class names** — Corrected from user-app class names (`card`, `section-title`, `form-field`, `field-label`) to admin-app class names (`admin-card`, `admin-section-title`, `admin-form-field`, `admin-form-label`, `strategy-filter-tabs`, `filter-tab`)
- **502 after service rebuild** — Replaced static nginx `upstream` blocks with `set $upstream` variables + Docker DNS resolver; gateway now auto-recovers without reload

### Changed

- `docker-compose.infra.yml` — Added `user-app`, `admin-app`, `landing`, `gateway` services
- `layout.component.ts` — Nav sections now support `superAdminOnly` flag; System section hidden for non-super-admins
- `admin-api-service/package.json` — Added `bcryptjs` + `@types/bcryptjs` dependency

---

## [1.0.0] — 2026-03-01

### Added

- Full monorepo: Turborepo 2 + pnpm workspaces
- Shared packages: `shared-types`, `shared-db`, `shared-redis`, `shared-auth`, `shared-schemas`, `logger`
- All 13 NestJS services: `auth-service`, `admin-auth-service`, `api-service`, `admin-api-service`, `market-data-service`, `strategy-engine`, `order-service`, `paper-order-service`, `backtest-service`, `notification-service`, `bot-service`, `signer-service`, `mock-polymarket`
- Angular 21 user app (`apps/user-app/`) with full strategy builder (36 blocks), portfolio, social, backtests
- Angular 21 admin console (`apps/admin-app/`) with all management screens
- Static landing page (`apps/landing/`) with waitlist form
- Prisma 7.5.0 with two databases (`polyforge` + `polyforge_admin`), all migrations applied
- Docker Compose full-stack setup with Postgres, PgBouncer, Redis, MailHog
- Production infrastructure: Terraform (AWS VPC, EC2, RDS, ElastiCache, ECR, Secrets Manager, SES, CloudWatch)
- Invite-only launch gate with admin panel management
- Full test suite: Vitest unit/integration, Playwright E2E, k6 load tests
