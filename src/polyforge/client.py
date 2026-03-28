"""Polyforge REST API client — sync and async versions."""

from __future__ import annotations

from dataclasses import fields
from typing import Any, TypeVar, get_type_hints

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

T = TypeVar("T")

_MODEL_REGISTRY: dict[str, type] = {
    "Market": Market,
    "Token": Token,
    "Strategy": Strategy,
    "StrategyTemplate": StrategyTemplate,
    "Portfolio": Portfolio,
    "Position": Position,
    "Order": Order,
    "TraderScore": TraderScore,
    "WhaleTrade": WhaleTrade,
    "NewsSignal": NewsSignal,
    "Alert": Alert,
    "CopyConfig": CopyConfig,
    "Webhook": Webhook,
    "AiQueryResponse": AiQueryResponse,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse(cls: type[T], data: dict[str, Any]) -> T:
    """Recursively instantiate a dataclass from a JSON dict."""
    if not isinstance(data, dict):
        return data  # type: ignore[return-value]

    hints = get_type_hints(cls)
    kwargs: dict[str, Any] = {}

    for f in fields(cls):  # type: ignore[arg-type]
        raw = data.get(f.name)
        if raw is None:
            continue

        hint = hints.get(f.name)
        # Resolve nested dataclass fields via registry
        hint_name = getattr(hint, "__name__", "") if hint else ""
        origin = getattr(hint, "__origin__", None)

        if hint_name in _MODEL_REGISTRY:
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
    request_id = response.headers.get("x-request-id", "")

    kwargs = dict(status_code=response.status_code, code=code, request_id=request_id)

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


# ---------------------------------------------------------------------------
# Synchronous client
# ---------------------------------------------------------------------------

class PolyforgeClient:
    """Synchronous Polyforge REST API client.

    Usage::

        with PolyforgeClient(api_key="pk_...") as client:
            markets = client.list_markets(limit=5)
            for m in markets.items:
                print(m.name, m.price)
    """

    def __init__(
        self,
        api_key: str,
        api_url: str = "http://localhost:3002",
        timeout: float = 15.0,
    ) -> None:
        self._api_url = api_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self._api_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "polyforge-python/1.0.0",
            },
            timeout=timeout,
        )

    # -- helpers --

    def _get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        resp = self._client.get(path, params=_strip_none(params or {}))
        _raise_for_status(resp)
        return resp.json()

    def _post(self, path: str, *, json: dict[str, Any] | None = None) -> Any:
        resp = self._client.post(path, json=json or {})
        _raise_for_status(resp)
        return resp.json()

    def _delete(self, path: str) -> Any:
        resp = self._client.delete(path)
        _raise_for_status(resp)
        return resp.json()

    # -- Markets --

    def list_markets(
        self,
        *,
        search: str | None = None,
        category: str | None = None,
        limit: int = 10,
        page: int = 1,
    ) -> PaginatedResponse[Market]:
        data = self._get(
            "/api/v1/markets",
            params={"search": search, "category": category, "limit": limit, "page": page},
        )
        # Backend returns PaginatedResponse<Market> with 'data' field
        items = [_parse(Market, m) for m in data["data"]]
        return PaginatedResponse(
            items=items,
            total=data["total"],
            page=data["page"],
            limit=data["limit"],
            has_more=data["hasNext"],
        )

    def get_market(self, market_id: str) -> Market:
        return _parse(Market, self._get(f"/api/v1/markets/{market_id}"))

    # -- Strategies --

    def list_strategies(self, *, status: str | None = None) -> list[Strategy]:
        data = self._get("/api/v1/strategies", params={"status": status})
        # Backend returns PaginatedResponse<Strategy> with 'data' field
        items = data["data"]
        return [_parse(Strategy, s) for s in items]

    def get_strategy(self, strategy_id: str) -> Strategy:
        return _parse(Strategy, self._get(f"/api/v1/strategies/{strategy_id}"))

    def create_strategy(self, name: str, description: str | None = None) -> Strategy:
        return _parse(Strategy, self._post("/api/v1/strategies", json={"name": name, "description": description or ""}))

    def create_strategy_from_description(self, description: str, market_id: str | None = None) -> Strategy:
        body: dict[str, Any] = {"description": description}
        if market_id is not None:
            body["market_id"] = market_id
        return _parse(Strategy, self._post("/api/v1/strategies/from-description", json=body))

    def start_strategy(self, strategy_id: str, mode: str = "paper") -> Strategy:
        return _parse(Strategy, self._post(f"/api/v1/strategies/{strategy_id}/start", json={"mode": mode}))

    def stop_strategy(self, strategy_id: str) -> Strategy:
        return _parse(Strategy, self._post(f"/api/v1/strategies/{strategy_id}/stop"))

    def get_strategy_templates(self) -> list[StrategyTemplate]:
        data = self._get("/api/v1/strategies/templates")
        # Backend returns PaginatedResponse<StrategyTemplate> with 'data' field
        items = data["data"]
        return [_parse(StrategyTemplate, t) for t in items]

    def export_strategy(self, strategy_id: str) -> dict:
        return self._get(f"/api/v1/strategies/{strategy_id}/export")

    # -- Portfolio & Orders --

    def get_portfolio(self) -> Portfolio:
        return _parse(Portfolio, self._get("/api/v1/portfolio"))

    def get_orders(self, *, limit: int = 20, status: str | None = None) -> list[Order]:
        data = self._get("/api/v1/orders", params={"limit": limit, "status": status})
        # Backend returns PaginatedResponse<Order> with 'data' field
        items = data["data"]
        return [_parse(Order, o) for o in items]

    def get_score(self) -> TraderScore:
        return _parse(TraderScore, self._get("/api/v1/score"))

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
        return self._delete(f"/api/v1/orders/{order_id}")

    # -- Social & Signals --

    def get_whale_feed(self, *, min_size: int = 10000) -> list[WhaleTrade]:
        data = self._get("/api/v1/whale-feed", params={"min_size": min_size})
        # Backend returns PaginatedResponse<WhaleTrade> with 'data' field
        items = data["data"]
        return [_parse(WhaleTrade, w) for w in items]

    def get_news_signals(self, *, min_confidence: int = 70) -> list[NewsSignal]:
        data = self._get("/api/v1/news-signals", params={"min_confidence": min_confidence})
        # Backend returns PaginatedResponse<NewsSignal> with 'data' field
        items = data["data"]
        return [_parse(NewsSignal, s) for s in items]

    # -- Configuration --

    def list_alerts(self) -> list[Alert]:
        data = self._get("/api/v1/alerts")
        # Backend returns PaginatedResponse<Alert> with 'data' field
        items = data["data"]
        return [_parse(Alert, a) for a in items]

    def list_copy_configs(self) -> list[CopyConfig]:
        data = self._get("/api/v1/copy-configs")
        # Backend returns PaginatedResponse<CopyConfig> with 'data' field
        items = data["data"]
        return [_parse(CopyConfig, c) for c in items]

    def list_webhooks(self) -> list[Webhook]:
        data = self._get("/api/v1/webhooks")
        # Backend returns PaginatedResponse<Webhook> with 'data' field
        items = data["data"]
        return [_parse(Webhook, w) for w in items]

    def create_webhook(self, url: str, events: list[str]) -> Webhook:
        return _parse(Webhook, self._post("/api/v1/webhooks", json={"url": url, "events": events}))

    # -- AI --

    def ai_query(self, query: str) -> AiQueryResponse:
        return _parse(AiQueryResponse, self._post("/api/v1/ai/query", json={"query": query}))

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
                print(m.name, m.price)
    """

    def __init__(
        self,
        api_key: str,
        api_url: str = "http://localhost:3002",
        timeout: float = 15.0,
    ) -> None:
        self._api_url = api_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._api_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "polyforge-python/1.0.0",
            },
            timeout=timeout,
        )

    # -- helpers --

    async def _get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        resp = await self._client.get(path, params=_strip_none(params or {}))
        _raise_for_status(resp)
        return resp.json()

    async def _post(self, path: str, *, json: dict[str, Any] | None = None) -> Any:
        resp = await self._client.post(path, json=json or {})
        _raise_for_status(resp)
        return resp.json()

    async def _delete(self, path: str) -> Any:
        resp = await self._client.delete(path)
        _raise_for_status(resp)
        return resp.json()

    # -- Markets --

    async def list_markets(
        self,
        *,
        search: str | None = None,
        category: str | None = None,
        limit: int = 10,
        page: int = 1,
    ) -> PaginatedResponse[Market]:
        data = await self._get(
            "/api/v1/markets",
            params={"search": search, "category": category, "limit": limit, "page": page},
        )
        # Backend returns PaginatedResponse<Market> with 'data' field
        items = [_parse(Market, m) for m in data["data"]]
        return PaginatedResponse(
            items=items,
            total=data["total"],
            page=data["page"],
            limit=data["limit"],
            has_more=data["hasNext"],
        )

    async def get_market(self, market_id: str) -> Market:
        return _parse(Market, await self._get(f"/api/v1/markets/{market_id}"))

    # -- Strategies --

    async def list_strategies(self, *, status: str | None = None) -> list[Strategy]:
        data = await self._get("/api/v1/strategies", params={"status": status})
        # Backend returns PaginatedResponse<Strategy> with 'data' field
        items = data["data"]
        return [_parse(Strategy, s) for s in items]

    async def get_strategy(self, strategy_id: str) -> Strategy:
        return _parse(Strategy, await self._get(f"/api/v1/strategies/{strategy_id}"))

    async def create_strategy(self, name: str, description: str | None = None) -> Strategy:
        return _parse(Strategy, await self._post("/api/v1/strategies", json={"name": name, "description": description or ""}))

    async def create_strategy_from_description(self, description: str, market_id: str | None = None) -> Strategy:
        body: dict[str, Any] = {"description": description}
        if market_id is not None:
            body["market_id"] = market_id
        return _parse(Strategy, await self._post("/api/v1/strategies/from-description", json=body))

    async def start_strategy(self, strategy_id: str, mode: str = "paper") -> Strategy:
        return _parse(Strategy, await self._post(f"/api/v1/strategies/{strategy_id}/start", json={"mode": mode}))

    async def stop_strategy(self, strategy_id: str) -> Strategy:
        return _parse(Strategy, await self._post(f"/api/v1/strategies/{strategy_id}/stop"))

    async def get_strategy_templates(self) -> list[StrategyTemplate]:
        data = await self._get("/api/v1/strategies/templates")
        # Backend returns PaginatedResponse<StrategyTemplate> with 'data' field
        items = data["data"]
        return [_parse(StrategyTemplate, t) for t in items]

    async def export_strategy(self, strategy_id: str) -> dict:
        return await self._get(f"/api/v1/strategies/{strategy_id}/export")

    # -- Portfolio & Orders --

    async def get_portfolio(self) -> Portfolio:
        return _parse(Portfolio, await self._get("/api/v1/portfolio"))

    async def get_orders(self, *, limit: int = 20, status: str | None = None) -> list[Order]:
        data = await self._get("/api/v1/orders", params={"limit": limit, "status": status})
        # Backend returns PaginatedResponse<Order> with 'data' field
        items = data["data"]
        return [_parse(Order, o) for o in items]

    async def get_score(self) -> TraderScore:
        return _parse(TraderScore, await self._get("/api/v1/score"))

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
        return await self._delete(f"/api/v1/orders/{order_id}")

    # -- Social & Signals --

    async def get_whale_feed(self, *, min_size: int = 10000) -> list[WhaleTrade]:
        data = await self._get("/api/v1/whale-feed", params={"min_size": min_size})
        # Backend returns PaginatedResponse<WhaleTrade> with 'data' field
        items = data["data"]
        return [_parse(WhaleTrade, w) for w in items]

    async def get_news_signals(self, *, min_confidence: int = 70) -> list[NewsSignal]:
        data = await self._get("/api/v1/news-signals", params={"min_confidence": min_confidence})
        # Backend returns PaginatedResponse<NewsSignal> with 'data' field
        items = data["data"]
        return [_parse(NewsSignal, s) for s in items]

    # -- Configuration --

    async def list_alerts(self) -> list[Alert]:
        data = await self._get("/api/v1/alerts")
        # Backend returns PaginatedResponse<Alert> with 'data' field
        items = data["data"]
        return [_parse(Alert, a) for a in items]

    async def list_copy_configs(self) -> list[CopyConfig]:
        data = await self._get("/api/v1/copy-configs")
        # Backend returns PaginatedResponse<CopyConfig> with 'data' field
        items = data["data"]
        return [_parse(CopyConfig, c) for c in items]

    async def list_webhooks(self) -> list[Webhook]:
        data = await self._get("/api/v1/webhooks")
        # Backend returns PaginatedResponse<Webhook> with 'data' field
        items = data["data"]
        return [_parse(Webhook, w) for w in items]

    async def create_webhook(self, url: str, events: list[str]) -> Webhook:
        return _parse(Webhook, await self._post("/api/v1/webhooks", json={"url": url, "events": events}))

    # -- AI --

    async def ai_query(self, query: str) -> AiQueryResponse:
        return _parse(AiQueryResponse, await self._post("/api/v1/ai/query", json={"query": query}))

    # -- Lifecycle --

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> AsyncPolyforgeClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
