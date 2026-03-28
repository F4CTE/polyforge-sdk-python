# Polyforge — API Endpoint Catalog

> Complete contract for every REST endpoint and WebSocket message.  
> All REST routes are prefixed with the service path shown in each section heading.  
> All requests and responses use `Content-Type: application/json`.

---

## Authentication

### JWT formats

| JWT type | Header | Lifetime | Issued by |
|---|---|---|---|
| User JWT | `Authorization: Bearer <token>` | 7 days | auth-service |
| Admin JWT | `Authorization: Bearer <token>` | 1 hour | admin-auth-service |
| Bot JWT | `Authorization: Bearer <token>` | 30 days | auth-service |
| Internal JWT | `Authorization: Bearer <token>` | 30 seconds | each service (for service-to-service calls) |
| API Key | `Authorization: Bearer pf_xxxx...` | Configurable (optional expiry) | auth-service |

### API Key Authentication

External tools, AI agents, and scripts can authenticate using API keys instead of JWTs.

- Include `Authorization: Bearer pf_xxxx...` header (keys always start with `pf_` prefix)
- Keys are scoped: **READ** (view data), **WRITE** (modify strategies/settings), **TRADE** (place orders)
- Keys are SHA256-hashed at rest; the plaintext key is shown only once at creation
- Max 10 active keys per user
- Optional expiration (`expiresInDays` at creation time)
- `JwtAuthGuard` detects the `pf_` prefix, SHA256 hashes the token, looks up the hash in the database, and sets `request.user` + `request.apiKeyMeta`
- `ApiKeyScopeGuard` checks required scopes via the `@RequireScopes()` decorator

### Error response (all endpoints)

```json
{
  "statusCode": 400,
  "code": "MACHINE_READABLE_CODE",
  "message": "Human readable message",
  "field": "fieldName",
  "requestId": "uuid"
}
```

---

## Auth Service  (`/auth/v1`)

### POST /auth/v1/register

Create a new user account.

**Auth:** None  
**Rate limit:** 5 req/hour per IP

**Request:**
```json
{
  "email": "alice@example.com",
  "password": "Test1234!",
  "username": "alice",
  "tosAccepted": true
}
```

**Validation:**
- `email` — valid email format, max 255 chars
- `password` — min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit
- `username` — 3–30 chars, alphanumeric + underscore only, no leading/trailing underscore
- `tosAccepted` — must be `true` (400 if false)

**Response `201`:**
```json
{
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "username": "alice",
    "status": "UNVERIFIED",
    "createdAt": "2026-03-12T10:00:00Z"
  }
}
```

**Errors:** `400 VALIDATION_ERROR` · `409 EMAIL_TAKEN` · `409 USERNAME_TAKEN`

---

### POST /auth/v1/login

**Auth:** None  
**Rate limit:** 10 req/15min per IP

**Request:**
```json
{
  "email": "alice@example.com",
  "password": "Test1234!",
  "totpCode": "123456"
}
```
`totpCode` required only if 2FA is enabled.

**Response `200`:**
```json
{
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "username": "alice",
    "displayName": "Alice",
    "status": "CONNECTED",
    "polymarketConnected": true,
    "emailVerified": true
  },
  "requiresTotp": false
}
```

**Errors:** `400 INVALID_CREDENTIALS` · `400 TOTP_REQUIRED` · `400 TOTP_INVALID` · `403 ACCOUNT_SUSPENDED`

---

### POST /auth/v1/logout

**Auth:** User JWT

**Response `204`:** No body.

---

### POST /auth/v1/verify-email

**Auth:** None

**Request:**
```json
{ "token": "64-char-hex-token-from-email" }
```

**Response `200`:**
```json
{ "message": "Email verified successfully" }
```

**Errors:** `400 TOKEN_INVALID` · `400 TOKEN_EXPIRED` · `400 TOKEN_ALREADY_USED`

---

### POST /auth/v1/forgot-password

**Auth:** None  
**Rate limit:** 3 req/hour per IP

**Request:**
```json
{ "email": "alice@example.com" }
```

**Response `200`:** Always returns 200 (prevents email enumeration).
```json
{ "message": "If that email exists, a reset link has been sent" }
```

---

### POST /auth/v1/reset-password

**Auth:** None

**Request:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewPass1234!"
}
```

**Response `200`:**
```json
{ "message": "Password reset successfully" }
```

**Errors:** `400 TOKEN_INVALID` · `400 TOKEN_EXPIRED` · `400 TOKEN_ALREADY_USED`

---

### POST /auth/v1/totp/setup

Begin 2FA enrollment. Returns a TOTP secret and QR code URI.

**Auth:** User JWT

**Response `200`:**
```json
{
  "secret": "BASE32ENCODED...",
  "qrCodeUri": "otpauth://totp/Polyforge:alice@example.com?secret=...&issuer=Polyforge",
  "backupCodes": ["abc123", "def456", "..."]
}
```

---

### POST /auth/v1/totp/confirm

Confirm a TOTP code to complete enrollment.

**Auth:** User JWT

**Request:**
```json
{ "totpCode": "123456" }
```

**Response `200`:**
```json
{ "enabled": true }
```

**Errors:** `400 TOTP_INVALID`

---

### DELETE /auth/v1/totp

Disable 2FA. Requires current password.

**Auth:** User JWT

**Request:**
```json
{ "password": "Test1234!" }
```

**Response `200`:**
```json
{ "enabled": false }
```

---

### POST /auth/v1/credentials

Import Polymarket API credentials. Transitions user to CONNECTED status.

**Auth:** User JWT  
**Rate limit:** 3 req/hour per user

**Request:**
```json
{
  "apiKey": "polymarket-api-key",
  "secret": "polymarket-secret",
  "passphrase": "polymarket-passphrase",
  "walletAddress": "0xabc...",
  "safeAddress": "0xdef...",
  "sigType": 0
}
```

**Response `201`:**
```json
{
  "connected": true,
  "walletAddress": "0xabc...",
  "importedAt": "2026-03-12T10:00:00Z"
}
```

**Errors:** `400 VALIDATION_ERROR` · `422 CREDENTIALS_ALREADY_IMPORTED` · `422 INVALID_POLYMARKET_CREDENTIALS`

---

### DELETE /auth/v1/credentials

Remove Polymarket credentials. Stops all running strategies first.

**Auth:** User JWT

**Response `200`:**
```json
{ "connected": false }
```

---

### GET /auth/v1/me

**Auth:** User JWT

**Response `200`:**
```json
{
  "id": "uuid",
  "email": "alice@example.com",
  "username": "alice",
  "displayName": "Alice",
  "bio": "...",
  "avatarUrl": "https://...",
  "status": "CONNECTED",
  "polymarketConnected": true,
  "emailVerified": true,
  "totpEnabled": true,
  "createdAt": "2026-03-12T10:00:00Z",
  "lastSeen": "2026-03-12T10:00:00Z"
}
```

---

### POST /auth/v1/bot-link

Generate a short-lived link code for connecting a Telegram or Discord bot.

**Auth:** User JWT

**Response `200`:**
```json
{
  "code": "ABC123",
  "expiresIn": 300
}
```

---

### POST /auth/v1/api-keys

Create a new API key for the authenticated user.

**Auth:** User JWT
**Rate limit:** 10 req/hour per user

**Request:**
```json
{
  "name": "My Trading Bot",
  "scopes": ["READ", "WRITE", "TRADE"],
  "expiresInDays": 90
}
```

- `name` — descriptive label for the key
- `scopes` — array of `READ`, `WRITE`, `TRADE` (at least one required)
- `expiresInDays` — optional; key never expires if omitted

**Response `201`:**
```json
{
  "id": "uuid",
  "name": "My Trading Bot",
  "key": "pf_abc123...full-plaintext-key",
  "prefix": "pf_abc123",
  "scopes": ["READ", "WRITE", "TRADE"],
  "expiresAt": "2026-06-19T00:00:00Z"
}
```

> **Warning:** The `key` field is returned **only once** at creation. It cannot be retrieved again.

**Errors:** `400 VALIDATION_ERROR` · `409 MAX_KEYS_REACHED` (limit: 10 active keys per user)

---

### GET /auth/v1/api-keys

List all API keys for the authenticated user. Does not include `tokenHash`.

**Auth:** User JWT

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "My Trading Bot",
    "prefix": "pf_abc123",
    "scopes": ["READ", "WRITE", "TRADE"],
    "createdAt": "2026-03-21T10:00:00Z",
    "expiresAt": "2026-06-19T00:00:00Z",
    "lastUsedAt": "2026-03-21T12:30:00Z",
    "status": "ACTIVE"
  }
]
```

