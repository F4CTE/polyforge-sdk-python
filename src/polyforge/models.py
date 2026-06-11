"""Polyforge SDK data models.

Uses Python dataclasses for zero additional dependencies beyond httpx.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Generic, List, Literal, Optional, TypeVar

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

    The platform returns flat pagination fields alongside ``data``:
    ``page``, ``limit``, ``total``, ``totalPages``, ``hasNext``.
    The ``items`` property is a backward-compatible alias for ``data``.
    """

    data: list[T] = field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 10
    total_pages: int = 0
    has_next: bool = False

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
    """A prediction market.

    Fields matching the platform response shape (parity with sdk-ts ``Market``
    interface and sdk-rust ``Market`` struct):

    - ``symbol``: **deprecated** — the platform does not return a top-level
      ``symbol`` field.  Defaults to ``None``.  Kept for backward compat only.
    - ``updated_at``: **deprecated** — the platform does not return
      ``updatedAt`` at the market level.  Defaults to ``None``.
    - ``description``: optional market description (platform never returns ``null``
      but the field is optional in the OpenAPI schema).
    - ``end_date``: ISO 8601 string, may be ``null`` for perpetual/ongoing markets.
    - ``resolved``: whether the market has been resolved by the oracle.
    """

    id: str = ""
    title: str = ""
    # Deprecated — kept in place for positional constructor compat
    symbol: str | None = None
    category: str = ""
    tokens: list[Token] = field(default_factory=list)
    price: float = 0.0
    volume_24h: float = 0.0
    change_24h: float = 0.0
    liquidity: float = 0.0
    created_at: str = ""
    # Deprecated — kept in place for positional constructor compat
    updated_at: str | None = None
    description: str | None = None
    end_date: str | None = None
    resolved: bool = False


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
    kalshi_subaccount: str | None = None


@dataclass
class StrategyStatusResponse:
    """Minimal response from strategy start/stop/pause/resume endpoints."""

    status: str = ""
    started_at: str = ""
    stopped_at: str = ""


@dataclass
class StrategyBlockValidationIssue:
    """A single validation issue found in strategy blocks.

    Mirrors the backend ``@IsIn()`` enum gate and ``class-validator`` severity
    levels used by the ``POST /api/v1/strategies/validate-blocks`` endpoint.
    """

    path: str = ""
    message: str = ""
    code: str = ""
    severity: str = ""  # 'error' | 'warning' | 'info'
    block_id: str = ""
    block_type: str = ""
    suggestion: str = ""


@dataclass
class StrategyBlockValidationResult:
    """Validation result returned by the strategy-blocks endpoint."""

    valid: bool = False
    issues: list[StrategyBlockValidationIssue] = field(default_factory=list)
    warnings: list[StrategyBlockValidationIssue] = field(default_factory=list)
    normalized_blocks: dict[str, Any] = field(default_factory=dict)


@dataclass
class StrategyBlockType:
    """A supported strategy block type as returned by ``GET /api/v1/strategies/block-types``."""

    type: str = ""
    label: str = ""
    category: str = ""
    description: str = ""
    version: str = ""
    deprecated: bool = False
    tags: list[str] = field(default_factory=list)


@dataclass
class StrategyBlockSchema:
    """JSON schema for a specific strategy block type."""

    type: str = ""
    schema: dict[str, Any] = field(default_factory=dict)
    ui_schema: dict[str, Any] = field(default_factory=dict)
    defaults: dict[str, Any] = field(default_factory=dict)
    examples: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class StrategyHealth:
    """Execution health metrics for a strategy (MCP contract).

    Mirrors the ``GET /api/v1/strategies/:id/health`` response shape.
    """

    fill_rate: float | None = None
    avg_latency_ms: float = 0.0
    error_count_24h: int = 0
    slippage_bps: float = 0.0
    win_rate: float | None = None
    total_pnl: float | None = None
    max_drawdown: float | None = None
    total_orders: int = 0
    filled_orders: int = 0
    last_updated: str | None = None


