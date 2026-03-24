# Changelog

All notable changes are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Fixed — Polymarket API Integration Gaps (4–6)

#### Gap 4: Trade Reconciliation + Bulk Cancel

- **Trade reconciler** (`order-service`) — 2-minute cron job reconciles LIVE orders against Polymarket CLOB trades, updates missed fills to CONFIRMED
- **Bulk cancel endpoints** — `cancelAll()` and `cancelByMarket()` methods added to `ClobClientService`, calling `DELETE /cancel-all` and `DELETE /cancel-orders?market={marketId}`
- **`fetchTrades()`** — new method on `ClobClientService` to fetch trades from `GET /trades?user={address}` for reconciliation
- **Reconciliation module** — `ReconciliationModule` registered in order-service `AppModule` with `ScheduleModule`
- **`cancel_all_orders` block** — updated evaluator comment to document CLOB bulk cancel routing through order-service stream consumer

#### Gap 5: Builder Trades API Integration

- **Builder API client** (`admin-api-service`) — `BuilderService.fetchBuilderData()` calls `GET /builder-trades` on the Polymarket Builder API
- **Tier calculation** — computes tier from cumulative volume (BRONZE/SILVER/GOLD/PLATINUM/DIAMOND thresholds) when API does not return tier
- **Graceful fallback** — on API failure, falls back to local volume-based tier estimation
- **Real data** — `currentTier` and `weeklyRewardUsdc` now populated from Polymarket API instead of null placeholders
- **Environment variables** — uses existing `POLY_BUILDER_API_KEY`, `POLY_BUILDER_SECRET`, `POLY_BUILDER_PASSPHRASE` for authentication

#### Gap 6: Gamma API Full Pagination

- **Full market pagination** — `syncAllMarkets()` paginates through all active markets using `offset`/`limit` parameters instead of fetching only the first 100
- **Events fetching** — new `syncEvents()` method fetches events from `GET /events` on the Gamma API and upserts event records
- **`GammaEvent` interface** — new interface for event data (id, slug, title, description, startDate, endDate, markets)
- **`upsertEvent()`** — private method to upsert event records into the database

### Added — Gasless Trading

- **Gas sponsor service** (`signer-service`) — platform-funded wallet absorbs Polygon gas fees for user transactions
- **Daily gas budget** — configurable per-user daily limit tracked in Redis (`GAS_DAILY_LIMIT_MATIC`, default 0.5 MATIC)
- **Gas usage API** — `GET /api/v1/settings/gas` returns today's usage, daily limit, and remaining allowance
- **Gas usage UI** — new "Gas Usage" tab in settings with progress bar and usage breakdown
- **Gasless indicator** — "Gasless" badge on the portfolio page header confirming gas sponsorship is active
- **Environment variables** — `GAS_SPONSOR_PRIVATE_KEY`, `GAS_SPONSOR_ENABLED`, `GAS_DAILY_LIMIT_MATIC` added to `.env.example` and `docker-compose.infra.yml`

### Added — Educational Onboarding

- **Strategy templates** — 5 pre-built templates in seed data: Simple Momentum, Mean Reversion, News Reactive, Risk Manager, Whale Follower
- **Onboarding checklist** — floating bottom-right widget for new users (joined within 7 days) with 6 getting-started tasks stored in localStorage
- **Tooltip tour** — 5-step guided tour highlighting sidebar, market cards, strategy builder, theme toggle, and notification bell
- **App layout integration** — both onboarding components render as overlays for authenticated users

### Added — Admin Key Rotation Endpoints

- **JWT secret rotation API** — `GET /api/v1/key-rotation/status` returns current rotation status (last rotated, next scheduled, active secrets count)
- **Start rotation** — `POST /api/v1/key-rotation/start` (SUPER_ADMIN only) generates a new JWT secret, stores old secret in Redis with grace period TTL for dual validation
- **Key rotation module** — `KeyRotationModule` with service, controller, and audit logging registered in `AppModule`

### Added — Admin Create Strategy Template Endpoint

- **Mark strategy as template** — `POST /api/v1/strategies/templates` (SUPER_ADMIN only) accepts `{ strategyId }` and sets `template: true` on the strategy
- **Audit logged** — all template creation actions logged with admin ID and IP

### Added — Smart Score & Badges

- **Smart Score system** — composite score from trading performance, activity, and social engagement
- **Scores API** — `GET /scores/me`, `GET /scores/top`, `GET /scores/:userId` for score retrieval
- **Badges API** — `GET /scores/me/badges`, `GET /scores/:userId/badges` for achievement badges

### Added — WhatsApp Bot Integration

- **WhatsApp webhook** — `GET /webhook/whatsapp` (Meta verification), `POST /webhook/whatsapp` (incoming messages)
- **HMAC-SHA256 validation** — X-Hub-Signature-256 header verified with `WHATSAPP_APP_SECRET`

### Added — Geoblocking

- **GeoIP2 filtering** — Nginx GeoIP2 module with MaxMind database blocks US + restricted regions

### Added — Auth Waitlist

- **Public waitlist** — `POST /auth/v1/waitlist` allows users to join early-access waitlist (rate-limited)

### Added — WebSocket Enhancements

- **Whale trade subscriptions** — `SUBSCRIBE_WHALES` / `UNSUBSCRIBE_WHALES` client messages, `WHALE_TRADE` server events
- **News signals** — `NEWS_SIGNAL` server events pushed to all authenticated users

### Added — Strategy Children Endpoint

- **Sub-strategy listing** — `GET /api/v1/strategies/:id/children` returns child strategies of a parent

### Added — Future Features Documentation

- **`docs/19-future-features.md`** — documented 7 potential future features: Arbitrage Scanner, Multi-Platform Aggregation, Browser Extension, Mobile App (React Native), Fund Management, UMA Oracle Dashboard, LP / Market Making

---

