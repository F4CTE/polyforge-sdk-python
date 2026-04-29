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

### POST /auth/v1/totp/backup-codes

Regenerate TOTP backup codes. Invalidates any previously issued backup codes.

**Auth:** User JWT

**Response `200`:**
```json
{ "backupCodes": ["abc123", "def456", "ghi789", "..."] }
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

### POST /auth/v1/credentials/kalshi

Import Kalshi API credentials. Enables cross-venue trading.

**Auth:** User JWT
**Rate limit:** 3 req/hour per user

**Request:**
```json
{
  "apiKey": "kalshi-api-key",
  "privateKey": "kalshi-private-key-pem"
}
```

**Response `201`:**
```json
{ "connected": true, "importedAt": "2026-03-12T10:00:00Z" }
```

**Errors:** `400 VALIDATION_ERROR` · `422 CREDENTIALS_ALREADY_IMPORTED` · `422 INVALID_KALSHI_CREDENTIALS`

---

### DELETE /auth/v1/credentials/kalshi

Remove Kalshi credentials. Stops any Kalshi-specific strategies.

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

Refresh the access token using the refresh token cookie. No request body needed for browser clients — reads the `pf_refresh` HTTP-only cookie. API clients may provide `{ "refreshToken": "..." }` in the request body.

**Auth:** None (cookie-based)
**Rate limit:** 30 req/15min per user

**Response `200`:**
```json
{
  "token": "eyJ..."
}
```
Atomically consumes the old refresh token, rotates it, and sets new `pf_token` and `pf_refresh` cookies on the response.

**Errors:** `401 INVALID_REFRESH_TOKEN` · `401 REFRESH_TOKEN_REPLAY`

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

#### GET /api/v1/markets/search

Full-text search across market titles and descriptions.

**Auth:** User JWT

**Query params:** `q` (string, required, max 255), `limit` (int, default 20, max 100)

**Response `200`:** Array of matching market objects with relevance scoring.

---

#### GET /api/v1/markets/:marketId/alerts

List the authenticated user's price alerts for a specific market.

**Auth:** User JWT

**Response `200`:** Array of alert objects for the given market.

---

#### POST /api/v1/markets/:marketId/alerts

Create a price alert for a market outcome.

**Auth:** JWT or API Key (WRITE scope)

**Request:**
```json
{ "outcome": "YES", "condition": "above", "threshold": 0.75 }
```

**Response `201`:** Alert object.

**Errors:** `422 ALERT_LIMIT_REACHED`

---

#### DELETE /api/v1/markets/:marketId/alerts/:alertId

Delete a market-specific price alert.

**Auth:** JWT or API Key (WRITE scope)

**Response `204`:** No body.

---

#### GET /api/v1/markets/:marketId/sentiment

Get community sentiment votes for a market.

**Auth:** User JWT

**Response `200`:**
```json
{ "marketId": "uuid", "yesVotes": 142, "noVotes": 58, "userVote": "YES" }
```

---

#### POST /api/v1/markets/:marketId/sentiment

Cast a sentiment vote on a market.

**Auth:** User JWT

**Request:**
```json
{ "vote": "YES" }
```

**Response `200`:** Updated sentiment object.

---

#### GET /api/v1/markets/:tokenId/tick-size

Get the minimum tick size for a token.

**Auth:** User JWT

**Response `200`:**
```json
{ "tokenId": "...", "tickSize": "0.01" }
```

---

#### GET /api/v1/markets/:tokenId/spread

Get the current bid-ask spread for a token.

**Auth:** User JWT

**Response `200`:**
```json
{ "tokenId": "...", "bid": 0.71, "ask": 0.73, "spread": 0.02, "spreadBps": 278 }
```

---

#### GET /api/v1/markets/:tokenId/midpoint

Get the market midpoint price for a token.

**Auth:** User JWT

**Response `200`:**
```json
{ "tokenId": "...", "midpoint": 0.72, "timestamp": 1234567890123 }
```

---

#### GET /api/v1/markets/:tokenId/clob-book

Get the full CLOB order book for a token.

**Auth:** User JWT

**Response `200`:**
```json
{
  "tokenId": "...",
  "bids": [{ "price": "0.71", "size": "500", "orders": 3 }],
  "asks": [{ "price": "0.73", "size": "450", "orders": 2 }],
  "timestamp": 1234567890123
}
```

---

#### GET /api/v1/markets/:tokenId/clob-prices-history

Get CLOB price history with configurable interval and fidelity.

**Auth:** User JWT

**Query params:** `interval` (`1m`|`5m`|`1h`|`4h`|`1d`|`1w`|`max`, default `1h`), `fidelity` (1–500, default 60)

**Response `200`:**
```json
{
  "tokenId": "...",
  "interval": "1h",
  "fidelity": 60,
  "candles": [{ "time": "2026-03-12T09:00:00Z", "open": "0.70", "high": "0.74", "low": "0.69", "close": "0.72" }]
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

#### GET /api/v1/strategies/:id/export

Export a strategy as a JSON file. Returns a downloadable attachment.

**Auth:** User JWT

**Response `200`:** `application/json` with `Content-Disposition: attachment` header. Contains full strategy definition.

---

#### POST /api/v1/strategies/import

Import a strategy from a previously exported JSON file.

**Auth:** User JWT

**Request:**
```json
{
  "polyforge": "1.0",
  "exportedAt": "2026-03-12T10:00:00Z",
  "strategy": { "name": "...", "triggers": [...], "conditions": [...], "actions": [...], "safety": [...] }
}
```

**Response `201`:** New strategy object (imported as a private copy).

**Errors:** `400 INVALID_EXPORT_FORMAT`

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
  "intentId": "uuid",
  "status": "REDEEMED"
}
```

> **Note:** Redemption is async — a redemption intent is published to `stream:redemptions` for the signer-service to process on-chain. The `intentId` can be used to track settlement progress. A future `POST /api/v1/orders/redeem/intent` endpoint may expose synchronous on-chain settlement.

**Errors:** `404 POSITION_NOT_FOUND` · `422 MARKET_NOT_RESOLVED` · `422 NOT_CONNECTED` · `451 GEO_BLOCKED`

---

#### POST /api/v1/orders/split

Split USDC.e into Yes + No outcome tokens for a market.

**Auth:** JWT or API Key (TRADE scope) + GeoBlockGuard
**Rate limit:** 30 req/min

**Request:**
```json
{ "tokenId": "...", "amount": "100.000000" }
```

**Response `200`:**
```json
{ "tokenIds": ["yes-token-id", "no-token-id"], "amounts": ["100.000000", "100.000000"] }
```

---

#### POST /api/v1/orders/merge

Merge Yes + No outcome tokens back into USDC.e.

**Auth:** JWT or API Key (TRADE scope) + GeoBlockGuard
**Rate limit:** 30 req/min

**Request:**
```json
{ "tokenId": "...", "amount": "100.000000" }
```

**Response `200`:**
```json
{ "balance": 100.0 }
```

---

#### POST /api/v1/orders/batch

Place multiple orders in a single request (1–15 orders per batch).

**Auth:** JWT or API Key (TRADE scope) + GeoBlockGuard
**Rate limit:** 10 req/min

**Request:**
```json
{
  "orders": [
    { "tokenId": "...", "side": "BUY", "outcome": "YES", "size": 50, "price": 0.45 }
  ]
}
```

**Response `202`:**
```json
{ "batchId": "uuid", "orders": [{ "orderId": "uuid", "status": "PENDING" }] }
```

---

#### DELETE /api/v1/orders/bulk

Cancel multiple orders by ID (up to 3000 per request).

**Auth:** JWT or API Key (TRADE scope)

**Request:**
```json
{ "orderIds": ["uuid-1", "uuid-2"] }
```

**Response `200`:**
```json
{ "cancelled": 2, "failed": 0, "details": [] }
```

---

#### POST /api/v1/orders/place

Place a single order.

**Auth:** User JWT
**Rate limit:** 30 req/min

**Request:**
```json
{
  "tokenId": "...",
  "side": "BUY",
  "outcome": "YES",
  "size": 100,
  "price": 0.55,
  "orderType": "GTC"
}
```

`orderType`: `GTC` (default) | `FOK` | `GTD` | `FAK` | `POST_ONLY`

**Response `200`:**
```json
{ "orderId": "uuid", "status": "OPEN", "remainingSize": 100 }
```

**Errors:** `400 VALIDATION_ERROR` · `403 NOT_CONNECTED` · `451 GEO_BLOCKED`

---

#### DELETE /api/v1/orders/:id

Cancel a single order by ID.

**Auth:** User JWT

**Response `200`:**
```json
{ "orderId": "uuid", "status": "CANCELLED" }
```

**Errors:** `404 ORDER_NOT_FOUND`

---

#### GET /api/v1/orders/export/csv

Export all user orders as a CSV file.

**Auth:** JWT or API Key (READ scope)

**Response `200`:** `text/csv` attachment.

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

#### GET /api/v1/portfolio/export/csv

Export portfolio data as a CSV file.

**Auth:** User JWT

**Response `200`:** `text/csv` attachment.

---

#### GET /api/v1/portfolio/polymarket/portfolio

Get Polymarket portfolio for the user's connected wallet.

**Auth:** User JWT

**Response `200`:** Array of portfolio entries from the Polymarket Data API. Empty array if wallet not connected.

---

#### GET /api/v1/portfolio/polymarket/earnings

Get Polymarket earnings for the user's connected wallet.

**Auth:** User JWT

**Response `200`:** Array of earnings entries from Polymarket.

---

#### GET /api/v1/portfolio/polymarket/activity

Get Polymarket activity log for the user's connected wallet.

**Auth:** User JWT

**Query params:** `type` (`TRADE`|`SPLIT`|`MERGE`|`REDEEM`|`REWARD`|`CONVERSION`|`MAKER_REBATE`|`REFERRAL_REWARD`, optional)

**Response `200`:** Array of activity records, filtered by type if provided.

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

## API Service — Prediction Accuracy & Calibration (`/api/v1/accuracy`)

### GET /api/v1/accuracy/me

Get the authenticated user's prediction accuracy and calibration stats, computed on-the-fly from all resolved and redeemed positions.

**Auth:** User JWT or API Key (READ scope)

**Response `200`:**
```json
{
  "brierScore": 0.18,
  "totalPredictions": 142,
  "correctPredictions": 97,
  "winRate": 0.683,
  "calibration": [
    { "bucketMid": 0.05, "frequency": 0.04, "count": 12 },
    { "bucketMid": 0.15, "frequency": 0.13, "count": 24 },
    { "bucketMid": 0.25, "frequency": 0.22, "count": 18 }
  ],
  "byCategory": {
    "crypto": { "count": 55, "brierScore": 0.14 },
    "politics": { "count": 61, "brierScore": 0.21 },
    "sports": { "count": 26, "brierScore": 0.19 }
  }
}
```

**Notes:**
- `brierScore` ranges 0–1; lower is better
- `calibration` divides the 0–1 probability range into 10% buckets; `frequency` is the actual outcome rate for predictions in that bucket
- `byCategory` shows Brier score broken down by market category

**Errors:** `401 UNAUTHORIZED`

---

## API Service — AI Portfolio Optimizer (`/api/v1/ai`)

### GET /api/v1/ai/portfolio-review

Get an AI-generated portfolio analysis with actionable suggestions and a quality score. Uses LlmService internally; falls back to a pattern-based review if the LLM is unavailable.

**Auth:** User JWT or API Key (READ scope)

**Response `200`:**
```json
{
  "review": "Your portfolio shows strong conviction in crypto markets with 58% allocation...",
  "suggestions": [
    "Consider reducing crypto exposure ahead of upcoming volatility events",
    "Your politics positions are well-diversified — no changes recommended",
    "Three positions are within 5 days of resolution; review take-profit levels"
  ],
  "score": 7,
  "generatedAt": "2026-03-30T12:00:00Z"
}
```

**Notes:**
- `score` is 1–10; higher is better
- `generatedAt` is the UTC timestamp of generation
- If the LLM is unavailable, `review` and `suggestions` are derived from rule-based pattern analysis; the response shape is identical

**Errors:** `401 UNAUTHORIZED`

---

## API Service — Sentiment Intelligence (`/api/v1/news`)

### GET /api/v1/news/sentiment/:marketId

Get the aggregated sentiment score for a specific market, computed from the last 7 days of NewsSignal records.

**Auth:** User JWT or API Key (READ scope)

**Path param:** `marketId` — the Polymarket market ID

**Response `200`:**
```json
{
  "marketId": "mkt-abc",
  "score": 42,
  "label": "BULLISH",
  "signalCount": 18,
  "lastUpdated": "2026-03-30T11:45:00Z"
}
```

**Notes:**
- `score` ranges from -100 (maximally bearish) to +100 (maximally bullish)
- `label` is `BULLISH` (score > 20), `BEARISH` (score < -20), or `NEUTRAL`
- Score formula: `(bullish - bearish) / total * 100` where BUY signals are bullish and SELL signals are bearish
- `signalCount` is the number of NewsSignal records used in the calculation

**Errors:** `401 UNAUTHORIZED` · `404 NOT_FOUND` (no signals for the given market)

---

## API Service — LP / Market Making (`/api/v1/lp`)

### POST /api/v1/lp/provide

Place two-sided quotes on a market (BUY at mid minus half-spread, SELL at mid plus half-spread). Creates two pending Order records and publishes intents to the Redis order stream.

**Auth:** User JWT or API Key (TRADE scope)
**Rate limit:** 10 req/min per account (each call creates 2 order records)

**Request:**
```json
{
  "tokenId": "tok-yes-abc",
  "spread": 0.04,
  "size": 200
}
```

- `tokenId` — the YES or NO token to quote
- `spread` — total spread as a decimal (e.g. `0.04` = 4 cents on a $1 token)
- `size` — USDC size for each side of the quote

**Response `201`:**
```json
{
  "buyOrderId": "ord-buy-uuid",
  "sellOrderId": "ord-sell-uuid",
  "tokenId": "tok-yes-abc",
  "buyPrice": 0.48,
  "sellPrice": 0.52,
  "size": 200
}
```

**Notes:**
- `buyPrice` = `midPrice - spread / 2`
- `sellPrice` = `midPrice + spread / 2`
- Mid price is sourced from the Redis price cache
- Both orders follow the standard order lifecycle (`PENDING` → `SUBMITTED` → ...)

**Errors:** `401 UNAUTHORIZED` · `422 NOT_CONNECTED` · `404 TOKEN_NOT_FOUND` · `429 RATE_LIMITED`

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

## Merge Arbitrage  (`/api/v1/arbitrage`)

### GET /api/v1/arbitrage

Scan all active prediction markets for merge arbitrage opportunities — situations where the combined cost of buying one YES share and one NO share is less than $1.00, guaranteeing a risk-free profit at resolution.

**Auth:** JWT or API Key (READ scope)

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `minMargin` | `number` | Minimum margin percentage to include (e.g. `2` = 2%). Default: any positive margin. |

**Response `200`:**
```json
[
  {
    "marketId": "mkt-abc",
    "marketTitle": "Will BTC exceed $100k by end of Q2?",
    "category": "crypto",
    "endDate": "2026-06-30T23:59:59Z",
    "yesTokenId": "tok-yes-abc",
    "noTokenId": "tok-no-abc",
    "yesPrice": "0.47",
    "noPrice": "0.49",
    "sum": "0.96",
    "marginPct": "4.17",
    "costPerUnit": "0.96",
    "profitPerUnit": "0.04"
  }
]
```

**Notes:**
- Prices are sourced from the Redis price cache and may lag by up to 5 seconds
- Only markets with both YES and NO token prices available are included
- `marginPct` = `(1 - sum) / sum * 100`

---

### Cross-Venue Arbitrage

#### GET /api/v1/arbitrage/cross-venue

List cross-venue arbitrage opportunities between Polymarket and Kalshi.

**Auth:** User JWT

**Query params:** `minSpread` (number, default 3 — minimum spread percentage)

**Response `200`:** Array of `CrossVenueOpportunity` objects with `matchId`, `polymarketId`, `kalshiId`, `polymarketTitle`, `kalshiTitle`, `category`, `confidence`, `polymarketYes`, `kalshiYes`, `spreadPct`, `direction`.

---

#### GET /api/v1/arbitrage/cross-venue/:marketId

Cross-venue opportunities for a specific market (either venue).

**Auth:** User JWT

**Query params:** `minSpread` (number, default 3)

**Response `200`:** Array of `CrossVenueOpportunity` objects.

---

#### GET /api/v1/arbitrage/cross-venue/:matchId/comparison

Detailed price comparison for a matched market pair across venues.

**Auth:** User JWT

**Response `200`:**
```json
{
  "matchId": "match-1",
  "polymarket": { "marketId": "pm-1", "title": "...", "yesPrice": 0.55, "noPrice": 0.45 },
  "kalshi": { "marketId": "k-1", "title": "...", "yesPrice": 0.48, "noPrice": 0.52 },
  "spreadPct": 7.0,
  "confidence": 0.95,
  "verified": true
}
```

---

#### GET /api/v1/arbitrage/spread

Bid/ask spread comparison across all matched venues.

**Auth:** User JWT

**Response `200`:** Array of `SpreadSummary` objects with `matchId`, per-venue `yesBid`/`noAsk`, `yesSpreadPct`, `noSpreadPct`, `confidence`, `verified`.

---

#### GET /api/v1/arbitrage/history

Historical arbitrage opportunity snapshots.

**Auth:** User JWT

**Query params:** `matchId` (string, optional), `limit` (number, default 100), `offset` (number, default 0)

**Response `200`:** Paginated array of historical records.

---

### Arbitrage Alerts

#### GET /api/v1/arbitrage/alerts

List the authenticated user's arbitrage alert subscriptions.

**Auth:** User JWT

**Response `200`:** Array of `ArbitrageAlertSubscription` objects.

---

#### POST /api/v1/arbitrage/alerts

Create an arbitrage alert subscription — triggered when spread exceeds threshold.

**Auth:** JWT or API Key (WRITE scope)

**Request:**
```json
{ "minSpreadPct": "5", "marketId": "optional-market-id" }
```

**Response `201`:** Alert subscription object.

---

#### DELETE /api/v1/arbitrage/alerts/:id

Deactivate an arbitrage alert.

**Auth:** JWT or API Key (WRITE scope)

**Response `204`:** No body.

---

### Market Matches

#### GET /api/v1/arbitrage/matches

List market matches across venues.

**Auth:** User JWT

**Query params:** `verified` (boolean, optional), `limit` (number, default 50), `offset` (number, default 0)

**Response `200`:**
```json
{ "matches": [{ "id": "match-1", "polymarketId": "...", "kalshiId": "...", "confidence": 0.92, "matchMethod": "AUTO", "verified": true }], "total": 42 }
```

---

#### GET /api/v1/arbitrage/matches/market/:marketId

Get all matches for a specific market (from either venue).

**Auth:** User JWT

**Response `200`:** Array of `MarketMatch` objects.

---

#### GET /api/v1/arbitrage/matches/:matchId

Get a single market match by ID.

**Auth:** User JWT

**Response `200`:** `MarketMatch` object.

---

#### POST /api/v1/arbitrage/matches

Manually match two markets across venues.

**Auth:** User JWT

**Request:**
```json
{ "polymarketId": "pm-1", "kalshiId": "k-1" }
```

**Response `201`:**
```json
{ "id": "match-uuid" }
```

---

#### POST /api/v1/arbitrage/matches/:matchId/verify

Verify/confirm an auto-matched market pair.

**Auth:** User JWT

**Response `200`:** Updated match object with `verified: true`.

---

#### DELETE /api/v1/arbitrage/matches/:matchId

Remove a market match (unmatch).

**Auth:** User JWT

**Response `204`:** No body.

---

#### POST /api/v1/arbitrage/matches/sync

Trigger a manual matching pass to auto-discover new market pairs.

**Auth:** User JWT

**Response `200`:**
```json
{ "matched": 12 }
```

---

## Smart Orders  (`/api/v1/orders/smart`)

Advanced execution orders that split large trades across time or set conditional trigger logic.

### POST /api/v1/orders/smart

Place a smart order. Supported types:

| Type | Description |
|---|---|
| `TWAP` | Time-Weighted Average Price — splits `totalSize` into `slices` equal parts executed every interval |
| `DCA` | Dollar-Cost Averaging — recurring buy at fixed interval until cancelled or `maxSlices` reached |
| `BRACKET` | Entry order + automatic Take Profit and Stop Loss legs placed simultaneously |
| `OCO` | One-Cancels-Other — two conditional orders; when one fills, the other is automatically cancelled |

**Auth:** JWT or API Key (TRADE scope)
**Rate limit:** 10 requests / 60 s

**Request (TWAP example):**
```json
{
  "type": "TWAP",
  "marketId": "mkt-abc",
  "tokenId": "tok-yes-abc",
  "outcome": "YES",
  "side": "BUY",
  "totalSize": "100",
  "slices": 5,
  "intervalSeconds": 300
}
```

**Request (BRACKET example):**
```json
{
  "type": "BRACKET",
  "marketId": "mkt-abc",
  "tokenId": "tok-yes-abc",
  "outcome": "YES",
  "side": "BUY",
  "totalSize": "50",
  "entryPrice": "0.45",
  "takeProfitPrice": "0.65",
  "stopLossPrice": "0.35"
}
```

**Response `201`:**
```json
{
  "smartOrderId": "so-uuid",
  "type": "TWAP",
  "status": "PENDING",
  "slicesTotal": 5
}
```

**Errors:** `400 INVALID_SMART_ORDER` · `403 POLYMARKET_NOT_CONNECTED` · `429 RATE_LIMITED`

---

### GET /api/v1/orders/smart

List the authenticated user's smart orders with child order progress.

**Auth:** JWT or API Key (READ scope)

**Response `200`:**
```json
[
  {
    "id": "so-uuid",
    "type": "TWAP",
    "status": "ACTIVE",
    "marketId": "mkt-abc",
    "tokenId": "tok-yes-abc",
    "outcome": "YES",
    "side": "BUY",
    "totalSize": "100",
    "slicesFilled": 2,
    "slicesTotal": 5,
    "nextExecuteAt": "2026-03-30T14:05:00Z",
    "completedAt": null,
    "createdAt": "2026-03-30T14:00:00Z",
    "orders": [
      {
        "id": "ord-child-1",
        "status": "FILLED",
        "fillSize": "20",
        "fillPrice": "0.46",
        "createdAt": "2026-03-30T14:00:00Z"
      }
    ]
  }
]
```

---

### DELETE /api/v1/orders/smart/:id

Cancel a pending or active smart order. All pending child orders are also cancelled.

**Auth:** JWT or API Key (TRADE scope)

**Response `200`:**
```json
{ "cancelled": true }
```

**Errors:** `404 SMART_ORDER_NOT_FOUND` · `409 ALREADY_COMPLETED`

---

## Strategy Marketplace  (`/api/v1/marketplace`)

### GET /api/v1/marketplace

Browse published strategy listings.

**Auth:** JWT or API Key (READ scope)

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `sort` | `string` | Sort order: `popular` (default), `newest`, `top_rated`, `price_asc`, `price_desc` |
| `tag` | `string` | Filter by tag (e.g. `momentum`, `arbitrage`) |
| `limit` | `number` | Results per page. Default: 20, max: 100 |
| `offset` | `number` | Pagination offset. Default: 0 |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "lst-uuid",
      "strategyId": "strat-uuid",
      "sellerId": "user-uuid",
      "title": "Delta-Neutral Arb Bot",
      "description": "Exploits YES/NO price imbalances...",
      "priceUsdc": "49.00",
      "status": "PUBLISHED",
      "purchaseCount": 12,
      "forkCount": 12,
      "avgRating": "4.3",
      "ratingCount": 7,
      "tags": ["arbitrage", "neutral"],
      "createdAt": "2026-03-01T00:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### GET /api/v1/marketplace/my/listings

List the authenticated user's own marketplace listings (all statuses).

**Auth:** JWT or API Key (READ scope)

**Response `200`:** Array of listing objects (same schema as browse).

---

### GET /api/v1/marketplace/my/purchases

List strategies the authenticated user has purchased.

**Auth:** JWT or API Key (READ scope)

**Response `200`:** Array of listing objects the user has purchased (includes their forked strategy reference).

---

### GET /api/v1/marketplace/:id

Get a single marketplace listing by ID.

**Auth:** JWT or API Key (READ scope)

**Response `200`:** Single listing object.

**Errors:** `404 LISTING_NOT_FOUND`

---

### POST /api/v1/marketplace

Create a new marketplace listing. The strategy must be owned by the authenticated user.

**Auth:** JWT or API Key (WRITE scope)

**Request:**
```json
{
  "strategyId": "strat-uuid",
  "title": "Delta-Neutral Arb Bot",
  "description": "Exploits YES/NO price imbalances for risk-free profit",
  "priceUsdc": "49.00",
  "tags": ["arbitrage", "neutral"]
}
```

**Response `201`:** Created listing object with `status: "DRAFT"`.

**Errors:** `404 STRATEGY_NOT_FOUND` · `403 NOT_STRATEGY_OWNER`

---

### PATCH /api/v1/marketplace/:id

Update a listing's title, description, price, tags, or status. Only the listing owner can update.

**Auth:** JWT or API Key (WRITE scope)

**Request** (all fields optional):
```json
{
  "title": "Updated title",
  "priceUsdc": "39.00",
  "status": "PUBLISHED"
}
```

**Response `200`:** Updated listing object.

**Errors:** `404 LISTING_NOT_FOUND` · `403 NOT_LISTING_OWNER`

---

### POST /api/v1/marketplace/:id/purchase

Purchase a published strategy listing. The buyer receives a private fork of the strategy added to their account. Cannot purchase your own listing or purchase the same listing twice.

**Auth:** JWT or API Key (TRADE scope)

**Response `201`:**
```json
{
  "purchaseId": "pur-uuid",
  "forkedStrategyId": "strat-forked-uuid",
  "priceUsdc": 49.0,
  "platformFee": 9.8,
  "sellerNet": 39.2
}
```

**Errors:** `404 LISTING_NOT_FOUND` · `409 ALREADY_PURCHASED` · `403 CANNOT_BUY_OWN_LISTING` · `400 LISTING_NOT_PUBLISHED`

---

### POST /api/v1/marketplace/:id/rate

Submit a rating (1–5) for a purchased listing. One rating per buyer per listing.

**Auth:** JWT or API Key (WRITE scope)

**Request:**
```json
{ "rating": 4 }
```

**Response `200`:** Updated listing object with recalculated `avgRating` and `ratingCount`.

**Errors:** `404 LISTING_NOT_FOUND` · `403 NOT_PURCHASED` · `409 ALREADY_RATED`

---

---

## Watchlist

### GET /api/v1/watchlist

Returns the authenticated user's starred markets with current prices, 24h volume, and price delta.

**Auth:** JWT or API Key (READ scope)

**Response `200`:** Array of `{ marketId, slug, title, currentPrice, volume24h, priceDelta24h, watched: true }`.

---

### POST /api/v1/watchlist

Add a market to the watchlist.

**Auth:** JWT or API Key (WRITE scope)

**Request:**
```json
{ "marketId": "market-uuid" }
```

**Response `201`:** `{ marketId, addedAt }`.

**Errors:** `404 MARKET_NOT_FOUND` · `409 ALREADY_WATCHED`

---

### DELETE /api/v1/watchlist/:marketId

Remove a market from the watchlist.

**Auth:** JWT or API Key (WRITE scope)

**Response `204`:** No content.

**Errors:** `404 NOT_IN_WATCHLIST`

---

### GET /api/v1/watchlist/status/:marketId

Check whether a specific market is on the user's watchlist.

**Auth:** JWT or API Key (READ scope)

**Response `200`:** `{ marketId, watched: boolean }`.

---

## Risk Settings

### GET /api/v1/settings/risk

Returns the user's drawdown circuit breaker configuration.

**Auth:** JWT or API Key (READ scope)

**Response `200`:**
```json
{
  "drawdownEnabled": true,
  "drawdownThreshold": 10,
  "drawdownLookback": 24,
  "drawdownTriggeredAt": null
}
```

---

### PATCH /api/v1/settings/risk

Update drawdown circuit breaker settings.

**Auth:** JWT or API Key (WRITE scope)

**Request:**
```json
{
  "drawdownEnabled": true,
  "drawdownThreshold": 15,
  "drawdownLookback": 48
}
```

**Response `200`:** Updated risk settings object.

---

### POST /api/v1/settings/risk/reset

Clear the triggered circuit breaker and re-enable strategy execution.

**Auth:** JWT or API Key (WRITE scope)

**Response `200`:** `{ drawdownTriggeredAt: null, drawdownEnabled: true }`.

**Errors:** `400 NOT_TRIGGERED` if circuit breaker is not currently active.

---

## Strategy Versions

### GET /api/v1/strategies/:id/versions

Paginated list of saved strategy versions.

**Auth:** JWT or API Key (READ scope)

**Query params:** `page`, `limit`

**Response `200`:** Array of `{ versionNumber, createdAt, description, blockCount, isRollback }`.

---

### POST /api/v1/strategies/:id/versions/:versionId/rollback

Restore a strategy to a prior version. Creates a new version entry recording the rollback.

**Auth:** JWT or API Key (WRITE scope)

**Response `200`:** Updated strategy object at the restored version.

**Errors:** `404 VERSION_NOT_FOUND` · `403 FORBIDDEN`

---

### GET /api/v1/strategies/:id/event-log

Ordered list of strategy lifecycle events (created, deployed, paused, edited, rolled back).

**Auth:** JWT or API Key (READ scope)

**Response `200`:** Array of `{ event, occurredAt, actorId, meta }`.

---

## Backtest Orders

### GET /api/v1/backtests/:id/orders

Returns the simulated order history for a completed backtest run.

**Auth:** JWT or API Key (READ scope)

**Query params:** `page`, `limit`, `side` (`BUY`|`SELL`)

**Response `200`:** Paginated array of simulated orders with `price`, `size`, `side`, `timestamp`, `pnl`.

**Errors:** `404 BACKTEST_NOT_FOUND`

---

## Market History

### GET /api/v1/markets/:id/history

OHLCV-style price history for a market.

**Auth:** JWT or API Key (READ scope)

**Query params:** `from` (ISO 8601), `to` (ISO 8601), `interval` (`1m`|`5m`|`1h`|`1d`)

**Response `200`:** Array of `{ timestamp, open, high, low, close, volume }`.

**Errors:** `404 MARKET_NOT_FOUND`

---

## TOTP Re-authentication

### POST /api/v1/auth/totp/verify

Standalone TOTP re-authentication for sensitive actions. Returns a short-lived re-auth token.

**Auth:** JWT (current session)

**Request:**
```json
{ "code": "123456" }
```

**Response `200`:** `{ reAuthToken, expiresAt }` — token valid for 5 minutes.

**Errors:** `401 INVALID_TOTP` · `429 TOO_MANY_ATTEMPTS`

---

## User Preferences & Social

### PATCH /api/v1/users/me/preferences

Update user preferences (theme, locale, notification toggles, onboarding state).

**Auth:** JWT or API Key (WRITE scope)

**Request (partial):**
```json
{
  "theme": "dark",
  "locale": "en-US",
  "onboardingDismissed": true
}
```

**Response `200`:** Full preferences object.

---

### GET /api/v1/users/:id/follow

Check whether the authenticated user follows the given user.

**Auth:** JWT or API Key (READ scope)

**Response `200`:** `{ following: boolean, followedAt: string | null }`.

---

### POST /api/v1/users/:id/follow

Follow or unfollow a trader. Idempotent — calling again toggles the follow state.

**Auth:** JWT or API Key (WRITE scope)

**Response `200`:** `{ following: boolean }`.

**Errors:** `404 USER_NOT_FOUND` · `400 CANNOT_FOLLOW_SELF`

---

### GET /api/v1/users/:id/accuracy

Public accuracy statistics for a trader (Brier score, calibration curve, win rate by category).

**Auth:** Optional JWT (public endpoint)

**Response `200`:**
```json
{
  "brierScore": 0.18,
  "winRate": 0.62,
  "totalPredictions": 241,
  "calibration": [{ "bucket": "0.6-0.7", "predicted": 0.65, "actual": 0.63 }],
  "byCategory": [{ "category": "crypto", "winRate": 0.71, "brierScore": 0.14 }]
}
```

---

## API Service — Rewards (`/api/v1/rewards`)

### GET /api/v1/rewards/markets

Get all markets with available liquidity rewards.

**Auth:** User JWT

**Response `200`:** Array of reward-eligible market objects (cached 300s from Polymarket Data API).

---

### GET /api/v1/rewards/markets/:conditionId

Get reward details for a specific market by condition ID.

**Auth:** User JWT

**Response `200`:** Reward details object (cached 300s).

---

### GET /api/v1/rewards/user

Get the authenticated user's available rewards. Empty if wallet not connected.

**Auth:** User JWT

**Response `200`:**
```json
{ "rewards": [{ "type": "MAKER_REBATE", "amount": "12.50", "claimedAt": null }] }
```

---

### GET /api/v1/rewards/user/total

Get the user's total rewards with daily breakdown.

**Auth:** User JWT

**Response `200`:**
```json
{ "total": "125.00", "byDate": [{ "date": "2026-03-12", "amount": "4.50" }] }
```

---

### GET /api/v1/rewards/user/percentages

Get rewards breakdown by category as percentages.

**Auth:** User JWT

**Response `200`:**
```json
{ "MAKER_REBATE": "45.2", "REFERRAL": "30.1", "LIQUIDITY": "24.7" }
```

---

### GET /api/v1/rewards/user/markets

Get user's rewards grouped by market.

**Auth:** User JWT

**Response `200`:**
```json
{ "markets": [{ "marketId": "...", "marketTitle": "...", "amount": "5.25" }] }
```

---

### GET /api/v1/rewards/rebates

Get user's maker rebates.

**Auth:** User JWT

**Response `200`:**
```json
{ "rebates": [{ "tokenId": "...", "amount": "0.50", "date": "2026-03-12T10:00:00Z" }] }
```

---

## API Service — Notifications (`/api/v1/notifications`)

### GET /api/v1/notifications

List the authenticated user's in-app notifications with pagination.

**Auth:** User JWT

**Query params:** `page` (int, default 1), `limit` (int, default 20, max 100)

**Response `200`:** `PaginatedResponse<Notification>` — notification objects with `type`, `title`, `body`, `read`, `createdAt`.

---

## API Service — Activity Feed (`/api/v1/feed`)

### GET /api/v1/feed

Get whale activity feed (same data as `/api/v1/whales/feed` — legacy alias).

**Auth:** User JWT

**Query params:** `minSize` (number), `marketId` (string), `walletAddress` (string), `side` (`BUY`|`SELL`), `page`, `limit`

**Response `200`:** `PaginatedResponse<WhaleTrade>`

---

## API Service — Referrals (`/api/v1/referrals`)

### GET /api/v1/referrals/me

Get the authenticated user's referral code, statistics, and earnings.

**Auth:** User JWT

**Response `200`:**
```json
{
  "userId": "uuid",
  "referralCode": "ABC123",
  "totalReferred": 5,
  "activeReferred": 3,
  "earnings": "25.00",
  "referrals": [{ "userId": "uuid", "joinedAt": "...", "active": true }]
}
```

---

## API Service — Analytics (`/api/v1/analytics`)

### GET /api/v1/analytics/correlation/categories

Get market correlation data grouped by category.

**Auth:** User JWT

**Response `200`:**
```json
{ "categories": [{ "name": "crypto", "correlation": 0.82, "markets": ["mkt-1", "mkt-2"] }] }
```

---

## API Service — User Preferences (`/api/v1/users/me`)

### GET /api/v1/users/me/notification-preferences

Get per-event notification channel preferences.

**Auth:** User JWT

**Response `200`:**
```json
{
  "ORDER_FILLED": { "inApp": true, "email": true, "push": false },
  "STRATEGY_ERROR": { "inApp": true, "email": true, "push": true }
}
```

---

### PUT /api/v1/users/me/notification-preferences

Replace per-event notification channel preferences.

**Auth:** User JWT

**Request:**
```json
{
  "preferences": {
    "ORDER_FILLED": { "inApp": true, "email": false, "push": true }
  }
}
```

**Response `200`:** Updated preferences object.

---

### GET /api/v1/users/me/venue-preferences

Get venue preferences (default venue, enabled venues, single-platform mode).

**Auth:** User JWT

**Response `200`:**
```json
{ "defaultVenue": "POLYMARKET", "enabledVenues": ["POLYMARKET", "KALSHI"], "singlePlatformMode": false }
```

---

### PATCH /api/v1/users/me/venue-preferences

Update venue preferences.

**Auth:** User JWT

**Request:**
```json
{ "defaultVenue": "KALSHI", "enabledVenues": ["POLYMARKET", "KALSHI"], "singlePlatformMode": false }
```

**Response `200`:** Updated venue preferences.

---

## API Service — Profile & Settings (additional)

### PATCH /api/v1/profile/me

Update the authenticated user's display profile.

**Auth:** User JWT

**Request:** Any subset of `displayName` (max 50), `bio` (max 500), `avatarUrl` (valid URL, max 2048).

**Response `200`:** Updated user profile object.

---

### POST /api/v1/profile/password

Change the authenticated user's password.

**Auth:** User JWT

**Request:**
```json
{ "currentPassword": "Old1234!", "newPassword": "New1234!" }
```

**Response `200`:**
```json
{ "message": "Password changed" }
```

**Errors:** `400 INVALID_PASSWORD`

---

### PATCH /api/v1/profile/notifications

Update notification preference flags.

**Auth:** User JWT

**Request:** Object of notification key → boolean (e.g. `{ "onOrderFilled": true, "onStrategyError": false }`).

**Response `200`:**
```json
{ "message": "Notification preferences updated" }
```

---

### GET /api/v1/settings/notifications

Get the user's notification preferences.

**Auth:** User JWT

**Response `200`:** Object with `emailEnabled`, `telegramEnabled`, `discordEnabled`, and per-event booleans.

---

### GET /api/v1/settings/beta-usage

Get beta feature usage statistics for the authenticated user.

**Auth:** User JWT

**Response `200`:**
```json
{ "betaFeaturesEnabled": ["cross-venue", "smart-orders"], "usageCount": 42, "lastUsed": "2026-03-12T10:00:00Z" }
```

---

### GET /api/v1/accuracy

Get prediction accuracy leaderboard. Unlike `/accuracy/me` which returns the authenticated user's stats, this returns a ranked list.

**Auth:** User JWT

**Response `200`:** Array of accuracy score objects with ranking.

---

## API Service — Whale Tracking (additional)

### GET /api/v1/whales/leaderboard

Get the smart money leaderboard — whales ranked by performance.

**Auth:** User JWT

**Query params:** `period` (`24h`|`7d`|`30d`|`all`, default `all`), `limit` (number, default 20, max 100)

**Response `200`:** Array of `WhaleProfile` objects ranked by performance.

---

### GET /api/v1/whales/alerts/filter

Get the authenticated user's whale alert filter settings.

**Auth:** User JWT

**Response `200`:**
```json
{ "userId": "uuid", "minSize": "1000", "marketIds": ["m-1"], "walletAddresses": ["0xabc"], "sides": ["BUY"], "active": true }
```

---

### PUT /api/v1/whales/alerts/filter

Create or update whale alert filter settings.

**Auth:** User JWT

**Request:**
```json
{ "minSize": "1000", "marketIds": ["m-1"], "walletAddresses": ["0xabc"], "sides": ["BUY"], "active": true }
```

**Response `200`:** Updated filter object.

---

### DELETE /api/v1/whales/alerts/filter

Delete the user's whale alert filter.

**Auth:** User JWT

**Response `204`:** No body.

---

### POST /api/v1/whales/:address/unfollow

Unfollow a whale address.

**Auth:** User JWT

**Response `200`:**
```json
{ "followed": false }
```

---

## API Service — Watchlist (additional)

### GET /api/v1/watchlist/:marketId/status

Check whether a specific market is on the user's watchlist (alternative path format).

**Auth:** JWT or API Key (READ scope)

**Response `200`:**
```json
{ "marketId": "uuid", "watched": true }
```

---

## API Service — API Keys (User)

These endpoints are also accessible via the gateway at `/api/v1/api-keys` (in addition to the auth-service paths at `/auth/v1/api-keys`).

### GET /api/v1/api-keys

List the authenticated user's API keys.

**Auth:** User JWT

**Response `200`:** Array of API key objects.

---

### POST /api/v1/api-keys

Create a new API key.

**Auth:** User JWT

**Request:**
```json
{ "name": "My Bot", "scopes": ["READ", "WRITE", "TRADE"], "expiresInDays": 90 }
```

**Response `201`:** API key object with plaintext `key` (shown only once).

---

### DELETE /api/v1/api-keys/:id

Revoke an API key.

**Auth:** User JWT

**Response `204`:** No body.

---

## Admin API Service (additional)

### Dashboard

#### GET /api/v1/dashboard

System health overview — all services and dependencies.

**Auth:** Admin JWT

**Response `200`:**
```json
{ "status": "healthy", "services": { "auth-service": { "status": "healthy", "latencyMs": 2 } }, "db": { "status": "healthy" }, "redis": { "status": "healthy" } }
```

---

#### GET /api/v1/dashboard/rate-limits

Current rate limit usage statistics.

**Auth:** Admin JWT

**Response `200`:** Array of rate limit status objects per endpoint.

---

#### GET /api/v1/dashboard/platform-stats

Platform-wide statistics (users, strategies, volume).

**Auth:** Admin JWT

**Response `200`:**
```json
{ "totalUsers": 1200, "activeUsers": 450, "totalStrategies": 3400, "activeStrategies": 280, "totalVolume": "1250000.00" }
```

---

#### GET /api/v1/dashboard/marketplace-stats

Strategy marketplace statistics.

**Auth:** Admin JWT

**Response `200`:**
```json
{ "totalListings": 85, "activeListings": 42, "avgPrice": "35.00", "totalSales": 312 }
```

---

#### GET /api/v1/dashboard/beta-usage

Beta feature adoption statistics.

**Auth:** Admin JWT

**Response `200`:** Array of feature objects with `name`, `enabledCount`, `totalCount`, `adoptionRate`.

---

### Builder Program (additional)

#### GET /api/v1/builder/leaderboard

Get the builder leaderboard — top strategy creators by volume and performance.

**Auth:** Admin JWT

**Response `200`:** Array of ranked builder objects.

---

#### GET /api/v1/builder/volume

Get builder trading volume metrics and breakdown.

**Auth:** Admin JWT

**Response `200`:**
```json
{ "totalVolume": "1250000.00", "volumeByPeriod": { "today": "45000", "week": "310000", "month": "1250000" } }
```

---

### Cache (additional)

#### GET /api/v1/cache/streams

Get Redis stream statistics.

**Auth:** Admin JWT (Admin or SuperAdmin only)

**Response `200`:** Array of stream objects with `pattern`, `keyCount`, `memoryUsed`, `lastAccessed`.

---

### Sentiment

#### GET /api/v1/sentiment

Get platform-wide sentiment analysis overview for admin monitoring.

**Auth:** Admin JWT

**Query params:** `limit` (number, default 20)

**Response `200`:** Sentiment entries with top positive and negative markets.

---

### Users (additional)

#### PATCH /api/v1/users/:id/approve

Approve a pending user's registration.

**Auth:** Admin JWT

**Response `200`:**
```json
{ "id": "uuid", "status": "ACTIVE", "approvedAt": "2026-03-12T10:00:00Z" }
```

---

#### PATCH /api/v1/users/:id/reject

Reject a pending user's registration.

**Auth:** Admin JWT

**Request:**
```json
{ "reason": "Incomplete verification" }
```

**Response `200`:**
```json
{ "id": "uuid", "status": "REJECTED", "rejectionReason": "..." }
```

---

### Venues

#### GET /api/v1/venues/health

Get exchange venue connection health status.

**Auth:** Admin JWT (Admin or SuperAdmin only)

**Response `200`:**
```json
{ "venues": [{ "name": "polymarket", "status": "healthy", "latency": 45 }, { "name": "kalshi", "status": "healthy", "latency": 62 }] }
```

---

*See also: [Architecture Addendum A3](./Polyforge-Architecture-Addendum.pdf) for the complete stream:events event taxonomy.*