@dataclass
class StrategyUpdatePreview:
    """Preview of a strategy update returned by the ``preview-update`` endpoint."""

    strategy: dict[str, Any] = field(default_factory=dict)
    validation: dict[str, Any] = field(default_factory=dict)
    diff: dict[str, Any] = field(default_factory=dict)
    estimated_impact: dict[str, Any] = field(default_factory=dict)


@dataclass
class StrategyDecisionExplanation:
    """Explanation of a strategy decision returned by the ``explain-decision`` endpoint."""

    summary: str = ""
    rationale: list[str] = field(default_factory=list)
    confidence: float | None = None
    inputs: dict[str, Any] = field(default_factory=dict)
    decision: dict[str, Any] = field(default_factory=dict)
    related_events: list[dict[str, Any]] = field(default_factory=list)


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
    token_id: str = ""
    outcome: str = ""
    side: str = ""
    size: str = ""
    avg_price: str = ""
    current_price: str = ""
    unrealized_pnl: str = ""
    realized_pnl: str = ""
    opened_at: str = ""


@dataclass
class Portfolio:
    """Aggregate portfolio state.

    PnL totals are typed as ``str`` because the platform returns decimal
    strings to preserve precision.
    """

    total_unrealized_pnl: str = ""
    total_realized_pnl: str = ""
    positions: list[Position] = field(default_factory=list)


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
    token_id: str = ""
    outcome: str = ""
    strategy_id: str = ""
    intent_id: str | None = None
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


@dataclass
class RedeemPositionResponse:
    """Response from redeeming a resolved position."""

    position_id: str = ""
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


@dataclass
class CrossVenueOpportunity:
    """A cross-venue arbitrage opportunity between Polymarket and Kalshi."""

    match_id: str = ""
    polymarket_id: str = ""
    kalshi_id: str = ""
    polymarket_title: str = ""
    kalshi_title: str = ""
    category: str = ""
    confidence: float = 0.0
    polymarket_yes: float = 0.0
    kalshi_yes: float = 0.0
    spread_pct: float = 0.0
    direction: str = ""  # "buy_poly_sell_kalshi" | "buy_kalshi_sell_poly"


@dataclass
class MarketMatch:
    """A matched pair of markets across venues."""

    id: str = ""
    polymarket_id: str = ""
    kalshi_id: str = ""
    confidence: float = 0.0
    match_method: str = ""
    verified: bool = False
    created_at: str = ""
    updated_at: str = ""


@dataclass
class VenuePriceInfo:
    """Bid/ask info for a single venue in a spread comparison."""

    market_id: str = ""
    title: str = ""
    yes_bid: float = 0.0
    no_ask: float = 0.0


@dataclass
class SpreadSummary:
    """Bid/ask spread comparison between Polymarket and Kalshi for a matched pair."""

    match_id: str = ""
    polymarket: Optional[VenuePriceInfo] = None
    kalshi: Optional[VenuePriceInfo] = None
    yes_spread_pct: float = 0.0
    no_spread_pct: float | None = None
    confidence: float = 0.0
    verified: bool = False


@dataclass
class VenueComparisonDetail:
    """Price detail for one venue in a cross-venue comparison."""

    market_id: str = ""
    title: str = ""
    yes_price: float = 0.0
    no_price: float = 0.0


@dataclass
class VenueComparison:
    """Detailed price comparison for a matched market pair across venues."""

    match_id: str = ""
    polymarket: Optional[VenueComparisonDetail] = None
    kalshi: Optional[VenueComparisonDetail] = None
    spread_pct: float = 0.0
    confidence: float = 0.0
    verified: bool = False


@dataclass
class MatchSyncResult:
    """Result of a manual matching pass."""

    matched: int = 0
    created: int | None = None
    updated: int | None = None


@dataclass
class ArbitrageSnapshot:
    """A historical record of a cross-venue arbitrage detection."""

    id: str = ""
    match_id: str = ""
    spread_pct: float = 0.0
    direction: str = ""
    poly_yes: float = 0.0
    kalshi_yes: float = 0.0
    confidence: float = 0.0
    scanned_at: str = ""


