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
    Badge,
    BatchOrderItem,
    BatchOrderResult,
    BatchResult,
    BulkCancelError,
    BulkCancelResult,
    CalibrationBucket,
    CategoryAccuracy,
    ClobBook,
    ClobPriceHistory,
    ConditionalOrder,
    CopyConfig,
    CopyTrade,
    LeaderboardEntry,
    LpPosition,
    Market,
    MarketplaceListing,
    MarketplacePurchaseResult,
    MarketplaceSeller,
    MarketplaceStrategy,
    MarketSentiment,
    MidpointInfo,
    NewsArticle,
    NewsSignal,
    Order,
    OrderBook,
    OrderBookLevel,
    OrderStatus,
    PaginatedResponse,
    PaperSummary,
    PlaceOrderResponse,
    PlaceSmartOrderResponse,
    PolymarketActivity,
    PolymarketEarningsEntry,
    PolymarketPortfolioEntry,
    Portfolio,
    PortfolioPnl,
    PortfolioReview,
    Position,
    PriceHistoryEntry,
    Rebate,
    RedeemPositionResponse,
    RewardMarket,
    RiskSettings,
    SmartOrder,
    SmartOrderChildOrder,
    SpreadInfo,
    Strategy,
    StrategyBlock,
    StrategyEvent,
    StrategyStatusResponse,
    StrategyTemplate,
    TickSizeInfo,
    Token,
    TopTraderEntry,
    TraderScore,
    UserReward,
    UserRewardsTotal,
    WatchlistItem,
    Webhook,
    WebhookTestResult,
    WhaleTrade,
    WhaleProfile,
)

T = TypeVar("T")

_FIELD_ALIASES: dict[str, dict[str, str]] = {
    "PriceHistoryEntry": {"time": "timestamp"},
}

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
    "WhaleProfile": WhaleProfile,
    "LeaderboardEntry": LeaderboardEntry,
    "PaperSummary": PaperSummary,
    "BatchResult": BatchResult,
    "CopyTrade": CopyTrade,
    "NewsSignal": NewsSignal,
    "NewsArticle": NewsArticle,
    "Badge": Badge,
    "TopTraderEntry": TopTraderEntry,
    "TickSizeInfo": TickSizeInfo,
    "SpreadInfo": SpreadInfo,
    "MidpointInfo": MidpointInfo,
    "ClobBook": ClobBook,
    "ClobPriceHistory": ClobPriceHistory,
    "BatchOrderItem": BatchOrderItem,
    "BatchOrderResult": BatchOrderResult,
    "BulkCancelError": BulkCancelError,
    "BulkCancelResult": BulkCancelResult,
    "PolymarketPortfolioEntry": PolymarketPortfolioEntry,
    "PolymarketEarningsEntry": PolymarketEarningsEntry,
    "PolymarketActivity": PolymarketActivity,
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
    "RewardMarket": RewardMarket,
    "UserReward": UserReward,
    "UserRewardsTotal": UserRewardsTotal,
    "Rebate": Rebate,
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

    aliases = _FIELD_ALIASES.get(cls.__name__, {})
    aliased = {aliases.get(k, k): v for k, v in data.items()}

    # Build a snake_case lookup so camelCase API keys map to dataclass fields
    snake_data = {_camel_to_snake(k): v for k, v in aliased.items()}

    hints = get_type_hints(cls)
    kwargs: dict[str, Any] = {}

    for f in fields(cls):  # type: ignore[arg-type]
        raw = aliased.get(f.name) or snake_data.get(f.name)
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
        elif hint is float and isinstance(raw, str):
            kwargs[f.name] = float(raw)
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


def _validate_enum(name: str, value: str, allowed: frozenset[str]) -> None:
    """Reject values not in *allowed* for enum-like string parameters.

    Raises:
        ValueError: if *value* is not in *allowed*.
    """
    if value not in allowed:
        sorted_opts = ", ".join(sorted(allowed))
        raise ValueError(f"{name} must be one of {{{sorted_opts}}}, got {value!r}")


