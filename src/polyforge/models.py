"""Polyforge SDK data models.

Uses Python dataclasses for zero additional dependencies beyond httpx.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Generic, List, Optional, TypeVar

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Generic paginated wrapper
# ---------------------------------------------------------------------------

@dataclass
class PaginatedResponse(Generic[T]):
    """A page of results from a list endpoint."""

    items: list[T]
    total: int = 0
    page: int = 1
    limit: int = 10
    has_more: bool = False


# ---------------------------------------------------------------------------
# Markets
# ---------------------------------------------------------------------------

@dataclass
class Token:
    """A token within a market pair."""

    symbol: str = ""
    name: str = ""
    address: str = ""
    decimals: int = 18
    logo_url: str = ""


@dataclass
class Market:
    """A trading market / pair."""

    id: str = ""
    name: str = ""
    symbol: str = ""
    category: str = ""
    base_token: Token | None = None
    quote_token: Token | None = None
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
class Strategy:
    """A trading strategy configuration and its runtime state."""

    id: str = ""
    name: str = ""
    description: str = ""
    status: str = ""
    mode: str = ""
    market_id: str = ""
    pnl: float = 0.0
    win_rate: float = 0.0
    total_trades: int = 0
    config: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


@dataclass
class StrategyTemplate:
    """A pre-built strategy template."""

    id: str = ""
    name: str = ""
    description: str = ""
    category: str = ""
    risk_level: str = ""
    config: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Portfolio & Orders
# ---------------------------------------------------------------------------

@dataclass
class Position:
    """An open position within a portfolio."""

    market_id: str = ""
    symbol: str = ""
    side: str = ""
    size: float = 0.0
    entry_price: float = 0.0
    current_price: float = 0.0
    pnl: float = 0.0
    pnl_percent: float = 0.0
    opened_at: str = ""


@dataclass
class Portfolio:
    """Aggregate portfolio state."""

    total_value: float = 0.0
    available_balance: float = 0.0
    total_pnl: float = 0.0
    total_pnl_percent: float = 0.0
    positions: list[Position] = field(default_factory=list)
    updated_at: str = ""


@dataclass
class Order:
    """A trade order."""

    id: str = ""
    market_id: str = ""
    strategy_id: str = ""
    side: str = ""
    order_type: str = ""
    status: str = ""
    price: float = 0.0
    size: float = 0.0
    filled_size: float = 0.0
    filled_price: float = 0.0
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
    total_trades: int = 0
    win_rate: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Social & Signals
# ---------------------------------------------------------------------------

@dataclass
class WhaleTrade:
    """A large trade detected on-chain."""

    id: str = ""
    market_id: str = ""
    symbol: str = ""
    side: str = ""
    size: float = 0.0
    price: float = 0.0
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
    """A price or event alert."""

    id: str = ""
    name: str = ""
    condition: str = ""
    market_id: str = ""
    threshold: float = 0.0
    enabled: bool = True
    last_triggered: str = ""
    created_at: str = ""


@dataclass
class CopyConfig:
    """A copy-trading configuration."""

    id: str = ""
    source_strategy_id: str = ""
    enabled: bool = True
    max_allocation: float = 0.0
    scale_factor: float = 1.0
    created_at: str = ""


@dataclass
class Webhook:
    """A webhook endpoint registration."""

    id: str = ""
    url: str = ""
    events: list[str] = field(default_factory=list)
    secret: str = ""
    enabled: bool = True
    created_at: str = ""


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

@dataclass
class AiQueryResponse:
    """Response from the AI assistant endpoint."""

    answer: str = ""
    confidence: float = 0.0
    sources: list[str] = field(default_factory=list)
    suggested_actions: list[dict[str, Any]] = field(default_factory=list)


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
    label: str = ""  # 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    signal_count: int = 0
    last_updated: Optional[str] = None


@dataclass
class LpPosition:
    buy_order_id: str = ""
    sell_order_id: str = ""
    token_id: str = ""
    buy_price: str = ""
    sell_price: str = ""
    size: str = ""


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