@dataclass
class ArbitrageAlertSubscription:
    """A user subscription for cross-venue arbitrage notifications."""

    id: str = ""
    min_spread_pct: float = 0.0
    market_id: str | None = None
    active: bool = True
    triggered_at: str | None = None
    created_at: str = ""


# ---------------------------------------------------------------------------
# Cross-Venue Arb Execution / Positions / Risk
# ---------------------------------------------------------------------------
#
# Trading-impact surface: ``execute_arb`` and ``close_arb_position`` place
# real orders on Polymarket and Kalshi. Both endpoints are rate-limited to
# 5 requests per minute per user (HTTP 429 on exceed). ``close_arb_position``
# uses sweep semantics: GTC orders priced at extreme tick boundaries
# (0.001 SELL / 0.999 BUY) behave as market-order sweeps — slippage is
# bounded only by venue depth, not by the on-paper price.
#
# ``match_id`` is UUID-validated server-side. Backend error codes
# (``VENUES_NOT_CONNECTED``, ``MATCH_NOT_FOUND``, ``COMPARISON_UNAVAILABLE``,
# ``SPREAD_TOO_LOW``, ``TOKEN_RESOLUTION_FAILED``, ``ARB_POSITION_NOT_FOUND``,
# ``INVALID_STATUS``) are passed through verbatim via ``PolyforgeError.code``.
#
# These models describe the trading-impact-bearing arbitrage execution
# surface (``POST /api/v1/arbitrage/execute``, the position lifecycle, and
# the risk dashboards). Decimal columns from the Prisma backend serialize
# as strings; we keep them as ``str`` so callers convert with full
# precision instead of relying on float coercion.

# Status values mirror the server-side ``ArbPositionStatus`` enum.
ArbPositionStatus = Literal[
    "PENDING", "PARTIAL", "OPEN", "CLOSING", "CLOSED", "FAILED"
]

# Venue identifiers mirror the server-side ``Venue`` enum.
Venue = Literal["POLYMARKET", "KALSHI", "POLYMARKET_US"]


@dataclass
class ArbExecutionLeg:
    """A single leg of an arbitrage execution result."""

    venue: str = ""
    intent_id: str = ""
    token_id: str = ""
    price: float = 0.0


@dataclass
class ArbExecutionResult:
    """Server response for ``POST /api/v1/arbitrage/execute``.

    On success this opens a new :class:`ArbPosition` in ``OPEN`` state.
    The position consists of two offsetting legs (buy on one venue, sell
    on the other) and can later be exited only via a **full sweep-close**
    using ``POST /api/v1/arbitrage/positions/:id/close``
    (see :meth:`PolyforgeClient.close_arb_position`). Partial closes are
    not supported for arbitrage positions.

    Both legs carry optional ``intent_id`` and ``price`` fields; fill
    confirmation may arrive asynchronously and is available on the full
    :class:`ArbPosition` record after the orders execute.
    """

    arb_position_id: str = ""
    buy_leg: ArbExecutionLeg | None = None
    sell_leg: ArbExecutionLeg | None = None
    entry_spread_pct: float = 0.0
    status: str = ""


@dataclass
class ArbPosition:
    """A cross-venue arbitrage position (mirrors the Prisma ``ArbPosition`` row).

    Created via ``POST /api/v1/arbitrage/execute`` and closed via a **full
    sweep-close** (``POST /api/v1/arbitrage/positions/:id/close``). The
    lifecycle is tracked in ``status``: positions start in ``OPEN``,
    transition through ``CLOSING`` during the sweep, and settle in
    ``CLOSED`` or ``FAILED``.

    Decimal columns (``buy_price``, ``buy_size``, P&L fields, etc.) arrive
    as strings when the backend serializes Decimals through JSON.
    """

    id: str = ""
    user_id: str = ""
    match_id: str = ""
    status: str = ""

    buy_venue: str = ""
    buy_order_id: str | None = None
    buy_token_id: str = ""
    buy_price: str = "0"
    buy_size: str = "0"
    buy_fill_price: str | None = None
    buy_fill_size: str | None = None

    sell_venue: str = ""
    sell_order_id: str | None = None
    sell_token_id: str = ""
    sell_price: str = "0"
    sell_size: str = "0"
    sell_fill_price: str | None = None
    sell_fill_size: str | None = None

    entry_spread_pct: str = "0"
    current_spread_pct: str | None = None
    realized_pnl: str | None = None
    unrealized_pnl: str | None = None

    opened_at: str | None = None
    closed_at: str | None = None
    created_at: str = ""
    updated_at: str = ""