---

### DELETE /auth/v1/api-keys/:id

Revoke an API key. The key becomes immediately unusable.

**Auth:** User JWT

**Response `204`:** No body.

**Errors:** `404 API_KEY_NOT_FOUND`

---

### POST /auth/v1/waitlist

Join the early-access waitlist.

**Auth:** None
**Rate limit:** 3 req/hour per IP

**Request:**
```json
{ "email": "user@example.com" }
```

**Response `200`:**
```json
{ "joined": true }
```

**Errors:** `400 VALIDATION_ERROR` · `409 ALREADY_ON_WAITLIST`

---

### POST /auth/v1/refresh

Refresh the access token using the refresh token cookie. No request body needed — reads the `pf_refresh` HTTP-only cookie.

**Auth:** None (cookie-based)
**Rate limit:** 30 req/15min per user

**Response `200`:**
```json
{
  "token": "eyJ..."
}
```
Sets a new `pf_token` cookie on the response.

**Errors:** `401 REFRESH_TOKEN_INVALID` · `401 REFRESH_TOKEN_EXPIRED`

---

### POST /auth/v1/resend-verification

Resend the email verification link.

**Auth:** None
**Rate limit:** 3 req/hour per IP

**Request:**
```json
{ "email": "alice@example.com" }
```

**Response `200`:** Always returns 200 (prevents email enumeration).
```json
{ "message": "If that email exists and is unverified, a verification link has been sent" }
```

---

### DELETE /auth/v1/account

Soft-delete the authenticated user's account. Stops all running strategies, revokes all tokens, and clears cookies.

**Auth:** User JWT

**Request:**
```json
{ "password": "Test1234!" }
```
Password required for confirmation.

**Response `204`:** No body.

**Errors:** `400 INVALID_PASSWORD` · `422 ACCOUNT_ALREADY_DELETED`

---

## API Service — User REST  (`/api/v1`)

All endpoints require `Authorization: Bearer <USER_JWT>` unless noted.

---

### Markets

#### GET /api/v1/markets