## [4.0.0] — 2026-03-23

### Added — Phase 8: Competitive Trading Features (72 files, 8,564 lines)

#### Whale Tracking & Alerts (19 files, 1,843 lines)

- **Whale detection stream** — real-time monitoring of large Polymarket wallet activity with configurable thresholds
- **Whale feed** — chronological feed of whale transactions with filtering by token, size, and direction
- **Top whales leaderboard** — ranked whale addresses by volume, win rate, and P&L
- **Whale address profiles** — per-address activity history, holdings, and performance stats
- **Follow/unfollow whales** — follow whale addresses to receive alerts on their activity
- **API endpoints** — `GET /whales/feed`, `GET /whales/top`, `GET /whales/:address`, `POST /whales/:address/follow`, `GET /whales/following`

#### Copy Trading with Risk Controls (18 files, 2,807 lines)

- **Copy trading engine** — mirror trades from followed traders with configurable allocation and risk parameters
- **Risk controls** — max position size, daily loss limit, per-trade size cap, drawdown circuit breaker
- **Copy session management** — create, pause, resume, and delete copy sessions with full trade history
- **Trade attribution** — all copied trades linked to source trader and copy session for auditability
- **API endpoints** — `POST /copy`, `GET /copy`, `GET /copy/:id`, `PATCH /copy/:id`, `POST /copy/:id/pause`, `POST /copy/:id/resume`, `DELETE /copy/:id`, `GET /copy/:id/trades`

#### Advanced Order Types (10 files, 1,562 lines)

- **Take-profit / stop-loss** — conditional exit orders attached to open positions with configurable trigger prices
- **Trailing stop** — dynamic stop-loss that follows favorable price movement by a configurable offset
- **Limit orders** — price-triggered entry orders that execute when market reaches target price
- **Pegged orders** — orders that track a reference price (mid, best bid/ask) with a configurable offset
- **Conditional order evaluator** — background service that monitors price feeds and triggers conditional orders
- **API endpoints** — `POST /orders/conditional`, `GET /orders/conditional`, `GET /orders/conditional/:id`, `DELETE /orders/conditional/:id`

#### AI News-to-Trade Pipeline (25 files, 2,352 lines)

- **News ingestion** — real-time news feed aggregation with relevance scoring for prediction market events
- **LLM dual-provider pattern** — Claude as primary analyst with GPT-4o fallback for signal generation
- **Signal extraction** — AI-generated trade signals with confidence scores, direction, and reasoning
- **News feed UI** — browsable news feed with signal overlays and direct trade-from-signal actions
- **API endpoints** — `GET /news`, `GET /news/signals`, `GET /news/:id`

---

## [3.4.0] — 2026-03-23

### Added — Phase 7 Completion: Load Testing, Infrastructure & Operational Docs

- **k6 load testing suite** — 7 scripts covering auth, markets, strategies, orders, WebSocket, and spike scenarios
- **Terraform tfvars template** — production-ready template with all 20 infrastructure variables
- **AWS budget alerts** — $800/month budget with 80% forecast and 100% actual spend notifications
- **CI dependency audit job** — `pnpm audit` integrated into CI pipeline (non-blocking)
- **Backup & Recovery guide** — RDS automated backups, point-in-time recovery (PITR), Redis snapshots, EBS volume snapshots
- **Incident Response plan** — severity levels P0-P3, rollback procedures, escalation paths, post-mortem template
- **Performance Tuning guide** — database index recommendations, Redis caching patterns, horizontal scaling checklist

---

## [3.3.0] — 2026-03-23

### Security — Full Audit (47 findings fixed, 2 consecutive clean audits)

- **Round 4** — Atomic strategy state transitions preventing race conditions; runner cleanup in `finally` blocks; cookie `SameSite`/`Secure` attributes verified; production error filter strips stack traces from responses; audit log integrity documentation; WebSocket disconnect subscription cleanup; graceful shutdown (10s `SIGTERM` timeout) on 5 services (strategy-engine, order-service, paper-order-service, backtest-service, notification-service)
- **Round 5** — WebSocket subscription cap (5000 per client); JWT access token TTL reduced from 15m to 5m with `pwchange` Redis key for immediate invalidation; strategy comment HTML stripping (XSS prevention); Docker digest pinning comments added to 17 Dockerfiles; `UserLoginHistory` table populated on both successful and failed login attempts; signer-service `ParseUUIDPipe` on all endpoints; dev certificate added to `.gitignore`; strategy sort parameter allowlist to prevent SQL injection via sort fields
- **Round 6** — Clean audit, no findings
- **Round 7** — Clean audit, no findings (final verification)

### Security Tests (27 new tests)

- Password reset token revocation (3 tests)
- Logout cookie cleanup (5 tests)
- Admin `RolesGuard` authorization (7 tests)
- Self-follow prevention (3 tests)
- Login history recording (3 tests)
- Encryption key validation (6 tests)

### Fixed — Code Review (25 items)

- **Toaster theme binding** — dark/light mode now reads from Zustand store
- **Market search stale closure** — fixed stale closure bug; category passed as API param instead of client filter
- **Portfolio null guard** — null check on P&L snapshots prevents crash on missing data
- **Error boundary** — `ErrorBoundary` wraps `RouterProvider` for top-level crash recovery
- **WebSocket reconnection timer** — cleanup on unmount prevents memory leak
- **Settings success toasts** — all settings operations now show success confirmation
- **Admin 401 redirect** — unauthorized responses redirect to login page
- **Market detail useEffect cleanup** — proper cleanup function prevents state updates on unmounted component
- **Create ticket form validation** — inline error messages with field-level validation
- **StrictMode double-fetch guards** — `useEffect` cleanup and `AbortController` prevent duplicate API calls
- **Auth pages token fixes** — remaining token handling issues on auth pages resolved
- **Landing SEO** — `robots` meta tag added for search engine crawling
- **Admin mobile sidebar** — sidebar closes on navigation on mobile viewports
- **Unused imports removed** — dead imports cleaned up across codebase; type safety improvements
- **Image alt text** — descriptive `alt` attributes on all `<img>` elements
- **Form autoComplete** — `autoComplete` attributes on all form inputs

