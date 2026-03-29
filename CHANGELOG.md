# Changelog

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
