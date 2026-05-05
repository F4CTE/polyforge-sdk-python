# Polyforge Python SDK

Typed Python client for the [Polyforge](https://polyforge.io) trading platform REST API. Provides both synchronous and asynchronous interfaces powered by [httpx](https://www.python-httpx.org/).

## Installation

```bash
pip install polyforge
```

## Quick Start

### Synchronous

```python
from polyforge import PolyforgeClient

with PolyforgeClient(api_key="pk_live_...") as client:
    # Browse markets
    markets = client.list_markets(category="defi", limit=5)
    for m in markets.items:
        print(f"{m.symbol}  ${m.price:,.2f}  ({m.change_24h:+.1f}%)")

    # Create and start a strategy
    strategy = client.create_strategy("My Momentum Bot")
    client.start_strategy(strategy.id, mode="paper")

    # Check portfolio
    portfolio = client.get_portfolio()
    print(f"Total value: ${portfolio.total_value:,.2f}")
```

### Asynchronous

```python
import asyncio
from polyforge import AsyncPolyforgeClient

async def main():
    async with AsyncPolyforgeClient(api_key="pk_live_...") as client:
        markets = await client.list_markets(limit=3)
        signals = await client.get_news_signals(min_confidence=80)
        for s in signals:
            print(f"[{s.confidence}%] {s.headline}")

asyncio.run(main())
```

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `api_key` | *required* | Your Polyforge API key |
| `api_url` | `https://api.polyforge.app` | Base URL of the Polyforge API |
| `timeout` | `15.0` | Request timeout in seconds |

## API Reference

### Markets

| Method | Description |
|--------|-------------|
| `list_markets(search, category, limit, page)` | List markets with optional filters |
| `get_market(market_id)` | Get a single market by ID |

### Strategies

| Method | Description |
|--------|-------------|
| `list_strategies(status)` | List strategies, optionally filtered by status |
| `get_strategy(strategy_id)` | Get strategy details |
| `create_strategy(name, description)` | Create a new strategy |
| `create_strategy_from_description(description, market_id)` | AI-generate a strategy from a text description |
| `start_strategy(strategy_id, mode)` | Start a strategy (`"paper"` or `"live"`) |
| `stop_strategy(strategy_id)` | Stop a running strategy |
| `get_strategy_templates()` | List pre-built strategy templates |
| `export_strategy(strategy_id)` | Export strategy configuration as a dict |
| `watch_strategy(strategy_id)` | Stream live execution events via SSE |

### Live Execution Watching

Both `PolyforgeClient` and `AsyncPolyforgeClient` expose `watch_strategy()` which yields `StrategyEvent` objects as they arrive over a persistent SSE connection.

```python
# Synchronous — blocks the calling thread while the stream is open
from polyforge import PolyforgeClient

with PolyforgeClient(api_key="pk_live_...") as client:
    client.start_strategy("strat-uuid", mode="live")

    for event in client.watch_strategy("strat-uuid"):
        print(f"[{event.type}] {event.data}")
        if event.type in ("STRATEGY_STOPPED", "BACKTEST_COMPLETED"):
            break
```

```python
# Asynchronous — non-blocking, works inside async frameworks
import asyncio
from polyforge import AsyncPolyforgeClient

async def main():
    async with AsyncPolyforgeClient(api_key="pk_live_...") as client:
        async for event in client.watch_strategy("strat-uuid"):
            if event.type == "ORDER_FILLED":
                print("Filled:", event.data)
            elif event.type == "STRATEGY_STOPPED":
                break

asyncio.run(main())
```

**`StrategyEvent` fields:** `type: str` · `strategy_id: str` · `data: dict | None` · `timestamp: int` (Unix ms)

**Common event types:** `CONNECTED` · `STRATEGY_STARTED` · `STRATEGY_STOPPED` · `STRATEGY_ERROR` · `ORDER_PLACED` · `ORDER_FILLED` · `ORDER_CANCELLED` · `BACKTEST_PROGRESS` · `BACKTEST_COMPLETED` · `BACKTEST_FAILED`

### Portfolio & Orders

| Method | Description |
|--------|-------------|
| `get_portfolio()` | Get portfolio summary with open positions |
| `get_orders(limit, status)` | List trade orders |
| `get_score()` | Get your trader performance score |
| `place_order(token_id, side, outcome, size, price, order_type)` | Place a direct buy/sell order |
| `cancel_order(order_id)` | Cancel a pending or live order |

### Arbitrage

| Method | Description |
|--------|-------------|
| `get_cross_venue_opportunities(min_spread)` | List cross-venue Polymarket/Kalshi opportunities |
| `get_cross_venue_comparison(match_id)` | Compare prices for a matched cross-venue market |
| `execute_arb(match_id, size, max_slippage_pct)` | Execute a real cross-venue arbitrage trade; validates UUID `match_id`, `size` 1..10000, and optional slippage 0..5 |
| `list_arb_positions(status, limit, offset)` | List arbitrage positions; validates status and `limit` 1..100 |
| `get_arb_position(position_id)` | Fetch one arbitrage position |
| `close_arb_position(position_id)` | Close an open arbitrage position with real reverse orders |
| `get_arb_risk_dashboard()` | Get aggregate arbitrage exposure and P&L |
| `get_arb_settlement_risks()` | List settlement-date and resolution-criteria risks |
| `refresh_arb_pnl()` | Recompute unrealized arbitrage P&L |

### Trading idempotency

Trading write methods automatically send an `Idempotency-Key` header accepted
by the PolyForge API. Pass your own `idempotency_key` when retrying the same
logical mutation so the platform can deduplicate the retry:

```python
with PolyforgeClient(api_key="pk_live_...") as client:
    client.place_order(
        "token-1",
        "BUY",
        "YES",
        10.0,
        0.5,
        idempotency_key="strategy-run-42-order-1",
    )
```

If omitted, the SDK generates a fresh 32-character key for each order,
position, smart-order, conditional-order, bulk cancel, and arbitrage write.
Caller-provided keys must be 8-128 characters.

### Social & Signals

| Method | Description |
|--------|-------------|
| `get_whale_feed(min_size)` | Get large on-chain trades |
| `get_news_signals(min_confidence)` | Get AI-generated news trading signals |

### Utility Endpoints

| Method | Description |
|--------|-------------|
| `list_feed(...)` / `get_feed(...)` | Global whale-activity feed |
| `list_journal(...)` / `update_order_journal(...)` | Trading journal entries and order mood notes |
| `list_notifications(...)` | Notification history records |
| `get_my_referrals()` | Referral code, link, stats, and referred users |
| `preview_fees(...)` / `list_fee_schedules()` / `get_fee_schedules()` | Cross-venue fee previews and active fee schedules |
| `list_market_alerts(...)` / `create_market_alert(...)` / `delete_market_alert(...)` | Per-market price alerts |
| `get_market_history(...)` / `get_market_sentiment_report(...)` / `vote_market_sentiment(...)` | Market history and user-sentiment report endpoints |
| `list_combo_collections(...)` / `get_combo_collection(...)` / `lookup_combo_market(...)` / `lookup_combo_ticker(...)` | Kalshi combo collection lookup endpoints |
| `get_correlation_categories()` | Category correlation matrix |

### Sports Markets

| Method | Description |
|--------|-------------|
| `list_sports_categories()` | List sports categories with series tickers and market counts |
| `list_sports_markets(page, limit, category, search, series_ticker, event_ticker, live_only, sort)` | List sports markets — `sort` ∈ `{"volume", "closing_soon", "newest"}` |
| `list_sports_events(page, limit, category, series_ticker, status)` | List sports events — `status` ∈ `{"SCHEDULED", "PREGAME", "LIVE", "HALFTIME", "FINAL"}` |
| `get_sports_event(event_ticker)` | Fetch one event with its markets |
| `list_sports_milestones(page, limit, event_ticker, status)` | List in-game milestones (cursor-paginated) |
| `get_sports_live_data(milestone_id)` | Fetch live data for a milestone |
| `list_sports_combos(page, limit, series_ticker)` | List combo collections (cursor-paginated) |
| `get_sports_combo_collection(collection_ticker)` | Fetch a combo collection by ticker |
| `lookup_sports_combo(collection_ticker, selected_markets)` | Resolve `(eventTicker, marketTicker)` for a combo selection |

### Configuration

| Method | Description |
|--------|-------------|
| `list_alerts()` | List configured alerts |
| `list_copy_configs()` | List copy-trading configurations |
| `list_webhooks()` | List registered webhooks |
| `create_webhook(url, events)` | Register a new webhook |

### AI

| Method | Description |
|--------|-------------|
| `ai_query(query)` | Ask the Polyforge AI assistant a question |

### Accuracy & Liquidity

| Method | Description |
|--------|-------------|
| `get_accuracy()` | Get your accuracy score with Brier score, win rate, and calibration data |
| `get_portfolio_review()` | Get an AI-generated portfolio review with suggestions and score (1–10) |
| `get_market_sentiment(market_id)` | Get sentiment score (−100 to +100) and BULLISH / BEARISH / NEUTRAL label for a market |
| `provide_liquidity(token_id, spread, size)` | Provide liquidity; returns `LpPosition` with buy and sell order IDs |

## Error Handling

All API errors raise a `PolyforgeError` (or a specific subclass):

```python
from polyforge import PolyforgeClient, PolyforgeError, NotFoundError

with PolyforgeClient(api_key="pk_live_...") as client:
    try:
        market = client.get_market("invalid-id")
    except NotFoundError:
        print("Market not found")
    except PolyforgeError as e:
        print(f"API error {e.status_code}: {e.message} (request {e.request_id})")
```

| Exception | HTTP Status |
|-----------|-------------|
| `AuthenticationError` | 401 |
| `PermissionError` | 403 |
| `NotFoundError` | 404 |
| `RateLimitError` | 429 |
| `ServerError` | 5xx |

### Rate limits and retries

The SDK raises `RateLimitError` for HTTP 429 responses and does not retry
requests automatically. This is intentional for trading APIs, where retrying a
mutation without an idempotency strategy can duplicate work or place unintended
orders.

Catch `RateLimitError` separately from other API errors and back off before
retrying safe read requests:

```python
import random
import time

from polyforge import PolyforgeClient, RateLimitError

max_attempts = 5
base_delay = 1.0
max_delay = 30.0

with PolyforgeClient(api_key="pk_live_...") as client:
    for attempt in range(max_attempts):
        try:
            markets = client.list_markets(limit=20)
            break
        except RateLimitError:
            if attempt == max_attempts - 1:
                raise

            delay = min(max_delay, base_delay * (2**attempt))
            time.sleep(random.uniform(0, delay))
```

Operational guidance:

- Respect server-provided retry timing, such as `Retry-After`, whenever it is
  exposed to your client or infrastructure.
- Use bounded exponential backoff with jitter instead of tight retry loops.
- Retry idempotent reads only; avoid automatic retries for trading mutations
  such as `place_order()` unless your caller supplies an idempotency key or
  other duplicate-order protection.
- For polling market data or strategy state, use a fixed minimum interval and
  increase it after each `RateLimitError`; prefer streaming APIs such as
  `watch_strategy()` where they fit the workflow.

## Testing

```bash
pytest tests/
```

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