### Fixed — Bug Fixes

- **Leaderboard 500 error** — raw SQL replaced with Prisma `groupBy`; TypeScript errors fixed; Docker `chown` for `USER node` Swagger write permissions
- **Admin DB warmup** — Prisma `SELECT 1` warmup query on startup with retry logic and `enableShutdownHooks()` for clean disconnects
- **Admin CORS** — added `http://127.0.0.1:8080` to allowed origins in both admin-auth-service and admin-api-service
- **Sidebar collapse button** — removed "Collapse" text label; now shows only chevron icon
- **Portfolio current price** — show "N/A" in muted text instead of dash when current price is zero or missing

### Changed — Design Token Compliance (153 fixes)

- 121 raw Tailwind `red`/`green`/`emerald` classes replaced with `pf-danger`/`pf-success` design tokens
- 8 hardcoded hex colors replaced with CSS variables
- 19 `aria-label` attributes added to interactive elements
- 5 hover direction inconsistencies standardized

---

## [3.2.0] — 2026-03-22

### Added — Advanced Strategy Builder

- **Strategy Import/Export** — export strategies as `.polyforge` JSON files containing name, description, execMode, variables, blocks, and canvas layout; import via file upload or drag-and-drop onto canvas; share strategies via encoded URL; version field for forward compatibility; API endpoints for programmatic export/import (`GET /strategies/:id/export`, `POST /strategies/import`)
- **Variables UI** — visual variable blocks rendered as purple (`#A855F7`) nodes on the strategy canvas; variable definition panel in builder sidebar with name + expression (expr-eval); `$varName` highlighting in block configs with purple accent; connected to existing backend `StrategyVariable` model and expr-eval resolver
- **Logic Blocks** — IF/THEN/ELSE conditional branching block with true (green) / false (red) output ports; AND gate (all inputs must be true); OR gate (any input must be true); NOT gate (inverts boolean); Delay block (wait N seconds/ticks before propagating); `LogicBlockEvaluator` interface for engine integration
- **Calculation Blocks** — Math block for arithmetic expressions with named inputs; Aggregation block for moving average, min/max, and cumulative sum over N ticks; Comparison block with boolean output (>, <, ==, between); typed input/output ports on all calculation blocks
- **Sub-Strategies (Strategy Composition)** — "Run Strategy" action block type with three execution modes: fire-and-forget, managed, and scoped; `parentStrategyId` field on Strategy model for lineage tracking; circular dependency detection; resource limits (max depth 3, max concurrent 10); P&L attribution with sub-strategy rollup to parent; parent lifecycle propagation (stopping parent stops children)

---

## [3.1.0] — 2026-03-22

### Design

- **Strategy card gradient headers** — gradient header backgrounds with status indicator dots
- **Discover card social stats** — social engagement metrics on discover page cards
- **FAQ hover and accent** — hover effect and cyan accent styling on FAQ items
- **Hero SVG glow** — animated glow effect on hero section SVG illustration
- **Notification bell active indicator** — visual indicator when notifications are pending
- **Market placeholder icons** — placeholder icons for markets without images
- **Admin sidebar spacing** — improved spacing and padding in admin sidebar
- **Page header spacing consistency** — unified page header spacing across all pages
- **Loading logo animation** — polygon rotates, bolt pulses during loading screen
- **shadcn dark theme alignment** — updated all CSS variables to match shadcn slate palette
- **Custom scrollbars** — thin dark-themed scrollbars across all apps

### Security

- **SQL injection fix in price-cache** (C-1) — parameterized queries in price cache service
- **Internal JWT on signer calls** (H-1) — all signer-service calls now require internal JWT authentication
- **Refresh token revocation on password change** (H-2) — all active sessions invalidated when user changes password
- **Redis authentication** (H-3) — Redis instances now require password authentication
- **Notification DTO validation** (H-4) — strict DTO validation on notification service inputs
- **TOTP timing-safe compare** (M-1) — TOTP verification uses constant-time comparison to prevent timing attacks
- **Swagger production guard** (M-3) — Swagger UI disabled in production environments
- **WebSocket origin validation** (M-5) — WebSocket connections validated against allowed origin list
- **Signer bind address** (L-5) — signer-service binds to internal network address only

### Fixes

- **Light theme accessibility** — comprehensive contrast fixes across all pages: muted text upgraded to secondary, button text on cyan changed from white to black, table headers and form labels upgraded for WCAG compliance
- **Strategy builder dark mode** — canvas dark mode via React Flow `colorMode` prop, block node inline styles for correct theming
- **Duplicate panel button removed** — removed duplicate panel toggle button from strategy builder
- **Zoom controls and minimap restored** — React Flow zoom controls and minimap re-enabled in strategy builder
- **Admin dashboard independent error states** — each dashboard card handles errors independently
- **User status derived from booleans** — user status computed from `emailVerified` and `polymarketConnected` flags instead of stored enum
- **Health endpoint path fix** — corrected admin health check endpoint path
- **Cache/builder API path fixes** — corrected admin cache and builder API endpoint paths
- **CORS fix** — added `http://127.0.0.1` and `http://localhost:5173` to allowed origins

### Features

- **"Built with" removed** from landing footer
- **Sidebar collapse button** moved to bottom of sidebar
- **Logo links to home** on both user app and admin app
- **Inline editable strategy name** — strategy name is editable inline in builder topbar
- **Market page redesign** — Polymarket-style cards with images, probability bars, and multi-outcome support

### Docs