@dataclass
class ArbPositionsResponse:
    """Paginated response for ``GET /api/v1/arbitrage/positions``.

    Each :class:`ArbPosition` tracks the full arbitrage lifecycle
    (``OPEN`` → ``CLOSING`` → ``CLOSED`` / ``FAILED``). Positions can only
    be exited via a full sweep-close.
    """

    positions: list[ArbPosition] = field(default_factory=list)
    total: int = 0


@dataclass
class ArbCloseResponse:
    """Server response for ``POST /api/v1/arbitrage/positions/:id/close``.

    Returned after a **full sweep-close** of a cross-venue arbitrage
    position. Both legs (buy and sell) are reversed with market orders
    placed on the respective venues. The close is always a complete
    sweep — no partial close is supported for arbitrage positions.

    ``status`` reflects the immediate outcome of the close request:

    - ``CLOSING`` — both reversing market orders were accepted and are
      being placed; closure completes asynchronously. Poll
      :meth:`PolyforgeClient.get_arb_position` to wait for the terminal
      status (``CLOSED`` or ``FAILED``).
    - ``FAILED`` — one or both reverse orders could not be placed (e.g.
      insufficient liquidity, venue connectivity issue). This is a
      **terminal** outcome — the position remains in its prior state and
      will not transition further without a new close request.
    """

    status: str = ""
    position_id: str = ""


@dataclass
class ArbNetExposure:
    """Net deployed capital broken out by venue."""

    polymarket: float = 0.0
    kalshi: float = 0.0


@dataclass
class ArbRiskDashboard:
    """Server response for ``GET /api/v1/arbitrage/risk/dashboard``."""

    open_positions: int = 0
    pending_positions: int = 0
    total_deployed: float = 0.0
    net_exposure: ArbNetExposure = field(default_factory=ArbNetExposure)
    total_realized_pnl: float = 0.0
    total_unrealized_pnl: float = 0.0
    avg_spread_pct: float = 0.0
    positions_by_status: Dict[str, int] = field(default_factory=dict)


@dataclass
class ArbSettlementRisk:
    """An entry from ``GET /api/v1/arbitrage/risk/settlement``."""

    match_id: str = ""
    polymarket_title: str = ""
    kalshi_title: str = ""
    polymarket_end_date: str | None = None
    kalshi_end_date: str | None = None
    end_date_diff_days: float | None = None
    confidence: float = 0.0
    risk_level: str = "LOW"  # "LOW" | "MEDIUM" | "HIGH"
    reason: str = ""


@dataclass
class ArbPnlRefreshResult:
    """Server response for ``POST /api/v1/arbitrage/risk/refresh-pnl``."""

    updated: int = 0


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
class AccuracyLeaderboardEntry:
    """A single entry in the accuracy leaderboard, ranked by win-rate.

    The platform returns ``pnl`` and ``winRate`` as decimal strings to
    preserve precision.
    """

    rank: int = 0
    user_id: str = ""
    username: str = ""
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    pnl: str = ""
    win_rate: str = ""
    trade_count: int = 0


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
    """A single OHLCV candle in a market's price history."""

    timestamp: str = ""
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    volume: float = 0.0

    @property
    def price(self) -> float:
        return self.close


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
# Rewards
# ---------------------------------------------------------------------------

@dataclass
class RewardMarket:
    condition_id: str = ""
    rewards_daily: str = ""
    rewards_max_spread: str = ""
    rewards_min_size: str = ""
    start_date: str = ""
    end_date: str = ""