List active Polymarket markets with price and liquidity data.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Max 100 |
| `series` | string | — | Filter by series slug |
| `search` | string | — | Full-text search on title |
| `sort` | string | `volume` | `volume` \| `liquidity` \| `closing_soon` \| `newest` |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "market-uuid",
      "slug": "will-x-happen",
      "title": "Will X happen?",
      "description": "...",
      "category": "Politics",
      "seriesSlug": "us-elections-2026",
      "tokens": [
        { "tokenId": "...", "outcome": "YES", "price": "0.72", "liquidity": "45000" },
        { "tokenId": "...", "outcome": "NO",  "price": "0.28", "liquidity": "44500" }
      ],
      "volume24h": "12500",
      "endDate": "2026-11-04T00:00:00Z",
      "closed": false
    }
  ],
  "total": 248,
  "page": 1,
  "limit": 20,
  "totalPages": 13,
  "hasNext": true
}
```

---

#### GET /api/v1/markets/:marketId

**Response `200`:** Single market object (same shape as list item, plus full description).

**Errors:** `404 MARKET_NOT_FOUND`

---

#### GET /api/v1/markets/:tokenId/price-history

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `resolution` | string | `1h` | `1m` \| `1h` \| `1d` |
| `from` | ISO8601 | -7d | Start of range |
| `to` | ISO8601 | now | End of range |
| `limit` | int | 200 | Max 1000 |

**Response `200`:**
```json
{
  "tokenId": "...",
  "resolution": "1h",
  "hasGaps": false,
  "data": [
    { "time": "2026-03-12T09:00:00Z", "open": "0.70", "high": "0.74", "low": "0.69", "close": "0.72", "volume": "1250" }
  ]
}
```

---

#### GET /api/v1/markets/:tokenId/book

Current order book (bid/ask spread).

**Response `200`:**
```json
{
  "tokenId": "...",
  "bids": [{ "price": "0.71", "size": "500" }],
  "asks": [{ "price": "0.73", "size": "450" }],
  "spread": "0.02",
  "midpoint": "0.72",
  "timestamp": 1234567890123
}
```

---

### Strategies

#### GET /api/v1/strategies

List the authenticated user's strategies.

**Query params:** `page`, `limit`, `status` (`IDLE`|`RUNNING`|`PAUSED`|`PAPER`), `sort` (`createdAt`|`updatedAt`)

**Response `200`:** `PaginatedResponse<Strategy>`

**Strategy object:**
```json
{
  "id": "uuid",
  "name": "My Strategy",
  "description": "...",
  "visibility": "PRIVATE",
  "execMode": "TICK",
  "tickMs": 1000,
  "triggers": [...],
  "conditions": [...],
  "actions": [...],
  "safety": [...],
  "status": "IDLE",
  "version": 3,
  "template": false,
  "forkedFromId": null,
  "forkCount": 0,
  "likeCount": 12,
  "tags": ["momentum", "presidential"],
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

#### POST /api/v1/strategies

Create a new strategy.

**Request:**
```json
{
  "name": "My Strategy",
  "description": "Optional description",
  "visibility": "PRIVATE",
  "execMode": "TICK",
  "tickMs": 1000,
  "triggers": [{ "type": "price_crosses_up", "config": { "tokenId": "...", "threshold": "0.50" } }],
  "conditions": [{ "type": "min_liquidity", "config": { "minUsdc": "100" } }],
  "actions": [{ "type": "buy_yes", "config": { "tokenId": "...", "size": "50" } }],
  "safety": [{ "type": "stop_if_daily_loss", "config": { "maxLossUsdc": "200" } }],
  "tags": ["momentum"]
}
```

**Response `201`:** Full strategy object.

**Errors:** `400 VALIDATION_ERROR` · `422 STRATEGY_LIMIT_REACHED`

---

#### GET /api/v1/strategies/:id

**Auth:** User JWT (own strategies) or any user (PUBLIC strategies)

**Response `200`:** Full strategy object.

**Errors:** `403 FORBIDDEN` (private strategy, not owner) · `404 NOT_FOUND`

---

#### PATCH /api/v1/strategies/:id

Partial update. Increments `version`.

**Request:** Any subset of `name`, `description`, `visibility`, `execMode`, `tickMs`, `triggers`, `conditions`, `actions`, `safety`, `tags`.

**Response `200`:** Updated strategy object.

**Errors:** `400 VALIDATION_ERROR` · `403 FORBIDDEN` · `422 STRATEGY_IS_RUNNING` (cannot edit blocks while running)

---

#### DELETE /api/v1/strategies/:id

Soft delete. Sets status to ARCHIVED.

**Response `204`:** No body.

**Errors:** `403 FORBIDDEN` · `422 STRATEGY_IS_RUNNING`

---

#### POST /api/v1/strategies/:id/start

Start a live strategy.

**Request:**
```json
{ "mode": "live" }
```
`mode` is `"live"` or `"paper"`.

**Response `200`:**
```json
{ "status": "RUNNING", "startedAt": "2026-03-12T10:00:00Z" }
```

**Errors:** `403 FORBIDDEN` · `422 NOT_CONNECTED` (live mode requires credentials) · `422 ALREADY_RUNNING` · `422 STRATEGY_LIMIT_REACHED`

---

#### POST /api/v1/strategies/:id/stop

**Response `200`:**
```json
{ "status": "IDLE", "stoppedAt": "2026-03-12T10:00:00Z" }
```

---

#### POST /api/v1/strategies/:id/pause

**Response `200`:**
```json
{ "status": "PAUSED" }
```

---

#### POST /api/v1/strategies/:id/resume

**Response `200`:**
```json
{ "status": "RUNNING" }
```

---

#### GET /api/v1/strategies/:id/events _(SSE)_

Stream live execution events for a strategy over **Server-Sent Events**.

**Auth:** API key Bearer token · Scope: `READ`

**Response `200` — `Content-Type: text/event-stream`**

Each frame is a `data: <JSON>\n\n` line. A heartbeat comment (`: heartbeat`) is sent every 15 s.

Event schema:
```json
{
  "type": "ORDER_FILLED",
  "strategyId": "uuid",
  "data": { "orderId": "...", "price": 0.62 },
  "timestamp": 1711720000000
}
```

First event after connection is always `{ "type": "CONNECTED", ... }`.

Common event types: `CONNECTED` · `STRATEGY_STARTED` · `STRATEGY_STOPPED` · `STRATEGY_ERROR` · `ORDER_PLACED` · `ORDER_FILLED` · `ORDER_CANCELLED` · `BACKTEST_PROGRESS` · `BACKTEST_COMPLETED` · `BACKTEST_FAILED`

**Errors:** `403 FORBIDDEN` (wrong scope) · `404 NOT_FOUND` (strategy not found or not yours)

**SDK usage:**
```ts
// TypeScript
for await (const event of client.watchStrategy(id, abortController.signal)) { ... }

// Python async
async for event in client.watch_strategy(id): ...

// Rust
let mut stream = client.watch_strategy(id).await?;
while let Some(event) = stream.next().await { ... }
```

---

#### GET /api/v1/strategies/:id/children

List child (sub) strategies of a parent strategy.

**Auth:** User JWT (own strategies)

**Response `200`:**
```json
{
  "children": [
    { "id": "uuid", "name": "Child Strategy", "status": "RUNNING" }
  ]
}
```

**Errors:** `404 NOT_FOUND`

---

#### POST /api/v1/strategies/:id/fork

Create a copy of any PUBLIC strategy (or own strategy) as a new PRIVATE strategy.

**Response `201`:** New strategy object with `forkedFromId` set.

**Errors:** `403 FORBIDDEN` (private strategy) · `422 STRATEGY_LIMIT_REACHED`

---

#### POST /api/v1/strategies/:id/like

Toggle like on a PUBLIC strategy.

**Response `200`:**
```json
{ "liked": true, "likeCount": 13 }
```

---

#### GET /api/v1/strategies/:id/comments

**Query params:** `page`, `limit`

**Response `200`:** `PaginatedResponse<Comment>`

---

#### POST /api/v1/strategies/:id/comments

**Request:**
```json
{ "content": "Great strategy!" }
```

**Response `201`:** Comment object.

---

#### DELETE /api/v1/strategies/:strategyId/comments/:commentId

Only the comment author or an admin can delete.

**Response `204`:** No body.

---

#### POST /api/v1/strategies/:id/report

**Request:**
```json
{ "reason": "SPAM", "description": "Optional details" }
```

**Response `201`:**
```json
{ "reportId": "uuid" }
```

---

#### GET /api/v1/strategies/templates

List platform strategy templates.

**Response `200`:** `PaginatedResponse<Strategy>` where `template = true`.

---

### Discover

#### GET /api/v1/discover

Public strategy feed — for the Discover page.

**Query params:**
| Param | Default | Options |
|---|---|---|
| `sort` | `popular` | `popular` \| `newest` \| `top_pnl` \| `most_forked` |
| `category` | — | filter by market category |
| `page` | 1 | — |
| `limit` | 20 | max 50 |

**Response `200`:** `PaginatedResponse<PublicStrategy>`

`PublicStrategy` = strategy object with author info, but blocks are hidden if `visibility = UNLISTED`.

---

#### GET /api/v1/leaderboard

Top traders by P&L over a period.

**Query params:** `period` (`7d`|`30d`|`allTime`), `page`, `limit`

**Response `200`:**
```json
{
  "data": [
    {
      "rank": 1,
      "userId": "uuid",
      "username": "alice",
      "displayName": "Alice",
      "avatarUrl": "...",
      "pnl": "4250.00",
      "winRate": "0.67",
      "tradeCount": 89
    }
  ],
  "total": 500,
  "page": 1,
  "limit": 20,
  "totalPages": 25,
  "hasNext": true
}
```

---

### Orders

#### GET /api/v1/orders

**Query params:** `page`, `limit`, `status`, `strategyId`, `from`, `to`

**Response `200`:** `PaginatedResponse<Order>`

**Order object:**
```json
{
  "id": "uuid",
  "intentId": "uuid",
  "strategyId": "uuid",
  "marketId": "...",
  "tokenId": "...",
  "side": "BUY",
  "outcome": "YES",
  "size": "100.000000",
  "price": "0.550000",
  "orderType": "GTC",
  "status": "CONFIRMED",
  "clobOrderId": "...",
  "filledSize": "100.000000",
  "avgFillPrice": "0.551000",
  "makerFee": "0.000000",
  "takerFee": "0.100000",
  "submittedAt": "...",
  "filledAt": "...",
  "createdAt": "..."
}
```

---

#### POST /api/v1/orders/close-position

Manually close an open position (FOK sell order).

**Request:**
```json
{
  "tokenId": "...",
  "size": "50.000000"
}
```
`size` is optional — defaults to full position size.

**Response `202`:**
```json
{
  "orderId": "uuid",
  "intentId": "uuid",
  "status": "PENDING"
}
```

**Errors:** `404 POSITION_NOT_FOUND` · `422 NOT_CONNECTED`

---

#### POST /api/v1/orders/redeem

Redeem a resolved market position.

**Auth:** User JWT or API Key (requires `TRADE` scope)
**GeoBlocked:** Returns `451` in restricted regions.

**Request:**
```json
{ "positionId": "uuid" }
```
Or alternatively:
```json
{ "marketId": "uuid" }
```

**Response `200`:**
```json
{
  "positionId": "uuid",
  "marketId": "uuid",
  "redemptionValue": "200.000000",
  "txHash": "0x...",
  "redeemedAt": "2026-03-12T10:00:00Z"
}
```

**Errors:** `404 POSITION_NOT_FOUND` · `422 MARKET_NOT_RESOLVED` · `422 ALREADY_REDEEMED` · `451 GEO_BLOCKED`

---

### Portfolio & Positions

#### GET /api/v1/portfolio

Current open positions with unrealized P&L.

**Response `200`:**
```json
{
  "positions": [
    {
      "id": "uuid",
      "marketId": "...",
      "tokenId": "...",
      "marketTitle": "Will X happen?",
      "side": "YES",
      "size": "200.000000",
      "avgEntryPrice": "0.520000",
      "currentPrice": "0.720000",
      "unrealizedPnl": "40.000000",
      "resolutionStatus": "UNRESOLVED"
    }
  ],
  "totalUnrealizedPnl": "40.000000",
  "totalRealizedPnl": "125.500000"
}
```

---

#### GET /api/v1/portfolio/pnl

P&L over time (for charts).

**Query params:** `period` (`7d`|`30d`|`90d`|`allTime`), `strategyId`

**Response `200`:**
```json
{
  "snapshots": [
    { "time": "2026-03-05T08:00:00Z", "pnl": "80.00" },
    { "time": "2026-03-06T08:00:00Z", "pnl": "125.50" }
  ],
  "totalPnl": "125.50",
  "winRate": "0.67"
}
```

---

### Paper Trading

#### GET /api/v1/paper/summary

**Response `200`:**
```json
{
  "pnl": "47.20",
  "positions": [
    { "tokenId": "...", "side": "YES", "size": "100", "unrealizedPnl": "12.00" }
  ],
  "orderCount": 23
}
```

---

#### POST /api/v1/paper/reset

Clears all paper orders, positions, and P&L.

**Response `200`:**
```json
{ "reset": true }
```

---

### Backtests

#### GET /api/v1/backtests

**Query params:** `page`, `limit`, `strategyId`, `status`

**Response `200`:** `PaginatedResponse<BacktestRun>`

---

#### POST /api/v1/backtests

Create and queue a backtest run.

**Request:**
```json
{
  "strategyId": "uuid",
  "dateRangeStart": "2026-01-01T00:00:00Z",
  "dateRangeEnd": "2026-03-01T00:00:00Z",
  "quickMode": false
}
```

For `quickMode: true` (from strategy builder — last 7 days, synchronous):
- `strategyId` can be null, `strategyBlocks` must be provided instead
- Returns result inline (not via WebSocket)

**Response `201` (standard):**
```json
{ "runId": "uuid", "status": "QUEUED" }
```

**Response `200` (quickMode):**
```json
{
  "totalOrders": 23,
  "filledOrders": 18,
  "totalPnl": "47.20",
  "winRate": "0.7826",
  "hasDataGaps": false
}
```

---

#### GET /api/v1/backtests/:id

**Response `200`:** Full BacktestRun object.

---

### Alerts

#### GET /api/v1/alerts

**Response `200`:** Array of `PriceAlert` objects.

---

#### POST /api/v1/alerts

**Request:**
```json
{
  "tokenId": "...",
  "direction": "above",
  "price": "0.75",
  "persistent": false
}
```

**Response `201`:** PriceAlert object.

**Errors:** `422 ALERT_LIMIT_REACHED` (max 50 alerts per user)

---

#### DELETE /api/v1/alerts/:id

**Response `204`:** No body.

---

### Support Tickets (User)

#### POST /api/v1/tickets

Create a new support ticket.

**Body:**
```json
{
  "subject": "Can't log in",
  "category": "TECHNICAL",
  "body": "I get a 500 error when clicking login..."
}
```

- `subject` — string, 1–255 chars (required)
- `category` — `GENERAL` | `BILLING` | `TECHNICAL` | `ACCOUNT` | `BUG` | `FEATURE_REQUEST` (default: `GENERAL`)
- `body` — string, 1–5000 chars (required, first message)

**Response `201`:** Ticket object.

#### GET /api/v1/tickets

List current user's tickets (paginated).

**Query:** `page` (default 1), `limit` (default 20)

**Response `200`:** `PaginatedResponse<Ticket>` with latest message preview.

#### GET /api/v1/tickets/:id

Get ticket detail with full message history.

**Response `200`:**
```json
{
  "id": "uuid",
  "subject": "Can't log in",
  "category": "TECHNICAL",
  "status": "AWAITING_USER",
  "priority": "MEDIUM",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "messages": [
    {
      "id": "uuid",
      "senderId": "uuid",
      "senderName": "alice",
      "isAdmin": false,
      "body": "I get a 500 error...",
      "createdAt": "ISO"
    }
  ]
}
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN` (not your ticket)

#### POST /api/v1/tickets/:id/messages

Add a reply to your ticket.

**Body:** `{ "body": "Here's more info..." }` (1–5000 chars)

**Response `201`:** TicketMessage object. Sets ticket status to `AWAITING_ADMIN`.

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`, `403 TICKET_CLOSED`

---

### Profile & Social

#### GET /api/v1/profile/:username

Public profile of any user.

**Response `200`:**
```json
{
  "id": "uuid",
  "username": "alice",
  "displayName": "Alice",
  "bio": "...",
  "avatarUrl": "...",
  "followersCount": 42,
  "followingCount": 15,
  "isFollowing": true,
  "publicStrategyCount": 3,
  "joinedAt": "..."
}
```

---

#### POST /api/v1/profile/:username/follow

Toggle follow. Returns current follow state.

**Response `200`:**
```json
{ "following": true, "followersCount": 43 }
```

---

#### PATCH /api/v1/settings/profile

**Request:** Any subset of `displayName`, `bio`, `avatarUrl`, `twitterHandle`.

**Response `200`:** Updated profile object.

---

#### PATCH /api/v1/settings/notifications

**Request:** Any subset of notification preference booleans.

**Response `200`:** Updated preferences object.

---

#### PATCH /api/v1/settings/password

**Request:**
```json
{
  "currentPassword": "Old1234!",
  "newPassword": "New1234!"
}
```

**Response `200`:**
```json
{ "message": "Password updated" }
```

---

#### GET /api/v1/settings/gas

Returns gas sponsorship usage for the authenticated user.

**Auth:** User JWT

**Response `200`:**
```json
{
  "spent": 1.25,
  "limit": 10.00,
  "remaining": 8.75,
  "sponsored": true
}
```

---

## API Service — Smart Score & Badges (`/api/v1/scores`)

All endpoints require `Authorization: Bearer <USER_JWT>`.

### GET /api/v1/scores/me

Get the authenticated user's Smart Score.

**Response `200`:** Score object with composite score, breakdown by category, and rank.

---

### GET /api/v1/scores/top

Get the top traders by Smart Score.

**Response `200`:** Array of top-ranked score objects.

---

### GET /api/v1/scores/me/badges

Get all badges earned by the authenticated user.

**Response `200`:** Array of badge objects with name, description, and earned timestamp.

---

### GET /api/v1/scores/:userId

Get Smart Score for a specific user.

**Response `200`:** Score object.

**Errors:** `404 NOT_FOUND`

---

### GET /api/v1/scores/:userId/badges

Get badges for a specific user.

**Response `200`:** Array of badge objects.

**Errors:** `404 NOT_FOUND`

---

## Bot Service — WhatsApp Webhook (`/webhook/whatsapp`)

### GET /webhook/whatsapp

Meta verification challenge for WhatsApp Business Cloud API.

**Auth:** None

**Query params:** `hub.mode`, `hub.verify_token`, `hub.challenge`

**Response `200`:** Returns the `hub.challenge` value if verification succeeds.

---

### POST /webhook/whatsapp

Incoming WhatsApp message webhook. Validates `X-Hub-Signature-256` header using HMAC-SHA256 with `WHATSAPP_APP_SECRET`.

**Auth:** None (signature-validated)

**Response `200`:** `EVENT_RECEIVED`

---

## API Service — WebSocket  (`wss://polyforge.app/ws`)

### Connection & auth

```javascript
const ws = new WebSocket('wss://polyforge.app/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'AUTH', token: 'Bearer eyJ...' }));
};
```

If the token is invalid, the server sends `AUTH_ERROR` and closes the connection.

### Client → Server messages

| Message type | Payload | Description |
|---|---|---|
| `AUTH` | `{ token: string }` | Authenticate (must be first message) |
| `SUBSCRIBE_PRICES` | `{ tokenIds: string[] }` | Subscribe to price updates for tokens |
| `UNSUBSCRIBE_PRICES` | `{ tokenIds: string[] }` | Unsubscribe |
| `SUBSCRIBE_STRATEGY` | `{ strategyId: string }` | Subscribe to strategy events |
| `UNSUBSCRIBE_STRATEGY` | `{ strategyId: string }` | Unsubscribe |
| `SUBSCRIBE_WHALES` | `{}` | Subscribe to whale trade events |
| `UNSUBSCRIBE_WHALES` | `{}` | Unsubscribe from whale trade events |
| `PING` | `{}` | Keepalive |

### Server → Client messages

| Message type | Payload | Trigger |
|---|---|---|
| `AUTH_OK` | `{ userId: string }` | Successful auth |
| `AUTH_ERROR` | `{ message: string }` | Invalid token |
| `PONG` | `{}` | Response to PING |
| `PRICE_UPDATE` | `{ tokenId, price, timestamp }` | Every price tick for subscribed tokens |
| `ORDER_PLACED` | `{ orderId, intentId, strategyId, status: "PENDING" }` | Order created |
| `ORDER_SUBMITTED` | `{ orderId, clobOrderId }` | Order sent to CLOB |
| `ORDER_FILLED` | `{ orderId, filledSize, avgFillPrice, pnl }` | Order fully filled |
| `ORDER_PARTIAL` | `{ orderId, filledSize, remainingSize }` | Partial fill |
| `ORDER_CANCELLED` | `{ orderId, reason }` | Order cancelled |
| `ORDER_FAILED` | `{ orderId, error }` | Order failed (non-retryable) |
| `ORDER_ERROR` | `{ orderId, error }` | Order entered DLQ |
| `STRATEGY_STARTED` | `{ strategyId }` | Strategy is now RUNNING |
| `STRATEGY_STOPPED` | `{ strategyId, reason }` | Strategy is now IDLE |
| `STRATEGY_PAUSED` | `{ strategyId, reason }` | Strategy is now PAUSED |
| `STRATEGY_RESUMED` | `{ strategyId }` | Strategy is now RUNNING again |
| `STRATEGY_ERROR` | `{ strategyId, error, blockType }` | Block evaluation error |
| `BACKTEST_PROGRESS` | `{ runId, progress: 0-100 }` | Backtest progress update |
| `BACKTEST_COMPLETED` | `{ runId, winRate, totalPnl, ... }` | Backtest finished |
| `BACKTEST_FAILED` | `{ runId, error }` | Backtest failed |
| `MARKET_RESOLVING` | `{ marketId, expectedResolutionAt }` | Market entering resolution |
| `MARKET_RESOLVED` | `{ marketId, outcome, redemptionValue }` | Market resolved |
| `PRICE_ALERT_TRIGGERED` | `{ alertId, tokenId, price, direction }` | Price alert fired |
| `POSITION_CLOSED` | `{ positionId, tokenId, realizedPnl }` | Position fully closed |
| `POSITION_REDEEMED` | `{ positionId, redemptionValue, txHash }` | Resolution redemption |
| `NOTIFICATION` | `{ type, title, body }` | In-app notification |
| `TICKET_REPLY` | `{ ticketId, subject, adminName }` | Admin replied to your ticket |
| `TICKET_CLOSED` | `{ ticketId, subject }` | Your ticket was closed |
| `WHALE_TRADE` | `{ walletAddress, tokenId, side, size, price }` | Whale trade detected (whale subscribers only) |
| `NEWS_SIGNAL` | `{ newsId, marketId, direction, confidence, provider }` | AI-generated trade signal from news analysis |
| `DISCONNECT` | `{ reason }` | Server is shutting down (graceful) |

---

## Admin Auth Service  (`/auth/v1` on admin subdomain)

### POST /auth/v1/login

**Auth:** None  
**Rate limit:** 10 req/15min per IP + IP allowlist enforced by Nginx

**Request:**
```json
{
  "email": "admin@polyforge.app",
  "password": "AdminPass1234!"
}
```

**Response `200`:**
```json
{
  "token": "eyJ...",
  "admin": {
    "id": "uuid",
    "email": "admin@polyforge.app",
    "role": "SUPER_ADMIN",
    "displayName": "Admin"
  }
}
```

**Errors:** `400 INVALID_CREDENTIALS` · `403 IP_NOT_ALLOWLISTED`

---

### POST /auth/v1/logout

**Auth:** Admin JWT

**Response `204`:** No body. Session revoked in Redis immediately.

---

## Admin API Service  (`/api/v1` on admin subdomain)

All endpoints require `Authorization: Bearer <ADMIN_JWT>`.

---

### Dashboard

#### GET /api/v1/health

System health — all services + dependencies.

**Response `200`:**
```json
{
  "status": "healthy",
  "services": {
    "auth-service": { "status": "healthy", "latencyMs": 2 },
    "strategy-engine": { "status": "healthy", "latencyMs": 1 }
  },
  "db": { "status": "healthy", "connections": 8 },
  "redis": { "status": "healthy", "memoryUsageMb": 45 }
}
```

---

### Users

#### GET /api/v1/users

**Query params:** `page`, `limit`, `search` (email/username), `status`, `suspended`

**Response `200`:** `PaginatedResponse<AdminUserView>`

---

#### GET /api/v1/users/:id

Full user detail including credential status (no key values), login history, strategy summary.

---

#### PATCH /api/v1/users/:id/suspend

**Request:**
```json
{ "reason": "ToS violation — spam" }
```

**Response `200`:**
```json
{ "suspended": true, "suspendedAt": "...", "reason": "..." }
```

---

#### PATCH /api/v1/users/:id/unsuspend

**Response `200`:**
```json
{ "suspended": false }
```

---

#### PATCH /api/v1/users/:id/limits

**Request:** Any subset of limit fields.

**Response `200`:** Updated UserLimit object.

---

### User API Keys (Admin)

#### GET /api/v1/users/:id/api-keys

List all API keys for a specific user.

**Auth:** Admin JWT

**Response `200`:** Array of API key objects (same shape as user-facing list, without `tokenHash`).

---

#### DELETE /api/v1/users/:id/api-keys/:keyId

Revoke a specific API key for a user. Audit logged.

**Auth:** Admin JWT

**Response `204`:** No body.

**Errors:** `404 API_KEY_NOT_FOUND`

---

### Strategies

#### GET /api/v1/strategies

All strategies (all users).

**Query params:** `page`, `limit`, `userId`, `status`, `visibility`

---

#### POST /api/v1/strategies/:id/force-stop

Stop a running strategy regardless of owner.

**Response `200`:**
```json
{ "status": "IDLE", "stoppedBy": "admin" }
```

---

#### POST /api/v1/strategies/templates

Create a new platform template.

**Request:** Same as user strategy creation + `template: true`.

---

#### PATCH /api/v1/strategies/:id/unpublish

Admin unpublishes a strategy (sets visibility to `PRIVATE`).

**Auth:** Admin JWT

**Response `200`:**
```json
{
  "id": "uuid",
  "visibility": "PRIVATE",
  "unpublishedAt": "2026-03-12T10:00:00Z",
  "unpublishedBy": "admin"
}
```

**Errors:** `404 NOT_FOUND` · `422 ALREADY_PRIVATE`

---

### Orders

#### GET /api/v1/orders

All orders (all users).

**Query params:** `page`, `limit`, `userId`, `status`, `from`, `to`

---

#### GET /api/v1/orders/dlq

Dead letter queue entries.

**Response `200`:** Array of DLQ messages.

---

#### POST /api/v1/orders/dlq/:intentId/replay

Re-publish a DLQ entry to `stream:orders`.

**Response `200`:**
```json
{ "replayed": true, "intentId": "uuid" }
```

---

#### POST /api/v1/orders/dlq/:intentId/discard

Mark as dismissed without replaying.

**Response `200`:**
```json
{ "discarded": true }
```

---

### Cache

#### GET /api/v1/cache/stats

Cache hit rates, key counts, memory usage.

---

#### DELETE /api/v1/cache/:pattern

Flush a cache key pattern (e.g. `cache:market:*`).

**Response `200`:**
```json
{ "keysDeleted": 48 }
```

---

### Rate Limits

#### GET /api/v1/rate-limits

Current Polymarket API rate limit usage per endpoint.

---

### Backtests

#### GET /api/v1/backtests

All backtest runs (all users).

---

#### POST /api/v1/backtests/:id/cancel

Admin cancels a stuck or running backtest. Sets status to `CANCELLED`.

**Auth:** Admin JWT

**Response `200`:**
```json
{ "id": "uuid", "status": "CANCELLED", "cancelledAt": "2026-03-12T10:00:00Z" }
```

**Errors:** `404 NOT_FOUND` · `422 BACKTEST_NOT_RUNNING`

---

### Reports

#### GET /api/v1/reports

**Query params:** `status` (`PENDING`|`REVIEWED`|`DISMISSED`)

---

#### PATCH /api/v1/reports/:id

**Request:**
```json
{
  "status": "REVIEWED",
  "adminNote": "Strategy removed — confirmed spam"
}
```

---

### Notifications

#### POST /api/v1/notifications/broadcast

Send a notification to all users or a subset.

**Request:**
```json
{
  "channel": "EMAIL",
  "templateId": "platform_announcement",
  "subject": "Important update",
  "userIds": null,
  "metadata": { "body": "..." }
}
```
`userIds: null` means all users.

---

#### GET /api/v1/notifications/stats

Returns notification delivery statistics.

**Auth:** Admin JWT

**Response `200`:**
```json
{
  "channels": {
    "EMAIL": { "sent": 1240, "delivered": 1198, "failed": 42 },
    "PUSH": { "sent": 890, "delivered": 872, "failed": 18 },
    "WEBSOCKET": { "sent": 5600, "delivered": 5600, "failed": 0 }
  },
  "recentFailures": [
    { "channel": "EMAIL", "recipient": "user@example.com", "error": "SMTP timeout", "at": "2026-03-12T09:45:00Z" }
  ],
  "totalSent": 7730,
  "totalFailed": 60
}
```

---

### Key Rotation

#### GET /api/v1/key-rotation/status

Returns current JWT secret rotation status.

**Auth:** Admin JWT

**Response `200`:**
```json
{
  "lastRotatedAt": "2026-03-24T10:00:00Z",
  "nextScheduledAt": null,
  "activeSecretsCount": 2,
  "status": "idle"
}
```

---

#### POST /api/v1/key-rotation/start

Initiate JWT secret rotation. Generates a new secret, stores the old secret in Redis with a grace period TTL for dual validation, and returns the hash of the new secret.

**Auth:** Admin JWT (SUPER_ADMIN only)

**Response `200`:**
```json
{
  "secretHash": "sha256-hex-string",
  "gracePeriodSeconds": 3600
}
```

---

### Strategy Templates (Admin)

#### POST /api/v1/strategies/templates

Mark an existing strategy as a platform template. SUPER_ADMIN only.

**Auth:** Admin JWT (SUPER_ADMIN only)

**Request:**
```json
{ "strategyId": "uuid" }
```

**Response `200`:**
```json
{ "id": "uuid", "template": true }
```

**Errors:** `404 NOT_FOUND` · `422 ALREADY_TEMPLATE`

---

### Config Flags

#### GET /api/v1/config

Returns all runtime configuration flags.

**Response `200`:**
```json
{ "inviteOnly": false }
```

---

#### PATCH /api/v1/config/invite-only

Toggle invite-only registration mode. Changes take effect immediately (Redis-backed).

**Body:**
```json
{ "enabled": true }
```

**Response `200`:**
```json
{ "inviteOnly": true }
```

---

### Invites

#### POST /api/v1/invites

Generate a batch of invite codes.

**Body:**
```json
{ "count": 10, "uses": 1, "ttlDays": 7 }
```

**Response `201`:**
```json
{ "codes": ["ABC123", "DEF456", "..."] }
```

---

#### GET /api/v1/invites

List all active invite codes with remaining uses and TTL.

**Response `200`:**
```json
[{ "code": "ABC123", "remainingUses": 1, "ttl": 604800 }]
```
TTL is in seconds; `-1` means no expiry.

---

#### DELETE /api/v1/invites/:code

Revoke an invite code immediately.

**Response `204`:** No content.

---

### Waitlist

#### GET /api/v1/waitlist

List all waitlist entries ordered by join date (oldest first).

**Response `200`:**
```json
{ "total": 42, "data": [{ "email": "user@example.com", "joinedAt": "2026-03-01T10:00:00Z" }] }
```

---

#### DELETE /api/v1/waitlist/:email

Remove an email from the waitlist.

**Response `204`:** No content.

---

#### POST /api/v1/waitlist/:email/send-invite

Generate a single-use invite code and email it to a waitlist entry.

**Response `200`:**
```json
{ "code": "XYZ789", "sentTo": "user@example.com" }
```

---

### Support Tickets (Admin)

#### GET /api/v1/tickets

List all tickets (paginated, filterable).

**Query:** `page`, `limit`, `status` (OPEN|AWAITING_USER|AWAITING_ADMIN|CLOSED), `priority` (LOW|MEDIUM|HIGH|URGENT), `assignedTo` (admin UUID)

**Response `200`:** `PaginatedResponse<AdminTicket>` — includes `user.username`, `user.email`, `assignedToName` (resolved from admin DB), latest message preview.

#### GET /api/v1/tickets/:id

Get ticket detail with all messages and resolved admin names.

**Response `200`:** Full ticket with `messages[]`, `assignedToName`, `closedByName`.

#### POST /api/v1/tickets/:id/messages

Admin reply to a ticket. Auto-assigns ticket to the replying admin if unassigned.

**Body:** `{ "body": "We've fixed the issue..." }` (1–5000 chars)

**Response `201`:** TicketMessage. Sets status to `AWAITING_USER`. Emits `TICKET_REPLY` stream event. Audit logged.

#### PATCH /api/v1/tickets/:id

Update ticket status, priority, or assignment.

**Body:**
```json
{
  "status": "AWAITING_ADMIN",
  "priority": "HIGH",
  "assignedTo": "admin-uuid"
}
```

All fields optional. Setting `status: "CLOSED"` also sets `closedBy` and `closedAt`. Emits `TICKET_CLOSED` stream event when closing. Audit logged.

#### POST /api/v1/tickets/:id/close

Shorthand to close a ticket. Sets status to CLOSED, records `closedBy`/`closedAt`. Audit logged.

---

### Audit & Logs

#### GET /api/v1/logs/audit

**Query params:** `page`, `limit`, `userId`, `adminId`, `action`, `from`, `to`

---

#### GET /api/v1/logs/events

`stream:events` history from `event_log` table.

---

#### GET /api/v1/logs/logins

User login history.

---

#### GET /api/v1/logs/notifications

Notification send history.

---

### Builder Program

#### GET /api/v1/builder/stats

Attributed volume, current tier, weekly rewards.

---

### Admin Management  *(SUPER_ADMIN only)*

All endpoints in this section return `403 FORBIDDEN` for `ADMIN` and `VIEWER` roles.

#### GET /api/v1/admins

List all admin accounts.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "email": "alice@admin.local",
    "displayName": "Alice",
    "role": "SUPER_ADMIN",
    "active": true,
    "createdAt": "2026-01-01T00:00:00Z",
    "lastSeen": "2026-03-18T10:00:00Z"
  }
]
```

---

#### POST /api/v1/admins

Create a new admin account.

**Request:**
```json
{
  "email": "bob@admin.local",
  "displayName": "Bob",
  "password": "SecurePass1",
  "role": "ADMIN"
}
```

**Validation:**
- `email` — valid email, unique
- `displayName` — 2–100 chars
- `password` — min 8 chars
- `role` — `SUPER_ADMIN` | `ADMIN` | `VIEWER`

**Response `201`:** Same shape as list item above.

**Errors:** `409 EMAIL_TAKEN`

---

#### PATCH /api/v1/admins/:id

Update an existing admin account. All fields are optional.

**Request:**
```json
{
  "displayName": "Bobby",
  "role": "VIEWER",
  "active": false,
  "password": "NewPassword1"
}
```

**Constraints:**
- A super admin cannot change their own role or set their own `active` to `false`

**Response `200`:** Updated admin object.

**Errors:** `403 SELF_MODIFY` · `404 NOT_FOUND`

---

#### DELETE /api/v1/admins/:id

Deactivate an admin account (sets `active = false`; does not delete the record).

**Constraints:** Cannot deactivate your own account.

**Response `200`:**
```json
{ "deactivated": true }
```

**Errors:** `403 SELF_DEACTIVATE` · `404 NOT_FOUND`

---

### Admin WebSocket  (`wss://admin.polyforge.app/ws`)