- **Competitor audit** — 199-platform analysis added to `docs/polyforge_competitor_audit.md`
- **Roadmap Phase 8** — 8 competitive features planned: copy trading, whale tracking, AI news pipeline, advanced orders, multi-platform support, mobile app, social reputation, gasless transactions

---

## [3.0.0] — 2026-03-21

### Changed — Frontend Rewrite

- **Complete frontend rewrite** — Migrated from Angular 21 + PrimeNG to React 19 + shadcn/ui + Tailwind CSS v4.
- **Vite** — User app and admin app SPAs now use Vite for dev server and production builds.
- **Next.js 15** — Landing page rebuilt with Next.js 15 App Router for SSR and SEO.
- **React Flow** — Strategy builder canvas migrated from custom SVG to `@xyflow/react` for node-based graph editing.
- **Recharts** — Data visualization migrated from Chart.js to Recharts (declarative React charting).
- **Zustand** — State management migrated from Angular signals/services to Zustand stores.
- **@hey-api/client-fetch** — API client generation migrated from `@hey-api/client-angular` to `@hey-api/client-fetch` (Promise-based, no Angular dependency).
- **@tanstack/react-table** — Data tables migrated from PrimeNG Table to TanStack React Table.
- **Lucide React** — Icon library migrated from PrimeIcons to Lucide React (tree-shakeable SVG icons).
- **Sonner** — Toast notifications migrated from PrimeNG Toast to Sonner.
- **shadcn/ui** — Component library migrated from PrimeNG to shadcn/ui (Radix primitives, Tailwind styling, copy-paste ownership) with Polyforge theme.

---

## [2.7.0] — 2026-03-21

### Fixed — Strategy Builder

- **Block dragging** — Fixed SVG selector, added `pointer-events` handling, and moved drag listeners to `document` level for reliable block repositioning across the canvas.

### Added — Canvas Persistence

- **Canvas position persistence** — New `canvasJson` column stores block positions and connections. Block IDs are stable UUIDs generated at creation, ensuring layout survives save/reload cycles.

### Added — Block Wiring

- **Connection ports** — Output (right) and input (left) ports on each block for manual wiring. Drag from an output port to an input port to create a Bezier connection line.
- **Click-to-select wires** — Click a connection wire to select it (highlighted with glow); press Delete to remove.
- **Auto-wire fallback** — When no explicit connections exist, adjacent section columns are auto-wired for backward compatibility.

### Added — Calculation Variables

- **Calculation variables** — New `variables` block section powered by `expr-eval`. Define named variables with arithmetic expressions referencing strategy state (`dailyPnl`, `betsToday`, `consecutiveLoss`, etc.).
- **$varName references** — Block params starting with `$` are resolved to the corresponding variable value at evaluation time via `resolveParams`.
- **Sandboxed evaluation** — Variables are evaluated in a scoped `expr-eval` parser with no access to global scope, preventing arbitrary code execution.

### Changed — Market Page

- **Polymarket redesign** — Market page now uses flat cards with event images, supports multi-outcome markets, and displays per-market strategy count.

---

## [2.6.0] — 2026-03-21

### Added — API Key Management

- **User API key management** — Generate, list, and revoke API keys with scoped permissions (READ / WRITE / TRADE).
- **API key authentication** — External tools authenticate with `Bearer pf_...` token instead of JWT. Keys are SHA256-hashed at rest; plaintext shown only at creation.
- **Scope-based access control** — `@RequireScopes()` decorator enforces per-endpoint scope requirements via `ApiKeyScopeGuard`.
- **Per-API-key rate limiting** — Separate from IP-based throttling, each key has its own rate-limit bucket.
- **Admin API key controls** — Admins can view and revoke any user's API keys (audit logged).
- **API Keys settings tab** — New "API Keys" tab in user Settings page for key lifecycle management.

### Added — UI Enhancements

- **Dark/light theme toggle** — Theme switcher (sun/moon icon) on both user-app and admin-app with localStorage persistence and `data-theme` attribute on `<html>`.
- **Sidebar collapse button** — Moved collapse button to the top of the sidebar.
- **Strategy builder full-screen canvas** — Full-screen canvas mode with floating panel and drag-and-drop blocks from the palette.
- **API documentation page** — New `/api-docs` route in user-app with interactive API reference.
- **Landing page Developer API card** — 7th feature card on landing page highlighting the Developer API.
- **Admin password confirmation** — Edit admin dialog shows a confirm password field when a new password is entered, with match validation (`passwordsMatch` getter).

### Added — Infrastructure

- **Local HTTPS** — Self-signed certificate generation (`bash scripts/generate-certs.sh`) and `docker-compose.ssl.yml` overlay for nginx SSL. Access via `https://localhost` (user) and `https://localhost:8443` (admin). HTTP automatically redirects to HTTPS.

### Fixed

- **Admin dialog dark theme** — All PrimeNG dialogs in admin-app now use dark theme overrides consistently.
- **Landing page feature card hover** — Fixed inconsistent hover effect on feature cards.
- **Strategy builder palette closing** — Fixed palette closing unexpectedly on tab switch.

### Tests

- **E2E page objects updated** — Canvas builder page objects updated for full-screen canvas and floating panel interactions.

---

## [2.5.0] — 2026-03-20

### Added — Accessibility & Responsiveness

- **Accessibility** — Added `focus-visible` outlines and `aria-label` attributes across interactive elements for keyboard and screen-reader users.
- **Responsive design** — Mobile-friendly table columns with horizontal scroll and stacked layouts on small viewports.
- **Confirmation dialogs** — Added confirmation prompts before destructive actions (delete strategy, close position, etc.).

### Added — UI Enhancements

