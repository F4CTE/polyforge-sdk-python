# Changelog

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