@dataclass
class UserReward:
    date: str = ""
    amount: str = ""
    market: str = ""


@dataclass
class UserRewardsTotal:
    total: str = ""
    by_date: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class Rebate:
    date: str = ""
    amount: str = ""
    fees_paid: str = ""


@dataclass
class RewardsMarketDetail:
    condition_id: str = ""
    rate_per_day: str = ""
    total_rewards: str = ""
    remaining_reward_amount: str = ""
    max_spread: str = ""
    min_size: str = ""
    start_date: str = ""
    end_date: str = ""


@dataclass
class UserSponsoredMarkets:
    markets: list = field(default_factory=list)


@dataclass
class RewardsSponsorUrl:
    url: str = ""


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
    trailing_pct: str | None = None
    expires_at: str | None = None


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
        CONNECTED, STRATEGY_STARTED, STRATEGY_STOPPED, STRATEGY_PAUSED,
        STRATEGY_RESUMED, STRATEGY_ERROR,
        ORDER_SUBMITTED, ORDER_PLACED, ORDER_PARTIAL, ORDER_FILLED,
        ORDER_FAILED, ORDER_ERROR, ORDER_CANCELLED,
        BACKTEST_PROGRESS, BACKTEST_COMPLETED, BACKTEST_FAILED
    """

    type: str = ""
    strategy_id: str = ""
    data: dict[str, Any] | None = None
    timestamp: int = 0


# Known strategy event types mirroring the platform SSE stream.
StrategyEventType = Literal[
    "CONNECTED",
    "STRATEGY_STARTED",
    "STRATEGY_STOPPED",
    "STRATEGY_PAUSED",
    "STRATEGY_RESUMED",
    "STRATEGY_ERROR",
    "ORDER_PLACED",
    "ORDER_SUBMITTED",
    "ORDER_FILLED",
    "ORDER_PARTIAL",
    "ORDER_CANCELLED",
    "ORDER_FAILED",
    "ORDER_ERROR",
    "BACKTEST_PROGRESS",
    "BACKTEST_COMPLETED",
    "BACKTEST_FAILED",
]

KNOWN_STRATEGY_EVENTS: frozenset[str] = frozenset(
    (
        "CONNECTED",
        "STRATEGY_STARTED",
        "STRATEGY_STOPPED",
        "STRATEGY_PAUSED",
        "STRATEGY_RESUMED",
        "STRATEGY_ERROR",
        "ORDER_PLACED",
        "ORDER_SUBMITTED",
        "ORDER_FILLED",
        "ORDER_PARTIAL",
        "ORDER_CANCELLED",
        "ORDER_FAILED",
        "ORDER_ERROR",
        "BACKTEST_PROGRESS",
        "BACKTEST_COMPLETED",
        "BACKTEST_FAILED",
    )
)


# ---------------------------------------------------------------------------
# News Articles
# ---------------------------------------------------------------------------


@dataclass
class NewsArticle:
    """A news article with optional AI-generated trading signals."""

    id: str = ""
    source: str = ""
    title: str = ""
    summary: str | None = None
    url: str = ""
    image_url: str | None = None
    sentiment: str = ""
    published_at: str = ""
    ingested_at: str = ""
    signals: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Scores — Badges
# ---------------------------------------------------------------------------


@dataclass
class Badge:
    """A trader badge awarded for reaching a performance milestone."""

    id: str = ""
    user_id: str = ""
    type: str = ""
    name: str = ""
    earned_at: str = ""


@dataclass
class TopTraderEntry:
    """A single entry from the top-traders leaderboard (scores/top)."""

    user_id: str = ""
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    score: float = 0.0
    win_rate: str = ""
    total_trades: int = 0


# ---------------------------------------------------------------------------
# Markets — extended CLOB data
# ---------------------------------------------------------------------------


@dataclass
class TickSizeInfo:
    """Tick size and fee rate for a market token."""

    token_id: str = ""
    tick_size: str = ""
    fee_rate: str = ""


@dataclass
class SpreadInfo:
    """Current bid-ask spread for a market token."""

    token_id: str = ""
    spread: str = ""


@dataclass
class MidpointInfo:
    """Current midpoint price for a market token."""

    token_id: str = ""
    midpoint: str = ""


@dataclass
class ClobBook:
    """Full CLOB order book snapshot including spread and midpoint."""

    token_id: str = ""
    bids: list[dict[str, Any]] = field(default_factory=list)
    asks: list[dict[str, Any]] = field(default_factory=list)
    spread: str = ""
    midpoint: str = ""
    timestamp: int = 0


@dataclass
class ClobPriceHistory:
    """CLOB price history for a market token."""

    token_id: str = ""
    interval: str = ""
    history: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Orders — Batch / Bulk
# ---------------------------------------------------------------------------


@dataclass
class BatchOrderItem:
    """A single result from a batch order placement."""

    order_id: str = ""
    intent_id: str = ""
    status: str = ""


@dataclass
class BatchOrderResult:
    """Response from POST /api/v1/orders/batch."""

    results: list[BatchOrderItem] = field(default_factory=list)


@dataclass
class BulkCancelError:
    """An error entry from a bulk cancel operation."""

    order_id: str = ""
    reason: str = ""


@dataclass
class BulkCancelResult:
    """Response from POST /api/v1/orders/bulk."""

    cancelled: list[str] = field(default_factory=list)
    errors: list[BulkCancelError] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Portfolio — Polymarket-native
# ---------------------------------------------------------------------------


@dataclass
class PolymarketPortfolioEntry:
    """A single position in a Polymarket-native portfolio."""

    asset: str = ""
    size: str = ""
    avg_price: str = ""
    realized_pnl: str = ""
    unrealized_pnl: str = ""


@dataclass
class PolymarketEarningsEntry:
    """Daily earnings data from the Polymarket rewards programme."""

    date: str = ""
    earnings: str = ""
    volume: str = ""
    win_rate: str = ""


@dataclass
class PolymarketActivity:
    """A single on-chain activity event from a Polymarket wallet."""

    id: str = ""
    type: str = ""
    amount: str = ""
    asset: str = ""
    timestamp: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


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


# ---------------------------------------------------------------------------
# Whale Leaderboard (Smart Money)
# ---------------------------------------------------------------------------

@dataclass
class WhaleLeaderboardEntry:
    """A single entry in the whale smart-money leaderboard."""

    rank: int = 0
    wallet_address: str = ""
    smart_money_score: str = ""
    total_pnl: str = ""
    win_rate: str = ""
    sharpe_ratio: str = ""
    trade_count: int = 0
    win_count: int = 0
    total_volume: str = ""
    last_trade_at: str | None = None


# ---------------------------------------------------------------------------
# Whale Alert Filter
# ---------------------------------------------------------------------------

@dataclass
class WhaleAlertFilter:
    """User-specific alert filter for whale trade notifications."""

    id: str = ""
    min_size: str | None = None
    market_ids: list[str] = field(default_factory=list)
    wallet_addresses: list[str] = field(default_factory=list)
    sides: list[str] = field(default_factory=list)
    active: bool = True
    created_at: str = ""
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Actions (API capability discovery)
# ---------------------------------------------------------------------------

@dataclass
class ActionParameter:
    """A parameter accepted by an API action."""

    name: str = ""
    type: str = ""
    required: bool = False
    in_: str = ""
    description: str = ""
    enum: list[str] = field(default_factory=list)
    default: Any = None
    max: int | None = None
    min: int | None = None


@dataclass
class ActionDefinition:
    """A single API action exposed by the platform."""

    name: str = ""
    description: str = ""
    method: str = ""
    path: str = ""
    scope: str = ""
    category: str = ""
    parameters: list[ActionParameter] = field(default_factory=list)


@dataclass
class ActionsSchema:
    """The complete list of available API actions."""

    version: str = ""
    actions: list[ActionDefinition] = field(default_factory=list)


# ---------------------------------------------------------------------------
# User Profile
# ---------------------------------------------------------------------------

@dataclass
class UserProfile:
    """Public profile for a user."""

    username: str = ""
    display_name: str = ""
    bio: str | None = None
    avatar_url: str | None = None
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    public_strategy_count: int = 0
    joined_at: str = ""


@dataclass
class FollowResult:
    """Result of a follow/unfollow toggle."""

    following: bool = False
    followers_count: int = 0


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

@dataclass
class NotificationSettings:
    """Channel-level notification toggles."""

    email_enabled: bool = False
    telegram_enabled: bool = False
    discord_enabled: bool = False
    on_order_filled: bool = False
    on_strategy_error: bool = False
    on_backtest_complete: bool = False
    on_daily_loss_limit: bool = False
    on_market_resolved: bool = False
    on_someone_forked: bool = False
    on_someone_followed: bool = False
    on_someone_liked: bool = False
    on_someone_commented: bool = False


@dataclass
class EventNotificationPref:
    """Per-event notification preference."""

    event: str = ""
    in_app: bool = False
    email: bool = False
    push: bool = False


@dataclass
class EventNotificationPreferences:
    """Aggregate event notification preferences."""

    preferences: list[EventNotificationPref] = field(default_factory=list)
    email_digest: str = ""


@dataclass
class VenuePreferences:
    """User venue preferences."""

    default_venue: str = ""
    enabled_venues: list[str] = field(default_factory=list)
    single_platform_mode: bool = False


UserPreferences = VenuePreferences


# ---------------------------------------------------------------------------
# Support Tickets
# ---------------------------------------------------------------------------

@dataclass
class TicketMessage:
    """A single message within a support ticket."""

    id: str = ""
    body: str = ""
    author: str = ""
    created_at: str = ""


@dataclass
class SupportTicket:
    """A support ticket."""

    id: str = ""
    subject: str = ""
    category: str = "GENERAL"
    priority: str = "MEDIUM"
    status: str = ""
    body: str = ""
    messages: list[TicketMessage] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Public user profile lookups (POLA-1844)
# ---------------------------------------------------------------------------


@dataclass
class UserPerformancePoint:
    """One day on a public user's PnL curve."""

    date: str = ""
    pnl: float = 0.0
    cum_pnl: float = 0.0