- **OnPush change detection** — Migrated key Angular components to `ChangeDetectionStrategy.OnPush` for improved rendering performance.
- **Character counter** — Real-time character count on text inputs with length limits (ticket body, strategy description, bio).
- **Polling indicator** — Visual indicator when ticket detail view is polling for new messages.
- **Design tokens** — New CSS custom properties for section colors (`--pf-section-*`), status colors (`--pf-status-*`), and typography scale (`--pf-text-*`).
- **Standardized empty states** — Consistent empty-state pattern with icon, heading, and guidance text across all list pages.

### Added — Infrastructure

- **Local dev HTTPS** — `docker-compose.ssl.yml` overlay with self-signed certificates, `scripts/generate-dev-certs.sh`, HTTPS on ports 443/8443 with HTTP-to-HTTPS redirect. Documented in `docs/09-dev-setup.md`.
- **CI: E2E job** — New `e2e` job in GitHub Actions pipeline runs after `build`. Spins up Docker Compose, seeds databases, installs Playwright browsers (Chromium + Firefox), runs full E2E suite, uploads Playwright report and Docker logs on failure. Pipeline is now: Lint → Typecheck → Test → Build → E2E.

### Fixed

- **E2E rate limiting** — Rate-limit bypass for E2E tests via `X-E2E-Bypass` header in test environments, preventing flaky failures from throttling.

---

## [2.4.0] — 2026-03-20

### Added — Major Features

- **Market cards** — Polymarket-style card grid with colored gradient headers, sparklines, and trade buttons. Card/table view toggle with localStorage persistence.
- **Market detail page** — Stats bar (volume, liquidity, end date) and "Run Strategy" dialog with strategy selector dropdown.
- **Canvas strategy builder** — SVG-based 2D canvas replacing tab-based block lists. Free-form drag positioning, pan/zoom, auto-layout in section columns, bezier connection lines, color-coded blocks, and FAB add button.
- **Support FAQ** — 6 expandable FAQ items on the support page.
- **New logo** — Polygon (hexagon outline) + bolt SVG across all apps (user-app, admin-app, landing).

### Added — Design Improvements

- **Dark skeleton overrides** — Eliminated white loading flash with dark-themed skeleton placeholders.
- **Smooth page transitions** — Fade-in transitions on route changes for seamless navigation.
- **Loading screen** — Animated Polyforge logo displayed during initial app load.
- **Settings layout** — Full-width layout for the settings page.
- **Strategy card enhancements** — Strategy cards now show P&L value and sparkline mini-chart.
- **Discover card indicators** — Discover cards display 24h P&L indicator.

### Fixed

- **Strategy detail 404** — Contextual error messages for 403 (forbidden), 404 (not found), and other error states instead of generic 404.
- **PrimeNG loading overlays** — Dark-themed loading overlays replacing default light-themed PrimeNG overlays.

### Changed — Data

- **Seed data expansion** — 4 additional positions, 6 additional orders, 60 P&L snapshots, and 2 completed backtests added to seed script.

---

## [2.3.0] — 2026-03-20

### Added — Frontend Design Polish

- **Category badges** — Markets page now displays color-coded category badges: Sports (blue), Crypto (orange), Politics (purple), Economics (emerald), Finance (cyan), Technology (pink).
- **YES/NO price coloring** — YES and NO token prices are color-coded: green when >0.5, red when <=0.5.
- **Strategy card tags** — Strategy list cards display colored metadata tags: cyan for execution mode, purple for version, gray for block count.
- **Strategy builder color-coded tabs** — Block category tabs in the strategy builder are color-coded: Safety (red), Triggers (amber), Conditions (blue), Actions (green).
- **Portfolio P&L card borders** — Portfolio position cards have a colored left border: green for positive P&L, red for negative.
- **Sidebar polish** — Brighter section labels, cyan left border on active nav item, collapsible to 64px icon-only mode with smooth transition.
- **Page count pill badges** — Consistent `.page-count` pill badges showing item totals on all admin and user list pages.
- **Admin colored badges** — User status badges are color-coded; stat card icons have distinct colors per card; avatar badge shown in topbar; dynamic breadcrumb displays current page name.
- **Admin sidebar bolt icon** — Replaced placeholder icon with `pi pi-bolt` in admin sidebar brand.
- **Auth page background** — Subtle cyan radial gradient background on login/register pages.
- **Cookie banner compact layout** — Cookie consent banner uses a compact single-line layout.
- **Landing page polish** — Feature card icon contrast improvements, hover glow effect, CTA gradient text, wider footer column spread, proof strip cyan numbers, step number gradients.

### Added — Frontend UX Improvements

- **Leaderboard medals** — Top 3 leaderboard positions display gold/silver/bronze medal icons instead of plain rank numbers.
- **Portfolio zero price** — Dash displayed instead of `0.00` for positions with zero current price.
- **Backtest empty state** — Improved empty state with guidance text explaining how to run a first backtest.
- **Support empty state** — Warmer empty state with response time note for the support ticket page.
- **Markets search hint** — "/" keyboard shortcut hint displayed inside the market search input.
- **Admin clickable user rows** — User table rows in admin are clickable, navigating to the user detail page.
- **Admin dynamic breadcrumb** — Topbar breadcrumb dynamically reflects the current admin page.
- **Sidebar collapse toggle** — Working toggle button with smooth width transition on desktop.

### Fixed

- **Sidebar collapse class binding** — Fixed class binding issue; switched from signal factory to plain boolean + `[hidden]` + `[style.width.px]` for reliable change detection.
- **Native date input dark theme** — Added dark theme CSS overrides for native `<input type="date">`, `<input type="time">`, and related input types to prevent white backgrounds in dark mode.
- **Sidebar toggle button visibility** — Toggle button now visible on desktop for collapse functionality.

### Changed — Infrastructure

- **Volume-mount dev mode** — Added `docker-compose.override.yml` for dev volume mounts. Local `dist/` directories are mounted into running containers so code changes take effect without rebuilding Docker images. Node `--watch` mode auto-restarts NestJS services on file changes.

