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

### Key Rotation

#### GET /api/v1/key-rotation/status

Current or last rotation job status.

---

#### POST /api/v1/key-rotation/start

Triggers the master key rotation job. SUPER_ADMIN only.

**Response `202`:**
```json
{ "jobId": "uuid", "status": "running", "totalUsers": 1250 }
```

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
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

*See also: [Architecture Addendum A3](./Polyforge-Architecture-Addendum.pdf) for the complete stream:events event taxonomy.*
