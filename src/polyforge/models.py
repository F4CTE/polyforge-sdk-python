"""Polyforge SDK data models.

Uses Python dataclasses for zero additional dependencies beyond httpx.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Generic, List, Optional, TypeVar

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class OrderStatus(str, Enum):
    """Valid order status values as defined by the platform."""

    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    LIVE = "LIVE"
    MATCHED = "MATCHED"
    DELAYED = "DELAYED"
    MINED = "MINED"
    CONFIRMED = "CONFIRMED"
    PARTIAL = "PARTIAL"
    CANCELLED = "CANCELLED"
    UNMATCHED = "UNMATCHED"
    FAILED = "FAILED"
    ERROR = "ERROR"


class StrategyVisibility(str, Enum):
    """Strategy visibility options."""

    PRIVATE = "PRIVATE"
    PUBLIC = "PUBLIC"
    UNLISTED = "UNLISTED"


class StrategyExecMode(str, Enum):
    """Strategy execution mode."""

    TICK = "TICK"
    EVENT = "EVENT"
    HYBRID = "HYBRID"


# ---------------------------------------------------------------------------
# Generic paginated wrapper
# ---------------------------------------------------------------------------

@dataclass
class PaginatedResponse(Generic[T]):
    """A page of results from a list endpoint.

    The platform returns paginated results under the ``data`` key with a
    ``hasNext`` boolean. For backward compatibility the ``items`` property
    is an alias for ``data``.
    """

    data: list[T] = field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 10
    has_more: bool = False
    total_pages: int = 0

    @property
    def items(self) -> list[T]:
        """Backward-compatible alias for :attr:`data`."""
        return self.data


# ---------------------------------------------------------------------------
# Markets
# ---------------------------------------------------------------------------

@dataclass
class Token:
    """A prediction market outcome token (YES/NO share).

    Platform contract: id is required; outcome ("YES"/"NO") and price
    (implied probability 0.001–0.999) are optional server-side but
    always present in practice.
    """

    id: str = ""
    outcome: str | None = None
    price: float | None = None


@dataclass
class Market:
    """A prediction market."""

    id: str = ""
    title: str = ""
    symbol: str = ""
    category: str = ""
    tokens: list[Token] = field(default_factory=list)
    price: float = 0.0
    volume_24h: float = 0.0
    change_24h: float = 0.0
    liquidity: float = 0.0
    created_at: str = ""
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

@dataclass
class StrategyBlock:
    """A single block in a block-based strategy."""

    id: str = ""
    type: str = ""
    label: str = ""
    config: dict[str, Any] = field(default_factory=dict)
    connections: list[str] = field(default_factory=list)


@dataclass
class Strategy:
    """A trading strategy configuration and its runtime state."""

    id: str = ""
    name: str = ""
    description: str = ""
    status: str = ""
    market_id: str = ""
    pnl: float = 0.0
    win_rate: float = 0.0
    trade_count: int = 0
    # Block categories (#31)
    triggers: list[StrategyBlock] = field(default_factory=list)
    conditions: list[StrategyBlock] = field(default_factory=list)
    actions: list[StrategyBlock] = field(default_factory=list)
    safety: list[StrategyBlock] = field(default_factory=list)
    logic_blocks: list[dict[str, Any]] = field(default_factory=list)
    calc_blocks: list[dict[str, Any]] = field(default_factory=list)
    # Strategy metadata (#31)
    visibility: str = "PRIVATE"
    exec_mode: str = "TICK"
    tick_ms: int | None = None
    fork_count: int = 0
    like_count: int = 0
    tags: list[str] = field(default_factory=list)
    version: int = 0
    # Legacy field — kept for backward compat
    blocks: list[StrategyBlock] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


@dataclass
class StrategyStatusResponse:
    """Minimal response from strategy start/stop/pause/resume endpoints."""

    status: str = ""
    started_at: str = ""
    stopped_at: str = ""


# StrategyTemplate is an alias for Strategy — the platform endpoint
# ``GET /api/v1/strategies/templates`` returns full Strategy objects
# (rows where ``template = true``).  Kept as an alias for backward compat.
StrategyTemplate = Strategy


# ---------------------------------------------------------------------------
# Portfolio & Orders
# ---------------------------------------------------------------------------

@dataclass
class Position:
    """An open position within a portfolio.

    Monetary fields are typed as ``str`` because the platform returns
    decimal strings to preserve precision (#34).
    """

    id: str = ""
    market_id: str = ""
    market_name: str = ""
    side: str = ""
    size: str = ""
    entry_price: str = ""
    current_price: str = ""
    unrealized_pnl: str = ""
    realized_pnl: str = ""
    opened_at: str = ""


@dataclass
class Portfolio:
    """Aggregate portfolio state."""

    total_value: float = 0.0
    available_balance: float = 0.0
    unrealized_pnl: float = 0.0
    realized_pnl: float = 0.0
    positions: list[Position] = field(default_factory=list)
    updated_at: str = ""


@dataclass
class Order:
    """A trade order.

    Monetary fields (``price``, ``size``, ``filled_size``, ``filled_price``,
    ``fee``) are typed as ``str`` because the platform returns decimal strings
    to preserve precision (#34).  The ``status`` field uses the
    :class:`OrderStatus` enum values (#30).
    """

    id: str = ""
    market_id: str = ""
    strategy_id: str = ""
    side: str = ""
    order_type: str = ""
    status: str = ""  # One of OrderStatus values
    price: str = ""
    size: str = ""
    fill_size: str | None = None
    fill_price: str | None = None
    fee: str | None = None
    created_at: str = ""
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Trader Score
# ---------------------------------------------------------------------------

@dataclass
class TraderScore:
    """Aggregated trader performance score."""

    overall: float = 0.0
    risk_management: float = 0.0
    consistency: float = 0.0
    profitability: float = 0.0
    win_rate: float = 0.0
    volume: float = 0.0
    rank: int = 0
    percentile: float = 0.0
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Social & Signals
# ---------------------------------------------------------------------------

@dataclass
class WhaleTrade:
    """A large trade detected on-chain."""

    id: str = ""
    market_id: str = ""
    market_name: str = ""
    side: str = ""
    size: float = 0.0
    usd_value: float = 0.0
    wallet: str = ""
    timestamp: str = ""


@dataclass
class NewsSignal:
    """An AI-generated trading signal from news analysis."""

    id: str = ""
    headline: str = ""
    source: str = ""
    sentiment: str = ""
    confidence: int = 0
    related_markets: list[str] = field(default_factory=list)
    signal: str = ""
    published_at: str = ""


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass
class Alert:
    """A price alert on a specific token.

    Field names match the platform ``PriceAlert`` Prisma model:
    ``tokenId``, ``direction``, ``price``, ``persistent``.
    """

    id: str = ""
    token_id: str = ""
    direction: str = ""  # "above" | "below"
    price: str = ""  # decimal string
    persistent: bool = False
    triggered: bool = False
    triggered_at: str | None = None
    created_at: str = ""


@dataclass
class CopyConfig:
    """A copy-trading configuration.

    Field names match the platform ``CopyConfig`` Prisma model:
    ``targetWallet``, ``mode``, ``sizeValue``, ``maxExposure``,
    ``maxDailyLoss``, ``priceOffset``, ``status``.
    """

    id: str = ""
    target_wallet: str = ""
    mode: str = ""  # "PERCENTAGE" | "FIXED" | "MIRROR"
    size_value: str = ""  # decimal string
    max_exposure: str = ""  # decimal string
    max_daily_loss: str = ""  # decimal string
    price_offset: str = ""  # decimal string
    status: str = ""  # "ACTIVE" | "PAUSED" | "STOPPED" | "ERROR"
    total_pnl: str = ""  # decimal string
    total_copied: int = 0
    created_at: str = ""
    updated_at: str = ""
    stopped_at: str | None = None


@dataclass
class WatchlistItem:
    """A market on the user's watchlist.

    Note: field names ``volume24h`` and ``price_delta24h`` match the API's
    camelCase keys after ``_camel_to_snake`` conversion (digits do not
    trigger an underscore insertion).
    """

    market_id: str = ""
    slug: str = ""
    title: str = ""
    current_price: float = 0.0
    volume24h: float = 0.0
    price_delta24h: float = 0.0
    watched: bool = True


@dataclass
class WebhookTestResult:
    """Response from testing a webhook endpoint."""

    success: bool = False
    status_code: int = 0


class WebhookEvent:
    """Constants for webhook event names (SCREAMING_SNAKE_CASE as expected by the platform).

    These match the platform's ``CreateWebhookDto`` validation exactly::

        @IsIn(['ORDER_FILLED','STRATEGY_ERROR','WHALE_TRADE','NEWS_SIGNAL',
               'BACKTEST_COMPLETE','DAILY_LOSS_LIMIT','MARKET_RESOLVED','PRICE_ALERT'])

    Usage::

        client.create_webhook(url="https://...", events=[WebhookEvent.ORDER_FILLED])
    """

    ORDER_FILLED = "ORDER_FILLED"
    STRATEGY_ERROR = "STRATEGY_ERROR"
    WHALE_TRADE = "WHALE_TRADE"
    NEWS_SIGNAL = "NEWS_SIGNAL"
    BACKTEST_COMPLETE = "BACKTEST_COMPLETE"
    DAILY_LOSS_LIMIT = "DAILY_LOSS_LIMIT"
    MARKET_RESOLVED = "MARKET_RESOLVED"
    PRICE_ALERT = "PRICE_ALERT"


@dataclass
class Webhook:
    """A webhook endpoint registration."""

    id: str = ""
    url: str = ""
    events: list[str] = field(default_factory=list)
    secret: str = ""
    enabled: bool = True
    created_at: str = ""

    def __repr__(self) -> str:
        return (
            f"Webhook(id={self.id!r}, url={self.url!r}, "
            f"secret='***', events={self.events!r}, "
            f"enabled={self.enabled!r})"
        )


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

@dataclass
class AiQueryResponse:
    """Response from the AI assistant endpoint."""

    answer: str = ""
    confidence: float = 0.0
    sources: list[str] = field(default_factory=list)
    suggested_actions: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Direct Trading
# ---------------------------------------------------------------------------

@dataclass
class PlaceOrderResponse:
    """Response from placing a direct order."""

    order_id: str = ""
    intent_id: str = ""
    status: str = ""


# ---------------------------------------------------------------------------
# Arbitrage
# ---------------------------------------------------------------------------

@dataclass
class ArbitrageOpportunity:
    """A merge arbitrage opportunity where YES + NO prices sum to less than $1.00."""

    market_id: str = ""
    market_title: str = ""
    category: str = ""
    end_date: str | None = None
    yes_token_id: str = ""
    no_token_id: str = ""
    yes_price: str = ""
    no_price: str = ""
    sum: str = ""
    margin_pct: str = ""
    cost_per_unit: str = ""
    profit_per_unit: str = ""


# ---------------------------------------------------------------------------
# Smart Orders
# ---------------------------------------------------------------------------

@dataclass
class SmartOrderChildOrder:
    """A child order spawned by a smart order."""

    id: str = ""
    status: str = ""
    fill_size: str | None = None
    fill_price: str | None = None
    created_at: str = ""


@dataclass
class SmartOrder:
    """An advanced execution order (TWAP, DCA, BRACKET, or OCO)."""

    id: str = ""
    type: str = ""
    status: str = ""
    market_id: str = ""
    token_id: str = ""
    outcome: str = ""
    side: str = ""
    total_size: str = ""
    slices_filled: int = 0
    slices_total: int = 1
    next_execute_at: str | None = None
    completed_at: str | None = None
    created_at: str = ""
    orders: list[SmartOrderChildOrder] = field(default_factory=list)


@dataclass
class PlaceSmartOrderResponse:
    """Response from placing a smart order."""

    smart_order_id: str = ""
    type: str = ""
    status: str = ""
    slices_total: int = 1


# ---------------------------------------------------------------------------
# Marketplace
# ---------------------------------------------------------------------------

@dataclass
class MarketplaceSeller:
    """Seller info embedded in a listing."""

    id: str = ""
    name: str = ""
    avatar_url: str | None = None


@dataclass
class MarketplaceStrategy:
    """Strategy info embedded in a listing."""

    id: str = ""
    name: str = ""
    description: str | None = None


@dataclass
class MarketplaceListing:
    """A strategy listing in the marketplace."""

    id: str = ""
    strategy_id: str = ""
    seller_id: str = ""
    title: str = ""
    description: str | None = None
    price_usdc: str = ""
    status: str = "DRAFT"
    purchase_count: int = 0
    fork_count: int = 0
    avg_rating: str | None = None
    rating_count: int = 0
    tags: list[str] = field(default_factory=list)
    seller: MarketplaceSeller | None = None
    strategy: MarketplaceStrategy | None = None
    created_at: str = ""


@dataclass
class MarketplacePurchaseResult:
    """Response from purchasing a marketplace strategy."""

    purchase_id: str = ""
    forked_strategy_id: str = ""
    price_usdc: float = 0.0
    platform_fee: float = 0.0
    seller_net: float = 0.0


# ---------------------------------------------------------------------------
# Accuracy & Portfolio Review
# ---------------------------------------------------------------------------

@dataclass
class CalibrationBucket:
    bucket_mid: float = 0.0
    frequency: float = 0.0
    count: int = 0


@dataclass
class CategoryAccuracy:
    count: int = 0
    brier_score: float = 0.0


@dataclass
class AccuracyScore:
    brier_score: Optional[float] = None
    total_predictions: int = 0
    correct_predictions: int = 0
    win_rate: str = ""
    calibration: List[CalibrationBucket] = field(default_factory=list)
    by_category: Dict[str, CategoryAccuracy] = field(default_factory=dict)


@dataclass
class PortfolioReview:
    review: str = ""
    suggestions: List[str] = field(default_factory=list)
    score: int = 0
    generated_at: str = ""


@dataclass
class MarketSentiment:
    market_id: str = ""
    score: float = 0.0
    direction: str = ""  # 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    signal_count: int = 0
    last_updated: Optional[str] = None


@dataclass
class PriceHistoryEntry:
    """A single data point in a market's price history."""

    timestamp: str = ""
    price: float = 0.0
    volume: float = 0.0


@dataclass
class OrderBookLevel:
    """A single price level in an order book."""

    price: str = ""
    size: str = ""


@dataclass
class OrderBook:
    """Order book snapshot for a market token."""

    bids: List[OrderBookLevel] = field(default_factory=list)
    asks: List[OrderBookLevel] = field(default_factory=list)


@dataclass
class LpPosition:
    buy_order_id: str = ""
    sell_order_id: str = ""
    token_id: str = ""
    buy_price: str = ""
    sell_price: str = ""
    size: str = ""


# ---------------------------------------------------------------------------
# Conditional Orders
# ---------------------------------------------------------------------------

@dataclass
class ConditionalOrder:
    """A conditional order that triggers when a price condition is met."""

    id: str = ""
    market_id: str = ""
    token_id: str = ""
    type: str = ""
    side: str = ""
    outcome: str = ""
    size: str = ""
    trigger_price: str = ""
    limit_price: str | None = None
    status: str = ""
    triggered_at: str | None = None
    created_at: str = ""
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Portfolio PnL
# ---------------------------------------------------------------------------

@dataclass
class PortfolioPnl:
    """Aggregated portfolio profit-and-loss over a time period."""

    period: str = ""
    total_pnl: float = 0.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    win_rate: float = 0.0
    trade_count: int = 0
    best_trade: float = 0.0
    worst_trade: float = 0.0
    data_points: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Discovery & Ranking
# ---------------------------------------------------------------------------

@dataclass
class LeaderboardEntry:
    """A single entry in the trading leaderboard."""

    address: str = ""
    rank: int = 0
    pnl: float = 0.0
    win_rate: float = 0.0
    trade_count: int = 0
    score: float = 0.0
    volume: float = 0.0
    period: str = ""


# ---------------------------------------------------------------------------
# Whale Intelligence
# ---------------------------------------------------------------------------

@dataclass
class WhaleProfile:
    """A whale trader's on-chain profile."""

    address: str = ""
    pnl: float = 0.0
    win_rate: float = 0.0
    trade_count: int = 0
    volume: float = 0.0
    following: bool = False
    score: float = 0.0
    last_active: str = ""


# ---------------------------------------------------------------------------
# Paper Trading
# ---------------------------------------------------------------------------

@dataclass
class PaperSummary:
    """Paper trading account summary."""

    balance: float = 0.0
    initial_balance: float = 0.0
    pnl: float = 0.0
    win_rate: float = 0.0
    trade_count: int = 0
    positions: List[Any] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Batch API
# ---------------------------------------------------------------------------

@dataclass
class BatchResult:
    """A single result item returned from a batch request."""

    id: str = ""
    status: int = 200
    body: Any = None


# ---------------------------------------------------------------------------
# Copy Trades
# ---------------------------------------------------------------------------

@dataclass
class CopyTrade:
    """A trade executed via copy trading."""

    id: str = ""
    copy_config_id: str = ""
    market_id: str = ""
    market_name: str = ""
    side: str = ""
    size: str = ""
    price: str = ""
    pnl: str = ""
    executed_at: str = ""


# ---------------------------------------------------------------------------
# Strategy Execution Events (SSE)
# ---------------------------------------------------------------------------

@dataclass
class StrategyEvent:
    """A single event from the strategy execution SSE stream.

    Events are emitted while a strategy is running (or backtesting).
    The first event on a new stream always has ``type == "CONNECTED"``.

    Common event types:
        CONNECTED, STRATEGY_STARTED, STRATEGY_STOPPED, STRATEGY_ERROR,
        ORDER_PLACED, ORDER_FILLED, ORDER_CANCELLED,
        BACKTEST_PROGRESS, BACKTEST_COMPLETED, BACKTEST_FAILED
    """

    type: str = ""
    strategy_id: str = ""
    data: dict[str, Any] | None = None
    timestamp: int = 0


# ---------------------------------------------------------------------------
# Risk Settings
# ---------------------------------------------------------------------------

@dataclass
class RiskSettings:
    """Circuit-breaker and drawdown configuration for the authenticated user."""

    drawdown_enabled: bool = False
    drawdown_lookback_hours: int = 24
    drawdown_threshold_pct: float = 0.1
    circuit_breaker_tripped: bool = False
    circuit_breaker_tripped_at: str | None = None
