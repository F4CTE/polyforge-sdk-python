"""Polyforge REST API client — sync and async versions."""

from __future__ import annotations

import ipaddress
import json as _json
import logging as _log
import math
import re
import socket
from dataclasses import fields
from typing import Any, AsyncIterator, Iterator, TypeVar, get_type_hints

from urllib.parse import quote, urlparse

import httpx

from polyforge.errors import (
    AuthenticationError,
    NotFoundError,
    PermissionError,
    PolyforgeError,
    RateLimitError,
    ServerError,
)
from polyforge.models import (
    AccuracyScore,
    AiQueryResponse,
    Alert,
    ArbitrageOpportunity,
    CalibrationBucket,
    CategoryAccuracy,
    ConditionalOrder,
    CopyConfig,
    LpPosition,
    Market,
    MarketplaceListing,
    MarketplacePurchaseResult,
    MarketplaceSeller,
    MarketplaceStrategy,
    MarketSentiment,
    NewsSignal,
    Order,
    OrderBook,
    OrderBookLevel,
    OrderStatus,
    PaginatedResponse,
    PlaceOrderResponse,
    PlaceSmartOrderResponse,
    Portfolio,
    PortfolioPnl,
    PortfolioReview,
    Position,
    PriceHistoryEntry,
    SmartOrder,
    SmartOrderChildOrder,
    Strategy,
    StrategyBlock,
    StrategyEvent,
    StrategyStatusResponse,
    StrategyTemplate,
    Token,
    TraderScore,
    WatchlistItem,
    Webhook,
    WebhookTestResult,
    WhaleTrade,
)

T = TypeVar("T")