@dataclass
class UserStrategySummary:
    """Public summary of one of a user's strategies."""

    id: str = ""
    name: str = ""
    description: str = ""
    win_rate: float = 0.0
    trade_count: int = 0
    price_usdc: float = 0.0
    fork_count: int = 0
    like_count: int = 0
    is_liked: bool = False


@dataclass
class UserActivityEntry:
    """Resolved-position activity entry shown on a user's profile."""

    id: str = ""
    market_question: str = ""
    outcome: str = ""
    side: str = ""
    size: float = 0.0
    pnl: float = 0.0
    resolved_at: str = ""


@dataclass
class UserProfileBadge:
    """Badge entry returned by the public-profile endpoint (id is the badge type)."""

    id: str = ""
    unlocked_at: str = ""


@dataclass
class FollowedUser:
    """Pared-down user record returned by ``me/following``."""

    id: str = ""
    username: str = ""
    display_name: str | None = None
    avatar_url: str | None = None


# ---------------------------------------------------------------------------
# Misc public utility endpoints (POLA-1857)
# ---------------------------------------------------------------------------


@dataclass
class MyReferralsResponse:
    """Referral overview returned by ``GET /api/v1/referrals/me``."""

    referral_code: str = ""
    referral_link: str = ""
    invited: int = 0
    signed_up: int = 0
    active: int = 0
    credits_earned: int = 0
    referrals: list[Any] = field(default_factory=list)

    @property
    def stats(self) -> MyReferralsResponse:
        """Deprecated stats alias returning this combined response."""
        return self


