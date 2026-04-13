"""Polyforge Python SDK — typed REST client for the Polyforge trading platform."""

from polyforge.client import AsyncPolyforgeClient, PolyforgeClient
from polyforge.errors import (
    AuthenticationError,
    NotFoundError,
    PermissionError,
    PolyforgeError,
    RateLimitError,
    ServerError,
)
from polyforge.models import (
    AiQueryResponse,
    Alert,
    CopyConfig,
    Market,
    MarketplaceListing,
    MarketplaceSeller,
    MarketplaceStrategy,
    NewsSignal,
    Order,
    OrderStatus,
    PaginatedResponse,
    PlaceOrderResponse,
    Portfolio,
    Position,
    Strategy,
    StrategyBlock,
    StrategyEvent,
    StrategyExecMode,
    StrategyStatusResponse,
    StrategyTemplate,
    StrategyVisibility,
    Token,
    TraderScore,
    WhaleTrade,
    Webhook,
)

__all__ = [
    # Clients
    "PolyforgeClient",
    "AsyncPolyforgeClient",
    # Errors
    "PolyforgeError",
    "AuthenticationError",
    "PermissionError",
    "NotFoundError",
    "RateLimitError",
    "ServerError",
    # Enums
    "OrderStatus",
    "StrategyVisibility",
    "StrategyExecMode",
    # Models
    "AiQueryResponse",
    "Alert",
    "CopyConfig",
    "Market",
    "MarketplaceListing",
    "MarketplaceSeller",
    "MarketplaceStrategy",
    "NewsSignal",
    "Order",
    "PaginatedResponse",
    "PlaceOrderResponse",
    "Portfolio",
    "Position",
    "Strategy",
    "StrategyBlock",
    "StrategyEvent",
    "StrategyStatusResponse",
    "StrategyTemplate",
    "Token",
    "TraderScore",
    "WhaleTrade",
    "Webhook",
]

__version__ = "1.0.0"
