"""Polyforge SDK data models.

Uses Python dataclasses for zero additional dependencies beyond httpx.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Generic, TypeVar

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
