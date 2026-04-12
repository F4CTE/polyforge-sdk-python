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

### Social & Signals

| Method | Description |
|--------|-------------|
| `get_whale_feed(min_size)` | Get large on-chain trades |
| `get_news_signals(min_confidence)` | Get AI-generated news trading signals |

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

## Testing

```bash
pytest tests/
```

## License

MIT