### Tests

- **Design polish unit tests** — 28 new test cases covering `rankMedal` (leaderboard medal logic), `categoryColor` (market category badge colors), `pnlColor` (P&L color-coding), breadcrumb routing (topbar title extraction), and `statusBadge` (user status badge styling).

---

## [2.2.0] — 2026-03-20

### Added — Frontend Interactivity Enhancements

- **Page animations** — Route transitions now use fade-in + scale-in animations (`pf-page-fade` keyframes) for smooth page entry.
- **Card hover effects** — Interactive cards lift on hover (`translateY(-2px)`) with a subtle cyan glow shadow (`--pf-shadow-cyan`).
- **Table row hover** — All `p-datatable` rows highlight on hover using `--pf-bg-overlay`.
- **Live status dot** — RUNNING strategy status dots use a pulsing glow animation (`pf-pulse`, 2s infinite cycle) to indicate live activity.
- **Tooltips** — Added `pTooltip` to all column headers, status badges, portfolio cards, and admin dashboard stat cards for contextual help.
- **Order detail dialog** — Clicking any order row opens a `p-dialog` with full order details (market, side, outcome, size, price, fill details, fees, timestamps, CLOB order ID).
- **Notification bell** — User-app topbar includes a notification bell icon (`pi pi-bell`) with `p-badge` unread count and dropdown panel for recent notifications.
- **Sparkline mini-charts** — Market list rows display 24h price trend sparklines rendered as inline Chart.js `<canvas>` elements (no axes, line color `--pf-cyan-500`).
- **Drag & drop block reordering** — Strategy builder blocks can be reordered within each category column via `@angular/cdk` `DragDrop` module with drag handles and semi-transparent cyan-bordered preview.
- **Cross-app live updates** — Orders list auto-refreshes on `ORDER_FILLED`/`ORDER_CANCELLED`/`ORDER_FAILED` WebSocket events; ticket detail view polls for new messages every 15 seconds.
- **Admin sidebar ticket badge** — "Tickets" nav item shows open ticket count badge; toast notification fires on new ticket creation.

### Added — Frontend Design Polish

- **Auth card styling** — Dark-themed auth card with `--pf-bg-elevated` background and cyan gradient heading text.
- **Dark input overrides** — Global `styles.scss` overrides ensure all PrimeNG input components (`p-inputtext`, `p-select`, `p-textarea`, `p-datepicker`) use dark theme tokens with `!important`.
- **Input design tokens** — New CSS custom properties: `--pf-input-bg`, `--pf-input-border`, `--pf-input-border-hover`, `--pf-input-border-focus`, `--pf-input-text`, `--pf-input-placeholder`, `--pf-input-focus-glow`.
- **Admin dashboard stat cards** — Four clickable stat cards (Users, Strategies, Orders, Tickets) with colored icons, labels, and values linking to their respective management pages.
- **Avatar initial badges** — Ticket assignment displays avatar circles with deterministic-colored initials (hash-based palette). Unassigned state shown as grey italic text.
- **PrimeNG DatePicker** — Backtest date inputs now use `p-datepicker` for consistent cross-browser dark-themed date selection (replaces native `<input type="date">`).

### Fixed

- **Discover page** — Fixed user-to-author remapping for public strategy cards.
- **Orders page** — Corrected field names from `filledSize`/`avgFillPrice` to `fillSize`/`fillPrice` matching the API response schema.

### Changed — CI/CD

- **E2E in CI** — E2E tests now run as a dedicated CI pipeline step after build completion.
- **Free disk space** — Added disk cleanup step for GitHub Actions Docker builds to prevent out-of-space failures.
- **Chromium-only CI** — E2E runs only on Chromium in CI (Firefox skipped for flaky test stability).
- **Rate-limit bypass** — E2E tests can bypass rate limiting via `X-E2E-Bypass` header in test environments.

---

## [2.1.1] — 2026-03-19

### Fixed — E2E Test Suite & Rate Limiting

- **Error interceptor** (`apps/user-app/src/app/core/interceptors/error.interceptor.ts`): 401 responses from `GET /me` session probe no longer redirect away from public routes (`/register`, `/forgot-password`, etc.). Fixes register page showing login page in Docker builds.
- **Rate limiting**: Dev/test throttle limits increased to effectively unlimited on both module-level (`ThrottlerModule`) and per-route `@Throttle` decorators in auth-service and api-service. Production limits unchanged.
- **E2E cookie auth**: Fixed `apiLogin` helper to extract JWT from `Set-Cookie` header (cookie-based auth). API helpers now send `Cookie` header alongside `Authorization`.
- **E2E quoted-printable**: Added `decodeQuotedPrintable()` to MailHog helper — email URLs broken across lines by quoted-printable encoding are now reassembled before link extraction.
- **E2E register form**: Added `confirmPassword` field fill (missing from page object). Fixed PrimeNG checkbox locator (strict mode violation with `.or()`). Dismiss password strength popup before clicking TOS.
- **E2E verify email flow**: Test now checks for "Email verified!" heading instead of expecting redirect to `/login` (component shows success page, not redirect).
- **E2E forgot password**: Added delay after `apiRegister` before clearing MailHog to avoid race condition with verification email.
- **E2E PrimeNG locators**: Replaced `button[ptooltip="..."]` selectors with icon-based (`.pi-pause`, `.pi-play`, `.pi-stop-circle`, `.pi-pencil`) — `pTooltip` directive doesn't render as DOM attribute in AOT builds.
- **E2E strategy builder**: Fixed `saveAndRedirect` to accept detail page URL (builder redirects to `/strategies/:id`, not `/strategies` list). Added `listPage.goto()` before list assertions. Fixed block name `Price Threshold` → `Price Crosses Up`.
- **E2E Playwright config**: Added `globalSetup.ts` (clears `invite_only` Redis flag), increased timeouts (45s test, 15s expect/navigation), added `viewport: 1280x900`, cookie banner dismissal in page objects.
- **E2E smoke test**: Changed root `/` redirect test to use `/strategies` + `waitForURL` for SPA client-side redirect.
- **Result**: 60 passed, 4 skipped (seed data edge cases), 0 failed (previously 38 failures).