All standard user WS messages plus:

| Message type | Payload | Trigger |
|---|---|---|
| `SERVICE_HEALTH` | `{ serviceName, status, latencyMs }` | Every 10s |
| `ORDER_DLQ` | `{ intentId, userId, attempts, lastError }` | Order enters DLQ |
| `DATA_GAP_DETECTED` | `{ tokenId, gapStart, gapEnd, durationMin }` | Market data gap |
| `RATE_LIMIT_WARNING` | `{ endpoint, currentPct }` | 80% of API rate limit |
| `RATE_LIMIT_CRITICAL` | `{ endpoint, currentPct }` | 95% of API rate limit |
| `CANARY_TRIGGERED` | `{ detectedAt, sourceIp }` | Canary credentials used |
| `KEY_ROTATION_PROGRESS` | `{ rotated, total, status }` | During rotation job |
| `REPORT_QUEUE_UPDATE` | `{ pendingCount }` | New report filed |
| `SYSTEM_ERROR` | `{ service, error, severity }` | Unhandled exception in any service |

---

## API Service — Whale Tracking (`/api/v1/whales`)

### GET /api/v1/whales/feed

List recent whale transactions. Supports filtering by token, size, and direction.

**Auth:** User JWT

**Query params:** `?token=string&minSize=number&direction=BUY|SELL&page=1&limit=20`

