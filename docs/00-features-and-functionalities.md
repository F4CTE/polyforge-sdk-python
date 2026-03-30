# Polyforge — Functionalities & Features

> Complete list of every feature to build in Polyforge v1.  
> This document serves as the product specification and development backlog.

---

## Table of Contents

1. [User Account & Authentication](#1-user-account--authentication)
2. [Polymarket Credential Management](#2-polymarket-credential-management)
3. [Market Browser](#3-market-browser)
4. [Strategy Builder](#4-strategy-builder)
5. [Strategy Execution (Live Trading)](#5-strategy-execution-live-trading)
6. [Paper Trading](#6-paper-trading)
7. [Backtesting](#7-backtesting)
8. [Portfolio & Positions](#8-portfolio--positions)
9. [Orders](#9-orders)
10. [Price Alerts](#10-price-alerts)
11. [Social Features](#11-social-features)
12. [Notifications](#12-notifications)
13. [Telegram & Discord Bots](#13-telegram--discord-bots)
14. [User Settings](#14-user-settings)
15. [Admin Panel](#15-admin-panel)
16. [Platform Infrastructure](#16-platform-infrastructure)
17. [Support Ticket System](#17-support-ticket-system)
18. [Advanced Strategy Builder (v3.2+)](#18-advanced-strategy-builder-v32)
19. [Smart Score & Badges](#19-smart-score--badges)
20. [Gas Sponsorship](#20-gas-sponsorship)
21. [Educational Onboarding](#21-educational-onboarding)
22. [WhatsApp Bot](#22-whatsapp-bot)
23. [Geoblocking](#23-geoblocking)
24. [Prediction Accuracy & Calibration](#24-prediction-accuracy--calibration-v6150)
25. [AI Portfolio Optimizer](#25-ai-portfolio-optimizer-v6150)
26. [Sentiment Intelligence](#26-sentiment-intelligence-v6150)
27. [LP / Market Making](#27-lp--market-making-v6150)

---

## 1. User Account & Authentication

### Registration
- User registers with email, password, and username
- Password requirements: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit
- Username: 3–30 chars, alphanumeric + underscore only
- User must accept Terms of Service at registration (checkbox required)
- Verification email sent immediately after registration
- JWT token returned on successful registration (user can browse immediately)

### Email Verification
- Verification link sent to the registered email (24h TTL)
- Clicking the link verifies the account and upgrades access
- User can request a new verification email if the link expired

### Login
- Login with email + password
- If 2FA is enabled, TOTP code required as a second step
- A short-lived temporary token is returned after the password step when 2FA is enabled — the final token is only issued after TOTP confirmation
- Friendly error messages for: invalid credentials, suspended account, TOTP required

### Password Reset
- User requests a reset via email
- Response is always "If that email exists, a reset link has been sent" (prevents email enumeration)
- Reset link is single-use with 1h TTL
- After reset, all existing sessions are invalidated

### Two-Factor Authentication (2FA / TOTP)
- User can enable 2FA from Settings
- QR code + raw secret displayed for authenticator app setup
- 10 one-time backup codes generated at enrollment (stored hashed)
- User must confirm with a valid TOTP code before 2FA is activated
- User can disable 2FA by providing their current password
- Backup codes usable in place of a TOTP code

### Session Management
- JWT tokens with 7-day lifetime (users)
- Explicit logout endpoint that invalidates the session
- Account suspended users receive a clear error message with no access

### User States

| State | Triggers | Access |
|---|---|---|
| Unverified | Just registered | Browse markets only |
| Verified | Email confirmed | Backtest + Paper trade + Strategy builder |
| Connected | Polymarket credentials imported | All features including live trading |

---

## 2. Polymarket Credential Management

### Credential Import
- User imports their existing Polymarket credentials (API key, secret, passphrase, private key)
- Optional Safe address for sig_type 1 and 2
- Credentials validated against Polymarket API before storing
- Credentials encrypted with AES-256-GCM envelope encryption (see architecture doc)
- Plaintext credentials are never persisted anywhere
- Transition to "Connected" status on success

### Credential Removal
- User can remove their Polymarket credentials at any time
- All running live strategies are stopped before credentials are deleted
- Account reverts to "Verified" status

---

## 3. Market Browser

### Market List
- Paginated list of all active Polymarket binary markets
- Each market shows: title, category, YES/NO prices, 24h volume, liquidity, closing date
- Filter by series (e.g., US Elections 2026, Sports, Crypto)
- Full-text search on market title
- Sort by: volume, liquidity, closing soon, newest

### Market Detail
- Full market description
- YES and NO token prices and liquidity
- Order book (best bids and asks, spread, midpoint)
- OHLCV price history chart (resolutions: 1m, 1h, 1d)
- Ability to set a price alert on any token

---

## 4. Strategy Builder

### Block-Based Editor
- Drag-and-drop visual editor with 36 blocks across 4 categories
- Blocks are organized in 4 columns: SAFETY → TRIGGERS → CONDITIONS → ACTIONS
- Each block has a configuration panel with appropriate fields (market picker, number inputs, etc.)
- Strategy canvas auto-validates block combinations and highlights errors

### Strategy Settings
- Strategy name and description
- Execution mode: EVENT, TICK, or HYBRID
- Tick interval (min 200ms) — only visible in TICK/HYBRID mode
- Visibility: PRIVATE, PUBLIC, UNLISTED
- Tags (for discovery filtering)

### Block Registry (36 blocks)

**TRIGGERS — Event-based (6 blocks)**
| Block | Config |
|---|---|
| `new_bet_opens` | Series slug — fires when a new market opens in a series |
| `price_crosses_up` | Token ID + threshold — fires when price crosses upward |
| `price_crosses_down` | Token ID + threshold — fires when price crosses downward |
| `time_before_close` | Minutes before market close |
| `win_streak` | Count — fires after N consecutive wins |
| `loss_streak` | Count — fires after N consecutive losses |

**TRIGGERS — Tick-based (7 blocks)**
| Block | Config |
|---|---|
| `price_above_tick` | Token ID + price threshold |
| `price_below_tick` | Token ID + price threshold |
| `spread_below_tick` | Token ID + max spread |
| `volume_rate_tick` | Token ID + min rate |
| `price_momentum_tick` | Token ID + direction + threshold |
| `rsi_threshold_tick` | Token ID + period + level + direction |
| `every_tick` | No config — fires on every tick |

**CONDITIONS (9 blocks)**
| Block | Config |
|---|---|
| `min_liquidity` | Minimum USDC liquidity in order book |
| `max_position` | Maximum USDC position size |
| `max_bets_per_day` | Maximum trades per day |
| `daily_loss_limit` | Maximum loss in USDC per day |
| `cooldown_after_trade` | Cooldown in milliseconds after a trade |
| `price_in_range` | Token ID + min/max price bounds |
| `no_reentry` | Don't trade a market already traded today |
| `no_existing_position` | Don't trade if already holding a position |
| `time_window` | Only trade between start and end hours |

**ACTIONS (8 blocks)**
| Block | Config |
|---|---|
| `buy_yes` | Size + order type (GTC, GTD, FOK, FAK) |
| `buy_no` | Size + order type |
| `set_stop_loss` | Percentage — place a stop-loss order |
| `take_profit` | Percentage — place a take-profit order |
| `scale_in` | Additional size to buy |
| `scale_out` | Size to sell from existing position |
| `cancel_all_orders` | Cancel all open orders on this market |
| `skip_bet` | Explicitly skip this tick (for logging) |

**SAFETY — Circuit Breakers (6 blocks)**
| Block | Config |
|---|---|
| `stop_if_daily_loss` | Max USDC loss per day before strategy stops |
| `stop_if_orders_per_min` | Max orders per minute |
| `stop_if_consecutive_loss` | Max consecutive losing trades |
| `stop_if_exposure_exceeds` | Max total USDC exposure |
| `pause_after_fill` | Pause N milliseconds after every fill |
| `max_orders_total` | Max total orders before strategy stops |

### Quick Backtest
- Run a fast backtest on the last 7 days directly from the builder (synchronous, returns result inline)
- Results shown in a panel: total orders, filled orders, total P&L, win rate, data gaps warning

### Strategy Templates
- Admin-created templates shown in the builder as starting points
- User selects a template → it pre-fills the builder → user can customize before saving

### Fork a Strategy
- Any PUBLIC or UNLISTED strategy can be forked
- Fork creates a new PRIVATE copy under the user's account
- Fork is editable independently; `forkedFromId` stored for lineage tracking

---

## 5. Strategy Execution (Live Trading)

### Starting a Strategy
- Requires "Connected" status (Polymarket credentials must be imported)
- User chooses mode: `live` (real orders) or `paper` (simulated)
- Strategy limit enforced (admin-configurable per user)
- Strategy moves to RUNNING status

### Stopping / Pausing / Resuming
- User can stop a strategy at any time (moves to IDLE)
- User can pause a strategy (moves to PAUSED, no new ticks evaluated)
- User can resume a paused strategy (back to RUNNING)

### Tick Evaluation Loop
- SAFETY blocks evaluated first — any failure stops the strategy immediately
- TRIGGERS evaluated next — all must fire to continue
- CONDITIONS evaluated — all must pass to continue
- ACTIONS evaluated — OrderIntent published to order stream

### Order Submission
- Orders are batched (up to 15 per user per submission)
- Each order is signed by signer-service using the user's encrypted credentials
- Builder attribution headers added to every order (Builder Program)
- Order status tracked through full lifecycle: PENDING → SUBMITTED → LIVE → MATCHED → MINED → CONFIRMED

### Safety Mechanisms
- Tick interval floor: minimum 200ms enforced even if user sets lower
- Stale data protection: if market price cache is > 5 seconds old, strategy auto-pauses
- Dead-letter queue (DLQ) for orders that fail after retries
- Per-user limits on max running strategies, max orders per day, max order size

### Real-time Strategy Events (WebSocket)
- `STRATEGY_STARTED` — strategy is now running
- `STRATEGY_STOPPED` — strategy stopped (with reason)
- `STRATEGY_PAUSED` — strategy paused (with reason, e.g. stale data)
- `STRATEGY_RESUMED` — strategy resumed
- `STRATEGY_ERROR` — a block evaluation error occurred
- `ORDER_PLACED`, `ORDER_SUBMITTED`, `ORDER_FILLED`, `ORDER_PARTIAL`, `ORDER_CANCELLED`, `ORDER_FAILED`

---

## 6. Paper Trading

### Overview
- Strategies run in paper mode use real market prices but place no real orders
- Simulated fills based on actual order book data (price improvement applied when possible)
- Paper P&L tracked separately from real P&L
- Paper positions managed independently

### Paper Portfolio
- View current paper positions and unrealized P&L
- Paper orders history
- Total paper P&L

### Reset
- User can reset all paper data (positions, orders, P&L) at any time
- Useful to restart a simulation from scratch

---

## 7. Backtesting

### Starting a Backtest
- Select a strategy and a date range
- Optionally provide starting capital
- Job is queued and runs asynchronously in the backtest-service

### Progress Tracking
- Real-time progress bar updated via WebSocket (`BACKTEST_PROGRESS` events, 0–100%)
- `BACKTEST_COMPLETED` event fires when done with summary stats
- `BACKTEST_FAILED` event fires with an error if the run failed

### Results
- Total orders and filled orders
- Total P&L and win rate
- Max drawdown
- Sharpe ratio
- Equity curve chart (P&L over time)
- Warning displayed if the date range contains data gaps: "⚠ Data gaps detected — results may be inaccurate"

### Quick Mode
- Available from the strategy builder
- Runs on the last 7 days synchronously
- Returns results inline without queuing

### Backtest History
- User can view all past backtest runs for each strategy
- Each run shows its config, status, and results

---

## 8. Portfolio & Positions

### Positions
- List of all current open positions (real trading)
- Each position shows: market title, outcome (YES/NO), size, average entry price, current price, unrealized P&L, resolution status
- Total unrealized P&L and total realized P&L at the top

### P&L Chart
- Line chart of P&L over time
- Filter by period: 7d, 30d, 90d, all time
- Filter by specific strategy

### Market Resolution
- When a market resolves, positions show a "Redeem" button
- Resolution outcomes: YES wins (1.00), NO wins (1.00), 50/50 (0.50 each), Cancelled
- User triggers redemption → platform calls the Polymarket relayer
- Position shows `REDEEMED` status with transaction hash

### Close Position
- User can manually close a position (FOK sell order at market price)
- Partial close supported (specify size to sell)

---

## 9. Orders

### Order History
- Paginated list of all real orders
- Filters: status, strategy, date range
- Each order shows: market, outcome, side, size, price, order type, status, fill details, fees, timestamps

### Order Statuses
```
PENDING     → intent created, not yet submitted
SUBMITTED   → sent to CLOB
LIVE        → resting on order book (GTC/GTD)
MATCHED     → matched, awaiting settlement
DELAYED     → sports market 3s delay
MINED       → mined on-chain
CONFIRMED   → final fill ✓
PARTIAL     → partially filled, remainder live
CANCELLED   → cancelled ✓
UNMATCHED   → no match found ✓
FAILED      → permanent failure ✓
ERROR       → internal error before submission ✓
```

---

## 10. Price Alerts

- User sets a price alert on any market token
- Alert triggers when the token price crosses above or below a threshold
- Persistent alerts re-arm after triggering; non-persistent alerts fire once
- Max 50 active alerts per user
- Alert triggers a `PRICE_ALERT_TRIGGERED` WebSocket event and a notification
- Alerts can be deleted at any time

---

## 11. Social Features

### Public Profiles
- Each user has a public profile page at `/profile/:username`
- Shows: username, display name, bio, auto-generated identicon avatar, join date
- Shows: public strategies, followers/following count
- Optionally shows: aggregate P&L and win rate (user opt-in via settings)

### Follow System
- Any user can follow any other user
- Follow/unfollow toggle on the profile page
- Follower and following counts displayed
- Cannot follow yourself

### Strategy Discovery
- Public feed of all PUBLIC strategies at `/discover`
- Sort options: popular, newest, top P&L, most forked
- Filter by market category
- Each strategy card shows: name, author, description, tags, like count, fork count

### Leaderboard
- Tabs: Top P&L, Best win rate, Most forked strategies, Most followers
- P&L leaderboard filterable by period: 24h, 7d, 30d, all time
- Only users who have opted in to public stats appear in P&L/win rate leaderboards

### Likes
- Users can like any PUBLIC strategy
- Like is a toggle (like/unlike)
- Like count displayed on strategy card and detail page

### Comments
- Users can comment on PUBLIC strategies
- Threaded comments (reply to a comment)
- Comment author can delete their own comments
- Deleted comments show "[deleted]" placeholder (not hard-deleted)

### Reports
- Users can report a strategy or comment (reasons: spam, inappropriate, misleading, other)
- At 3 reports, content is automatically hidden pending admin review
- Reporter receives a notification when the report is resolved

### Strategy Versioning
- Every save of a strategy's blocks increments `version`
- Full edit history stored in `strategy_versions`

---

## 12. Notifications

### Channels
- **Email** (AWS SES) — transactional and trading alerts
- **In-app** (WebSocket `NOTIFICATION` event) — real-time in the UI
- **Telegram** — via linked bot
- **Discord** — via linked bot

### Notification Categories

**Transactional (always sent immediately, not configurable):**
- Email verification link
- Password reset link
- 2FA backup codes on enrollment

**Trading (user-configurable):**
- Order filled (with P&L)
- Order failed or entered DLQ
- Strategy error (block evaluation failure)
- Strategy stopped due to safety block
- Daily loss limit reached
- Backtest completed
- Market resolved (for markets with open positions)
- Price alert triggered

**Social (user-configurable, daily digest option):**
- Someone forked your strategy
- Someone followed you
- Someone liked your strategy
- Someone commented on your strategy

### Notification Preferences
- Per-channel toggle (email, Telegram, Discord)
- Per-event toggle
- Minimum fill size threshold (only notify for fills above N USDC)
- Frequency: IMMEDIATE, HOURLY digest, DAILY digest

---

## 13. Telegram & Discord Bots

### Account Linking
- User generates a 6-digit one-time code in Settings (10-minute TTL)
- User opens the bot and sends `/connect <code>`
- Bot links the chat to the user's Polyforge account
- Bot JWT issued (30-day lifetime, scoped to read + limited write)

### Bot Commands (Telegram and Discord)

| Command | Description |
|---|---|
| `/start` | Welcome message + instructions |
| `/connect <code>` | Link Polyforge account |
| `/status` | All running strategies + current P&L |
| `/stop <name>` | Stop a named strategy |
| `/pause <name>` | Pause a named strategy |
| `/resume <name>` | Resume a paused strategy |
| `/pnl` | Today's P&L across all strategies |
| `/pnl <name>` | P&L for a specific strategy |
| `/orders` | Last 5 orders |
| `/positions` | Current open positions |
| `/paper` | Paper trading summary |
| `/alerts` | View and configure alert thresholds |
| `/disconnect` | Unlink Polyforge account |
| `/help` | Full command list |

### Push Notifications via Bot
- Order filled alerts
- Strategy error alerts
- Daily loss limit alerts
- Price alert triggers
- Market resolution alerts

---

## 14. User Settings

### Profile Settings
- Display name (public)
- Bio (max 500 characters)
- Avatar URL
- Twitter/X handle

### Privacy Settings
- Show P&L on public profile (opt-in, default off)
- Show win rate on public profile (opt-in, default off)

### Notification Settings
- Toggle each notification channel (email, Telegram, Discord)
- Toggle each event type
- Set minimum fill size for fill notifications
- Set notification frequency (immediate, hourly, daily)

### Security Settings
- Change password (requires current password)
- Enable / disable 2FA
- View connected devices / sessions
- Import Polymarket credentials
- Remove Polymarket credentials

### Danger Zone
- Delete account (soft delete — admin can restore)

---

## 15. Admin Panel

The admin panel runs on `admin.polyforge.app` (IP allowlisted). All actions are logged in the immutable `audit_logs` table.

### Health Dashboard (`/health`)
- Live status of all 13 services (healthy / degraded / down)
- Service latency chart
- Database connection count
- Redis memory usage
- CloudWatch alarm states

### User Management (`/users`, `/users/:id`)
- Search users by email or username
- View user detail: account info, strategies, orders, limits
- Suspend / unsuspend a user (with reason)
- Update per-user limits: max running strategies, max orders per day, max order size
- Delete an account (soft delete)
- View login history

### Strategy Management (`/strategies`)
- View all strategies across all users
- Force-stop a running strategy
- Unpublish a PUBLIC strategy (removes from discovery)
- View strategy blocks and run history

### Order Monitor (`/orders`)
- Real-time order flow across all users
- Filter by user, strategy, status, date
- DLQ monitor — orders stuck in dead-letter queue

### Backtest Queue (`/backtests`)
- View all pending, running, and completed backtest jobs
- Cancel a stuck job

### Cache Dashboard (`/cache`)
- Hit rate and freshness metrics per cache key pattern
- Manual cache invalidation for specific keys

### Rate Limit Dashboard (`/rate-limits`)
- Current Polymarket API budget usage (requests/min)
- History of rate limit events by service

### Notifications Dashboard (`/notifications`)
- Delivery stats by channel (email, Telegram, Discord)
- Failed notification log with error reasons

### Content Moderation (`/content`)
- Report queue (strategies and comments with ≥ 1 report)
- Review each report: approve (keep content) or remove (permanent)
- Auto-hidden content (≥ 3 reports) shown separately
- Reporter notified of outcome

### Builder Program Dashboard (`/builder`)
- Weekly attributed volume (USDC)
- Total attributed orders
- Current Builder tier and reward multiplier
- Next tier threshold
- Historical weekly rewards

### Logs
- `/logs/audit` — immutable admin action history
- `/logs/events` — system event log (fills, strategy starts/stops)
- `/logs/logins` — user login activity
- `/logs/notifications` — notification delivery history

### Admin Accounts
- SUPER_ADMIN, ADMIN, VIEWER roles
- SUPER_ADMIN can create and revoke admin accounts
- All admin actions logged with IP and payload

---

## 16. Platform Infrastructure

These are not user-facing features, but they are required for the platform to function correctly.

### Market Data Collection (market-data-service)
- Connects to Polymarket WebSocket for live prices and order book data
- Writes price data to TimescaleDB
- Writes price and book data to Redis cache (with TTLs)
- Detects and records data gaps
- Monitors market resolution status for all markets with open positions
- Applies v1 filter: binary markets only (neg-risk markets excluded)

### Builder Program Attribution
- Every order placed through Polyforge carries HMAC builder attribution headers
- Signed by signer-service using `@polymarket/clob-client` builder config
- Weekly USDC rewards accumulate in the builder wallet
- Admin dashboard tracks attributed volume and rewards

### Data Retention (automated)
- Nightly cron at 3am UTC (admin-api-service) runs all cleanup jobs
- Logs purged per the retention policy (see architecture doc)

### Go-Live Checklist (one-time setup)

**DNS**
- [ ] `polyforge.app` A record → EC2 Elastic IP
- [ ] `admin.polyforge.app` A record → same IP
- [ ] SPF, DKIM, DMARC records for SES

**AWS**
- [ ] EC2 instance (t3.medium minimum)
- [ ] RDS PostgreSQL 16 + TimescaleDB
- [ ] ElastiCache Redis 7
- [ ] ECR repositories (one per service)
- [ ] All 14 secrets in Secrets Manager
- [ ] SES domain verification + production access
- [ ] IAM role on EC2 (SES + Secrets Manager, least privilege)
- [ ] Security groups (80, 443 public / all else internal)
- [ ] CloudWatch log groups + alarms

**Polymarket**
- [ ] Builder Program account created (dedicated wallet)
- [ ] Builder Program registration submitted and approved
- [ ] `POLY_BUILDER_API_KEY`, `SECRET`, `PASSPHRASE` stored in Secrets Manager

**Bots**
- [ ] Telegram bot created via @BotFather
- [ ] Discord application + bot created
- [ ] Both tokens stored in Secrets Manager

**Legal**
- [ ] Terms of Service page live at `/terms`
- [ ] Privacy Policy page live at `/privacy`
- [ ] ToS acceptance checkbox required at registration

---

## 17. Support Ticket System

In-app support ticket system allowing users to submit and track support requests, and admins to manage, reply, and resolve them.

### 17.1 User-Facing (user-app)

- [x] **Create ticket** — subject (max 255), category (General, Billing, Technical, Account, Bug, Feature Request), description (max 5000)
- [x] **Ticket list** — paginated list of user's tickets ordered by last updated, status badges, latest message preview
- [x] **Ticket detail** — full conversation thread with chronological messages, admin messages visually distinguished (shield icon, tinted background)
- [x] **Reply to ticket** — textarea reply form (hidden when ticket is closed)
- [x] **Status visibility** — Open, Awaiting Reply (admin replied), In Progress (user replied), Closed
- [x] **Sidebar navigation** — "Help > Support" section in sidebar

### 17.2 Admin-Facing (admin-app)

- [x] **Ticket list** — all tickets, filterable by status, priority, assigned admin. Shows user, status badge, priority badge, assigned admin name, last updated
- [x] **Ticket detail** — user info, conversation thread, admin controls (status, priority dropdowns + update button)
- [x] **Admin reply** — reply form with auto-assignment (if unassigned, replying admin is auto-assigned)
- [x] **Assignment** — "Assign to me" button on unassigned tickets. Admin display names resolved from admin DB
- [x] **Close ticket** — sets closedBy/closedAt, emits TICKET_CLOSED event, notifies user
- [x] **Audit logging** — all admin actions (reply, update, close) logged to audit_logs

### 17.3 Auto-Reminder

- [x] **Stale ticket detection** — hourly cron checks for tickets in AWAITING_USER status older than 48h
- [x] **Single reminder email** — branded HTML email with "View your ticket" CTA button, sent once per admin reply cycle
- [x] **Configurable delay** — Redis key `config:ticket_reminder_hours` (default 48)
- [x] **Error resilience** — continues processing remaining tickets if one email fails

### 17.4 Notifications

- [x] **TICKET_REPLY** — email/Telegram/Discord notification when admin replies (respects `onTicketReply` user preference)
- [x] **TICKET_CLOSED** — notification when ticket is closed
- [x] **TICKET_CREATED** — confirmation notification to user on ticket creation

### 17.5 Admin Role: SUPPORT

- [x] New `SUPPORT` role in `AdminRole` enum — dedicated support accounts that can access ticket management

---

## 18. Advanced Strategy Builder (v3.2+)

Extends the core strategy builder (section 4) with import/export, a visual variables UI, logic blocks, calculation blocks, and sub-strategy composition.

### 18.1 Strategy Import/Export

- Export any strategy as a `.polyforge` JSON file containing: name, description, execution mode, variables, blocks (with configs), and canvas layout
- Import a strategy via file upload or drag-and-drop onto the strategy builder canvas
- Share a strategy via encoded URL (link contains the full strategy definition, base64-encoded)
- Schema includes a `version` field for forward compatibility
- API endpoints for programmatic export/import:
  - `GET /api/v1/strategies/:id/export` — returns the `.polyforge` JSON
  - `POST /api/v1/strategies/import` — creates a new strategy from the JSON payload
- The `.polyforge` file format is a JSON document with the following top-level fields: `version`, `name`, `description`, `execMode`, `tickMs`, `variables`, `blocks`, `connections`, `canvasLayout`

### 18.2 Variables UI

- Visual variable blocks rendered on the strategy builder canvas in a dedicated purple section (`#A855F7`)
- Each variable block defines a name and an expression (evaluated using `expr-eval`)
- A Variables panel in the builder sidebar lists all defined variables with their current expressions
- Block config fields that reference a variable (`$varName`) are highlighted with a purple accent
- Backend support is already implemented: `StrategyVariable` model + `expr-eval` resolver in the strategy-engine evaluation pipeline

### 18.3 Logic Blocks

New block category for control flow logic. Logic blocks differ from standard blocks in that they have **multiple output ports** (true/false paths) instead of a single output.

| Block | Behavior |
|---|---|
| `if_then_else` | Conditional branching — evaluates a condition expression and routes to true or false output port |
| `and_gate` | All connected inputs must be true to output true |
| `or_gate` | Any connected input being true outputs true |
| `not_gate` | Inverts the boolean value from its input |
| `delay` | Waits N seconds or N ticks before propagating the signal to the output port |

Logic blocks are rendered with a distinct visual style: IF/THEN/ELSE blocks show two output ports (green for true, red for false). AND/OR/NOT gates display their logic icon in the block header.

### 18.4 Calculation Blocks

New block category for mathematical operations. Calculation blocks have **typed input/output ports** (number, boolean, or string).

| Block | Behavior |
|---|---|
| `math` | Evaluates an arithmetic expression with named inputs (e.g., `$price * $size`) |
| `aggregation` | Computes moving average, min, max, or cumulative sum over the last N ticks |
| `comparison` | Outputs a boolean result from a comparison operation (>, <, ==, between) |

Calculation blocks display their expression in the block body and show input/output port types.

### 18.5 Sub-Strategies (Strategy Composition)

Allows strategies to invoke other strategies, enabling modular strategy design.

- **New "Run Strategy" action block** — references another strategy by ID
- **Three execution modes:**
  - **Fire-and-forget** — child strategy starts and runs independently
  - **Managed** — parent controls child lifecycle (start, stop, pause, resume)
  - **Scoped** — child inherits the parent's context (variables, strategy state)
- **Data model:** `parentStrategyId` field on the Strategy model tracks lineage
- **Circular dependency detection** — the engine validates the strategy graph before starting to prevent infinite recursion
- **Resource limits:**
  - Maximum nesting depth: 3 levels
  - Maximum concurrent sub-strategies: 10 per parent
- **P&L attribution:** sub-strategy P&L rolls up to the parent strategy's total P&L
- **Lifecycle propagation:** stopping a parent strategy automatically stops all running child strategies

---

## 19. Smart Score & Badges

### Smart Score

- Composite score computed from trading performance, activity, and social engagement
- `GET /api/v1/scores/me` — authenticated user's score
- `GET /api/v1/scores/top` — top trader leaderboard by Smart Score
- `GET /api/v1/scores/:userId` — any user's public score

### Badges

- Achievement-based badges earned through milestones (e.g., first trade, streak, top P&L)
- `GET /api/v1/scores/me/badges` — authenticated user's badges
- `GET /api/v1/scores/:userId/badges` — any user's public badges

---

## 20. Gas Sponsorship

- Platform-funded wallet absorbs Polygon gas fees for user transactions
- Configurable per-user daily gas budget tracked in Redis (`GAS_DAILY_LIMIT_MATIC`, default 0.5 MATIC)
- `GET /api/v1/settings/gas` — returns today's usage, daily limit, remaining allowance
- Gas usage UI tab in settings with progress bar and usage breakdown
- "Gasless" badge on portfolio page header

---

## 21. Educational Onboarding

- 5 pre-built strategy templates seeded: Simple Momentum, Mean Reversion, News Reactive, Risk Manager, Whale Follower
- Onboarding checklist widget for new users (joined within 7 days) with 6 getting-started tasks stored in localStorage
- 5-step tooltip tour highlighting sidebar, market cards, strategy builder, theme toggle, and notification bell

---

## 22. WhatsApp Bot

- WhatsApp Business Cloud API integration via bot-service
- Webhook endpoint (`GET /webhook/whatsapp` for Meta verification, `POST /webhook/whatsapp` for incoming messages)
- HMAC-SHA256 signature validation on incoming webhooks using `WHATSAPP_APP_SECRET`
- Same command set as Telegram/Discord bots (see section 13)
- Account linking via the same `/connect <code>` flow

---

## 23. Geoblocking

- Nginx GeoIP2 module with MaxMind GeoLite2 database
- Blocks access from US and restricted regions at the reverse proxy level
- Country-based IP filtering applied before requests reach application services

---

## 24. Prediction Accuracy & Calibration *(v6.15.0)*

- `GET /api/v1/accuracy/me` — computes Brier score, win rate, calibration curve, and per-category breakdown on-the-fly from the user's resolved and redeemed positions
- Brier score ranges 0–1 (lower is better); calibration buckets divide the 0–1 probability range into 10% intervals and show actual outcome frequency vs. predicted probability
- Requires JWT; READ scope

---

## 25. AI Portfolio Optimizer *(v6.15.0)*

- `GET /api/v1/ai/portfolio-review` — returns an AI-written portfolio analysis (`review`), a list of actionable `suggestions`, and a quality `score` (1–10)
- Powered by LlmService (Claude API); graceful pattern-based fallback if LLM is unavailable
- Requires JWT; READ scope

---

## 26. Sentiment Intelligence *(v6.15.0)*

- `GET /api/v1/news/sentiment/:marketId` — aggregates the last 7 days of NewsSignal records for a market into a composite sentiment score (-100 to +100) and a label (`BULLISH` | `BEARISH` | `NEUTRAL`)
- BUY signals contribute positive weight; SELL signals contribute negative weight
- Requires JWT; READ scope

---

## 27. LP / Market Making *(v6.15.0)*

- `POST /api/v1/lp/provide` — places two-sided quotes on a market: BUY at `midPrice - spread/2`, SELL at `midPrice + spread/2`
- Body: `{ tokenId, spread, size }`; response includes both order IDs, computed prices, and size
- Publishes intents to the Redis order stream and creates pending Order records
- Requires JWT; TRADE scope

---

## Deferred (Future Versions)

The following features are explicitly **out of scope for v1** and will be considered for future releases:

| Feature | Notes |
|---|---|
| Protected strategies | Encrypted blocks, profit sharing with strategy creators |
| Paid / subscription strategies | Strategy monetisation model |
| GDPR compliance | Data export, right to erasure, consent management |
| Negative risk markets | Multi-outcome markets (beyond YES/NO) |
| Mobile app | React Native or Capacitor |
| Multi-region deployment | CloudFront + multiple EC2 regions |
| HSM key storage | AWS CloudHSM for master encryption key |

---

*Reference documents: [Architecture](./01-architecture.md) · [Codebase Guide](./02-codebase-guide.md) · [API Catalog](./06-api-catalog.md)*
