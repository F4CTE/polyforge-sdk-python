# Changelog

## [Unreleased]

### Security
- **CI**: switch from self-hosted runner to `ubuntu-latest` for `pull_request` events and add `permissions: contents: read` to restrict GITHUB_TOKEN scope (closes #68)

### Fixed
- **#48** `ai_query()`: request body field renamed `query` → `question` to match platform `AiQueryDto` (affects both sync and async clients)
- **#49** `run_backtest()`: request body fields renamed `startDate` → `dateRangeStart` and `endDate` → `dateRangeEnd`; removed non-whitelisted `initialBalance` field; added `quickMode`, `strategyBlocks`, `marketBindings` optional parameters (affects both sync and async clients)
- **#42** `WebhookEvent` class: event value strings converted from `SCREAMING_SNAKE_CASE` to `dot.notation` (e.g. `ORDER_FILLED = "order.filled"`) to match platform webhook registration contract
- **#39** `create_strategy_from_description()`: request body field renamed `description` → `query` to match platform endpoint (affects both sync and async clients)
- **#40** `start_strategy()`: mode value is now uppercased before sending (`mode.upper()`) so that default `"paper"` and user-supplied `"live"` are sent as `"PAPER"` / `"LIVE"` as required by the platform enum (affects both sync and async clients)

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