**Response `200`:** Array of whale transaction objects with address, token, size, direction, price, and timestamp.

---

### GET /api/v1/whales/top

Ranked leaderboard of whale addresses by volume, win rate, and P&L.

**Auth:** User JWT

**Query params:** `?sortBy=volume|winRate|pnl&page=1&limit=20`

**Response `200`:** Array of whale profile summaries with address, total volume, win rate, P&L, and trade count.

---

### GET /api/v1/whales/:address

Detailed profile for a specific whale address including activity history, holdings, and performance stats.

**Auth:** User JWT

**Response `200`:** Whale profile object with address, holdings, recent trades, volume, win rate, and P&L.

**Errors:** `404 NOT_FOUND`

---

### POST /api/v1/whales/:address/follow

Follow a whale address to receive alerts on their activity.

**Auth:** User JWT

**Response `201`:** `{ "followed": true }`

**Errors:** `409 ALREADY_FOLLOWING`

---

### GET /api/v1/whales/following

List all whale addresses the authenticated user is following.

**Auth:** User JWT

**Response `200`:** Array of followed whale addresses with follow timestamps.

---

## API Service — Copy Trading (`/api/v1/copy`)

### POST /api/v1/copy

Create a new copy trading session for a target trader.

**Auth:** User JWT

**Request:**
```json
{
  "targetUserId": "uuid",
  "allocation": 1000,
  "maxPositionSize": 500,
  "dailyLossLimit": 200,
  "perTradeCap": 100,
  "drawdownBreaker": 0.15
}
```