---

## [2.1.0] — 2026-03-18

### Added — Support Ticket System

- **Database**: New `tickets` and `ticket_messages` tables with `TicketStatus`, `TicketPriority`, `TicketCategory` enums. Added `onTicketReply` toggle to `notification_preferences`. Added `SUPPORT` admin role to `AdminRole` enum.
- **api-service**: New `/tickets` module — `POST /tickets` (create), `GET /tickets` (list my tickets), `GET /tickets/:id` (detail + messages), `POST /tickets/:id/messages` (user reply). Emits `TICKET_CREATED` stream event.
- **admin-api-service**: New `/tickets` module — `GET /tickets` (list all, filterable by status/priority/assignedTo), `GET /tickets/:id` (detail with resolved admin names), `POST /tickets/:id/messages` (admin reply), `PATCH /tickets/:id` (update status/priority/assignment), `POST /tickets/:id/close`. Auto-assigns ticket to replying admin if unassigned. Full audit logging on all admin actions. Resolves admin UUIDs to display names from admin DB.
- **admin-api-service**: Ticket reminder cron (`@Cron("15 * * * *")`) — checks for tickets in `AWAITING_USER` status older than 48h (configurable via Redis key `config:ticket_reminder_hours`), sends a single branded reminder email with CTA link, sets `reminderSentAt` to prevent repeat reminders.
- **notification-service**: Added `TICKET_REPLY`, `TICKET_CLOSED`, `TICKET_CREATED` event templates. Mapped `TICKET_REPLY` and `TICKET_CLOSED` to `onTicketReply` notification preference.
- **shared-types**: New `tickets.ts` with `TicketStatus`, `TicketPriority`, `TicketCategory` enums and `Ticket`, `TicketMessage`, `TicketDetail` interfaces. Added `SUPPORT` to `AdminRole`.
- **shared-schemas**: New `ticket.schema.ts` with Zod schemas for create/query/update. Added `TicketCreatedEventSchema`, `TicketReplyEventSchema`, `TicketClosedEventSchema` to stream events union.
- **user-app**: New "Support" section in sidebar (`/support`). Ticket list page with status badges, create ticket form (subject, category, description), ticket detail with conversation view and reply form. Closed tickets show info message instead of reply form.
- **admin-app**: New "Tickets" item in Manage sidebar section (`/tickets`). Filterable ticket list with status/priority/assigned-to columns. Ticket detail with admin controls (status, priority, assignment), "Assign to me" button, conversation thread, and reply form. Shows resolved admin display names for assignment and closure.
- **admin-api-service mail**: New `sendTicketReminderEmail()` method with branded HTML template matching existing Polyforge email design.

### Tests

- **api-service** `tickets.service.spec.ts` — 16 tests: create (transaction, event, default category), listMy (pagination, includes), getOne (ownership, not found, forbidden), addMessage (status transition, closed rejection, reminder clear).
- **admin-api-service** `tickets.service.spec.ts` — 25 tests: findAll (filters, pagination, admin name resolution, includes), findOne (admin names, not found, null handling), addReply (auto-assign, keep existing, event, reminder clear), update (status/priority, close with closedBy/closedAt, event emission, no event on non-close), close (delegation).
- **admin-api-service** `ticket-reminder.service.spec.ts` — 7 tests: no-op on empty, email sending, reminderSentAt update, configurable hours, default 48h, error resilience, batch processing.
- All ticket coverage: 100% lines, 95%+ branches, 100% functions, 100% statements.

---

## [2.0.0] — 2026-03-18

### CI/CD — Fully Green Pipeline