_MODEL_REGISTRY: dict[str, type] = {
    "Market": Market,
    "Token": Token,
    "Strategy": Strategy,
    "StrategyBlock": StrategyBlock,
    "StrategyStatusResponse": StrategyStatusResponse,
    "StrategyTemplate": StrategyTemplate,
    "Portfolio": Portfolio,
    "Position": Position,
    "Order": Order,
    "TraderScore": TraderScore,
    "WhaleTrade": WhaleTrade,
    "NewsSignal": NewsSignal,
    "Alert": Alert,
    "ConditionalOrder": ConditionalOrder,
    "CopyConfig": CopyConfig,
    "PortfolioPnl": PortfolioPnl,
    "WatchlistItem": WatchlistItem,
    "Webhook": Webhook,
    "WebhookTestResult": WebhookTestResult,
    "AiQueryResponse": AiQueryResponse,
    "MarketplaceSeller": MarketplaceSeller,
    "MarketplaceStrategy": MarketplaceStrategy,
    "MarketplaceListing": MarketplaceListing,
    "PriceHistoryEntry": PriceHistoryEntry,
    "OrderBookLevel": OrderBookLevel,
    "OrderBook": OrderBook,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case (e.g. 'baseToken' -> 'base_token')."""
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", name).lower()


def _resolve_model_name(hint: Any) -> str:
    """Extract the model class name from a type hint, handling Optional/Union."""
    # Direct class name
    name = getattr(hint, "__name__", "")
    if name in _MODEL_REGISTRY:
        return name
    # Handle Optional[X] which is Union[X, None]
    args = getattr(hint, "__args__", ())
    if args:
        for arg in args:
            arg_name = getattr(arg, "__name__", "")
            if arg_name in _MODEL_REGISTRY:
                return arg_name
    return ""


def _parse(cls: type[T], data: dict[str, Any]) -> T:
    """Recursively instantiate a dataclass from a JSON dict."""
    if not isinstance(data, dict):
        return data  # type: ignore[return-value]

    # Build a snake_case lookup so camelCase API keys map to dataclass fields
    snake_data = {_camel_to_snake(k): v for k, v in data.items()}

    hints = get_type_hints(cls)
    kwargs: dict[str, Any] = {}

    for f in fields(cls):  # type: ignore[arg-type]
        raw = data.get(f.name) or snake_data.get(f.name)
        if raw is None:
            continue

        hint = hints.get(f.name)
        # Resolve nested dataclass fields via registry (handles Optional[X] too)
        hint_name = _resolve_model_name(hint) if hint else ""
        origin = getattr(hint, "__origin__", None)

        if hint_name in _MODEL_REGISTRY and isinstance(raw, dict):
            kwargs[f.name] = _parse(_MODEL_REGISTRY[hint_name], raw)
        elif origin is list and isinstance(raw, list) and raw:
            args = getattr(hint, "__args__", ())
            inner_name = getattr(args[0], "__name__", "") if args else ""
            if inner_name in _MODEL_REGISTRY:
                kwargs[f.name] = [_parse(_MODEL_REGISTRY[inner_name], item) for item in raw]
            else:
                kwargs[f.name] = raw
        else:
            kwargs[f.name] = raw

    return cls(**kwargs)


def _raise_for_status(response: httpx.Response) -> None:
    """Translate HTTP errors into typed PolyforgeError subclasses."""
    if response.is_success:
        return

    try:
        body = response.json()
    except Exception:
        body = {}

    message = body.get("message") or body.get("error") or response.reason_phrase or "Unknown error"
    code = body.get("code", "")
    request_id = body.get("requestId", "")
    suggestion = body.get("suggestion") or None

    kwargs = dict(status_code=response.status_code, code=code, request_id=request_id, suggestion=suggestion)

    match response.status_code:
        case 401:
            raise AuthenticationError(message, **kwargs)
        case 403:
            raise PermissionError(message, **kwargs)
        case 404:
            raise NotFoundError(message, **kwargs)
        case 429:
            raise RateLimitError(message, **kwargs)
        case sc if sc >= 500:
            raise ServerError(message, **kwargs)
        case _:
            raise PolyforgeError(message, **kwargs)


def _strip_none(params: dict[str, Any]) -> dict[str, Any]:
    """Remove None values so they are not sent as query parameters."""
    return {k: v for k, v in params.items() if v is not None}


def _encode_path(segment: str) -> str:
    """URL-encode a path parameter to prevent path traversal attacks (CWE-22)."""
    return quote(str(segment), safe="")


def _validate_financial_param(name: str, value: float) -> None:
    """Reject NaN, Infinity, negative, and zero values for financial parameters.

    Raises:
        TypeError: if *value* is not a real number (int or float).
        ValueError: if *value* is NaN, infinite, zero, or negative.
    """
    if not isinstance(value, (int, float)):
        raise TypeError(f"{name} must be a number, got {type(value).__name__}")
    if math.isnan(value):
        raise ValueError(f"{name} must not be NaN")
    if math.isinf(value):
        raise ValueError(f"{name} must not be Infinity")
    if value <= 0:
        raise ValueError(f"{name} must be positive, got {value}")


_BLOCKED_HOSTNAMES: set[str] = {
    "localhost",
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
}

# RFC 6598 — Carrier-Grade NAT (CGNAT) shared address space.
# Python's ipaddress module does NOT classify 100.64.0.0/10 as private,
# loopback, link-local, or reserved, so we must block it explicitly.
_CGNAT_NETWORK = ipaddress.ip_network("100.64.0.0/10")


def _is_cgnat(addr: ipaddress.IPv4Address) -> bool:
    """Return True if *addr* falls within the CGNAT shared address space."""
    return addr in _CGNAT_NETWORK


def _is_ip_blocked(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> str | None:
    """Return a human-readable reason if *addr* must be blocked, else ``None``."""
    # Check IPv4-mapped IPv6 first — the IPv6 wrapper has is_reserved=True for ALL
    # mapped addresses, which would incorrectly block public IPs like ::ffff:8.8.8.8.
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        mapped = addr.ipv4_mapped
        if mapped.is_private or mapped.is_loopback or mapped.is_link_local or mapped.is_reserved:
            return (
                "Webhook URL cannot point to private/loopback addresses "
                f"via IPv4-mapped IPv6 (resolved to {addr})"
            )
        if _is_cgnat(mapped):
            return (
                "Webhook URL cannot point to CGNAT/shared address space "
                f"(RFC 6598) via IPv4-mapped IPv6 (resolved to {addr})"
            )
        return None

    if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
        return (
            "Webhook URL cannot point to private, loopback, link-local, "
            f"or reserved addresses (resolved to {addr})"
        )
    if isinstance(addr, ipaddress.IPv4Address) and _is_cgnat(addr):
        return (
            "Webhook URL cannot point to CGNAT/shared address space "
            f"(RFC 6598, 100.64.0.0/10) (resolved to {addr})"
        )
    return None


def _resolve_and_validate_ips(hostname: str) -> list[str]:
    """Resolve *hostname* and validate every resulting IP.

    Returns the list of validated public IP strings so callers can pin the
    resolution result and avoid a second DNS lookup (DNS-rebinding mitigation).
    """
    try:
        addrinfos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise ValueError(f"Could not resolve webhook hostname: {hostname}")

    validated: list[str] = []
    for _family, _, _, _, sockaddr in addrinfos:
        ip_str = sockaddr[0]
        try:
            addr = ipaddress.ip_address(ip_str)
        except ValueError:
            raise ValueError(f"Invalid IP resolved for webhook hostname: {ip_str}")

        reason = _is_ip_blocked(addr)
        if reason:
            raise ValueError(reason)
        validated.append(ip_str)

    if not validated:
        raise ValueError(f"No addresses resolved for webhook hostname: {hostname}")

    return validated


def _validate_webhook_url(url: str) -> list[str]:
    """Validate webhook URL to prevent SSRF attacks.

    Blocks private, loopback, link-local, and reserved IP addresses as well as
    known cloud metadata hostnames.  Only HTTPS URLs are allowed.

    Returns the list of validated public IPs so callers can log or pin them.

    .. note::

       This is a **client-side best-effort check**.  Because the SDK sends the
       URL to the PolyForge API (which later delivers webhooks), the actual
       HTTP connection is made server-side.  A DNS rebinding attack could cause
       the server's DNS resolution to return a different IP than what was
       validated here (CWE-367 TOCTOU).  For full protection, the server must
       also validate destination IPs at connection time.
    """
    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise ValueError("Webhook URL must use HTTPS")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Webhook URL must contain a valid hostname")

    lower_hostname = hostname.lower()
    if lower_hostname in _BLOCKED_HOSTNAMES or lower_hostname.endswith(".local"):
        raise ValueError("Webhook URL cannot point to localhost or internal addresses")

    return _resolve_and_validate_ips(hostname)


# ---------------------------------------------------------------------------
# Synchronous client
# ---------------------------------------------------------------------------

class PolyforgeClient:
    """Synchronous Polyforge REST API client.

    Usage::

        with PolyforgeClient(api_key="pk_...") as client:
            markets = client.list_markets(limit=5)
            for m in markets.items:
                print(m.title, m.price)
    """

    def __init__(
        self,
        api_key: str,
        api_url: str = "https://api.polyforge.app",
        timeout: float = 15.0,
    ) -> None:
        self._api_key = api_key
        self._api_url = api_url.rstrip("/")

        # Reject non-HTTPS URLs for non-localhost hosts
        parsed = urlparse(self._api_url)
        if parsed.scheme != "https" and parsed.hostname not in ("localhost", "127.0.0.1"):
            raise ValueError("Non-localhost API URLs must use HTTPS")

        self._client = httpx.Client(
            base_url=self._api_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "polyforge-python/1.0.0",
            },
            timeout=timeout,
            verify=True,
        )

    def __repr__(self) -> str:
        return f"PolyforgeClient(api_key='[REDACTED]', base_url='{self._api_url}')"

    # -- helpers --

    def _get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        resp = self._client.get(path, params=_strip_none(params or {}))
        _raise_for_status(resp)
        return resp.json()

    def _post(self, path: str, *, json: dict[str, Any] | None = None) -> Any:
        resp = self._client.post(path, json=json or {})
        _raise_for_status(resp)
        return resp.json()

    def _patch(self, path: str, *, json: dict[str, Any] | None = None) -> Any:
        resp = self._client.patch(path, json=json or {})
        _raise_for_status(resp)
        return resp.json()

    def _delete(self, path: str) -> Any:
        resp = self._client.delete(path)
        _raise_for_status(resp)
        if resp.status_code == 204:
            return None
        return resp.json()

    # -- Markets --

    def list_markets(
        self,
        *,
        search: str | None = None,
        category: str | None = None,
        sort: str | None = None,
        closed: bool | None = None,
        limit: int = 10,
        page: int = 1,
    ) -> PaginatedResponse[Market]:
        raw = self._get(
            "/api/v1/markets",
            params={
                "search": search,
                "category": category,
                "sort": sort,
                "closed": closed,
                "limit": limit,
                "page": page,
            },
        )
        parsed = [_parse(Market, m) for m in raw["data"]]
        return PaginatedResponse(
            data=parsed,
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    def get_market(self, market_id: str) -> Market:
        return _parse(Market, self._get(f"/api/v1/markets/{_encode_path(market_id)}"))

    def get_price_history(
        self,
        token_id: str,
        *,
        resolution: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int | None = None,
    ) -> list[PriceHistoryEntry]:
        """Fetch price history for a market token.

        Args:
            token_id: The token ID to fetch history for.
            resolution: Candle resolution — ``"1m"``, ``"1h"``, or ``"1d"`` (default ``"1h"``).
            from_date: Start time as ISO 8601 string.
            to_date: End time as ISO 8601 string.
            limit: Maximum number of entries (1–1000, default 200).
        """
        data = self._get(
            f"/api/v1/markets/{_encode_path(token_id)}/price-history",
            params={
                "resolution": resolution,
                "from": from_date,
                "to": to_date,
                "limit": limit,
            },
        )
        items = data["data"] if isinstance(data, dict) and "data" in data else data
        return [_parse(PriceHistoryEntry, e) for e in items]

    def get_order_book(self, token_id: str) -> OrderBook:
        """Fetch the order book for a market token.

        Args:
            token_id: The token ID to fetch the book for.
        """
        data = self._get(f"/api/v1/markets/{_encode_path(token_id)}/book")
        return _parse(OrderBook, data)

    # -- Strategies --

    def list_strategies(
        self,
        *,
        status: str | None = None,
        sort: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[Strategy]:
        raw = self._get(
            "/api/v1/strategies",
            params={"status": status, "sort": sort, "page": page, "limit": limit},
        )
        return PaginatedResponse(
            data=[_parse(Strategy, s) for s in raw["data"]],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    def get_strategy(self, strategy_id: str) -> Strategy:
        return _parse(Strategy, self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}"))

    def create_strategy(
        self,
        name: str,
        *,
        description: str | None = None,
        market_id: str | None = None,
        visibility: str | None = None,
        exec_mode: str | None = None,
        tick_ms: int | None = None,
        triggers: list[dict[str, Any]] | None = None,
        conditions: list[dict[str, Any]] | None = None,
        actions: list[dict[str, Any]] | None = None,
        safety: list[dict[str, Any]] | None = None,
        logic_blocks: list[dict[str, Any]] | None = None,
        calc_blocks: list[dict[str, Any]] | None = None,
        tags: list[str] | None = None,
        variables: list[dict[str, Any]] | None = None,
        canvas: dict[str, Any] | None = None,
    ) -> Strategy:
        """Create a new strategy.

        Args:
            name: Strategy name (required).
            description: Optional description (0-500 chars).
            market_id: Optional market binding.
            visibility: ``"PRIVATE"``, ``"PUBLIC"``, or ``"UNLISTED"`` (default ``PRIVATE``).
            exec_mode: ``"TICK"``, ``"EVENT"``, or ``"HYBRID"`` (default ``TICK``).
            tick_ms: Tick interval in milliseconds (for TICK/HYBRID modes).
            triggers: Trigger block definitions.
            conditions: Condition block definitions.
            actions: Action block definitions.
            safety: Safety block definitions.
            logic_blocks: Logic block definitions.
            calc_blocks: Calc block definitions.
            tags: Strategy tags.
            variables: Strategy variable definitions.
            canvas: Canvas layout metadata.
        """
        body: dict[str, Any] = {"name": name}
        if description is not None:
            body["description"] = description
        if market_id is not None:
            body["marketId"] = market_id
        if visibility is not None:
            body["visibility"] = visibility
        if exec_mode is not None:
            body["execMode"] = exec_mode
        if tick_ms is not None:
            body["tickMs"] = tick_ms
        if triggers is not None:
            body["triggers"] = triggers
        if conditions is not None:
            body["conditions"] = conditions
        if actions is not None:
            body["actions"] = actions
        if safety is not None:
            body["safety"] = safety
        if logic_blocks is not None:
            body["logicBlocks"] = logic_blocks
        if calc_blocks is not None:
            body["calcBlocks"] = calc_blocks
        if tags is not None:
            body["tags"] = tags
        if variables is not None:
            body["variables"] = variables
        if canvas is not None:
            body["canvas"] = canvas
        return _parse(Strategy, self._post("/api/v1/strategies", json=body))

    def create_strategy_from_description(self, description: str, market_id: str | None = None) -> Strategy:
        body: dict[str, Any] = {"description": description}
        if market_id is not None:
            body["marketId"] = market_id
        return _parse(Strategy, self._post("/api/v1/strategies/from-description", json=body))

    def start_strategy(self, strategy_id: str, mode: str = "paper") -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/start", json={"mode": mode}))

    def stop_strategy(self, strategy_id: str) -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/stop"))

    def get_strategy_templates(self) -> list[StrategyTemplate]:
        data = self._get("/api/v1/strategies/templates")
        # Backend returns PaginatedResponse<Strategy> with 'data' field
        items = data["data"]
        return [_parse(StrategyTemplate, t) for t in items]

    def export_strategy(self, strategy_id: str) -> dict:
        return self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}/export")

    def update_strategy(self, strategy_id: str, name: str | None = None, description: str | None = None, market_id: str | None = None) -> Strategy:
        body: dict[str, Any] = {}
        if name is not None:
            body["name"] = name
        if description is not None:
            body["description"] = description
        if market_id is not None:
            body["marketId"] = market_id
        return _parse(Strategy, self._patch(f"/api/v1/strategies/{_encode_path(strategy_id)}", json=body))

    def delete_strategy(self, strategy_id: str) -> None:
        self._delete(f"/api/v1/strategies/{_encode_path(strategy_id)}")

    def import_strategy(self, data: dict) -> Strategy:
        return _parse(Strategy, self._post("/api/v1/strategies/import", json=data))

    def pause_strategy(self, strategy_id: str) -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/pause"))

    def resume_strategy(self, strategy_id: str) -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/resume"))

    def fork_strategy(self, strategy_id: str) -> Strategy:
        return _parse(Strategy, self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/fork"))

    def run_backtest(
        self,
        strategy_id: str,
        *,
        date_range_start: str | None = None,
        date_range_end: str | None = None,
        quick_mode: bool | None = None,
        strategy_blocks: dict[str, Any] | None = None,
        market_bindings: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Create and run a backtest for a strategy.

        Args:
            strategy_id: ID of the strategy to backtest.
            date_range_start: ISO 8601 start of the date range (e.g. ``"2025-01-01"``).
            date_range_end: ISO 8601 end of the date range (e.g. ``"2025-12-31"``).
            quick_mode: If True, run a fast approximate backtest.
            strategy_blocks: Optional override for strategy block config.
            market_bindings: Optional market binding overrides.

        Returns:
            Raw backtest result dict from the platform.
        """
        body: dict[str, Any] = {"strategyId": strategy_id}
        if date_range_start is not None:
            body["dateRangeStart"] = date_range_start
        if date_range_end is not None:
            body["dateRangeEnd"] = date_range_end
        if quick_mode is not None:
            body["quickMode"] = quick_mode
        if strategy_blocks is not None:
            body["strategyBlocks"] = strategy_blocks
        if market_bindings is not None:
            body["marketBindings"] = market_bindings
        return self._post("/api/v1/backtests", json=body)

    def list_backtests(
        self,
        *,
        strategy_id: str | None = None,
        status: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[dict[str, Any]]:
        """List backtests with optional filters.

        Args:
            strategy_id: Filter by strategy ID.
            status: Filter by backtest status.
            page: Page number (default 1).
            limit: Items per page (default 20, max 100).

        Returns:
            Paginated list of backtest dicts.
        """
        raw = self._get(
            "/api/v1/backtests",
            params={"strategyId": strategy_id, "status": status, "page": page, "limit": limit},
        )
        return PaginatedResponse(
            data=raw["data"],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    def get_backtest(self, backtest_id: str) -> dict[str, Any]:
        """Get a single backtest by ID.

        Args:
            backtest_id: The backtest ID.

        Returns:
            Raw backtest dict from the platform.
        """
        return self._get(f"/api/v1/backtests/{_encode_path(backtest_id)}")

    def run_quick_backtest(
        self,
        strategy_id: str,
        *,
        date_range_start: str | None = None,
        date_range_end: str | None = None,
        quick_mode: bool | None = None,
        strategy_blocks: dict[str, Any] | None = None,
        market_bindings: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Run a quick backtest for a strategy.

        Args:
            strategy_id: ID of the strategy to backtest.
            date_range_start: ISO 8601 start of the date range.
            date_range_end: ISO 8601 end of the date range.
            quick_mode: If True, run a fast approximate backtest.
            strategy_blocks: Optional override for strategy block config.
            market_bindings: Optional market binding overrides.

        Returns:
            Raw backtest result dict from the platform.
        """
        body: dict[str, Any] = {"strategyId": strategy_id}
        if date_range_start is not None:
            body["dateRangeStart"] = date_range_start
        if date_range_end is not None:
            body["dateRangeEnd"] = date_range_end
        if quick_mode is not None:
            body["quickMode"] = quick_mode
        if strategy_blocks is not None:
            body["strategyBlocks"] = strategy_blocks
        if market_bindings is not None:
            body["marketBindings"] = market_bindings
        return self._post("/api/v1/backtests/quick", json=body)

    def get_backtest_orders(self, backtest_id: str) -> list[dict[str, Any]]:
        """Get orders generated during a backtest.

        Args:
            backtest_id: The backtest ID.

        Returns:
            List of order dicts from the backtest.
        """
        return self._get(f"/api/v1/backtests/{_encode_path(backtest_id)}/orders")

    # -- Portfolio & Orders --

    def get_portfolio(self) -> Portfolio:
        return _parse(Portfolio, self._get("/api/v1/portfolio"))

    def get_orders(
        self,
        *,
        limit: int = 20,
        page: int = 1,
        status: str | OrderStatus | None = None,
        strategy_id: str | None = None,
        market_id: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> PaginatedResponse[Order]:
        """List orders with optional filters.

        Args:
            status: Filter by order status. Accepts an :class:`~polyforge.models.OrderStatus`
                enum value or one of: ``PENDING``, ``SUBMITTED``, ``LIVE``, ``MATCHED``,
                ``DELAYED``, ``MINED``, ``CONFIRMED``, ``PARTIAL``, ``CANCELLED``,
                ``UNMATCHED``, ``FAILED``, ``ERROR``.
        """
        status_val = status.value if isinstance(status, OrderStatus) else status
        raw = self._get("/api/v1/orders", params={
            "limit": limit,
            "page": page,
            "status": status_val,
            "strategyId": strategy_id,
            "marketId": market_id,
            "from": from_date,
            "to": to_date,
        })
        return PaginatedResponse(
            data=[_parse(Order, o) for o in raw["data"]],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    def get_score(self) -> TraderScore:
        return _parse(TraderScore, self._get("/api/v1/scores/me"))

    # -- Direct Trading --

    def place_order(
        self,
        token_id: str,
        side: str,
        outcome: str,
        size: float,
        price: float,
        order_type: str = "GTC",
    ) -> PlaceOrderResponse:
        """Place a direct buy or sell order on a prediction market."""
        _validate_financial_param("size", size)
        _validate_financial_param("price", price)
        data = self._post("/api/v1/orders/place", json={
            "tokenId": token_id,
            "side": side,
            "outcome": outcome,
            "size": size,
            "price": price,
            "orderType": order_type,
        })
        return PlaceOrderResponse(
            order_id=data["orderId"],
            intent_id=data["intentId"],
            status=data["status"],
        )

    def cancel_order(self, order_id: str) -> dict:
        """Cancel a pending or live order."""
        return self._delete(f"/api/v1/orders/{_encode_path(order_id)}")

    def close_position(self, token_id: str, size: float | str | None = None) -> PlaceOrderResponse:
        """Close an open position (sell all shares at market price)."""
        body: dict[str, Any] = {"tokenId": token_id}
        if size is not None:
            body["size"] = str(size)
        data = self._post("/api/v1/orders/close-position", json=body)
        return PlaceOrderResponse(order_id=data["orderId"], intent_id=data["intentId"], status=data["status"])

    def redeem_position(
        self,
        *,
        position_id: str | None = None,
        market_id: str | None = None,
        # Deprecated aliases kept for backward compat — ignored by the platform.
        token_id: str | None = None,
        condition_id: str | None = None,
    ) -> PlaceOrderResponse:
        """Redeem winning shares after a market resolves.

        Args:
            position_id: The position to redeem.
            market_id: The resolved market to redeem from.
        """
        body: dict[str, Any] = {}
        if position_id is not None:
            body["positionId"] = position_id
        if market_id is not None:
            body["marketId"] = market_id
        data = self._post("/api/v1/orders/redeem", json=body)
        return PlaceOrderResponse(order_id=data["orderId"], intent_id=data["intentId"], status=data["status"])

    def split_position(self, token_id: str, amount: float | str, **_kwargs: Any) -> PlaceOrderResponse:
        """Split a position into smaller positions.

        Args:
            token_id: The token to split.
            amount: The amount to split (sent as a NumberString).
        """
        amount_str = str(amount)
        data = self._post("/api/v1/orders/split", json={"tokenId": token_id, "amount": amount_str})
        return PlaceOrderResponse(order_id=data["orderId"], intent_id=data["intentId"], status=data["status"])

    def merge_positions(self, token_id: str, amount: float | str, **_kwargs: Any) -> PlaceOrderResponse:
        """Merge positions.

        Args:
            token_id: The token to merge.
            amount: The amount to merge (sent as a NumberString).
        """
        amount_str = str(amount)
        data = self._post("/api/v1/orders/merge", json={"tokenId": token_id, "amount": amount_str})
        return PlaceOrderResponse(order_id=data["orderId"], intent_id=data["intentId"], status=data["status"])

    # -- Arbitrage --

    def get_arbitrage_opportunities(self, *, min_margin: float = 0.5) -> list[ArbitrageOpportunity]:
        """Scan all markets for merge arbitrage opportunities (YES + NO < $1.00).

        Args:
            min_margin: Minimum profit margin percentage to include (default 0.5%).
        """
        data = self._get("/api/v1/arbitrage", params={"minMargin": min_margin})
        return [ArbitrageOpportunity(
            market_id=o.get("marketId", ""),
            market_title=o.get("marketTitle", ""),
            category=o.get("category", ""),
            end_date=o.get("endDate"),
            yes_token_id=o.get("yesTokenId", ""),
            no_token_id=o.get("noTokenId", ""),
            yes_price=o.get("yesPrice", ""),
            no_price=o.get("noPrice", ""),
            sum=o.get("sum", ""),
            margin_pct=o.get("marginPct", ""),
            cost_per_unit=o.get("costPerUnit", ""),
            profit_per_unit=o.get("profitPerUnit", ""),
        ) for o in data]

    # -- Smart Orders --

    def place_smart_order(
        self,
        *,
        type: str,
        token_id: str,
        side: str,
        outcome: str,
        total_size: float,
        slices: int | None = None,
        interval_minutes: int | None = None,
        limit_price: float | None = None,
        entry_price: float | None = None,
        take_profit_price: float | None = None,
        stop_loss_price: float | None = None,
        price_a: float | None = None,
        price_b: float | None = None,
    ) -> PlaceSmartOrderResponse:
        """Place an advanced smart order (TWAP, DCA, BRACKET, or OCO)."""
        _validate_financial_param("total_size", total_size)
        if limit_price is not None:
            _validate_financial_param("limit_price", limit_price)
        if entry_price is not None:
            _validate_financial_param("entry_price", entry_price)
        if take_profit_price is not None:
            _validate_financial_param("take_profit_price", take_profit_price)
        if stop_loss_price is not None:
            _validate_financial_param("stop_loss_price", stop_loss_price)
        if price_a is not None:
            _validate_financial_param("price_a", price_a)
        if price_b is not None:
            _validate_financial_param("price_b", price_b)
        body: dict[str, Any] = {
            "type": type,
            "tokenId": token_id,
            "side": side,
            "outcome": outcome,
            "totalSize": total_size,
        }
        if slices is not None: body["slices"] = slices
        if interval_minutes is not None: body["intervalMinutes"] = interval_minutes
        if limit_price is not None: body["limitPrice"] = limit_price
        if entry_price is not None: body["entryPrice"] = entry_price
        if take_profit_price is not None: body["takeProfitPrice"] = take_profit_price
        if stop_loss_price is not None: body["stopLossPrice"] = stop_loss_price
        if price_a is not None: body["priceA"] = price_a
        if price_b is not None: body["priceB"] = price_b
        data = self._post("/api/v1/orders/smart", json=body)
        return PlaceSmartOrderResponse(
            smart_order_id=data["smartOrderId"],
            type=data["type"],
            status=data["status"],
            slices_total=data["slicesTotal"],
        )

    def list_smart_orders(self) -> list[SmartOrder]:
        """List your smart orders with execution progress."""
        data = self._get("/api/v1/orders/smart")
        return [SmartOrder(
            id=o["id"], type=o["type"], status=o["status"],
            market_id=o.get("marketId", ""), token_id=o.get("tokenId", ""),
            outcome=o.get("outcome", ""), side=o.get("side", ""),
            total_size=o.get("totalSize", ""),
            slices_filled=o.get("slicesFilled", 0), slices_total=o.get("slicesTotal", 1),
            next_execute_at=o.get("nextExecuteAt"), completed_at=o.get("completedAt"),
            created_at=o.get("createdAt", ""),
        ) for o in data]

    def cancel_smart_order(self, smart_order_id: str) -> dict:
        """Cancel a pending or active smart order."""
        return self._delete(f"/api/v1/orders/smart/{_encode_path(smart_order_id)}")

    # -- Marketplace --

    def browse_marketplace(
        self,
        *,
        sort: str = "newest",
        tag: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        """Browse marketplace listings. Returns dict with 'items' list and 'total' count."""
        return self._get("/api/v1/marketplace", params={
            "sort": sort, "tag": tag, "limit": limit, "offset": offset,
        })

    def get_marketplace_listing(self, listing_id: str) -> dict:
        """Get a single marketplace listing by ID."""
        return self._get(f"/api/v1/marketplace/{_encode_path(listing_id)}")

    def purchase_strategy(self, listing_id: str) -> MarketplacePurchaseResult:
        """Purchase a marketplace strategy and receive a private fork."""
        data = self._post(f"/api/v1/marketplace/{_encode_path(listing_id)}/purchase")
        return MarketplacePurchaseResult(
            purchase_id=data["purchaseId"],
            forked_strategy_id=data["forkedStrategyId"],
            price_usdc=float(data["priceUsdc"]),
            platform_fee=float(data["platformFee"]),
            seller_net=float(data["sellerNet"]),
        )

    def watch_strategy(self, strategy_id: str) -> Iterator[StrategyEvent]:
        """Stream live execution events for a strategy via SSE.

        Yields :class:`~polyforge.models.StrategyEvent` objects as they arrive.
        The first event always has ``type == "CONNECTED"``.

        This method blocks the calling thread while the stream is open.
        Use :meth:`AsyncPolyforgeClient.watch_strategy` for non-blocking usage.

        Example::

            for event in client.watch_strategy("strat-uuid"):
                print(event.type, event.data)
                if event.type == "STRATEGY_STOPPED":
                    break
        """
        with self._client.stream(
            "GET",
            f"/api/v1/strategies/{_encode_path(strategy_id)}/events",
            headers={"Accept": "text/event-stream"},
        ) as response:
            _raise_for_status(response)
            for line in response.iter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if not raw:
                    continue
                try:
                    payload = _json.loads(raw)
                    # Validate expected fields before yielding
                    if not isinstance(payload.get("type"), str):
                        continue
                    yield StrategyEvent(
                        type=payload["type"],
                        strategy_id=payload.get("strategyId", ""),
                        data=payload.get("data"),
                        timestamp=payload.get("timestamp", 0),
                    )
                except _json.JSONDecodeError:
                    _log.warning("Malformed SSE event: failed to parse JSON")
                    continue

    # -- Social & Signals --

    def get_whale_feed(self, *, min_size: int = 10000) -> list[WhaleTrade]:
        data = self._get("/api/v1/whales/feed", params={"minSize": min_size})
        items = data["data"]
        return [_parse(WhaleTrade, w) for w in items]

    def get_news_signals(self, *, min_confidence: int = 70) -> list[NewsSignal]:
        data = self._get("/api/v1/news/signals", params={"minConfidence": min_confidence})
        items = data["data"]
        return [_parse(NewsSignal, s) for s in items]

    # -- Configuration --

    def list_alerts(self) -> list[Alert]:
        data = self._get("/api/v1/alerts")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(Alert, a) for a in items]

    def create_alert(
        self,
        token_id: str,
        direction: str,
        price: float,
        *,
        persistent: bool = False,
    ) -> Alert:
        """Create a price alert.

        Args:
            token_id: The token to monitor.
            direction: ``"ABOVE"`` or ``"BELOW"``.
            price: The trigger price threshold.
            persistent: If ``True`` the alert re-arms after firing.

        Returns:
            The created :class:`Alert`.
        """
        _validate_financial_param("price", price)
        body: dict[str, Any] = {
            "tokenId": token_id,
            "direction": direction,
            "price": price,
            "persistent": persistent,
        }
        return _parse(Alert, self._post("/api/v1/alerts", json=body))

    def delete_alert(self, alert_id: str) -> None:
        """Delete an alert by ID.

        Args:
            alert_id: The alert ID to delete.
        """
        self._delete(f"/api/v1/alerts/{_encode_path(alert_id)}")

    # -- Conditional Orders --

    def list_conditional_orders(
        self,
        *,
        status: str | None = None,
        type: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[ConditionalOrder]:
        """List conditional orders with optional filters.

        Args:
            status: Filter by status (e.g. ``"PENDING"``, ``"TRIGGERED"``).
            type: Filter by type (e.g. ``"TAKE_PROFIT"``, ``"STOP_LOSS"``).
            page: Page number (default 1).
            limit: Maximum number of results per page (default 20).
        """
        raw = self._get("/api/v1/orders/conditional", params={
            "status": status,
            "type": type,
            "page": page,
            "limit": limit,
        })
        return PaginatedResponse(
            data=[_parse(ConditionalOrder, o) for o in raw["data"]],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    def create_conditional_order(
        self,
        market_id: str,
        token_id: str,
        type: str,
        side: str,
        outcome: str,
        size: float,
        trigger_price: float,
        *,
        limit_price: float | None = None,
    ) -> ConditionalOrder:
        """Create a conditional order.

        Args:
            market_id: The market to trade on.
            token_id: The token ID.
            type: Order type (e.g. ``"STOP_LOSS"``, ``"TAKE_PROFIT"``).
            side: ``"BUY"`` or ``"SELL"``.
            outcome: ``"YES"`` or ``"NO"``.
            size: Order size.
            trigger_price: Price at which the order triggers.
            limit_price: Optional limit price for the triggered order.

        Returns:
            The created :class:`ConditionalOrder`.
        """
        _validate_financial_param("size", size)
        _validate_financial_param("trigger_price", trigger_price)
        body: dict[str, Any] = {
            "marketId": market_id,
            "tokenId": token_id,
            "type": type,
            "side": side,
            "outcome": outcome,
            "size": size,
            "triggerPrice": trigger_price,
        }
        if limit_price is not None:
            _validate_financial_param("limit_price", limit_price)
            body["limitPrice"] = limit_price
        return _parse(ConditionalOrder, self._post("/api/v1/orders/conditional", json=body))

    def get_conditional_order(self, order_id: str) -> ConditionalOrder:
        """Get a conditional order by ID.

        Args:
            order_id: The conditional order ID.

        Returns:
            The :class:`ConditionalOrder`.
        """
        data = self._get(f"/api/v1/orders/conditional/{_encode_path(order_id)}")
        return _parse(ConditionalOrder, data)

    def cancel_conditional_order(self, order_id: str) -> None:
        """Cancel a conditional order by ID.

        Args:
            order_id: The conditional order ID to cancel.
        """
        self._delete(f"/api/v1/orders/conditional/{_encode_path(order_id)}")

    # -- Portfolio PnL --

    def get_portfolio_pnl(
        self,
        *,
        period: str = "30d",
        strategy_id: str | None = None,
    ) -> PortfolioPnl:
        """Get portfolio profit-and-loss summary.

        Args:
            period: Time period (e.g. ``"7d"``, ``"30d"``, ``"90d"``).
            strategy_id: Optional strategy ID to filter by.

        Returns:
            A :class:`PortfolioPnl` summary.
        """
        params = _strip_none({"period": period, "strategyId": strategy_id})
        data = self._get("/api/v1/portfolio/pnl", params=params)
        return _parse(PortfolioPnl, data)

    def list_copy_configs(self) -> list[CopyConfig]:
        data = self._get("/api/v1/copy")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(CopyConfig, c) for c in items]

    def list_webhooks(self) -> list[Webhook]:
        data = self._get("/api/v1/webhooks")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(Webhook, w) for w in items]

    def create_webhook(self, url: str, events: list[str]) -> Webhook:
        resolved_ips = _validate_webhook_url(url)
        _log.debug("Webhook URL %s resolved to %s — registering", url, resolved_ips)
        return _parse(Webhook, self._post("/api/v1/webhooks", json={"url": url, "events": events}))

    def delete_webhook(self, webhook_id: str) -> None:
        """Delete a webhook by ID.

        Args:
            webhook_id: The webhook ID to delete.
        """
        self._delete(f"/api/v1/webhooks/{_encode_path(webhook_id)}")

    def test_webhook(self, webhook_id: str) -> WebhookTestResult:
        """Send a test payload to a webhook endpoint.

        Args:
            webhook_id: The webhook ID to test.

        Returns:
            A :class:`WebhookTestResult` with ``success`` and ``status_code``.
        """
        data = self._post(f"/api/v1/webhooks/{_encode_path(webhook_id)}/test")
        return WebhookTestResult(
            success=data.get("success", False),
            status_code=data.get("statusCode", 0),
        )

    # -- Watchlist --

    def get_watchlist(self) -> list[WatchlistItem]:
        """List all markets on the user's watchlist."""
        data = self._get("/api/v1/watchlist")
        items = data if isinstance(data, list) else data.get("data", data)
        return [_parse(WatchlistItem, w) for w in items]

    def add_to_watchlist(self, market_id: str) -> WatchlistItem:
        """Add a market to the watchlist.

        Args:
            market_id: The market ID to watch.

        Returns:
            The created :class:`WatchlistItem`.
        """
        data = self._post("/api/v1/watchlist", json={"marketId": market_id})
        return _parse(WatchlistItem, data)

    def remove_from_watchlist(self, market_id: str) -> None:
        """Remove a market from the watchlist.

        Args:
            market_id: The market ID to remove.
        """
        self._delete(f"/api/v1/watchlist/{_encode_path(market_id)}")

    def get_watchlist_status(self, market_id: str) -> WatchlistItem:
        """Check if a market is on the watchlist.

        Args:
            market_id: The market ID to check.

        Returns:
            A :class:`WatchlistItem` with at least ``market_id`` and ``watched``.
        """
        data = self._get(f"/api/v1/watchlist/status/{_encode_path(market_id)}")
        return _parse(WatchlistItem, data)

    # -- AI --

    def ai_query(self, query: str) -> AiQueryResponse:
        return _parse(AiQueryResponse, self._post("/api/v1/ai/query", json={"query": query}))

    # -- Accuracy & Portfolio Review --

    def get_accuracy(self) -> AccuracyScore:
        data = self._get("/api/v1/accuracy/me")
        calibration = [
            CalibrationBucket(
                bucket_mid=b.get("bucketMid", 0.0),
                frequency=b.get("frequency", 0.0),
                count=b.get("count", 0),
            )
            for b in data.get("calibration", [])
        ]
        by_category = {
            k: CategoryAccuracy(count=v.get("count", 0), brier_score=v.get("brierScore", 0.0))
            for k, v in data.get("byCategory", {}).items()
        }
        return AccuracyScore(
            brier_score=data.get("brierScore"),
            total_predictions=data.get("totalPredictions", 0),
            correct_predictions=data.get("correctPredictions", 0),
            win_rate=data.get("winRate", ""),
            calibration=calibration,
            by_category=by_category,
        )

    def get_portfolio_review(self) -> PortfolioReview:
        data = self._get("/api/v1/ai/portfolio-review")
        return PortfolioReview(
            review=data.get("review", ""),
            suggestions=data.get("suggestions", []),
            score=data.get("score", 0),
            generated_at=data.get("generatedAt", ""),
        )

    def get_market_sentiment(self, market_id: str) -> MarketSentiment:
        data = self._get(f"/api/v1/news/sentiment/{_encode_path(market_id)}")
        return MarketSentiment(
            market_id=data.get("marketId", ""),
            score=data.get("score", 0.0),
            direction=data.get("direction", ""),
            signal_count=data.get("signalCount", 0),
            last_updated=data.get("lastUpdated"),
        )

    def provide_liquidity(
        self,
        market_id: str,
        token_id: str,
        amount_usdc: float,
        *,
        target_spread: float | None = None,
    ) -> LpPosition:
        """Provide liquidity to a market.

        Args:
            market_id: The market to provide liquidity for.
            token_id: The YES token ID.
            amount_usdc: USDC amount to deploy (1-50000).
            target_spread: Optional spread target (0.001-0.5, default 0.02).
        """
        _validate_financial_param("amount_usdc", amount_usdc)
        body: dict[str, Any] = {"marketId": market_id, "tokenId": token_id, "amountUsdc": amount_usdc}
        if target_spread is not None:
            _validate_financial_param("target_spread", target_spread)
            body["targetSpread"] = target_spread
        data = self._post("/api/v1/lp/provide", json=body)
        return LpPosition(
            buy_order_id=data.get("buyOrderId", ""),
            sell_order_id=data.get("sellOrderId", ""),
            token_id=data.get("tokenId", ""),
            buy_price=data.get("buyPrice", ""),
            sell_price=data.get("sellPrice", ""),
            size=data.get("size", ""),
        )

    # -- Lifecycle --

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> PolyforgeClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


# ---------------------------------------------------------------------------
# Asynchronous client
# ---------------------------------------------------------------------------

class AsyncPolyforgeClient:
    """Asynchronous Polyforge REST API client.

    NOTE: This class mirrors the synchronous PolyforgeClient implementation above.
    Code duplication is intentional for clarity and to avoid shared state issues
    between sync/async codepaths (a common pattern with httpx).

    When making changes to method signatures, error handling, or logic:
    - Apply changes to BOTH the sync (PolyforgeClient) and async (AsyncPolyforgeClient) versions
    - Keep the implementations synchronized to ensure feature parity
    - Async methods should use `await` and `async with` where appropriate
    - Sync methods should use blocking calls without await

    Usage::

        async with AsyncPolyforgeClient(api_key="pk_...") as client:
            markets = await client.list_markets(limit=5)
            for m in markets.items:
                print(m.title, m.price)
    """

    def __init__(
        self,
        api_key: str,
        api_url: str = "https://api.polyforge.app",
        timeout: float = 15.0,
    ) -> None:
        self._api_key = api_key
        self._api_url = api_url.rstrip("/")

        # Reject non-HTTPS URLs for non-localhost hosts
        parsed = urlparse(self._api_url)
        if parsed.scheme != "https" and parsed.hostname not in ("localhost", "127.0.0.1"):
            raise ValueError("Non-localhost API URLs must use HTTPS")

        self._client = httpx.AsyncClient(
            base_url=self._api_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "polyforge-python/1.0.0",
            },
            timeout=timeout,
            verify=True,
        )

    def __repr__(self) -> str:
        return f"AsyncPolyforgeClient(api_key='[REDACTED]', base_url='{self._api_url}')"

    # -- helpers --

    async def _get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        resp = await self._client.get(path, params=_strip_none(params or {}))
        _raise_for_status(resp)
        return resp.json()

    async def _post(self, path: str, *, json: dict[str, Any] | None = None) -> Any:
        resp = await self._client.post(path, json=json or {})
        _raise_for_status(resp)
        return resp.json()

    async def _patch(self, path: str, *, json: dict[str, Any] | None = None) -> Any:
        resp = await self._client.patch(path, json=json or {})
        _raise_for_status(resp)
        return resp.json()

    async def _delete(self, path: str) -> Any:
        resp = await self._client.delete(path)
        _raise_for_status(resp)
        if resp.status_code == 204:
            return None
        return resp.json()

    # -- Markets --

    async def list_markets(
        self,
        *,
        search: str | None = None,
        category: str | None = None,
        sort: str | None = None,
        closed: bool | None = None,
        limit: int = 10,
        page: int = 1,
    ) -> PaginatedResponse[Market]:
        raw = await self._get(
            "/api/v1/markets",
            params={
                "search": search,
                "category": category,
                "sort": sort,
                "closed": closed,
                "limit": limit,
                "page": page,
            },
        )
        parsed = [_parse(Market, m) for m in raw["data"]]
        return PaginatedResponse(
            data=parsed,
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    async def get_market(self, market_id: str) -> Market:
        return _parse(Market, await self._get(f"/api/v1/markets/{_encode_path(market_id)}"))

    async def get_price_history(
        self,
        token_id: str,
        *,
        resolution: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int | None = None,
    ) -> list[PriceHistoryEntry]:
        """Fetch price history for a market token.

        Args:
            token_id: The token ID to fetch history for.
            resolution: Candle resolution — ``"1m"``, ``"1h"``, or ``"1d"`` (default ``"1h"``).
            from_date: Start time as ISO 8601 string.
            to_date: End time as ISO 8601 string.
            limit: Maximum number of entries (1–1000, default 200).
        """
        data = await self._get(
            f"/api/v1/markets/{_encode_path(token_id)}/price-history",
            params={
                "resolution": resolution,
                "from": from_date,
                "to": to_date,
                "limit": limit,
            },
        )
        items = data["data"] if isinstance(data, dict) and "data" in data else data
        return [_parse(PriceHistoryEntry, e) for e in items]

    async def get_order_book(self, token_id: str) -> OrderBook:
        """Fetch the order book for a market token.

        Args:
            token_id: The token ID to fetch the book for.
        """
        data = await self._get(f"/api/v1/markets/{_encode_path(token_id)}/book")
        return _parse(OrderBook, data)

    # -- Strategies --

    async def list_strategies(
        self,
        *,
        status: str | None = None,
        sort: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[Strategy]:
        raw = await self._get(
            "/api/v1/strategies",
            params={"status": status, "sort": sort, "page": page, "limit": limit},
        )
        return PaginatedResponse(
            data=[_parse(Strategy, s) for s in raw["data"]],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    async def get_strategy(self, strategy_id: str) -> Strategy:
        return _parse(Strategy, await self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}"))

    async def create_strategy(
        self,
        name: str,
        *,
        description: str | None = None,
        market_id: str | None = None,
        visibility: str | None = None,
        exec_mode: str | None = None,
        tick_ms: int | None = None,
        triggers: list[dict[str, Any]] | None = None,
        conditions: list[dict[str, Any]] | None = None,
        actions: list[dict[str, Any]] | None = None,
        safety: list[dict[str, Any]] | None = None,
        logic_blocks: list[dict[str, Any]] | None = None,
        calc_blocks: list[dict[str, Any]] | None = None,
        tags: list[str] | None = None,
        variables: list[dict[str, Any]] | None = None,
        canvas: dict[str, Any] | None = None,
    ) -> Strategy:
        """Create a new strategy (async version). See sync ``create_strategy`` for details."""
        body: dict[str, Any] = {"name": name}
        if description is not None:
            body["description"] = description
        if market_id is not None:
            body["marketId"] = market_id
        if visibility is not None:
            body["visibility"] = visibility
        if exec_mode is not None:
            body["execMode"] = exec_mode
        if tick_ms is not None:
            body["tickMs"] = tick_ms
        if triggers is not None:
            body["triggers"] = triggers
        if conditions is not None:
            body["conditions"] = conditions
        if actions is not None:
            body["actions"] = actions
        if safety is not None:
            body["safety"] = safety
        if logic_blocks is not None:
            body["logicBlocks"] = logic_blocks
        if calc_blocks is not None:
            body["calcBlocks"] = calc_blocks
        if tags is not None:
            body["tags"] = tags
        if variables is not None:
            body["variables"] = variables
        if canvas is not None:
            body["canvas"] = canvas
        return _parse(Strategy, await self._post("/api/v1/strategies", json=body))

    async def create_strategy_from_description(self, description: str, market_id: str | None = None) -> Strategy:
        body: dict[str, Any] = {"description": description}
        if market_id is not None:
            body["marketId"] = market_id
        return _parse(Strategy, await self._post("/api/v1/strategies/from-description", json=body))

    async def start_strategy(self, strategy_id: str, mode: str = "paper") -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, await self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/start", json={"mode": mode}))

    async def stop_strategy(self, strategy_id: str) -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, await self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/stop"))

    async def get_strategy_templates(self) -> list[StrategyTemplate]:
        data = await self._get("/api/v1/strategies/templates")
        # Backend returns PaginatedResponse<Strategy> with 'data' field
        items = data["data"]
        return [_parse(StrategyTemplate, t) for t in items]

    async def export_strategy(self, strategy_id: str) -> dict:
        return await self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}/export")

    async def update_strategy(self, strategy_id: str, name: str | None = None, description: str | None = None, market_id: str | None = None) -> Strategy:
        body: dict[str, Any] = {}
        if name is not None:
            body["name"] = name
        if description is not None:
            body["description"] = description
        if market_id is not None:
            body["marketId"] = market_id
        return _parse(Strategy, await self._patch(f"/api/v1/strategies/{_encode_path(strategy_id)}", json=body))

    async def delete_strategy(self, strategy_id: str) -> None:
        await self._delete(f"/api/v1/strategies/{_encode_path(strategy_id)}")

    async def import_strategy(self, data: dict) -> Strategy:
        return _parse(Strategy, await self._post("/api/v1/strategies/import", json=data))

    async def pause_strategy(self, strategy_id: str) -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, await self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/pause"))

    async def resume_strategy(self, strategy_id: str) -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, await self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/resume"))

    async def fork_strategy(self, strategy_id: str) -> Strategy:
        return _parse(Strategy, await self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/fork"))

    async def run_backtest(
        self,
        strategy_id: str,
        *,
        date_range_start: str | None = None,
        date_range_end: str | None = None,
        quick_mode: bool | None = None,
        strategy_blocks: dict[str, Any] | None = None,
        market_bindings: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Create and run a backtest for a strategy.

        Args:
            strategy_id: ID of the strategy to backtest.
            date_range_start: ISO 8601 start of the date range (e.g. ``"2025-01-01"``).
            date_range_end: ISO 8601 end of the date range (e.g. ``"2025-12-31"``).
            quick_mode: If True, run a fast approximate backtest.
            strategy_blocks: Optional override for strategy block config.
            market_bindings: Optional market binding overrides.

        Returns:
            Raw backtest result dict from the platform.
        """
        body: dict[str, Any] = {"strategyId": strategy_id}
        if date_range_start is not None:
            body["dateRangeStart"] = date_range_start
        if date_range_end is not None:
            body["dateRangeEnd"] = date_range_end
        if quick_mode is not None:
            body["quickMode"] = quick_mode
        if strategy_blocks is not None:
            body["strategyBlocks"] = strategy_blocks
        if market_bindings is not None:
            body["marketBindings"] = market_bindings
        return await self._post("/api/v1/backtests", json=body)

    async def list_backtests(
        self,
        *,
        strategy_id: str | None = None,
        status: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[dict[str, Any]]:
        """List backtests with optional filters (async version).

        Args:
            strategy_id: Filter by strategy ID.
            status: Filter by backtest status.
            page: Page number (default 1).
            limit: Items per page (default 20, max 100).

        Returns:
            Paginated list of backtest dicts.
        """
        raw = await self._get(
            "/api/v1/backtests",
            params={"strategyId": strategy_id, "status": status, "page": page, "limit": limit},
        )
        return PaginatedResponse(
            data=raw["data"],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    async def get_backtest(self, backtest_id: str) -> dict[str, Any]:
        """Get a single backtest by ID (async version).

        Args:
            backtest_id: The backtest ID.

        Returns:
            Raw backtest dict from the platform.
        """
        return await self._get(f"/api/v1/backtests/{_encode_path(backtest_id)}")

    async def run_quick_backtest(
        self,
        strategy_id: str,
        *,
        date_range_start: str | None = None,
        date_range_end: str | None = None,
        quick_mode: bool | None = None,
        strategy_blocks: dict[str, Any] | None = None,
        market_bindings: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Run a quick backtest for a strategy (async version).

        Args:
            strategy_id: ID of the strategy to backtest.
            date_range_start: ISO 8601 start of the date range.
            date_range_end: ISO 8601 end of the date range.
            quick_mode: If True, run a fast approximate backtest.
            strategy_blocks: Optional override for strategy block config.
            market_bindings: Optional market binding overrides.

        Returns:
            Raw backtest result dict from the platform.
        """
        body: dict[str, Any] = {"strategyId": strategy_id}
        if date_range_start is not None:
            body["dateRangeStart"] = date_range_start
        if date_range_end is not None:
            body["dateRangeEnd"] = date_range_end
        if quick_mode is not None:
            body["quickMode"] = quick_mode
        if strategy_blocks is not None:
            body["strategyBlocks"] = strategy_blocks
        if market_bindings is not None:
            body["marketBindings"] = market_bindings
        return await self._post("/api/v1/backtests/quick", json=body)

    async def get_backtest_orders(self, backtest_id: str) -> list[dict[str, Any]]:
        """Get orders generated during a backtest (async version).

        Args:
            backtest_id: The backtest ID.

        Returns:
            List of order dicts from the backtest.
        """
        return await self._get(f"/api/v1/backtests/{_encode_path(backtest_id)}/orders")

    # -- Portfolio & Orders --

    async def get_portfolio(self) -> Portfolio:
        return _parse(Portfolio, await self._get("/api/v1/portfolio"))

    async def get_orders(
        self,
        *,
        limit: int = 20,
        page: int = 1,
        status: str | OrderStatus | None = None,
        strategy_id: str | None = None,
        market_id: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> PaginatedResponse[Order]:
        """List orders with optional filters (async version)."""
        status_val = status.value if isinstance(status, OrderStatus) else status
        raw = await self._get("/api/v1/orders", params={
            "limit": limit,
            "page": page,
            "status": status_val,
            "strategyId": strategy_id,
            "marketId": market_id,
            "from": from_date,
            "to": to_date,
        })
        return PaginatedResponse(
            data=[_parse(Order, o) for o in raw["data"]],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    async def get_score(self) -> TraderScore:
        return _parse(TraderScore, await self._get("/api/v1/scores/me"))

    # -- Direct Trading --

    async def place_order(
        self,
        token_id: str,
        side: str,
        outcome: str,
        size: float,
        price: float,
        order_type: str = "GTC",
    ) -> PlaceOrderResponse:
        """Place a direct buy or sell order on a prediction market."""
        _validate_financial_param("size", size)
        _validate_financial_param("price", price)
        data = await self._post("/api/v1/orders/place", json={
            "tokenId": token_id,
            "side": side,
            "outcome": outcome,
            "size": size,
            "price": price,
            "orderType": order_type,
        })
        return PlaceOrderResponse(
            order_id=data["orderId"],
            intent_id=data["intentId"],
            status=data["status"],
        )

    async def cancel_order(self, order_id: str) -> dict:
        """Cancel a pending or live order."""
        return await self._delete(f"/api/v1/orders/{_encode_path(order_id)}")

    async def close_position(self, token_id: str, size: float | str | None = None) -> PlaceOrderResponse:
        """Close an open position (sell all shares at market price)."""
        body: dict[str, Any] = {"tokenId": token_id}
        if size is not None:
            body["size"] = str(size)
        data = await self._post("/api/v1/orders/close-position", json=body)
        return PlaceOrderResponse(order_id=data["orderId"], intent_id=data["intentId"], status=data["status"])

    async def redeem_position(
        self,
        *,
        position_id: str | None = None,
        market_id: str | None = None,
        # Deprecated aliases kept for backward compat — ignored by the platform.
        token_id: str | None = None,
        condition_id: str | None = None,
    ) -> PlaceOrderResponse:
        """Redeem winning shares after a market resolves.

        Args:
            position_id: The position to redeem.
            market_id: The resolved market to redeem from.
        """
        body: dict[str, Any] = {}
        if position_id is not None:
            body["positionId"] = position_id
        if market_id is not None:
            body["marketId"] = market_id
        data = await self._post("/api/v1/orders/redeem", json=body)
        return PlaceOrderResponse(order_id=data["orderId"], intent_id=data["intentId"], status=data["status"])

    async def split_position(self, token_id: str, amount: float | str, **_kwargs: Any) -> PlaceOrderResponse:
        """Split a position into smaller positions.

        Args:
            token_id: The token to split.
            amount: The amount to split (sent as a NumberString).
        """
        amount_str = str(amount)
        data = await self._post("/api/v1/orders/split", json={"tokenId": token_id, "amount": amount_str})
        return PlaceOrderResponse(order_id=data["orderId"], intent_id=data["intentId"], status=data["status"])

    async def merge_positions(self, token_id: str, amount: float | str, **_kwargs: Any) -> PlaceOrderResponse:
        """Merge positions.

        Args:
            token_id: The token to merge.
            amount: The amount to merge (sent as a NumberString).
        """
        amount_str = str(amount)
        data = await self._post("/api/v1/orders/merge", json={"tokenId": token_id, "amount": amount_str})
        return PlaceOrderResponse(order_id=data["orderId"], intent_id=data["intentId"], status=data["status"])

    # -- Arbitrage --

    async def get_arbitrage_opportunities(self, *, min_margin: float = 0.5) -> list[ArbitrageOpportunity]:
        """Scan all markets for merge arbitrage opportunities (YES + NO < $1.00)."""
        data = await self._get("/api/v1/arbitrage", params={"minMargin": min_margin})
        return [ArbitrageOpportunity(
            market_id=o.get("marketId", ""),
            market_title=o.get("marketTitle", ""),
            category=o.get("category", ""),
            end_date=o.get("endDate"),
            yes_token_id=o.get("yesTokenId", ""),
            no_token_id=o.get("noTokenId", ""),
            yes_price=o.get("yesPrice", ""),
            no_price=o.get("noPrice", ""),
            sum=o.get("sum", ""),
            margin_pct=o.get("marginPct", ""),
            cost_per_unit=o.get("costPerUnit", ""),
            profit_per_unit=o.get("profitPerUnit", ""),
        ) for o in data]

    # -- Smart Orders --

    async def place_smart_order(
        self,
        *,
        type: str,
        token_id: str,
        side: str,
        outcome: str,
        total_size: float,
        slices: int | None = None,
        interval_minutes: int | None = None,
        limit_price: float | None = None,
        entry_price: float | None = None,
        take_profit_price: float | None = None,
        stop_loss_price: float | None = None,
        price_a: float | None = None,
        price_b: float | None = None,
    ) -> PlaceSmartOrderResponse:
        """Place an advanced smart order (TWAP, DCA, BRACKET, or OCO)."""
        _validate_financial_param("total_size", total_size)
        if limit_price is not None:
            _validate_financial_param("limit_price", limit_price)
        if entry_price is not None:
            _validate_financial_param("entry_price", entry_price)
        if take_profit_price is not None:
            _validate_financial_param("take_profit_price", take_profit_price)
        if stop_loss_price is not None:
            _validate_financial_param("stop_loss_price", stop_loss_price)
        if price_a is not None:
            _validate_financial_param("price_a", price_a)
        if price_b is not None:
            _validate_financial_param("price_b", price_b)
        body: dict[str, Any] = {
            "type": type,
            "tokenId": token_id,
            "side": side,
            "outcome": outcome,
            "totalSize": total_size,
        }
        if slices is not None: body["slices"] = slices
        if interval_minutes is not None: body["intervalMinutes"] = interval_minutes
        if limit_price is not None: body["limitPrice"] = limit_price
        if entry_price is not None: body["entryPrice"] = entry_price
        if take_profit_price is not None: body["takeProfitPrice"] = take_profit_price
        if stop_loss_price is not None: body["stopLossPrice"] = stop_loss_price
        if price_a is not None: body["priceA"] = price_a
        if price_b is not None: body["priceB"] = price_b
        data = await self._post("/api/v1/orders/smart", json=body)
        return PlaceSmartOrderResponse(
            smart_order_id=data["smartOrderId"],
            type=data["type"],
            status=data["status"],
            slices_total=data["slicesTotal"],
        )

    async def list_smart_orders(self) -> list[SmartOrder]:
        """List your smart orders with execution progress."""
        data = await self._get("/api/v1/orders/smart")
        return [SmartOrder(
            id=o["id"], type=o["type"], status=o["status"],
            market_id=o.get("marketId", ""), token_id=o.get("tokenId", ""),
            outcome=o.get("outcome", ""), side=o.get("side", ""),
            total_size=o.get("totalSize", ""),
            slices_filled=o.get("slicesFilled", 0), slices_total=o.get("slicesTotal", 1),
            next_execute_at=o.get("nextExecuteAt"), completed_at=o.get("completedAt"),
            created_at=o.get("createdAt", ""),
        ) for o in data]

    async def cancel_smart_order(self, smart_order_id: str) -> dict:
        """Cancel a pending or active smart order."""
        return await self._delete(f"/api/v1/orders/smart/{_encode_path(smart_order_id)}")

    # -- Marketplace --

    async def browse_marketplace(
        self,
        *,
        sort: str = "newest",
        tag: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        """Browse marketplace listings. Returns dict with 'items' list and 'total' count."""
        return await self._get("/api/v1/marketplace", params={
            "sort": sort, "tag": tag, "limit": limit, "offset": offset,
        })

    async def get_marketplace_listing(self, listing_id: str) -> dict:
        """Get a single marketplace listing by ID."""
        return await self._get(f"/api/v1/marketplace/{_encode_path(listing_id)}")

    async def purchase_strategy(self, listing_id: str) -> MarketplacePurchaseResult:
        """Purchase a marketplace strategy and receive a private fork."""
        data = await self._post(f"/api/v1/marketplace/{_encode_path(listing_id)}/purchase")
        return MarketplacePurchaseResult(
            purchase_id=data["purchaseId"],
            forked_strategy_id=data["forkedStrategyId"],
            price_usdc=float(data["priceUsdc"]),
            platform_fee=float(data["platformFee"]),
            seller_net=float(data["sellerNet"]),
        )

    async def watch_strategy(self, strategy_id: str) -> AsyncIterator[StrategyEvent]:  # type: ignore[override]
        """Stream live execution events for a strategy via SSE.

        Yields :class:`~polyforge.models.StrategyEvent` objects as they arrive.
        The first event always has ``type == "CONNECTED"``.

        Example::

            async for event in client.watch_strategy("strat-uuid"):
                print(event.type, event.data)
                if event.type == "STRATEGY_STOPPED":
                    break
        """
        async with self._client.stream(
            "GET",
            f"/api/v1/strategies/{_encode_path(strategy_id)}/events",
            headers={"Accept": "text/event-stream"},
        ) as response:
            _raise_for_status(response)
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if not raw:
                    continue
                try:
                    payload = _json.loads(raw)
                    # Validate expected fields before yielding
                    if not isinstance(payload.get("type"), str):
                        continue
                    yield StrategyEvent(
                        type=payload["type"],
                        strategy_id=payload.get("strategyId", ""),
                        data=payload.get("data"),
                        timestamp=payload.get("timestamp", 0),
                    )
                except _json.JSONDecodeError:
                    _log.warning("Malformed SSE event: failed to parse JSON")
                    continue

    # -- Social & Signals --

    async def get_whale_feed(self, *, min_size: int = 10000) -> list[WhaleTrade]:
        data = await self._get("/api/v1/whales/feed", params={"minSize": min_size})
        items = data["data"]
        return [_parse(WhaleTrade, w) for w in items]

    async def get_news_signals(self, *, min_confidence: int = 70) -> list[NewsSignal]:
        data = await self._get("/api/v1/news/signals", params={"minConfidence": min_confidence})
        items = data["data"]
        return [_parse(NewsSignal, s) for s in items]

    # -- Configuration --

    async def list_alerts(self) -> list[Alert]:
        data = await self._get("/api/v1/alerts")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(Alert, a) for a in items]

    async def create_alert(
        self,
        token_id: str,
        direction: str,
        price: float,
        *,
        persistent: bool = False,
    ) -> Alert:
        """Create a price alert.

        Args:
            token_id: The token to monitor.
            direction: ``"ABOVE"`` or ``"BELOW"``.
            price: The trigger price threshold.
            persistent: If ``True`` the alert re-arms after firing.

        Returns:
            The created :class:`Alert`.
        """
        _validate_financial_param("price", price)
        body: dict[str, Any] = {
            "tokenId": token_id,
            "direction": direction,
            "price": price,
            "persistent": persistent,
        }
        return _parse(Alert, await self._post("/api/v1/alerts", json=body))

    async def delete_alert(self, alert_id: str) -> None:
        """Delete an alert by ID.

        Args:
            alert_id: The alert ID to delete.
        """
        await self._delete(f"/api/v1/alerts/{_encode_path(alert_id)}")

    # -- Conditional Orders --

    async def list_conditional_orders(
        self,
        *,
        status: str | None = None,
        type: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[ConditionalOrder]:
        """List conditional orders with optional filters.

        Args:
            status: Filter by status (e.g. ``"PENDING"``, ``"TRIGGERED"``).
            type: Filter by type (e.g. ``"TAKE_PROFIT"``, ``"STOP_LOSS"``).
            page: Page number (default 1).
            limit: Maximum number of results per page (default 20).
        """
        raw = await self._get("/api/v1/orders/conditional", params={
            "status": status,
            "type": type,
            "page": page,
            "limit": limit,
        })
        return PaginatedResponse(
            data=[_parse(ConditionalOrder, o) for o in raw["data"]],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    async def create_conditional_order(
        self,
        market_id: str,
        token_id: str,
        type: str,
        side: str,
        outcome: str,
        size: float,
        trigger_price: float,
        *,
        limit_price: float | None = None,
    ) -> ConditionalOrder:
        """Create a conditional order.

        Args:
            market_id: The market to trade on.
            token_id: The token ID.
            type: Order type (e.g. ``"STOP_LOSS"``, ``"TAKE_PROFIT"``).
            side: ``"BUY"`` or ``"SELL"``.
            outcome: ``"YES"`` or ``"NO"``.
            size: Order size.
            trigger_price: Price at which the order triggers.
            limit_price: Optional limit price for the triggered order.

        Returns:
            The created :class:`ConditionalOrder`.
        """
        _validate_financial_param("size", size)
        _validate_financial_param("trigger_price", trigger_price)
        body: dict[str, Any] = {
            "marketId": market_id,
            "tokenId": token_id,
            "type": type,
            "side": side,
            "outcome": outcome,
            "size": size,
            "triggerPrice": trigger_price,
        }
        if limit_price is not None:
            _validate_financial_param("limit_price", limit_price)
            body["limitPrice"] = limit_price
        return _parse(ConditionalOrder, await self._post("/api/v1/orders/conditional", json=body))

    async def get_conditional_order(self, order_id: str) -> ConditionalOrder:
        """Get a conditional order by ID.

        Args:
            order_id: The conditional order ID.

        Returns:
            The :class:`ConditionalOrder`.
        """
        data = await self._get(f"/api/v1/orders/conditional/{_encode_path(order_id)}")
        return _parse(ConditionalOrder, data)

    async def cancel_conditional_order(self, order_id: str) -> None:
        """Cancel a conditional order by ID.

        Args:
            order_id: The conditional order ID to cancel.
        """
        await self._delete(f"/api/v1/orders/conditional/{_encode_path(order_id)}")

    # -- Portfolio PnL --

    async def get_portfolio_pnl(
        self,
        *,
        period: str = "30d",
        strategy_id: str | None = None,
    ) -> PortfolioPnl:
        """Get portfolio profit-and-loss summary.

        Args:
            period: Time period (e.g. ``"7d"``, ``"30d"``, ``"90d"``).
            strategy_id: Optional strategy ID to filter by.

        Returns:
            A :class:`PortfolioPnl` summary.
        """
        params = _strip_none({"period": period, "strategyId": strategy_id})
        data = await self._get("/api/v1/portfolio/pnl", params=params)
        return _parse(PortfolioPnl, data)

    async def list_copy_configs(self) -> list[CopyConfig]:
        data = await self._get("/api/v1/copy")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(CopyConfig, c) for c in items]

    async def list_webhooks(self) -> list[Webhook]:
        data = await self._get("/api/v1/webhooks")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(Webhook, w) for w in items]

    async def create_webhook(self, url: str, events: list[str]) -> Webhook:
        resolved_ips = _validate_webhook_url(url)
        _log.debug("Webhook URL %s resolved to %s — registering", url, resolved_ips)
        return _parse(Webhook, await self._post("/api/v1/webhooks", json={"url": url, "events": events}))

    async def delete_webhook(self, webhook_id: str) -> None:
        """Delete a webhook by ID.

        Args:
            webhook_id: The webhook ID to delete.
        """
        await self._delete(f"/api/v1/webhooks/{_encode_path(webhook_id)}")

    async def test_webhook(self, webhook_id: str) -> WebhookTestResult:
        """Send a test payload to a webhook endpoint.

        Args:
            webhook_id: The webhook ID to test.

        Returns:
            A :class:`WebhookTestResult` with ``success`` and ``status_code``.
        """
        data = await self._post(f"/api/v1/webhooks/{_encode_path(webhook_id)}/test")
        return WebhookTestResult(
            success=data.get("success", False),
            status_code=data.get("statusCode", 0),
        )

    # -- Watchlist --

    async def get_watchlist(self) -> list[WatchlistItem]:
        """List all markets on the user's watchlist."""
        data = await self._get("/api/v1/watchlist")
        items = data if isinstance(data, list) else data.get("data", data)
        return [_parse(WatchlistItem, w) for w in items]

    async def add_to_watchlist(self, market_id: str) -> WatchlistItem:
        """Add a market to the watchlist.

        Args:
            market_id: The market ID to watch.

        Returns:
            The created :class:`WatchlistItem`.
        """
        data = await self._post("/api/v1/watchlist", json={"marketId": market_id})
        return _parse(WatchlistItem, data)

    async def remove_from_watchlist(self, market_id: str) -> None:
        """Remove a market from the watchlist.

        Args:
            market_id: The market ID to remove.
        """
        await self._delete(f"/api/v1/watchlist/{_encode_path(market_id)}")

    async def get_watchlist_status(self, market_id: str) -> WatchlistItem:
        """Check if a market is on the watchlist.

        Args:
            market_id: The market ID to check.

        Returns:
            A :class:`WatchlistItem` with at least ``market_id`` and ``watched``.
        """
        data = await self._get(f"/api/v1/watchlist/status/{_encode_path(market_id)}")
        return _parse(WatchlistItem, data)

    # -- AI --

    async def ai_query(self, query: str) -> AiQueryResponse:
        return _parse(AiQueryResponse, await self._post("/api/v1/ai/query", json={"query": query}))

    # -- Accuracy & Portfolio Review --

    async def get_accuracy(self) -> AccuracyScore:
        data = await self._get("/api/v1/accuracy/me")
        calibration = [
            CalibrationBucket(
                bucket_mid=b.get("bucketMid", 0.0),
                frequency=b.get("frequency", 0.0),
                count=b.get("count", 0),
            )
            for b in data.get("calibration", [])
        ]
        by_category = {
            k: CategoryAccuracy(count=v.get("count", 0), brier_score=v.get("brierScore", 0.0))
            for k, v in data.get("byCategory", {}).items()
        }
        return AccuracyScore(
            brier_score=data.get("brierScore"),
            total_predictions=data.get("totalPredictions", 0),
            correct_predictions=data.get("correctPredictions", 0),
            win_rate=data.get("winRate", ""),
            calibration=calibration,
            by_category=by_category,
        )

    async def get_portfolio_review(self) -> PortfolioReview:
        data = await self._get("/api/v1/ai/portfolio-review")
        return PortfolioReview(
            review=data.get("review", ""),
            suggestions=data.get("suggestions", []),
            score=data.get("score", 0),
            generated_at=data.get("generatedAt", ""),
        )

    async def get_market_sentiment(self, market_id: str) -> MarketSentiment:
        data = await self._get(f"/api/v1/news/sentiment/{_encode_path(market_id)}")
        return MarketSentiment(
            market_id=data.get("marketId", ""),
            score=data.get("score", 0.0),
            direction=data.get("direction", ""),
            signal_count=data.get("signalCount", 0),
            last_updated=data.get("lastUpdated"),
        )

    async def provide_liquidity(
        self,
        market_id: str,
        token_id: str,
        amount_usdc: float,
        *,
        target_spread: float | None = None,
    ) -> LpPosition:
        """Provide liquidity to a market.

        Args:
            market_id: The market to provide liquidity for.
            token_id: The YES token ID.
            amount_usdc: USDC amount to deploy (1-50000).
            target_spread: Optional spread target (0.001-0.5, default 0.02).
        """
        _validate_financial_param("amount_usdc", amount_usdc)
        body: dict[str, Any] = {"marketId": market_id, "tokenId": token_id, "amountUsdc": amount_usdc}
        if target_spread is not None:
            _validate_financial_param("target_spread", target_spread)
            body["targetSpread"] = target_spread
        data = await self._post("/api/v1/lp/provide", json=body)
        return LpPosition(
            buy_order_id=data.get("buyOrderId", ""),
            sell_order_id=data.get("sellOrderId", ""),
            token_id=data.get("tokenId", ""),
            buy_price=data.get("buyPrice", ""),
            sell_price=data.get("sellPrice", ""),
            size=data.get("size", ""),
        )

    # -- Lifecycle --

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> AsyncPolyforgeClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