**Response `201`:** Copy session object with id, status, risk controls, and creation timestamp.

---

### GET /api/v1/copy

List all copy trading sessions for the authenticated user.

**Auth:** User JWT

**Query params:** `?status=ACTIVE|PAUSED&page=1&limit=20`

**Response `200`:** Array of copy session objects.

---

### GET /api/v1/copy/:id

Get details of a specific copy trading session.

**Auth:** User JWT

**Response `200`:** Copy session object with current P&L, trade count, and risk control status.

**Errors:** `404 NOT_FOUND`

---

### PATCH /api/v1/copy/:id

Update risk controls or allocation on an existing copy session.

**Auth:** User JWT

**Request:**
```json
{
  "allocation": 1500,
  "maxPositionSize": 750,
  "dailyLossLimit": 300
}
```

**Response `200`:** Updated copy session object.

**Errors:** `404 NOT_FOUND`

---

### POST /api/v1/copy/:id/pause

Pause an active copy trading session. No new trades will be copied.

**Auth:** User JWT

**Response `200`:** `{ "status": "PAUSED" }`

**Errors:** `404 NOT_FOUND` · `422 ALREADY_PAUSED`

---

### POST /api/v1/copy/:id/resume

Resume a paused copy trading session.

**Auth:** User JWT

**Response `200`:** `{ "status": "ACTIVE" }`