ReferralInfo = MyReferralsResponse
ReferralStats = MyReferralsResponse


@dataclass
class VenueFeeEstimate:
    """Per-venue fee breakdown returned by the fee preview endpoint."""

    venue: str = ""
    fee_bps: float = 0.0
    fee_usd: float = 0.0
    total_cost_usd: float = 0.0
    is_maker: bool = False


@dataclass
class FeeMarketMatch:
    """Match descriptor linking a Polymarket and Kalshi market."""

    match_id: str = ""
    confidence: float = 0.0


@dataclass
class OrderPreviewResponse:
    """Fee preview comparing Polymarket and Kalshi for a hypothetical order."""

    polymarket: VenueFeeEstimate = field(default_factory=VenueFeeEstimate)
    kalshi: Optional[VenueFeeEstimate] = None
    savings: float = 0.0
    recommended_venue: str = ""
    market_match: Optional[FeeMarketMatch] = None


@dataclass
class MarketAlert:
    """A per-market price alert."""

    id: str = ""
    market_id: str = ""
    outcome: str = ""
    condition: str = ""
    threshold: float = 0.0
    triggered: bool = False
    created_at: str = ""


@dataclass
class MarketHistoryPoint:
    """A single timestamped point in a market's price history."""

    timestamp: str = ""
    yes_price: float = 0.0
    no_price: float = 0.0
    volume: float = 0.0


