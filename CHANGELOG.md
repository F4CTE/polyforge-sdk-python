# Changelog

## [1.7.0] — 2026-04-14

### Changed
- **BREAKING:** `list_strategies()` now returns `PaginatedResponse[Strategy]` instead of `list[Strategy]` — use `.data` to access the list (closes #105)
- **BREAKING:** `get_orders()` now returns `PaginatedResponse[Order]` instead of `list[Order]` — use `.data` to access the list
- **BREAKING:** `list_conditional_orders()` now returns `PaginatedResponse[ConditionalOrder]` instead of `list[ConditionalOrder]` — use `.data` to access the list

### Added
- `get_orders()`: added `page` and `market_id` parameters to match platform `OrderQueryDto`
- `list_conditional_orders()`: added `type` and `page` parameters to match platform `ConditionalOrderQueryDto`

## [1.6.20] — 2026-04-14

### Fixed
- **BREAKING:** `StrategyTemplate` model: replaced phantom fields (`risk_level`, `category`, `config`) with full `Strategy` fields — `StrategyTemplate` is now an alias for `Strategy` since the platform returns full strategy objects from `GET /api/v1/strategies/templates` (closes #44)

## [1.6.19] — 2026-04-14

### Fixed
- **BREAKING:** `Alert` model: replaced phantom fields (`name`, `condition`, `market_id`, `threshold`, `enabled`) with correct platform fields (`token_id`, `direction`, `price`, `persistent`, `triggered`, `triggered_at`) to match `PriceAlert` Prisma model (closes #107)
- **BREAKING:** `CopyConfig` model: replaced phantom fields (`source_wallet`, `label`, `max_position_size`, `enabled`, `total_copied_trades`) with correct platform fields (`target_wallet`, `mode`, `size_value`, `max_exposure`, `max_daily_loss`, `price_offset`, `status`, `total_pnl`, `total_copied`, `updated_at`, `stopped_at`) to match `CopyConfig` Prisma model (closes #108)
- `list_alerts()`, `list_copy_configs()`, `list_webhooks()`: fixed response parsing for endpoints that return raw arrays instead of `PaginatedResponse` — previously would crash with `TypeError` when platform returns `[...]` instead of `{data: [...]}`

## [1.6.18] — 2026-04-13

### Added
- `ConditionalOrder` model: `id`, `market_id`, `token_id`, `type`, `side`, `outcome`, `size`, `trigger_price`, `limit_price`, `status`, `triggered_at`, `created_at`, `updated_at` fields (closes #50)
- `PortfolioPnl` model: `period`, `total_pnl`, `realized_pnl`, `unrealized_pnl`, `win_rate`, `trade_count`, `best_trade`, `worst_trade`, `data_points` fields (closes #50)
- `create_alert(token_id, direction, price, persistent=False)`: create a price alert — both sync and async clients (closes #50)
- `delete_alert(alert_id)`: delete an alert by ID — both sync and async clients (closes #50)
- `list_conditional_orders(status?, limit?)`: list conditional orders with optional filters — both sync and async clients (closes #50)
- `create_conditional_order(market_id, token_id, type, side, outcome, size, trigger_price, limit_price?)`: create a conditional order — both sync and async clients (closes #50)
- `get_conditional_order(order_id)`: get a conditional order by ID — both sync and async clients (closes #50)
- `cancel_conditional_order(order_id)`: cancel a conditional order by ID — both sync and async clients (closes #50)
- `get_portfolio_pnl(period?, strategy_id?)`: get portfolio PnL summary — both sync and async clients (closes #50)

## [1.6.17] — 2026-04-13

### Added
- `PriceHistoryEntry` model: `timestamp`, `price`, `volume` fields for price history API responses (closes #51)
- `OrderBookLevel` model: `price` and `size` fields for order book levels (closes #51)
- `OrderBook` model: `bids` and `asks` lists of `OrderBookLevel` for order book snapshots (closes #51)
- `get_price_history(token_id, resolution?, from_date?, to_date?, limit?)`: fetch price history for a market token — both sync and async clients (closes #51)
- `get_order_book(token_id)`: fetch order book for a market token — both sync and async clients (closes #51)

## [1.6.16] — 2026-04-13

### Added
- `WatchlistItem` model: `market_id`, `slug`, `title`, `current_price`, `volume24h`, `price_delta24h`, `watched` fields for watchlist API responses (closes #53)
- `WebhookTestResult` model: `success` and `status_code` fields for webhook test responses (closes #55)
- `get_watchlist()`: list all watched markets — both sync and async clients
- `add_to_watchlist(market_id)`: add a market to the watchlist — both sync and async clients
- `remove_from_watchlist(market_id)`: remove a market from the watchlist (204 No Content) — both sync and async clients
- `get_watchlist_status(market_id)`: check if a market is watched — both sync and async clients
- `delete_webhook(webhook_id)`: delete a webhook by ID (204 No Content) — both sync and async clients (closes #55)
- `test_webhook(webhook_id)`: send a test payload to a webhook endpoint — both sync and async clients (closes #55)

## [1.6.15] — 2026-04-13

### Fixed
- `list_markets()`: add `sort` and `closed` optional parameters to both sync and async clients — platform supports filtering by sort order and closed status but SDK did not expose them (closes #74)
- `list_strategies()`: add `sort`, `page`, and `limit` optional parameters to both sync and async clients — platform supports pagination and sorting but SDK only exposed `status` filter (closes #77)

## [1.6.14] — 2026-04-13

### Fixed
- **BREAKING** `Strategy` model: add block category arrays (`triggers`, `conditions`, `actions`, `safety`, `logic_blocks`, `calc_blocks`) and metadata fields (`visibility`, `exec_mode`, `tick_ms`, `fork_count`, `like_count`, `tags`, `version`) to match platform contract — strategies were losing all block configuration during deserialization (closes #31)
- **BREAKING** `create_strategy()`: add optional parameters for `visibility`, `exec_mode`, `tick_ms`, `triggers`, `conditions`, `actions`, `safety`, `logic_blocks`, `calc_blocks`, `tags`, `variables`, `canvas` — strategies created via the SDK were empty with no blocks or configuration (closes #32)
- **BREAKING** `PaginatedResponse`: rename primary field from `items` to `data` to match platform's `data` array key; add backward-compatible `items` property alias; `has_more` now maps from platform's `hasNext` (closes #33)
- **BREAKING** `Order` model: change `price`, `size`, `fill_size`, `fill_price`, `fee` from `float` to `str` (or `str | None`) — platform returns decimal strings to preserve precision (closes #34)
- **BREAKING** `Position` model: change `size`, `entry_price`, `current_price`, `unrealized_pnl`, `realized_pnl` from `float` to `str` — platform returns decimal strings (closes #34)
- **BREAKING** `CopyConfig` model: rename `source_strategy_id` → `source_wallet`, `max_allocation` → `max_position_size`; remove `scale_factor`; add `label` and `total_copied_trades` — field names now match platform contract (closes #45)
- **BREAKING** `TraderScore` model: replace `total_trades`, `sharpe_ratio`, `max_drawdown` with `volume`, `rank`, `percentile` to match platform response (closes #23)
- **BREAKING** `WhaleTrade` model: rename `symbol` → `market_name`, `price` → `usd_value` to match platform field names (closes #23)
- **BREAKING** `AiQueryResponse`: change `suggested_actions` type from `list[dict]` to `list[str]` to match platform response (closes #23)
- `MarketplaceListing` model: add `seller: MarketplaceSeller | None` and `strategy: MarketplaceStrategy | None` nested objects to match platform response (closes #23)
- `_parse()`: handle `Optional[X]` / `X | None` type hints for nested model resolution — previously nested optional models were returned as raw dicts
- `Position` model: remove extra `symbol` field that does not exist in platform response (closes #23)
- `Strategy` model: remove extra `mode` and `config` fields that do not exist in platform response (closes #23)

### Added
- `OrderStatus` enum with 12 platform-defined values: `PENDING`, `SUBMITTED`, `LIVE`, `MATCHED`, `DELAYED`, `MINED`, `CONFIRMED`, `PARTIAL`, `CANCELLED`, `UNMATCHED`, `FAILED`, `ERROR` — usable in `get_orders(status=OrderStatus.LIVE)` (closes #30)
- `StrategyVisibility` enum: `PRIVATE`, `PUBLIC`, `UNLISTED` (closes #31)
- `StrategyExecMode` enum: `TICK`, `EVENT`, `HYBRID` (closes #31)

## [1.6.13] — 2026-04-13

### Fixed
- **BREAKING** `split_position()`: send `{tokenId, amount}` (amount as NumberString) instead of `{tokenId, size, price}` — platform `SplitPositionDto` expects `tokenId` + `amount` string, not numeric size/price (closes #26)
- **BREAKING** `merge_positions()`: send `{tokenId, amount}` (amount as NumberString) instead of `{tokenIds: [...]}` — platform `MergePositionDto` expects `tokenId` + `amount` string, not an array of token IDs (closes #26)
- **BREAKING** `provide_liquidity()`: send `{marketId, tokenId, amountUsdc, targetSpread?}` instead of `{tokenId, spread, size}` — platform `ProvideLiquidityDto` requires `marketId` and uses `amountUsdc`/`targetSpread` field names (closes #26)
- **BREAKING** `redeem_position()`: send `{positionId, marketId}` instead of `{tokenId, conditionId}` — platform `RedeemPositionDto` expects `positionId` and `marketId`, not `tokenId`/`conditionId` (closes #27)
- **BREAKING** `import_strategy()`: send data dict at top level instead of wrapping in `{data: ...}` — platform `ImportStrategyDto` expects `{polyforge, strategy}` at root (closes #28)
- `close_position()`: send `size` as a string (NumberString) instead of a number — platform `ClosePositionDto` validates `size` with `@IsNumberString()` (closes #29)

## [1.6.12] — 2026-04-13

### Fixed
- **`PolyforgeError.suggestion`**: add optional `suggestion` field to `PolyforgeError` — platform error responses include a `suggestion` string but it was silently dropped (closes #93)
- **`PolyforgeError.request_id`**: read `requestId` from the JSON body instead of the `x-request-id` HTTP header — the platform sends the request ID in the response body, so `request_id` was always empty (closes #93)

## [1.6.11] — 2026-04-13

### Fixed
- **BREAKING** `WebhookEvent`: replace 5 phantom events (`ORDER_PLACED`, `ORDER_CANCELLED`, `STRATEGY_STARTED`, `STRATEGY_STOPPED`, `BACKTEST_FAILED`) with the correct platform events (`WHALE_TRADE`, `NEWS_SIGNAL`, `DAILY_LOSS_LIMIT`, `MARKET_RESOLVED`, `PRICE_ALERT`); fix `BACKTEST_COMPLETED` → `BACKTEST_COMPLETE` — webhook creation was returning HTTP 400 for non-existent event names (closes #80)

## [1.6.10] — 2026-04-13

### Fixed
- **BREAKING** `Market` model: rename `name` field to `title` to match platform response — `list_markets()` and `get_market()` were returning empty titles because the platform sends `title`, not `name` (closes #43)

## [1.6.9] — 2026-04-13

### Security
- **Financial parameter validation**: add `_validate_financial_param()` helper that rejects NaN, Infinity, negative, and zero values — applied to `place_order`, `place_smart_order`, `provide_liquidity`, and `split_position` in both sync and async clients; prevents malformed orders from reaching the API (closes #88)

## [1.6.8] — 2026-04-13

### Fixed
- **BREAKING** `ai_query()`: send `{ "query" }` instead of `{ "question" }` to match platform `AiQueryDto` — AI queries were returning HTTP 400 (closes #89, regression of #48)
- **BREAKING** `create_strategy_from_description()`: send `{ "description" }` instead of `{ "query" }` to match platform `CreateFromDescriptionDto` — AI strategy creation was returning HTTP 400 (closes #90, regression of #39)
- **BREAKING** `WebhookEvent`: change values from dot.notation (`order.filled`) to SCREAMING_SNAKE_CASE (`ORDER_FILLED`) to match platform `CreateWebhookDto` validation — webhook creation was returning HTTP 400 (closes #91, regression of #42)
- **BREAKING** `start_strategy()`: send lowercase `mode` (`"live"`, `"paper"`) instead of uppercased — strategy start was returning HTTP 400 (closes #92, regression of #40)

## [Unreleased]

### Security
- **Webhook SSRF (CGNAT bypass)**: block CGNAT/shared address space (100.64.0.0/10, RFC 6598) in `_is_ip_blocked()` — Python's `ipaddress` module does not classify CGNAT as private/reserved, allowing SSRF bypass to internal infrastructure in cloud/ISP environments; also blocks CGNAT via IPv4-mapped IPv6 addresses (closes #24)

### Fixed
- **BREAKING**: `Strategy` model — replace `config: dict` with `blocks: list[StrategyBlock]` to match platform's block-based strategy structure; rename `total_trades` to `trade_count` (mapped from `tradeCount`); add new `StrategyBlock` dataclass with `id`, `type`, `label`, `config`, `connections` fields (closes #56)
- **BREAKING**: `Portfolio` model — replace `total_pnl`/`total_pnl_percent` with `unrealized_pnl`/`realized_pnl` to match platform's separate PnL fields; `Position` model — replace `pnl`/`pnl_percent` with `unrealized_pnl`/`realized_pnl`, add `id` and `market_name` fields (closes #57)
- **BREAKING**: `start_strategy()`/`stop_strategy()`/`pause_strategy()`/`resume_strategy()` — return `StrategyStatusResponse` instead of `Strategy`, matching the platform's minimal status response `{ status, startedAt?, stoppedAt? }` (closes #63)

### Removed
- **deps**: remove unused `cryptography` and `requests` from runtime dependencies — neither is imported anywhere in the SDK; `httpx` is the sole HTTP client; removing them reduces attack surface and transitive dependency count (closes #46, closes #35)

### Security
- **Webhook SSRF (TOCTOU)**: refactor `_validate_webhook_url` to eliminate DNS rebinding race condition (CWE-367) — extracted `_is_ip_blocked()` and `_resolve_and_validate_ips()` helpers, now returns resolved IPs for audit logging, documented server-side validation requirement (closes #69)
- **deps**: upgrade `setuptools>=78.1.1` and `wheel>=0.46.2` in CI before `pip install` — fixes PYSEC-2025-49 (path traversal/RCE), GHSA-cx63-2mw6-8hw5 (RCE via `package_index`), GHSA-8rrh-rw8j-w5fx (path traversal in `wheel.cli.unpack`) (closes #70)
- **CI**: switch from self-hosted runner to `ubuntu-latest` for `pull_request` events and add `permissions: contents: read` to restrict GITHUB_TOKEN scope (closes #68)
- **`__repr__`**: fully redact API key in both `PolyforgeClient` and `AsyncPolyforgeClient` — previously leaked first 6 characters which is sufficient to identify keys with known prefix formats (closes #37)
- **Default URL**: change default `api_url` from `https://localhost:3002` to `https://api.polyforge.app` — localhost with HTTPS causes TLS failures that encourage insecure workarounds (closes #47)
- **README**: fix documented default URL from `http://localhost:3002` to `https://api.polyforge.app` to match code (closes #78)
- **Webhook SSRF**: add `.local` mDNS hostname blocking to `_validate_webhook_url` (hardens existing #38 fix)

### Fixed
- **BREAKING** `place_smart_order()`: revert `interval_seconds`/`intervalSeconds` back to `interval_minutes`/`intervalMinutes` — the #64 fix was based on incorrect platform contract info; platform DTO uses `intervalMinutes` (closes #79)
- **#48** `ai_query()`: request body field renamed `query` → `question` to match platform `AiQueryDto` (affects both sync and async clients)
- **#49** `run_backtest()`: request body fields renamed `startDate` → `dateRangeStart` and `endDate` → `dateRangeEnd`; removed non-whitelisted `initialBalance` field; added `quickMode`, `strategyBlocks`, `marketBindings` optional parameters (affects both sync and async clients)
- **#42** `WebhookEvent` class: event value strings converted from `SCREAMING_SNAKE_CASE` to `dot.notation` (e.g. `ORDER_FILLED = "order.filled"`) to match platform webhook registration contract
- **#39** `create_strategy_from_description()`: request body field renamed `description` → `query` to match platform endpoint (affects both sync and async clients)
- **#40** `start_strategy()`: mode value is now uppercased before sending (`mode.upper()`) so that default `"paper"` and user-supplied `"live"` are sent as `"PAPER"` / `"LIVE"` as required by the platform enum (affects both sync and async clients)
- **BREAKING** `_delete()`: handle 204 No Content responses — `delete_strategy()` no longer raises `JSONDecodeError` (closes #71)
- **BREAKING** `place_smart_order()`: rename `interval_minutes` parameter to `interval_seconds` and send `intervalSeconds` in request body to match platform contract — TWAP/DCA orders were executing 60x too fast (closes #64)
- **BREAKING** `_parse()`: add `_camel_to_snake()` mapping so camelCase API fields (`baseToken`, `volume24h`, `createdAt`, etc.) correctly populate snake_case dataclass fields — all multi-word response fields were silently defaulting (closes #62)

## [1.5.2] — 2026-04-03

### Fixed
- `_validate_webhook_url`: comprehensive SSRF protection using `ipaddress` module — now blocks IPv6 loopback, RFC 1918 private ranges, IPv4-mapped IPv6, link-local, reserved addresses, and cloud metadata hostnames (closes #7)
- `MarketSentiment` dataclass constructor: accept `direction` field from API response (closes #10)
- `create_strategy_from_description`: send `marketId` (camelCase) instead of `market_id` in request body (closes #11)
- `get_whale_feed`: send `minSize` (camelCase) instead of `min_size` in query params (closes #12)
- `get_news_signals`: send `minConfidence` (camelCase) instead of `min_confidence` in query params (closes #13)
- Add `total_pages` field to `PaginatedResponse` dataclass and populate it from `totalPages` in API responses (closes #14)

### Security
- URL-encode all path parameters using `urllib.parse.quote(segment, safe="")` via new `_encode_path()` helper to prevent path traversal attacks (CWE-22). Affected parameters: `market_id`, `strategy_id`, `order_id`, `smart_order_id`, `listing_id` across both `PolyforgeClient` (sync) and `AsyncPolyforgeClient` (async). Closes #15.
- Upgrade `cryptography` minimum to `>=46.0.6` to patch 6 known CVEs including memory corruption (PYSEC-2024-225, GHSA-3ww4-gg4f-jr7f, GHSA-9v9h-cgj8-h64p, GHSA-h4gh-qq45-vh27, GHSA-r6ph-v2qm-q3c2, GHSA-m959-cc7f-wv43)
- Upgrade `requests` minimum to `>=2.32.6` to patch CVE in requests 2.32.5

## [1.5.1] — 2026-03-30

### Fixed
- `MarketSentiment` dataclass: renamed `label` → `direction` to match the actual API response field (`direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'`)

## [1.5.0] — 2026-03-30

### Added
- `get_accuracy()` — `GET /api/v1/accuracy/me`; returns `AccuracyScore` dataclass with Brier score, win rate, calibration list, and per-category breakdown
- `get_portfolio_review()` — `GET /api/v1/ai/portfolio-review`; returns `PortfolioReview` dataclass with review text, suggestions list, and score (1–10)
- `get_market_sentiment(market_id)` — `GET /api/v1/news/sentiment/:marketId`; returns `MarketSentiment` dataclass with score (−100 to +100) and BULLISH / BEARISH / NEUTRAL label
- `provide_liquidity(token_id, spread, size)` — `POST /api/v1/lp/provide`; returns `LpPosition` dataclass with buy and sell order IDs
- All methods available on both `PolyforgeClient` (sync) and `AsyncPolyforgeClient` (async)
- New dataclasses: `CalibrationBucket`, `CategoryAccuracy`, `AccuracyScore`, `PortfolioReview`, `MarketSentiment`, `LpPosition`

## [1.4.0] — 2026-03-30

### Added
- `get_arbitrage_opportunities(min_margin?)` — `GET /api/v1/arbitrage`; returns `list[ArbitrageOpportunity]`
- `place_smart_order(**kwargs)` — `POST /api/v1/orders/smart`; supports TWAP, DCA, BRACKET, OCO types
- `list_smart_orders()` — `GET /api/v1/orders/smart`; returns `list[SmartOrder]` with child order progress
- `cancel_smart_order(id)` — `DELETE /api/v1/orders/smart/:id`
- `browse_marketplace(sort?, tag?, limit?)` — `GET /api/v1/marketplace`; returns `list[MarketplaceListing]`
- `get_marketplace_listing(id)` — `GET /api/v1/marketplace/:id`
- `purchase_strategy(listing_id)` — `POST /api/v1/marketplace/:id/purchase`; returns `MarketplacePurchaseResult`
- All new methods available on both `PolyforgeClient` (sync) and `AsyncPolyforgeClient` (async)
- New dataclasses: `ArbitrageOpportunity`, `SmartOrderChildOrder`, `SmartOrder`, `PlaceSmartOrderResponse`, `MarketplaceSeller`, `MarketplaceStrategy`, `MarketplaceListing`, `MarketplacePurchaseResult`

## [1.3.0] — 2026-03-29

### Fixed
- `get_score()` path corrected: `/api/v1/score` → `/api/v1/scores/me`
- `get_whale_feed()` path corrected: `/api/v1/whale-feed` → `/api/v1/whales/feed`
- `get_news_signals()` path corrected: `/api/v1/news-signals` → `/api/v1/news/signals`
- `list_copy_configs()` path corrected: `/api/v1/copy-configs` → `/api/v1/copy`

### Added
- `update_strategy(id, name, description)` — `PATCH /api/v1/strategies/:id`
- `delete_strategy(id)` — `DELETE /api/v1/strategies/:id`
- `import_strategy(data)` — `POST /api/v1/strategies/import`
- `pause_strategy(id)` — `POST /api/v1/strategies/:id/pause`
- `resume_strategy(id)` — `POST /api/v1/strategies/:id/resume`
- `fork_strategy(id)` — `POST /api/v1/strategies/:id/fork`
- `close_position(token_id, size)` — `POST /api/v1/orders/close-position`
- `redeem_position(token_id, condition_id)` — `POST /api/v1/orders/redeem`
- `split_position(token_id, size, price)` — `POST /api/v1/orders/split`
- `merge_positions(token_ids)` — `POST /api/v1/orders/merge`
- `get_orders()` now accepts `strategy_id`, `from_date`, `to_date` filter params
- `_patch()` helper added to both sync and async clients
- All new methods available on both `PolyforgeClient` and `AsyncPolyforgeClient`

## [1.2.0] — 2026-03-29

### Added
- `watch_strategy(strategy_id)` on both `PolyforgeClient` and `AsyncPolyforgeClient` — generator / async generator that streams live execution events over SSE; yields `StrategyEvent` instances
- `StrategyEvent` dataclass — `type`, `strategy_id`, `data`, `timestamp` fields
- `StrategyEvent` exported from package root (`__init__.py`)

## [1.1.0] — 2026-03-28

### Fixed
- Align all API paths to canonical `/api/v1/*` pattern matching backend
- Fix strategy endpoint: `/api/strategies/generate` → `/api/v1/strategies/from-description`
- Standardize response parsing to match backend PaginatedResponse format

### Added
- Smoke tests for client, error classes, and model parsing (pytest)
- Docstring documenting sync/async code pattern

## [1.1.0] — 2026-03-27

### Added
- `place_order()` — place direct buy/sell orders
- `cancel_order()` — cancel pending or live orders
- `PlaceOrderResponse` model
- Both sync and async clients updated

## [1.0.0] — 2026-03-27

### Added
- Initial release — typed REST client for Polyforge API
- `PolyforgeClient` (sync) and `AsyncPolyforgeClient` (async) via httpx
- 20 methods covering all API endpoints
- PEP 561 type stubs (py.typed)
- Error hierarchy: `PolyforgeError`, `AuthenticationError`, `NotFoundError`, `RateLimitError`