**Errors:** `404 NOT_FOUND` · `422 ALREADY_ACTIVE`

---

### DELETE /api/v1/copy/:id

Delete a copy trading session. Open positions are not automatically closed.

**Auth:** User JWT

**Response `200`:** `{ "deleted": true }`

**Errors:** `404 NOT_FOUND`

---

### GET /api/v1/copy/:id/trades

List all trades executed by a copy trading session with source trader attribution.

**Auth:** User JWT

**Query params:** `?page=1&limit=50`

**Response `200`:** Array of copied trade objects with source trade reference, size, price, and timestamp.

**Errors:** `404 NOT_FOUND`

---

## API Service — Conditional Orders (`/api/v1/orders/conditional`)

### POST /api/v1/orders/conditional

Create a conditional order (take-profit, stop-loss, trailing stop, limit, or pegged).

**Auth:** User JWT

**Request:**
```json
{
  "marketId": "uuid",
  "type": "TAKE_PROFIT | STOP_LOSS | TRAILING_STOP | LIMIT | PEGGED",
  "side": "BUY | SELL",
  "size": 100,
  "triggerPrice": 0.65,
  "trailingOffset": 0.05,
  "pegReference": "MID | BEST_BID | BEST_ASK",
  "pegOffset": 0.01
}
```

Fields are conditional on `type`: `triggerPrice` for TP/SL/LIMIT, `trailingOffset` for TRAILING_STOP, `pegReference`+`pegOffset` for PEGGED.

**Response `201`:** Conditional order object with id, status `PENDING`, and creation timestamp.

---

### GET /api/v1/orders/conditional

List all conditional orders for the authenticated user.

**Auth:** User JWT

**Query params:** `?status=PENDING|TRIGGERED|CANCELLED&marketId=uuid&page=1&limit=20`

**Response `200`:** Array of conditional order objects.

---

### GET /api/v1/orders/conditional/:id

Get details of a specific conditional order.

**Auth:** User JWT

**Response `200`:** Conditional order object with current status, trigger conditions, and execution details if triggered.

**Errors:** `404 NOT_FOUND`

---

### DELETE /api/v1/orders/conditional/:id

Cancel a pending conditional order.

**Auth:** User JWT

**Response `200`:** `{ "status": "CANCELLED" }`

**Errors:** `404 NOT_FOUND` · `422 ALREADY_TRIGGERED`

---

## API Service — News & AI Signals (`/api/v1/news`)

### GET /api/v1/news

List recent news articles with relevance scoring for prediction market events.

**Auth:** User JWT

**Query params:** `?marketId=uuid&minRelevance=0.5&page=1&limit=20`

**Response `200`:** Array of news article objects with title, source, summary, relevance score, and timestamp.

---

### GET /api/v1/news/signals

List AI-generated trade signals derived from news analysis. Signals include confidence scores, direction, and LLM reasoning.

**Auth:** User JWT

**Query params:** `?marketId=uuid&minConfidence=0.6&provider=CLAUDE|GPT4O&page=1&limit=20`

**Response `200`:** Array of signal objects with news reference, market, direction, confidence, reasoning, and provider.

---

### GET /api/v1/news/:id

Get a specific news article with full content and any associated trade signals.

**Auth:** User JWT

**Response `200`:** News article object with full content, associated signals, and metadata.

**Errors:** `404 NOT_FOUND`

---