@dataclass
class SentimentUserVote:
    """Optional per-user sentiment vote returned alongside the report."""

    direction: str = ""
    confidence: float = 0.0


@dataclass
class MarketSentimentReport:
    """Aggregate sentiment report for a single market.

    Distinct from :class:`MarketSentiment` (which mirrors ``/news/sentiment/:id``)
    — this one mirrors ``/markets/:marketId/sentiment``.
    """

    yes_percent: float = 0.0
    no_percent: float = 0.0
    total_votes: int = 0
    user_vote: Optional[SentimentUserVote] = None


@dataclass
class CorrelationCategoriesReport:
    """Category correlation matrix returned by the analytics endpoint."""

    categories: list[str] = field(default_factory=list)
    matrix: list[list[float]] = field(default_factory=list)
    updated_at: str = ""


@dataclass
class JournalEntry:
    """A row in the journal page (orders annotated with a mood).

    Mirrors the shape returned by ``GET /api/v1/journal``.
    """

    id: str = ""
    market_id: str = ""
    mood: str | None = None
    note: str | None = None
    side: str = ""
    outcome: str = ""
    price: str = ""
    size: str = ""
    status: str = ""
    created_at: str = ""


@dataclass
class SystemHealthPublic:
    """Public health/status response for GET /health (unauthenticated).

    Returns only public-facing status fields. Operational internals
    (DB, Redis, queue, services) are not exposed on this endpoint.
    """

    status: str = ""
    service: str | None = None
    version: str | None = None
    uptime: float | None = None


@dataclass
class SystemHealthAuthenticated:
    """Authenticated health/status response for GET /api/v1/status.

    Includes operational metrics not exposed on the public /health endpoint.
    """

    status: str = ""
    service: str | None = None
    version: str | None = None
    uptime: float | None = None
    db: dict[str, Any] | None = None
    redis: dict[str, Any] | None = None
    queue_depth: int | None = None
    services: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# GDPR Personal Data Export
# ---------------------------------------------------------------------------


@dataclass
class PersonalDataExportMeta:
    """Metadata for a personal data export payload."""

    max_records_per_collection: int = 1000
    collections_truncated: dict[str, int] = field(default_factory=dict)


@dataclass
class PersonalDataExport:
    """GDPR personal data export response from GET /api/v1/me/export.

    Contains all user data across the platform grouped into sections.
    Webhook URLs are redacted to hostname only.
    """

    generated_at: str = ""
    format_version: str = ""
    meta: PersonalDataExportMeta | None = None
    account: dict[str, Any] = field(default_factory=dict)
    settings: dict[str, Any] = field(default_factory=dict)
    security: dict[str, Any] = field(default_factory=dict)
    trading: dict[str, Any] = field(default_factory=dict)
    communications: dict[str, Any] = field(default_factory=dict)
    social: dict[str, Any] = field(default_factory=dict)