_VALID_MODES = frozenset({"live", "paper"})
_VALID_DEPLOYMENT_MODES = frozenset({"LIVE", "SIMULATION"})
_VALID_SIDES = frozenset({"BUY", "SELL"})
_VALID_OUTCOMES = frozenset({"YES", "NO"})
_VALID_ORDER_TYPES = frozenset({"GTC", "GTD", "FOK"})


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

    def __getstate__(self) -> dict[str, Any]:
        state = self.__dict__.copy()
        state.pop("_client", None)
        return state

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

    def _delete_json(self, path: str, *, json: dict[str, Any]) -> Any:
        resp = self._client.request("DELETE", path, json=json)
        _raise_for_status(resp)
        if resp.status_code == 204:
            return None
        return resp.json()

    def _get_text(self, path: str, *, params: dict[str, Any] | None = None) -> str:
        resp = self._client.get(path, params=_strip_none(params or {}))
        _raise_for_status(resp)
        return resp.text

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
        from_: str | None = None,
        to: str | None = None,
        limit: int | None = None,
    ) -> list[PriceHistoryEntry]:
        """Fetch price history for a market token.

        Args:
            token_id: The token ID to fetch history for.
            resolution: Candle resolution — ``"1m"``, ``"1h"``, or ``"1d"`` (default ``"1h"``).
            from_: ISO 8601 start datetime (e.g. ``"2026-01-01T00:00:00Z"``).
            to: ISO 8601 end datetime (e.g. ``"2026-01-31T23:59:59Z"``).
            limit: Maximum number of entries (1–1000, default server-side).
        """
        data = self._get(
            f"/api/v1/markets/{_encode_path(token_id)}/price-history",
            params={
                "resolution": resolution,
                "from": from_,
                "to": to,
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

    def search_markets(self, q: str, *, limit: int | None = None) -> list[Market]:
        """Full-text search for markets.

        Args:
            q: Search query string (required).
            limit: Maximum number of results (1–100, default 20).
        """
        data = self._get("/api/v1/markets/search", params=_strip_none({"q": q, "limit": limit}))
        if isinstance(data, list):
            return [_parse(Market, m) for m in data]
        if isinstance(data, dict):
            if "results" in data:
                return [_parse(Market, m) for m in data["results"]]
            if "data" in data:
                return [_parse(Market, m) for m in data["data"]]
        return []

    def get_market_tick_size(self, token_id: str) -> TickSizeInfo:
        """Fetch the tick size and fee rate for a market token."""
        data = self._get(f"/api/v1/markets/{_encode_path(token_id)}/tick-size")
        return TickSizeInfo(
            token_id=data.get("tokenId", token_id),
            tick_size=data.get("tickSize", ""),
            fee_rate=data.get("feeRate", ""),
        )

    def get_market_spread(self, token_id: str) -> SpreadInfo:
        """Fetch the current bid-ask spread for a market token."""
        data = self._get(f"/api/v1/markets/{_encode_path(token_id)}/spread")
        return SpreadInfo(
            token_id=data.get("tokenId", token_id),
            spread=data.get("spread", ""),
        )

    def get_market_midpoint(self, token_id: str) -> MidpointInfo:
        """Fetch the current midpoint price for a market token."""
        data = self._get(f"/api/v1/markets/{_encode_path(token_id)}/midpoint")
        return MidpointInfo(
            token_id=data.get("tokenId", token_id),
            midpoint=data.get("midpoint", ""),
        )

    def get_clob_book(self, token_id: str) -> ClobBook:
        """Fetch the full CLOB order book snapshot for a market token."""
        data = self._get(f"/api/v1/markets/{_encode_path(token_id)}/clob-book")
        return ClobBook(
            token_id=data.get("tokenId", token_id),
            bids=data.get("bids", []),
            asks=data.get("asks", []),
            spread=data.get("spread", ""),
            midpoint=data.get("midpoint", ""),
            timestamp=data.get("timestamp", 0),
        )

    def get_clob_prices_history(
        self,
        token_id: str,
        *,
        interval: str | None = None,
        fidelity: int | None = None,
    ) -> ClobPriceHistory:
        """Fetch CLOB price history for a market token.

        Args:
            token_id: The token ID to fetch history for.
            interval: Time interval — ``"1m"``, ``"5m"``, ``"1h"``, ``"4h"``,
                ``"1d"``, ``"1w"``, or ``"max"`` (default ``"1h"``).
            fidelity: Number of data points (1–500, default 60).
        """
        data = self._get(
            f"/api/v1/markets/{_encode_path(token_id)}/clob-prices-history",
            params=_strip_none({"interval": interval, "fidelity": fidelity}),
        )
        return ClobPriceHistory(
            token_id=data.get("tokenId", token_id),
            interval=data.get("interval", interval or "1h"),
            history=data.get("history", []),
        )

    # -- Discovery & Ranking --

    def discover_strategies(
        self,
        *,
        sort: str | None = None,
        category: str | None = None,
        search: str | None = None,
        limit: int | None = None,
        page: int | None = None,
    ) -> PaginatedResponse[Strategy]:
        """Discover and browse public strategies.

        Args:
            sort: Sort order (e.g. ``"pnl"``, ``"win_rate"``).
            category: Filter by market category.
            search: Full-text search query.
            limit: Maximum number of results.
            page: Page number for pagination.

        Returns:
            A :class:`PaginatedResponse` of :class:`Strategy` objects.
        """
        raw = self._get("/api/v1/discover", params=_strip_none({
            "sort": sort, "category": category, "search": search,
            "limit": limit, "page": page,
        }))
        items = raw.get("data", raw.get("items", []))
        return PaginatedResponse(
            data=[_parse(Strategy, s) for s in items],
            total=raw.get("total", 0),
            page=raw.get("page", 1),
            limit=raw.get("limit", 10),
            has_more=raw.get("hasNext", False),
            total_pages=raw.get("totalPages", 0),
        )

    def get_leaderboard(
        self,
        *,
        period: str | None = None,
        limit: int | None = None,
        page: int | None = None,
    ) -> PaginatedResponse[LeaderboardEntry]:
        """Fetch the trader leaderboard.

        Args:
            period: Time period (e.g. ``"7d"``, ``"30d"``).
            limit: Maximum number of results.
            page: Page number for pagination.

        Returns:
            A :class:`PaginatedResponse` of :class:`LeaderboardEntry` objects.
        """
        raw = self._get("/api/v1/leaderboard", params=_strip_none({
            "period": period, "limit": limit, "page": page,
        }))
        items = raw if isinstance(raw, list) else raw.get("data", [])
        return PaginatedResponse(
            data=[_parse(LeaderboardEntry, e) for e in items],
            total=raw.get("total", 0) if isinstance(raw, dict) else len(items),
            page=raw.get("page", 1) if isinstance(raw, dict) else 1,
            limit=raw.get("limit", len(items)) if isinstance(raw, dict) else len(items),
            has_more=raw.get("hasNext", False) if isinstance(raw, dict) else False,
            total_pages=raw.get("totalPages", 0) if isinstance(raw, dict) else 0,
        )

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

    def start_strategy(self, strategy_id: str, paper_mode: bool = True,
                       deployment_mode: str | None = None) -> StrategyStatusResponse:
        body: dict[str, Any] = {"paperMode": paper_mode}
        if deployment_mode is not None:
            _validate_enum("deploymentMode", deployment_mode, _VALID_DEPLOYMENT_MODES)
            body["deploymentMode"] = deployment_mode
        return _parse(StrategyStatusResponse, self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/start", json=body))

    def stop_strategy(self, strategy_id: str) -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/stop"))

    def get_strategy_templates(self) -> list[StrategyTemplate]:
        data = self._get("/api/v1/strategies/templates")
        # Backend returns PaginatedResponse<Strategy> with 'data' field
        items = data["data"]
        return [_parse(StrategyTemplate, t) for t in items]

    def export_strategy(self, strategy_id: str) -> dict:
        return self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}/export")

    def update_strategy(
        self,
        strategy_id: str,
        *,
        name: str | None = None,
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
        market_slots: list[dict[str, Any]] | None = None,
    ) -> Strategy:
        body: dict[str, Any] = {}
        if name is not None:
            body["name"] = name
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
        if market_slots is not None:
            body["marketSlots"] = market_slots
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

    # -- Strategy Social --

    def like_strategy(self, strategy_id: str) -> dict[str, Any]:
        """Like or unlike a strategy (toggle). Returns ``{"liked": bool, "likeCount": int}``."""
        return self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/like")

    def list_strategy_comments(
        self,
        strategy_id: str,
        *,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[dict[str, Any]]:
        """List comments on a strategy with optional pagination."""
        raw = self._get(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/comments",
            params={"page": page, "limit": limit},
        )
        return PaginatedResponse(
            data=raw["data"],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    def add_strategy_comment(self, strategy_id: str, content: str) -> dict[str, Any]:
        """Add a comment to a strategy."""
        return self._post(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/comments",
            json={"content": content},
        )

    def delete_strategy_comment(self, strategy_id: str, comment_id: str) -> None:
        """Delete a comment on a strategy (must be the comment author)."""
        self._delete(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/comments/{_encode_path(comment_id)}"
        )

    def list_strategy_children(self, strategy_id: str) -> dict[str, Any]:
        """List child strategies (forks) of a strategy."""
        return self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}/children")

    def report_strategy(
        self,
        strategy_id: str,
        reason: str,
        *,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Report a strategy for violating guidelines.

        Args:
            strategy_id: Strategy to report.
            reason: One of ``"SPAM"``, ``"HARMFUL"``, ``"MISLEADING"``, ``"OTHER"``.
            description: Optional additional detail.
        """
        body: dict[str, Any] = {"reason": reason}
        if description is not None:
            body["description"] = description
        return self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/report", json=body)

    # -- Strategy Versioning --

    def list_strategy_versions(self, strategy_id: str) -> list[dict[str, Any]]:
        """List all saved versions of a strategy."""
        return self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}/versions")

    def rollback_strategy(self, strategy_id: str, version_id: str) -> dict[str, Any]:
        """Rollback a strategy to a previous version.

        Args:
            strategy_id: The strategy to rollback.
            version_id: The version ID to restore.
        """
        return self._post(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/versions/{_encode_path(version_id)}/rollback"
        )

    # -- Strategy Event Log --

    def get_strategy_event_log(
        self,
        strategy_id: str,
        *,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Get the execution event log for a strategy.

        Args:
            strategy_id: The strategy ID.
            limit: Maximum number of log entries to return.
        """
        return self._get(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/event-log",
            params={"limit": limit},
        )

    # -- API Key Management --

    def list_api_keys(self) -> list[dict[str, Any]]:
        """List all API keys for the authenticated user.

        The raw token is never returned — only the prefix is available for identification.
        """
        return self._get("/api/v1/api-keys")

    def create_api_key(
        self,
        name: str,
        *,
        scopes: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create a new API key.

        The raw ``token`` is returned only once and cannot be retrieved later.

        Args:
            name: Human-readable label for this key.
            scopes: Optional list of scopes — ``"READ"``, ``"WRITE"``, ``"TRADE"``.
        """
        body: dict[str, Any] = {"name": name}
        if scopes is not None:
            body["scopes"] = scopes
        return self._post("/api/v1/api-keys", json=body)

    def revoke_api_key(self, key_id: str) -> None:
        """Revoke an API key by ID. The key is permanently deactivated."""
        self._delete(f"/api/v1/api-keys/{_encode_path(key_id)}")

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

    def get_top_scores(self) -> list[TopTraderEntry]:
        """Fetch the top 20 traders by score."""
        data = self._get("/api/v1/scores/top")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(TopTraderEntry, e) for e in items]

    def get_my_badges(self) -> list[Badge]:
        """Fetch the authenticated user's earned badges."""
        data = self._get("/api/v1/scores/me/badges")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(Badge, b) for b in items]

    def get_user_score(self, user_id: str) -> TraderScore:
        """Fetch a specific user's trader score.

        Args:
            user_id: The user's UUID.
        """
        data = self._get(f"/api/v1/scores/{_encode_path(user_id)}")
        score_data = data.get("score", data) if isinstance(data, dict) and "score" in data else data
        return _parse(TraderScore, score_data)

    def get_user_badges(self, user_id: str) -> list[Badge]:
        """Fetch the badges earned by a specific user.

        Args:
            user_id: The user's UUID.
        """
        data = self._get(f"/api/v1/scores/{_encode_path(user_id)}/badges")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(Badge, b) for b in items]

    # -- Risk Settings (tracked in polyforge-sdk-python#139) --

    def get_risk_settings(self) -> RiskSettings:
        """Fetch the current risk / circuit-breaker settings."""
        data = self._get("/api/v1/settings/risk")
        return RiskSettings(
            drawdown_enabled=data.get("drawdownEnabled", False),
            drawdown_lookback_hours=data.get("drawdownLookbackHours", 24),
            drawdown_threshold_pct=float(data.get("drawdownThresholdPct", 0.1)),
            circuit_breaker_tripped=data.get("circuitBreakerTripped", False),
            circuit_breaker_tripped_at=data.get("circuitBreakerTrippedAt"),
        )

    def update_risk_settings(
        self,
        *,
        drawdown_enabled: bool | None = None,
        drawdown_lookback_hours: int | None = None,
        drawdown_threshold_pct: float | None = None,
    ) -> RiskSettings:
        """Update risk settings. Only supplied fields are changed."""
        body: dict[str, Any] = {}
        if drawdown_enabled is not None:
            body["drawdownEnabled"] = drawdown_enabled
        if drawdown_lookback_hours is not None:
            body["drawdownLookbackHours"] = drawdown_lookback_hours
        if drawdown_threshold_pct is not None:
            body["drawdownThresholdPct"] = drawdown_threshold_pct
        data = self._patch("/api/v1/settings/risk", json=body)
        return RiskSettings(
            drawdown_enabled=data.get("drawdownEnabled", False),
            drawdown_lookback_hours=data.get("drawdownLookbackHours", 24),
            drawdown_threshold_pct=float(data.get("drawdownThresholdPct", 0.1)),
            circuit_breaker_tripped=data.get("circuitBreakerTripped", False),
            circuit_breaker_tripped_at=data.get("circuitBreakerTrippedAt"),
        )

    def reset_circuit_breaker(self) -> RiskSettings:
        """Reset the circuit breaker after it has been tripped."""
        data = self._post("/api/v1/settings/risk/reset")
        return RiskSettings(
            drawdown_enabled=data.get("drawdownEnabled", False),
            drawdown_lookback_hours=data.get("drawdownLookbackHours", 24),
            drawdown_threshold_pct=float(data.get("drawdownThresholdPct", 0.1)),
            circuit_breaker_tripped=data.get("circuitBreakerTripped", False),
            circuit_breaker_tripped_at=data.get("circuitBreakerTrippedAt"),
        )

    # -- CSV Exports --

    def export_orders_csv(self) -> str:
        """Download order history as CSV text."""
        return self._get_text("/api/v1/orders/export/csv")

    def export_portfolio_csv(self) -> str:
        """Download portfolio as CSV text."""
        return self._get_text("/api/v1/portfolio/export/csv")

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
        _validate_enum("side", side, _VALID_SIDES)
        _validate_enum("outcome", outcome, _VALID_OUTCOMES)
        _validate_enum("order_type", order_type, _VALID_ORDER_TYPES)
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

    def batch_orders(self, orders: list[dict[str, Any]]) -> BatchOrderResult:
        """Place up to 15 orders in a single request.

        Args:
            orders: List of order dicts, each with keys ``tokenId``, ``side``,
                ``outcome``, ``size``, ``price``, and optionally ``orderType``.
                Maximum 15 orders per call.
        """
        if not orders:
            raise ValueError("batch_orders requires at least 1 order")
        if len(orders) > 15:
            raise ValueError("batch_orders accepts at most 15 orders per call")
        data = self._post("/api/v1/orders/batch", json={"orders": orders})
        items = [
            BatchOrderItem(
                order_id=r.get("orderId", ""),
                intent_id=r.get("intentId", ""),
                status=r.get("status", ""),
            )
            for r in data.get("results", [])
        ]
        return BatchOrderResult(results=items)

    def bulk_cancel_orders(self, order_ids: list[str]) -> BulkCancelResult:
        """Cancel up to 3000 orders in a single request.

        Args:
            order_ids: List of order IDs to cancel (maximum 3000).
        """
        if not order_ids:
            raise ValueError("bulk_cancel_orders requires at least 1 order ID")
        if len(order_ids) > 3000:
            raise ValueError("bulk_cancel_orders accepts at most 3000 order IDs")
        data = self._delete_json("/api/v1/orders/bulk", json={"orderIds": order_ids})
        errors = [
            BulkCancelError(order_id=e.get("orderId", ""), reason=e.get("reason", ""))
            for e in data.get("errors", [])
        ]
        return BulkCancelResult(cancelled=data.get("cancelled", []), errors=errors)

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
    ) -> RedeemPositionResponse:
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
        return RedeemPositionResponse(position_id=data["positionId"], intent_id=data["intentId"], status=data["status"])

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

    def create_marketplace_listing(
        self,
        strategy_id: str,
        title: str,
        price: float,
        *,
        description: str | None = None,
    ) -> MarketplaceListing:
        """Create a new marketplace listing for one of your strategies.

        Args:
            strategy_id: The ID of the strategy to list.
            title: Listing title (required by the API).
            price: Listing price in USDC (must be positive).
            description: Optional description for the listing.

        Returns:
            The created :class:`MarketplaceListing`.
        """
        _validate_financial_param("price", price)
        body: dict[str, Any] = {"strategyId": strategy_id, "title": title, "priceUsdc": price}
        if description is not None:
            body["description"] = description
        return _parse(MarketplaceListing, self._post("/api/v1/marketplace", json=body))

    def update_marketplace_listing(self, listing_id: str, **kwargs: Any) -> MarketplaceListing:
        """Update an existing marketplace listing.

        Pass API field names as keyword arguments (e.g. ``price=9.99``,
        ``description="Updated desc"``).

        Args:
            listing_id: The listing ID to update.
            **kwargs: Fields to update (passed directly to the API).

        Returns:
            The updated :class:`MarketplaceListing`.
        """
        return _parse(
            MarketplaceListing,
            self._patch(f"/api/v1/marketplace/{_encode_path(listing_id)}", json=kwargs),
        )

    def rate_marketplace_listing(
        self,
        listing_id: str,
        rating: int,
        *,
        review: str | None = None,
    ) -> dict[str, Any]:
        """Submit a rating and optional review for a marketplace listing.

        Args:
            listing_id: The listing ID to rate.
            rating: Integer rating (e.g. 1–5).
            review: Optional text review.

        Returns:
            A dict with the rating submission confirmation.
        """
        body: dict[str, Any] = {"rating": rating}
        if review is not None:
            body["review"] = review
        return self._post(f"/api/v1/marketplace/{_encode_path(listing_id)}/rate", json=body)

    def get_my_listings(self) -> list[MarketplaceListing]:
        """Get all marketplace listings created by the current user.

        Returns:
            A list of :class:`MarketplaceListing` objects.
        """
        data = self._get("/api/v1/marketplace/my/listings")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(MarketplaceListing, lst) for lst in items]

    def get_my_purchases(self) -> list[MarketplacePurchaseResult]:
        """Get all marketplace strategies purchased by the current user.

        Returns:
            A list of :class:`MarketplacePurchaseResult` objects.
        """
        data = self._get("/api/v1/marketplace/my/purchases")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(MarketplacePurchaseResult, p) for p in items]

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

    # -- Paper Trading --

    def get_paper_summary(self) -> PaperSummary:
        """Get the current paper trading account summary.

        Returns:
            A :class:`PaperSummary` with balance, PnL, and position data.
        """
        data = self._get("/api/v1/paper/summary")
        return _parse(PaperSummary, data)

    def reset_paper_account(self) -> dict[str, Any]:
        """Reset the paper trading account to its initial state.

        Returns:
            A dict containing the reset confirmation from the server.
        """
        return self._post("/api/v1/paper/reset")

    # -- Batch API --

    def batch_requests(self, requests: list[dict[str, Any]]) -> list[BatchResult]:
        """Execute multiple API requests in a single round-trip.

        Each request dict must have: ``id`` (str), ``method`` (str),
        ``path`` (str), and optionally ``body`` (dict).

        Args:
            requests: List of request dicts.

        Returns:
            A list of :class:`BatchResult` objects, one per request.
        """
        data = self._post("/api/v1/batch", json={"items": requests})
        items = data if isinstance(data, list) else data.get("results", [])
        return [_parse(BatchResult, r) for r in items]

    # -- Social & Signals --

    def get_whale_feed(
        self,
        *,
        min_size: int | None = None,
        market_id: str | None = None,
        wallet_address: str | None = None,
        page: int | None = None,
        limit: int | None = None,
    ) -> list[WhaleTrade]:
        data = self._get("/api/v1/whales/feed", params=_strip_none({
            "minSize": min_size, "marketId": market_id,
            "walletAddress": wallet_address, "page": page, "limit": limit,
        }))
        items = data["data"] if isinstance(data, dict) and "data" in data else (data if isinstance(data, list) else [])
        return [_parse(WhaleTrade, w) for w in items]

    def get_top_whales(
        self,
        *,
        sort: str | None = None,
        period: str | None = None,
        limit: int | None = None,
    ) -> list[WhaleProfile]:
        """Fetch the top whale traders ranked by activity.

        Args:
            sort: Sort field (e.g. ``"pnl"``, ``"volume"``).
            period: Time period (e.g. ``"7d"``, ``"30d"``).
            limit: Maximum number of results (1--100, default 20).

        Returns:
            A list of :class:`WhaleProfile` objects.
        """
        data = self._get("/api/v1/whales/top", params=_strip_none({
            "sortBy": sort, "period": period, "limit": limit,
        }))
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(WhaleProfile, w) for w in items]

    def get_whale_profile(self, address: str) -> WhaleProfile:
        """Get a whale trader's profile by wallet address.

        Args:
            address: The wallet address of the whale.

        Returns:
            The :class:`WhaleProfile` for the given address.
        """
        data = self._get(f"/api/v1/whales/{_encode_path(address)}")
        return _parse(WhaleProfile, data)

    def follow_whale(self, address: str) -> dict[str, Any]:
        """Follow a whale trader.

        Args:
            address: The wallet address of the whale to follow.

        Returns:
            A dict with the follow confirmation from the server.
        """
        return self._post(f"/api/v1/whales/{_encode_path(address)}/follow")

    def unfollow_whale(self, address: str) -> dict[str, Any]:
        """Unfollow a whale trader.

        Args:
            address: The wallet address of the whale to unfollow.

        Returns:
            A dict with the unfollow confirmation from the server.
        """
        return self._post(f"/api/v1/whales/{_encode_path(address)}/unfollow")

    def get_followed_whales(self) -> list[WhaleProfile]:
        """List all whales the current user is following.

        Returns:
            A list of :class:`WhaleProfile` objects.
        """
        data = self._get("/api/v1/whales/following")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(WhaleProfile, w) for w in items]

    def get_news_signals(
        self,
        *,
        min_confidence: int | None = None,
        market_id: str | None = None,
        direction: str | None = None,
        page: int | None = None,
        limit: int | None = None,
    ) -> list[NewsSignal]:
        data = self._get("/api/v1/news/signals", params=_strip_none({
            "minConfidence": min_confidence, "marketId": market_id,
            "direction": direction, "page": page, "limit": limit,
        }))
        items = data["data"] if isinstance(data, dict) and "data" in data else (data if isinstance(data, list) else [])
        return [_parse(NewsSignal, s) for s in items]

    def list_news(
        self,
        *,
        source: str | None = None,
        sentiment: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[NewsArticle]:
        """List news articles with optional filters.

        Args:
            source: Filter by news source (e.g. ``"Reuters"``).
            sentiment: Filter by sentiment — ``"POSITIVE"``, ``"NEGATIVE"``, or ``"NEUTRAL"``.
            page: Page number (default 1).
            limit: Items per page (1–100, default 20).
        """
        raw = self._get("/api/v1/news", params=_strip_none({
            "source": source, "sentiment": sentiment, "page": page, "limit": limit,
        }))
        return PaginatedResponse(
            data=[_parse(NewsArticle, a) for a in raw.get("data", [])],
            total=raw.get("total", 0),
            page=raw.get("page", page),
            limit=raw.get("limit", limit),
            has_more=raw.get("hasNext", False),
            total_pages=raw.get("totalPages", 0),
        )

    def get_news_article(self, article_id: str) -> NewsArticle:
        """Fetch a single news article by ID."""
        return _parse(NewsArticle, self._get(f"/api/v1/news/{_encode_path(article_id)}"))

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
            direction: ``"above"`` or ``"below"``.
            price: The trigger price threshold.
            persistent: If ``True`` the alert re-arms after firing.

        Returns:
            The created :class:`Alert`.
        """
        _validate_financial_param("price", price)
        body: dict[str, Any] = {
            "tokenId": token_id,
            "direction": direction,
            "price": str(price),
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

    def get_polymarket_portfolio(self) -> list[PolymarketPortfolioEntry]:
        """Fetch the Polymarket-native portfolio positions for the connected wallet."""
        data = self._get("/api/v1/portfolio/polymarket/portfolio")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(PolymarketPortfolioEntry, e) for e in items]

    def get_polymarket_earnings(self) -> list[PolymarketEarningsEntry]:
        """Fetch daily earnings from the Polymarket rewards programme."""
        data = self._get("/api/v1/portfolio/polymarket/earnings")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(PolymarketEarningsEntry, e) for e in items]

    def get_polymarket_activity(self, *, activity_type: str | None = None) -> list[PolymarketActivity]:
        """Fetch on-chain activity for the connected Polymarket wallet.

        Args:
            activity_type: Optional activity type filter (e.g. ``"TRADE"``, ``"REDEEM"``).
        """
        data = self._get(
            "/api/v1/portfolio/polymarket/activity",
            params=_strip_none({"type": activity_type}),
        )
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(PolymarketActivity, a) for a in items]

    def list_copy_configs(self) -> list[CopyConfig]:
        data = self._get("/api/v1/copy")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(CopyConfig, c) for c in items]

    def create_copy_config(
        self,
        target_wallet: str,
        *,
        mode: str | None = None,
        size_value: float | None = None,
        max_exposure: float | None = None,
        max_daily_loss: float | None = None,
        price_offset: float | None = None,
    ) -> CopyConfig:
        """Create a new copy-trading configuration.

        Args:
            target_wallet: The wallet address to copy trades from.
            mode: Copy mode (``"PERCENTAGE"``, ``"FIXED"``, or ``"MIRROR"``).
            size_value: Trade size value (percentage or fixed USDC amount).
            max_exposure: Maximum USDC exposure per copied wallet.
            max_daily_loss: Maximum daily loss limit in USDC.
            price_offset: Price offset applied to copied orders.

        Returns:
            The created :class:`CopyConfig`.
        """
        body: dict[str, Any] = {"targetWallet": target_wallet}
        if mode is not None:
            body["mode"] = mode
        if size_value is not None:
            body["sizeValue"] = size_value
        if max_exposure is not None:
            body["maxExposure"] = max_exposure
        if max_daily_loss is not None:
            body["maxDailyLoss"] = max_daily_loss
        if price_offset is not None:
            body["priceOffset"] = price_offset
        return _parse(CopyConfig, self._post("/api/v1/copy", json=body))

    def get_copy_config(self, copy_id: str) -> CopyConfig:
        """Get a copy-trading configuration by ID.

        Args:
            copy_id: The copy config ID.

        Returns:
            The :class:`CopyConfig`.
        """
        data = self._get(f"/api/v1/copy/{_encode_path(copy_id)}")
        return _parse(CopyConfig, data)

    def update_copy_config(self, copy_id: str, **kwargs: Any) -> CopyConfig:
        """Update an existing copy-trading configuration.

        Pass API field names as keyword arguments (e.g. ``mode="FIXED"``,
        ``sizeValue=100``).

        Args:
            copy_id: The copy config ID to update.
            **kwargs: Fields to update (passed directly to the API).

        Returns:
            The updated :class:`CopyConfig`.
        """
        return _parse(
            CopyConfig,
            self._patch(f"/api/v1/copy/{_encode_path(copy_id)}", json=kwargs),
        )

    def pause_copy_config(self, copy_id: str) -> CopyConfig:
        """Pause an active copy-trading configuration.

        Args:
            copy_id: The copy config ID to pause.

        Returns:
            The updated :class:`CopyConfig` with ``status="PAUSED"``.
        """
        return _parse(CopyConfig, self._post(f"/api/v1/copy/{_encode_path(copy_id)}/pause"))

    def resume_copy_config(self, copy_id: str) -> CopyConfig:
        """Resume a paused copy-trading configuration.

        Args:
            copy_id: The copy config ID to resume.

        Returns:
            The updated :class:`CopyConfig` with ``status="ACTIVE"``.
        """
        return _parse(CopyConfig, self._post(f"/api/v1/copy/{_encode_path(copy_id)}/resume"))

    def delete_copy_config(self, copy_id: str) -> None:
        """Delete a copy-trading configuration.

        Args:
            copy_id: The copy config ID to delete.
        """
        self._delete(f"/api/v1/copy/{_encode_path(copy_id)}")

    def get_copy_trades(self, copy_id: str) -> list[CopyTrade]:
        """List all trades executed via a copy-trading configuration.

        Args:
            copy_id: The copy config ID.

        Returns:
            A list of :class:`CopyTrade` objects.
        """
        data = self._get(f"/api/v1/copy/{_encode_path(copy_id)}/trades")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(CopyTrade, t) for t in items]

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
        data = self._get(f"/api/v1/watchlist/{_encode_path(market_id)}/status")
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

    # -- Rewards --

    def list_rewards_markets(self) -> list[RewardMarket]:
        data = self._get("/api/v1/rewards/markets")
        if isinstance(data, list):
            return [_parse(RewardMarket, item) for item in data]
        return []

    def get_rewards_for_market(self, condition_id: str) -> RewardMarket:
        data = self._get(f"/api/v1/rewards/markets/{_encode_path(condition_id)}")
        return _parse(RewardMarket, data)

    def get_user_rewards(self) -> list[UserReward]:
        data = self._get("/api/v1/rewards/user")
        rewards = data.get("rewards", []) if isinstance(data, dict) else []
        return [_parse(UserReward, item) for item in rewards]

    def get_user_rewards_total(self) -> UserRewardsTotal:
        data = self._get("/api/v1/rewards/user/total")
        return _parse(UserRewardsTotal, data)

    def get_user_rewards_percentages(self) -> dict[str, Any]:
        return self._get("/api/v1/rewards/user/percentages")

    def get_user_rewards_per_market(self) -> list[dict[str, Any]]:
        data = self._get("/api/v1/rewards/user/markets")
        if isinstance(data, dict):
            return data.get("markets", [])
        return []

    def get_rebates(self) -> list[Rebate]:
        data = self._get("/api/v1/rewards/rebates")
        rebates = data.get("rebates", []) if isinstance(data, dict) else []
        return [_parse(Rebate, item) for item in rebates]

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

    def __getstate__(self) -> dict[str, Any]:
        state = self.__dict__.copy()
        state.pop("_client", None)
        return state

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

    async def _delete_json(self, path: str, *, json: dict[str, Any]) -> Any:
        resp = await self._client.request("DELETE", path, json=json)
        _raise_for_status(resp)
        if resp.status_code == 204:
            return None
        return resp.json()

    async def _get_text(self, path: str, *, params: dict[str, Any] | None = None) -> str:
        resp = await self._client.get(path, params=_strip_none(params or {}))
        _raise_for_status(resp)
        return resp.text

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
        from_: str | None = None,
        to: str | None = None,
        limit: int | None = None,
    ) -> list[PriceHistoryEntry]:
        """Fetch price history for a market token.

        Args:
            token_id: The token ID to fetch history for.
            resolution: Candle resolution — ``"1m"``, ``"1h"``, or ``"1d"`` (default ``"1h"``).
            from_: ISO 8601 start datetime (e.g. ``"2026-01-01T00:00:00Z"``).
            to: ISO 8601 end datetime (e.g. ``"2026-01-31T23:59:59Z"``).
            limit: Maximum number of entries (1–1000, default server-side).
        """
        data = await self._get(
            f"/api/v1/markets/{_encode_path(token_id)}/price-history",
            params={
                "resolution": resolution,
                "from": from_,
                "to": to,
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

    async def search_markets(self, q: str, *, limit: int | None = None) -> list[Market]:
        """Full-text search for markets.

        Args:
            q: Search query string (required).
            limit: Maximum number of results (1–100, default 20).
        """
        data = await self._get("/api/v1/markets/search", params=_strip_none({"q": q, "limit": limit}))
        if isinstance(data, list):
            return [_parse(Market, m) for m in data]
        if isinstance(data, dict):
            if "results" in data:
                return [_parse(Market, m) for m in data["results"]]
            if "data" in data:
                return [_parse(Market, m) for m in data["data"]]
        return []

    async def get_market_tick_size(self, token_id: str) -> TickSizeInfo:
        """Fetch the tick size and fee rate for a market token."""
        data = await self._get(f"/api/v1/markets/{_encode_path(token_id)}/tick-size")
        return TickSizeInfo(
            token_id=data.get("tokenId", token_id),
            tick_size=data.get("tickSize", ""),
            fee_rate=data.get("feeRate", ""),
        )

    async def get_market_spread(self, token_id: str) -> SpreadInfo:
        """Fetch the current bid-ask spread for a market token."""
        data = await self._get(f"/api/v1/markets/{_encode_path(token_id)}/spread")
        return SpreadInfo(
            token_id=data.get("tokenId", token_id),
            spread=data.get("spread", ""),
        )

    async def get_market_midpoint(self, token_id: str) -> MidpointInfo:
        """Fetch the current midpoint price for a market token."""
        data = await self._get(f"/api/v1/markets/{_encode_path(token_id)}/midpoint")
        return MidpointInfo(
            token_id=data.get("tokenId", token_id),
            midpoint=data.get("midpoint", ""),
        )

    async def get_clob_book(self, token_id: str) -> ClobBook:
        """Fetch the full CLOB order book snapshot for a market token."""
        data = await self._get(f"/api/v1/markets/{_encode_path(token_id)}/clob-book")
        return ClobBook(
            token_id=data.get("tokenId", token_id),
            bids=data.get("bids", []),
            asks=data.get("asks", []),
            spread=data.get("spread", ""),
            midpoint=data.get("midpoint", ""),
            timestamp=data.get("timestamp", 0),
        )

    async def get_clob_prices_history(
        self,
        token_id: str,
        *,
        interval: str | None = None,
        fidelity: int | None = None,
    ) -> ClobPriceHistory:
        """Fetch CLOB price history for a market token.

        Args:
            token_id: The token ID to fetch history for.
            interval: Time interval — ``"1m"``, ``"5m"``, ``"1h"``, ``"4h"``,
                ``"1d"``, ``"1w"``, or ``"max"`` (default ``"1h"``).
            fidelity: Number of data points (1–500, default 60).
        """
        data = await self._get(
            f"/api/v1/markets/{_encode_path(token_id)}/clob-prices-history",
            params=_strip_none({"interval": interval, "fidelity": fidelity}),
        )
        return ClobPriceHistory(
            token_id=data.get("tokenId", token_id),
            interval=data.get("interval", interval or "1h"),
            history=data.get("history", []),
        )

    # -- Discovery & Ranking --

    async def discover_strategies(
        self,
        *,
        sort: str | None = None,
        category: str | None = None,
        search: str | None = None,
        limit: int | None = None,
        page: int | None = None,
    ) -> PaginatedResponse[Strategy]:
        """Discover and browse public strategies.

        Args:
            sort: Sort order (e.g. ``"pnl"``, ``"win_rate"``).
            category: Filter by market category.
            search: Full-text search query.
            limit: Maximum number of results.
            page: Page number for pagination.

        Returns:
            A :class:`PaginatedResponse` of :class:`Strategy` objects.
        """
        raw = await self._get("/api/v1/discover", params=_strip_none({
            "sort": sort, "category": category, "search": search,
            "limit": limit, "page": page,
        }))
        items = raw.get("data", raw.get("items", []))
        return PaginatedResponse(
            data=[_parse(Strategy, s) for s in items],
            total=raw.get("total", 0),
            page=raw.get("page", 1),
            limit=raw.get("limit", 10),
            has_more=raw.get("hasNext", False),
            total_pages=raw.get("totalPages", 0),
        )

    async def get_leaderboard(
        self,
        *,
        period: str | None = None,
        limit: int | None = None,
        page: int | None = None,
    ) -> PaginatedResponse[LeaderboardEntry]:
        """Fetch the trader leaderboard.

        Args:
            period: Time period (e.g. ``"7d"``, ``"30d"``).
            limit: Maximum number of results.
            page: Page number for pagination.

        Returns:
            A :class:`PaginatedResponse` of :class:`LeaderboardEntry` objects.
        """
        raw = await self._get("/api/v1/leaderboard", params=_strip_none({
            "period": period, "limit": limit, "page": page,
        }))
        items = raw if isinstance(raw, list) else raw.get("data", [])
        return PaginatedResponse(
            data=[_parse(LeaderboardEntry, e) for e in items],
            total=raw.get("total", 0) if isinstance(raw, dict) else len(items),
            page=raw.get("page", 1) if isinstance(raw, dict) else 1,
            limit=raw.get("limit", len(items)) if isinstance(raw, dict) else len(items),
            has_more=raw.get("hasNext", False) if isinstance(raw, dict) else False,
            total_pages=raw.get("totalPages", 0) if isinstance(raw, dict) else 0,
        )

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

    async def start_strategy(self, strategy_id: str, paper_mode: bool = True,
                             deployment_mode: str | None = None) -> StrategyStatusResponse:
        body: dict[str, Any] = {"paperMode": paper_mode}
        if deployment_mode is not None:
            _validate_enum("deploymentMode", deployment_mode, _VALID_DEPLOYMENT_MODES)
            body["deploymentMode"] = deployment_mode
        return _parse(StrategyStatusResponse, await self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/start", json=body))

    async def stop_strategy(self, strategy_id: str) -> StrategyStatusResponse:
        return _parse(StrategyStatusResponse, await self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/stop"))

    async def get_strategy_templates(self) -> list[StrategyTemplate]:
        data = await self._get("/api/v1/strategies/templates")
        # Backend returns PaginatedResponse<Strategy> with 'data' field
        items = data["data"]
        return [_parse(StrategyTemplate, t) for t in items]

    async def export_strategy(self, strategy_id: str) -> dict:
        return await self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}/export")

    async def update_strategy(
        self,
        strategy_id: str,
        *,
        name: str | None = None,
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
        market_slots: list[dict[str, Any]] | None = None,
    ) -> Strategy:
        body: dict[str, Any] = {}
        if name is not None:
            body["name"] = name
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
        if market_slots is not None:
            body["marketSlots"] = market_slots
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

    # -- Strategy Social --

    async def like_strategy(self, strategy_id: str) -> dict[str, Any]:
        """Like or unlike a strategy (toggle). Returns ``{"liked": bool, "likeCount": int}``."""
        return await self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/like")

    async def list_strategy_comments(
        self,
        strategy_id: str,
        *,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[dict[str, Any]]:
        """List comments on a strategy with optional pagination."""
        raw = await self._get(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/comments",
            params={"page": page, "limit": limit},
        )
        return PaginatedResponse(
            data=raw["data"],
            total=raw["total"],
            page=raw["page"],
            limit=raw["limit"],
            has_more=raw["hasNext"],
            total_pages=raw.get("totalPages", 0),
        )

    async def add_strategy_comment(self, strategy_id: str, content: str) -> dict[str, Any]:
        """Add a comment to a strategy."""
        return await self._post(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/comments",
            json={"content": content},
        )

    async def delete_strategy_comment(self, strategy_id: str, comment_id: str) -> None:
        """Delete a comment on a strategy (must be the comment author)."""
        await self._delete(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/comments/{_encode_path(comment_id)}"
        )

    async def list_strategy_children(self, strategy_id: str) -> dict[str, Any]:
        """List child strategies (forks) of a strategy."""
        return await self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}/children")

    async def report_strategy(
        self,
        strategy_id: str,
        reason: str,
        *,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Report a strategy for violating guidelines.

        Args:
            strategy_id: Strategy to report.
            reason: One of ``"SPAM"``, ``"HARMFUL"``, ``"MISLEADING"``, ``"OTHER"``.
            description: Optional additional detail.
        """
        body: dict[str, Any] = {"reason": reason}
        if description is not None:
            body["description"] = description
        return await self._post(f"/api/v1/strategies/{_encode_path(strategy_id)}/report", json=body)

    # -- Strategy Versioning --

    async def list_strategy_versions(self, strategy_id: str) -> list[dict[str, Any]]:
        """List all saved versions of a strategy."""
        return await self._get(f"/api/v1/strategies/{_encode_path(strategy_id)}/versions")

    async def rollback_strategy(self, strategy_id: str, version_id: str) -> dict[str, Any]:
        """Rollback a strategy to a previous version."""
        return await self._post(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/versions/{_encode_path(version_id)}/rollback"
        )

    # -- Strategy Event Log --

    async def get_strategy_event_log(
        self,
        strategy_id: str,
        *,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Get the execution event log for a strategy."""
        return await self._get(
            f"/api/v1/strategies/{_encode_path(strategy_id)}/event-log",
            params={"limit": limit},
        )

    # -- API Key Management --

    async def list_api_keys(self) -> list[dict[str, Any]]:
        """List all API keys for the authenticated user."""
        return await self._get("/api/v1/api-keys")

    async def create_api_key(
        self,
        name: str,
        *,
        scopes: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create a new API key.

        The raw ``token`` is returned only once and cannot be retrieved later.

        Args:
            name: Human-readable label for this key.
            scopes: Optional list of scopes — ``"READ"``, ``"WRITE"``, ``"TRADE"``.
        """
        body: dict[str, Any] = {"name": name}
        if scopes is not None:
            body["scopes"] = scopes
        return await self._post("/api/v1/api-keys", json=body)

    async def revoke_api_key(self, key_id: str) -> None:
        """Revoke an API key by ID. The key is permanently deactivated."""
        await self._delete(f"/api/v1/api-keys/{_encode_path(key_id)}")

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

    async def get_top_scores(self) -> list[TopTraderEntry]:
        """Fetch the top 20 traders by score."""
        data = await self._get("/api/v1/scores/top")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(TopTraderEntry, e) for e in items]

    async def get_my_badges(self) -> list[Badge]:
        """Fetch the authenticated user's earned badges."""
        data = await self._get("/api/v1/scores/me/badges")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(Badge, b) for b in items]

    async def get_user_score(self, user_id: str) -> TraderScore:
        """Fetch a specific user's trader score.

        Args:
            user_id: The user's UUID.
        """
        data = await self._get(f"/api/v1/scores/{_encode_path(user_id)}")
        score_data = data.get("score", data) if isinstance(data, dict) and "score" in data else data
        return _parse(TraderScore, score_data)

    async def get_user_badges(self, user_id: str) -> list[Badge]:
        """Fetch the badges earned by a specific user.

        Args:
            user_id: The user's UUID.
        """
        data = await self._get(f"/api/v1/scores/{_encode_path(user_id)}/badges")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(Badge, b) for b in items]

    # -- Risk Settings (tracked in polyforge-sdk-python#139) --

    async def get_risk_settings(self) -> RiskSettings:
        """Fetch the current risk / circuit-breaker settings."""
        data = await self._get("/api/v1/settings/risk")
        return RiskSettings(
            drawdown_enabled=data.get("drawdownEnabled", False),
            drawdown_lookback_hours=data.get("drawdownLookbackHours", 24),
            drawdown_threshold_pct=float(data.get("drawdownThresholdPct", 0.1)),
            circuit_breaker_tripped=data.get("circuitBreakerTripped", False),
            circuit_breaker_tripped_at=data.get("circuitBreakerTrippedAt"),
        )

    async def update_risk_settings(
        self,
        *,
        drawdown_enabled: bool | None = None,
        drawdown_lookback_hours: int | None = None,
        drawdown_threshold_pct: float | None = None,
    ) -> RiskSettings:
        """Update risk settings. Only supplied fields are changed."""
        body: dict[str, Any] = {}
        if drawdown_enabled is not None:
            body["drawdownEnabled"] = drawdown_enabled
        if drawdown_lookback_hours is not None:
            body["drawdownLookbackHours"] = drawdown_lookback_hours
        if drawdown_threshold_pct is not None:
            body["drawdownThresholdPct"] = drawdown_threshold_pct
        data = await self._patch("/api/v1/settings/risk", json=body)
        return RiskSettings(
            drawdown_enabled=data.get("drawdownEnabled", False),
            drawdown_lookback_hours=data.get("drawdownLookbackHours", 24),
            drawdown_threshold_pct=float(data.get("drawdownThresholdPct", 0.1)),
            circuit_breaker_tripped=data.get("circuitBreakerTripped", False),
            circuit_breaker_tripped_at=data.get("circuitBreakerTrippedAt"),
        )

    async def reset_circuit_breaker(self) -> RiskSettings:
        """Reset the circuit breaker after it has been tripped."""
        data = await self._post("/api/v1/settings/risk/reset")
        return RiskSettings(
            drawdown_enabled=data.get("drawdownEnabled", False),
            drawdown_lookback_hours=data.get("drawdownLookbackHours", 24),
            drawdown_threshold_pct=float(data.get("drawdownThresholdPct", 0.1)),
            circuit_breaker_tripped=data.get("circuitBreakerTripped", False),
            circuit_breaker_tripped_at=data.get("circuitBreakerTrippedAt"),
        )

    # -- CSV Exports --

    async def export_orders_csv(self) -> str:
        """Download order history as CSV text."""
        return await self._get_text("/api/v1/orders/export/csv")

    async def export_portfolio_csv(self) -> str:
        """Download portfolio as CSV text."""
        return await self._get_text("/api/v1/portfolio/export/csv")

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
        _validate_enum("side", side, _VALID_SIDES)
        _validate_enum("outcome", outcome, _VALID_OUTCOMES)
        _validate_enum("order_type", order_type, _VALID_ORDER_TYPES)
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

    async def batch_orders(self, orders: list[dict[str, Any]]) -> BatchOrderResult:
        """Place up to 15 orders in a single request.

        Args:
            orders: List of order dicts, each with keys ``tokenId``, ``side``,
                ``outcome``, ``size``, ``price``, and optionally ``orderType``.
                Maximum 15 orders per call.
        """
        if not orders:
            raise ValueError("batch_orders requires at least 1 order")
        if len(orders) > 15:
            raise ValueError("batch_orders accepts at most 15 orders per call")
        data = await self._post("/api/v1/orders/batch", json={"orders": orders})
        items = [
            BatchOrderItem(
                order_id=r.get("orderId", ""),
                intent_id=r.get("intentId", ""),
                status=r.get("status", ""),
            )
            for r in data.get("results", [])
        ]
        return BatchOrderResult(results=items)

    async def bulk_cancel_orders(self, order_ids: list[str]) -> BulkCancelResult:
        """Cancel up to 3000 orders in a single request.

        Args:
            order_ids: List of order IDs to cancel (maximum 3000).
        """
        if not order_ids:
            raise ValueError("bulk_cancel_orders requires at least 1 order ID")
        if len(order_ids) > 3000:
            raise ValueError("bulk_cancel_orders accepts at most 3000 order IDs")
        data = await self._delete_json("/api/v1/orders/bulk", json={"orderIds": order_ids})
        errors = [
            BulkCancelError(order_id=e.get("orderId", ""), reason=e.get("reason", ""))
            for e in data.get("errors", [])
        ]
        return BulkCancelResult(cancelled=data.get("cancelled", []), errors=errors)

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
    ) -> RedeemPositionResponse:
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
        return RedeemPositionResponse(position_id=data["positionId"], intent_id=data["intentId"], status=data["status"])

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

    async def create_marketplace_listing(
        self,
        strategy_id: str,
        title: str,
        price: float,
        *,
        description: str | None = None,
    ) -> MarketplaceListing:
        """Create a new marketplace listing for one of your strategies."""
        _validate_financial_param("price", price)
        body: dict[str, Any] = {"strategyId": strategy_id, "title": title, "priceUsdc": price}
        if description is not None:
            body["description"] = description
        return _parse(MarketplaceListing, await self._post("/api/v1/marketplace", json=body))

    async def update_marketplace_listing(self, listing_id: str, **kwargs: Any) -> MarketplaceListing:
        """Update an existing marketplace listing."""
        return _parse(
            MarketplaceListing,
            await self._patch(f"/api/v1/marketplace/{_encode_path(listing_id)}", json=kwargs),
        )

    async def rate_marketplace_listing(
        self,
        listing_id: str,
        rating: int,
        *,
        review: str | None = None,
    ) -> dict[str, Any]:
        """Submit a rating and optional review for a marketplace listing."""
        body: dict[str, Any] = {"rating": rating}
        if review is not None:
            body["review"] = review
        return await self._post(f"/api/v1/marketplace/{_encode_path(listing_id)}/rate", json=body)

    async def get_my_listings(self) -> list[MarketplaceListing]:
        """Get all marketplace listings created by the current user."""
        data = await self._get("/api/v1/marketplace/my/listings")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(MarketplaceListing, lst) for lst in items]

    async def get_my_purchases(self) -> list[MarketplacePurchaseResult]:
        """Get all marketplace strategies purchased by the current user."""
        data = await self._get("/api/v1/marketplace/my/purchases")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(MarketplacePurchaseResult, p) for p in items]

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

    # -- Paper Trading --

    async def get_paper_summary(self) -> PaperSummary:
        """Get the current paper trading account summary."""
        data = await self._get("/api/v1/paper/summary")
        return _parse(PaperSummary, data)

    async def reset_paper_account(self) -> dict[str, Any]:
        """Reset the paper trading account to its initial state."""
        return await self._post("/api/v1/paper/reset")

    # -- Batch API --

    async def batch_requests(self, requests: list[dict[str, Any]]) -> list[BatchResult]:
        """Execute multiple API requests in a single round-trip."""
        data = await self._post("/api/v1/batch", json={"items": requests})
        items = data if isinstance(data, list) else data.get("results", [])
        return [_parse(BatchResult, r) for r in items]

    # -- Social & Signals --

    async def get_whale_feed(
        self,
        *,
        min_size: int | None = None,
        market_id: str | None = None,
        wallet_address: str | None = None,
        page: int | None = None,
        limit: int | None = None,
    ) -> list[WhaleTrade]:
        data = await self._get("/api/v1/whales/feed", params=_strip_none({
            "minSize": min_size, "marketId": market_id,
            "walletAddress": wallet_address, "page": page, "limit": limit,
        }))
        items = data["data"] if isinstance(data, dict) and "data" in data else (data if isinstance(data, list) else [])
        return [_parse(WhaleTrade, w) for w in items]

    async def get_top_whales(
        self,
        *,
        sort: str | None = None,
        period: str | None = None,
        limit: int | None = None,
    ) -> list[WhaleProfile]:
        """Fetch the top whale traders ranked by activity."""
        data = await self._get("/api/v1/whales/top", params=_strip_none({
            "sortBy": sort, "period": period, "limit": limit,
        }))
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(WhaleProfile, w) for w in items]

    async def get_whale_profile(self, address: str) -> WhaleProfile:
        """Get a whale trader's profile by wallet address."""
        data = await self._get(f"/api/v1/whales/{_encode_path(address)}")
        return _parse(WhaleProfile, data)

    async def follow_whale(self, address: str) -> dict[str, Any]:
        """Follow a whale trader."""
        return await self._post(f"/api/v1/whales/{_encode_path(address)}/follow")

    async def unfollow_whale(self, address: str) -> dict[str, Any]:
        """Unfollow a whale trader."""
        return await self._post(f"/api/v1/whales/{_encode_path(address)}/unfollow")

    async def get_followed_whales(self) -> list[WhaleProfile]:
        """List all whales the current user is following."""
        data = await self._get("/api/v1/whales/following")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(WhaleProfile, w) for w in items]

    async def get_news_signals(
        self,
        *,
        min_confidence: int | None = None,
        market_id: str | None = None,
        direction: str | None = None,
        page: int | None = None,
        limit: int | None = None,
    ) -> list[NewsSignal]:
        data = await self._get("/api/v1/news/signals", params=_strip_none({
            "minConfidence": min_confidence, "marketId": market_id,
            "direction": direction, "page": page, "limit": limit,
        }))
        items = data["data"] if isinstance(data, dict) and "data" in data else (data if isinstance(data, list) else [])
        return [_parse(NewsSignal, s) for s in items]

    async def list_news(
        self,
        *,
        source: str | None = None,
        sentiment: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> PaginatedResponse[NewsArticle]:
        """List news articles with optional filters.

        Args:
            source: Filter by news source (e.g. ``"Reuters"``).
            sentiment: Filter by sentiment — ``"POSITIVE"``, ``"NEGATIVE"``, or ``"NEUTRAL"``.
            page: Page number (default 1).
            limit: Items per page (1–100, default 20).
        """
        raw = await self._get("/api/v1/news", params=_strip_none({
            "source": source, "sentiment": sentiment, "page": page, "limit": limit,
        }))
        return PaginatedResponse(
            data=[_parse(NewsArticle, a) for a in raw.get("data", [])],
            total=raw.get("total", 0),
            page=raw.get("page", page),
            limit=raw.get("limit", limit),
            has_more=raw.get("hasNext", False),
            total_pages=raw.get("totalPages", 0),
        )

    async def get_news_article(self, article_id: str) -> NewsArticle:
        """Fetch a single news article by ID."""
        return _parse(NewsArticle, await self._get(f"/api/v1/news/{_encode_path(article_id)}"))

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
            direction: ``"above"`` or ``"below"``.
            price: The trigger price threshold.
            persistent: If ``True`` the alert re-arms after firing.

        Returns:
            The created :class:`Alert`.
        """
        _validate_financial_param("price", price)
        body: dict[str, Any] = {
            "tokenId": token_id,
            "direction": direction,
            "price": str(price),
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

    async def get_polymarket_portfolio(self) -> list[PolymarketPortfolioEntry]:
        """Fetch the Polymarket-native portfolio positions for the connected wallet."""
        data = await self._get("/api/v1/portfolio/polymarket/portfolio")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(PolymarketPortfolioEntry, e) for e in items]

    async def get_polymarket_earnings(self) -> list[PolymarketEarningsEntry]:
        """Fetch daily earnings from the Polymarket rewards programme."""
        data = await self._get("/api/v1/portfolio/polymarket/earnings")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(PolymarketEarningsEntry, e) for e in items]

    async def get_polymarket_activity(self, *, activity_type: str | None = None) -> list[PolymarketActivity]:
        """Fetch on-chain activity for the connected Polymarket wallet.

        Args:
            activity_type: Optional activity type filter (e.g. ``"TRADE"``, ``"REDEEM"``).
        """
        data = await self._get(
            "/api/v1/portfolio/polymarket/activity",
            params=_strip_none({"type": activity_type}),
        )
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(PolymarketActivity, a) for a in items]

    async def list_copy_configs(self) -> list[CopyConfig]:
        data = await self._get("/api/v1/copy")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(CopyConfig, c) for c in items]

    async def create_copy_config(
        self,
        target_wallet: str,
        *,
        mode: str | None = None,
        size_value: float | None = None,
        max_exposure: float | None = None,
        max_daily_loss: float | None = None,
        price_offset: float | None = None,
    ) -> CopyConfig:
        """Create a new copy-trading configuration."""
        body: dict[str, Any] = {"targetWallet": target_wallet}
        if mode is not None:
            body["mode"] = mode
        if size_value is not None:
            body["sizeValue"] = size_value
        if max_exposure is not None:
            body["maxExposure"] = max_exposure
        if max_daily_loss is not None:
            body["maxDailyLoss"] = max_daily_loss
        if price_offset is not None:
            body["priceOffset"] = price_offset
        return _parse(CopyConfig, await self._post("/api/v1/copy", json=body))

    async def get_copy_config(self, copy_id: str) -> CopyConfig:
        """Get a copy-trading configuration by ID."""
        data = await self._get(f"/api/v1/copy/{_encode_path(copy_id)}")
        return _parse(CopyConfig, data)

    async def update_copy_config(self, copy_id: str, **kwargs: Any) -> CopyConfig:
        """Update an existing copy-trading configuration."""
        return _parse(
            CopyConfig,
            await self._patch(f"/api/v1/copy/{_encode_path(copy_id)}", json=kwargs),
        )

    async def pause_copy_config(self, copy_id: str) -> CopyConfig:
        """Pause an active copy-trading configuration."""
        return _parse(CopyConfig, await self._post(f"/api/v1/copy/{_encode_path(copy_id)}/pause"))

    async def resume_copy_config(self, copy_id: str) -> CopyConfig:
        """Resume a paused copy-trading configuration."""
        return _parse(CopyConfig, await self._post(f"/api/v1/copy/{_encode_path(copy_id)}/resume"))

    async def delete_copy_config(self, copy_id: str) -> None:
        """Delete a copy-trading configuration."""
        await self._delete(f"/api/v1/copy/{_encode_path(copy_id)}")

    async def get_copy_trades(self, copy_id: str) -> list[CopyTrade]:
        """List all trades executed via a copy-trading configuration."""
        data = await self._get(f"/api/v1/copy/{_encode_path(copy_id)}/trades")
        items = data if isinstance(data, list) else data.get("data", [])
        return [_parse(CopyTrade, t) for t in items]

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
        data = await self._get(f"/api/v1/watchlist/{_encode_path(market_id)}/status")
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

    # -- Rewards --

    async def list_rewards_markets(self) -> list[RewardMarket]:
        data = await self._get("/api/v1/rewards/markets")
        if isinstance(data, list):
            return [_parse(RewardMarket, item) for item in data]
        return []

    async def get_rewards_for_market(self, condition_id: str) -> RewardMarket:
        data = await self._get(f"/api/v1/rewards/markets/{_encode_path(condition_id)}")
        return _parse(RewardMarket, data)

    async def get_user_rewards(self) -> list[UserReward]:
        data = await self._get("/api/v1/rewards/user")
        rewards = data.get("rewards", []) if isinstance(data, dict) else []
        return [_parse(UserReward, item) for item in rewards]

    async def get_user_rewards_total(self) -> UserRewardsTotal:
        data = await self._get("/api/v1/rewards/user/total")
        return _parse(UserRewardsTotal, data)

    async def get_user_rewards_percentages(self) -> dict[str, Any]:
        return await self._get("/api/v1/rewards/user/percentages")

    async def get_user_rewards_per_market(self) -> list[dict[str, Any]]:
        data = await self._get("/api/v1/rewards/user/markets")
        if isinstance(data, dict):
            return data.get("markets", [])
        return []

    async def get_rebates(self) -> list[Rebate]:
        data = await self._get("/api/v1/rewards/rebates")
        rebates = data.get("rebates", []) if isinstance(data, dict) else []
        return [_parse(Rebate, item) for item in rebates]

    # -- Lifecycle --

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> AsyncPolyforgeClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