## Common Error Codes

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |
| `INVALID_CREDENTIALS` | 400 | Wrong email or password |
| `TOTP_REQUIRED` | 400 | Account has 2FA — code not provided |
| `TOTP_INVALID` | 400 | TOTP code incorrect |
| `TOKEN_INVALID` | 400 | Email verification or reset token not found |
| `TOKEN_EXPIRED` | 400 | Token past its expiry window |
| `TOKEN_ALREADY_USED` | 400 | Token was already consumed |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `ACCOUNT_SUSPENDED` | 403 | User account is suspended |
| `FORBIDDEN` | 403 | Authenticated but not permitted |
| `IP_NOT_ALLOWLISTED` | 403 | Admin endpoint from non-whitelisted IP |
| `NOT_FOUND` | 404 | Resource does not exist |
| `EMAIL_TAKEN` | 409 | Email already registered |
| `USERNAME_TAKEN` | 409 | Username already taken |
| `ALREADY_RUNNING` | 422 | Strategy is already in RUNNING state |
| `NOT_CONNECTED` | 422 | Action requires Polymarket credentials |
| `ORDER_EXCEEDS_LIMIT` | 422 | Order size exceeds user limit |
| `STRATEGY_LIMIT_REACHED` | 422 | User is at their max strategy count |
| `ALERT_LIMIT_REACHED` | 422 | User has 50 active alerts |
| `INVALID_POLYMARKET_CREDENTIALS` | 422 | Credentials failed validation against Polymarket API |
| `CREDENTIALS_ALREADY_IMPORTED` | 422 | User already has credentials — delete first |
| `STRATEGY_IS_RUNNING` | 422 | Cannot edit a running strategy |
| `TICKET_CLOSED` | 403 | Cannot reply to a closed ticket |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Polymarket API Integrations

The following external Polymarket APIs are consumed by Polyforge services.

### Gamma API (market-data-service)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/markets?closed=false&limit=N&offset=N` | Paginated market discovery (full sync) |
| `GET` | `/events` | Fetch events that group multiple markets |

### CLOB API (order-service)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/order` | Submit a signed order |
| `DELETE` | `/order/:orderId` | Cancel a single order |
| `DELETE` | `/cancel-all` | Bulk cancel all open orders for a user |
| `DELETE` | `/cancel-orders?market={marketId}` | Bulk cancel all orders in a market |
| `GET` | `/trades?user={address}` | Fetch trades for reconciliation |

### Builder API (admin-api-service)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/builder-trades` | Fetch attributed trades, tier, and weekly rewards |

**Authentication:** Builder API requests carry `POLY-API-KEY`, `POLY-API-SECRET`, and `POLY-API-PASSPHRASE` headers using platform-level builder credentials from environment variables.

### CLOB WebSocket (market-data-service)

| Channel | Purpose |
|---|---|
| Price channel | Real-time token price updates |
| Book channel | Order book snapshots and deltas |
| User channel | Per-user order status updates |

### Data API (order-service)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/positions?user={address}` | Position reconciliation (5min cron) |

---

---

## AI-Friendly API (`/api/v1`)

### OpenAPI Spec & Swagger UI

#### GET /api/v1/docs/openapi.json

Returns the auto-generated OpenAPI 3.1 specification as JSON. No authentication required. Used by AI agents, SDK generators, and external tooling for programmatic API discovery.

**Auth:** None (public)

**Response `200`:** OpenAPI 3.1 JSON document.

---

#### GET /api/v1/docs

Serves an interactive Swagger UI page for browsing and testing all API endpoints. No authentication required.

**Auth:** None (public)

**Response `200`:** HTML page with embedded Swagger UI.

---

### Actions Catalog

#### GET /api/v1/actions

Returns a structured list of all available API actions with method, path, scope, category, and parameter definitions. Designed for AI agents to discover platform capabilities programmatically.

**Auth:** None (public)

**Response `200`:**
```json
{
  "version": "1.0",
  "actions": [
    {
      "name": "list_markets",
      "description": "Browse prediction markets with optional filters",
      "method": "GET",
      "path": "/api/v1/markets",
      "scope": "READ",
      "category": "markets",
      "parameters": [...]
    }
  ]
}
```

---

### Batch API

#### POST /api/v1/batch

Execute up to 10 API requests in a single call. Each sub-request runs in parallel with the caller's auth token forwarded. Results are correlated by `id`.

**Auth:** JWT or API Key (any scope — sub-requests enforce their own scopes)

**Request:**
```json
{
  "items": [
    { "id": "a", "method": "GET", "path": "/api/v1/markets" },
    { "id": "b", "method": "GET", "path": "/api/v1/portfolio" },
    { "id": "c", "method": "POST", "path": "/api/v1/strategies", "body": { "name": "Test" } }
  ]
}
```

**Response `200`:**
```json
{
  "results": [
    { "id": "a", "status": 200, "body": { ... } },
    { "id": "b", "status": 200, "body": { ... } },
    { "id": "c", "status": 201, "body": { ... } }
  ]
}
```

**Limits:** Maximum 10 items per batch. 15s timeout per sub-request.

---

### Webhooks

Register webhook URLs to receive real-time event notifications via HTTP POST with HMAC-SHA256 signature verification.

#### POST /api/v1/webhooks

Register a webhook. Returns the HMAC secret (shown only once).

**Auth:** JWT or API Key (WRITE scope)

**Request:**
```json
{
  "url": "https://example.com/webhook",
  "events": ["ORDER_FILLED", "STRATEGY_ERROR", "WHALE_TRADE", "NEWS_SIGNAL"]
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "url": "https://example.com/webhook",
  "events": ["ORDER_FILLED", "STRATEGY_ERROR"],
  "secret": "hex-string",
  "active": true,
  "createdAt": "2026-03-24T..."
}
```

Valid event types: `ORDER_FILLED`, `STRATEGY_ERROR`, `WHALE_TRADE`, `NEWS_SIGNAL`, `BACKTEST_COMPLETE`, `DAILY_LOSS_LIMIT`, `MARKET_RESOLVED`, `PRICE_ALERT`

**Webhook payload format:**
```json
{
  "event": "ORDER_FILLED",
  "timestamp": "2026-03-24T12:00:00Z",
  "data": { ... }
}
```

Signature header: `X-Polyforge-Signature: <HMAC-SHA256 hex digest of JSON body using secret>`

---

#### GET /api/v1/webhooks

List your webhooks (secret is not returned).

**Auth:** JWT or API Key (READ scope)

---

#### DELETE /api/v1/webhooks/:id

Remove a webhook.

**Auth:** JWT or API Key (WRITE scope)

---

#### POST /api/v1/webhooks/:id/test

Send a test event to verify the webhook URL works.

**Auth:** JWT or API Key (WRITE scope)

**Response `200`:**
```json
{ "success": true, "statusCode": 200 }
```

---

### Natural Language Query

#### POST /api/v1/ai/query

Submit a natural language query to get structured data from the platform.

**Auth:** JWT or API Key (READ scope)

**Request:**
```json
{ "query": "show me my running strategies" }
```

**Response `200`:**
```json
{
  "query": "show me my running strategies",
  "intent": "list_strategies",
  "filters": { "status": "RUNNING" },
  "data": [...],
  "summary": "You have 2 running strategies: Momentum Blitz and Mean Reversion"
}
```

Supported intents: `list_strategies`, `get_portfolio`, `list_orders`, `get_whale_feed`, `get_news_signals`, `get_score`, `list_alerts`, `list_copy_configs`, `search_markets`

---

### Strategy from Description

#### POST /api/v1/strategies/from-description

Create a strategy from a natural language description using the LLM service.

**Auth:** JWT or API Key (WRITE scope)

**Request:**
```json
{
  "description": "Buy YES on any market where the price drops below 0.30 and liquidity is above $5000, with a 5% daily loss limit",
  "marketId": "optional-market-id"
}
```

**Response `201`:** Same as `POST /api/v1/strategies` — returns the created strategy object.

**Errors:** `422 LLM_PARSE_ERROR` (LLM response was not valid JSON) · `422 LLM_INVALID_BLOCKS` (LLM generated unknown block types)

---

*See also: [Architecture Addendum A3](./Polyforge-Architecture-Addendum.pdf) for the complete stream:events event taxonomy.*