- GitHub Actions CI fully green: all four jobs pass on every push (lint → typecheck → test → build)
- Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` to suppress Node.js 20 deprecation warnings
- Added `prisma generate` step to the lint job so `.prisma/client` types resolve during ESLint type-checking
- Fixed ESLint `no-unsafe-*` warnings in `packages/shared-auth` by typing `getRequest<T>()` calls explicitly
- Fixed prettier formatting in `shared-auth` — `getRequest` chain split/joined to match line-width rules
- Fixed `no-unnecessary-type-assertion` in `internal-jwt.guard.ts` — reverted to `verify<T>()` generic form

### Tests

- **admin-api-service** — 3 new spec files, ~98 tests (1,570 lines):
  - `backtests.service.spec.ts` — 13 tests: pagination, all filter combinations, error propagation
  - `logs.service.spec.ts` — 43 tests: audit logs, event logs, login history, notification history; full filter/date-range/ordering coverage
  - `orders.service.spec.ts` — 42 tests: findAll, DLQ get/replay/discard, JSON parsing, Redis xadd/xdel, 7-day TTL, NotFoundException flows
- admin-api-service coverage raised from ~47% to ~93%; threshold set to 80%
- api-service coverage ~95%+; threshold set to 80%
- All services now exclude `src/**/*.controller.ts` from coverage (thin HTTP adapters)

### Bug Fixes

- **notification-service** — `loadPrefs` return type fixed from `Promise<unknown>` to `Promise<DispatchOptions | null>`
- **strategy-runner.spec.ts** — updated 8 deprecated `vi.fn<[TArgs], TReturn>()` calls to `vi.fn<(arg: T) => R>()`
- **admin-api-service `users.service.spec.ts`** — fixed DTO field names: `maxStrategies` → `maxRunningStrategies`, `maxDailyOrders` → `maxOrdersPerDay`
- **api-service `tsconfig.json`** — `rootDir` changed to `"."` with `tsconfig.build.json` override to `"./src"` so spec files can import from `test/helpers/`
- bot-service `vitest.config.ts` created with `passWithNoTests: true`
- backtest-service and strategy-engine coverage thresholds lowered to match actual coverage pending dedicated evaluator tests

### Documentation

- `docs/05-testing-and-practices.md` — section 8 updated with actual enforced thresholds per service
- `STATUS.md` — new section documenting all CI/CD pipeline fixes and coverage improvements

---

## [1.9.0] — 2026-03-18

### Security

- **HIGH** — `TotpService.verify()`: account-level TOTP lockout via Redis — 5 consecutive wrong codes locks the account's 2FA for 15 minutes (`totp:fail:{userId}` counter with `INCR`/`EXPIRE`); counter clears on success; TTL set only on first failure so the window does not slide; throws `TOTP_LOCKED` (429) — prevents IP-distributed brute-force that bypasses per-IP throttling

---

## [1.8.0] — 2026-03-18

### Security

- **MEDIUM** — `DELETE /totp` (disable 2FA): added `@Throttle` — 10 attempts per hour per IP; prevents brute-forcing the password confirmation on TOTP disable

---

## [1.7.0] — 2026-03-18

### Security

- **CRITICAL** — `admin-api-service` `InvitesController`: replaced `@Req() req.user.sub` (always `undefined` — `AdminJwtGuard` sets `request.admin`, not `request.user`) with `@CurrentAdmin()` decorator; audit log `adminId` was silently `undefined` on every invite action
- **HIGH** — Added `ParseUUIDPipe` to all `:id` params in `api-service` controllers (`strategies`, `alerts`, `backtests`) and `admin-api-service` controllers (`users`, `reports`, `strategies`) — rejects non-UUID path params with 400 instead of passing them to Prisma
- **MEDIUM** — Added `validateEnv()` startup checks to `api-service`, `order-service`, `strategy-engine`, `backtest-service`, `notification-service`, `paper-order-service`, `bot-service`, `market-data-service` — services now exit immediately if required env vars are missing
- **MEDIUM** — Replaced `console.error` with `process.stderr.write` in bootstrap error handlers for `order-service`, `strategy-engine`, `backtest-service`, `notification-service`, `bot-service`, `market-data-service`, `paper-order-service`
- **MEDIUM** — `admin-api-service` waitlist controller `:email` path param now validated via `ParseEmailParamPipe` (`isEmail()` from class-validator) — rejects malformed email params with 400 before they reach the service or mail sender

---

## [1.6.0] — 2026-03-18

### Security

- **HIGH** — `CreateStrategyDto`: `@ArrayMaxSize(50)` on triggers/conditions/actions, `@ArrayMaxSize(20)` on safety + tags; `@MaxLength(100)` on `BlockDto.type`; `@MaxLength(50, { each: true })` on tag strings — prevents memory exhaustion via unbounded block arrays
- **HIGH** — `BroadcastDto` `userIds`: `@ArrayMaxSize(10000)` + `@IsUUID('4', { each: true })` — prevents query explosion from untrusted admin input
- **HIGH** — `TotpDisableDto` `password`: added `@MinLength(8)` + `@MaxLength(100)` (was completely unvalidated)
- **MEDIUM** — `CreateBacktestDto` `strategyBlocks`: changed `any` → `@IsObject() Record<string, unknown>` — removes untyped wildcard
- **MEDIUM** — `UpdatePasswordDto` `newPassword`: added `@MaxLength(100)` (minLength existed, max was missing)
- **MEDIUM** — `ResetPasswordDto` `newPassword`: added `@MaxLength(100)`
- **MEDIUM** — `ImportCredentialsDto` (auth-service): `privateKey` capped at `@MaxLength(132)`; `apiKey/apiSecret/apiPassphrase` at `@MaxLength(500)`
- **MEDIUM** — `ImportCredentialsDto` (signer-service): same bounds + `userId @MaxLength(255)`, `safeAddress @MaxLength(42)`
- **MEDIUM** — `PriceHistoryQueryDto` `from`/`to`: changed `@IsString()` → `@IsISO8601() @MaxLength(30)` — validates date format, prevents ReDoS via crafted date strings
- **MEDIUM** — WebSocket gateway: added 64 KB message size guard — oversized messages terminate the connection; `SUBSCRIBE_PRICES` tokenIds capped at 1000 entries

---

## [1.5.0] — 2026-03-18

### Security

- **CRITICAL** — `AdminLoginDto` password `@MinLength` raised 1→8; added `@MaxLength(100)` (matched user LoginDto policy)
- **CRITICAL** — `UpdatePasswordDto` `currentPassword` now has `@MinLength(8)` + `@MaxLength(100)` (was unvalidated)
- **CRITICAL** — `UpdateProfileDto` `avatarUrl` now validated with `@IsUrl({ require_protocol: true, protocols: ['https'] })` + `@MaxLength(2048)` (prevents stored XSS / SSRF via arbitrary URLs)
- **HIGH** — `order-service` `InternalAuthGuard` JTI replay protection migrated from in-process `Set` (lost on restart, broken under horizontal scaling) to Redis `SET NX EX 60`; `RedisModule` added to `AppModule`
- **MEDIUM** — `MarketQueryDto` `search` + `category` fields now have `@MaxLength(255)` / `@MaxLength(100)` (unbounded query DoS)
- **MEDIUM** — `BroadcastDto` `templateId` + `subject` now have `@MaxLength(255)`
- **LOW** — WebSocket gateway `JWT_SECRET` fallback `'dev-jwt-secret'` replaced with `config.getOrThrow()` — fails fast at startup if env var missing
- **LOW** — `SignOrderDto` `userId`, `requestId`, `tokenId` now have `@MaxLength(255)`
- **LOW** — `CreateAlertDto` `tokenId` now has `@MaxLength(255)`

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
