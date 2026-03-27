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
    NewsSignal,
    Order,
    PaginatedResponse,
    PlaceOrderResponse,
    Portfolio,
    Position,
    Strategy,
    StrategyTemplate,
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
    # Models
    "AiQueryResponse",
    "Alert",
    "CopyConfig",
    "Market",
    "NewsSignal",
    "Order",
    "PaginatedResponse",
    "PlaceOrderResponse",
    "Portfolio",
    "Position",
    "Strategy",
    "StrategyTemplate",
    "Token",
    "TraderScore",
    "WhaleTrade",
    "Webhook",
]

__version__ = "1.0.0"
