"""WebSocket client helpers for the Polyforge ``/ws`` gateway."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass
from types import TracebackType
from typing import Any, Literal
from urllib.parse import urlencode, urlparse, urlunparse


WsMessage = dict[str, Any]
WsAuthMode = Literal["cookie", "query"]


@dataclass
class WsEvent:
    """A generic server-to-client WebSocket event."""

    type: str
    data: Any = None
    timestamp: int | None = None
    raw: WsMessage | None = None


@dataclass
class WsPriceUpdate(WsEvent):
    """A token price update from ``SUBSCRIBE_PRICES``."""

    token_id: str = ""
    price: Any = None
    type: str = "PRICE_UPDATE"


@dataclass
class WsWhaleTrade(WsEvent):
    """A whale trade event from ``SUBSCRIBE_WHALES``."""

    type: str = "WHALE_TRADE"


def _build_ws_url(api_url: str, token: str | None = None) -> str:
    """Build the authenticated ``/ws`` gateway URL from the REST API URL."""
    parsed = urlparse(api_url.rstrip("/"))
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return urlunparse(
        (
            scheme,
            parsed.netloc,
            "/ws",
            "",
            urlencode({"token": token}) if token else "",
            "",
        )
    )


def _create_connection(
    url: str,
    *,
    timeout: float | None = None,
    header: list[str] | None = None,
    cookie: str | None = None,
    origin: str | None = None,
) -> Any:
    try:
        import websocket
    except ImportError as exc:  # pragma: no cover - exercised only without dependency installed
        raise RuntimeError(
            "WebSocket support requires the 'websocket-client' package. "
            "Install polyforge with its runtime dependencies."
        ) from exc
    return websocket.create_connection(
        url,
        timeout=timeout,
        header=header,
        cookie=cookie,
        origin=origin,
    )


def _parse_event(message: WsMessage) -> WsEvent:
    event_type = message["type"]
    data = message.get("data")
    timestamp = message.get("timestamp")
    if not isinstance(timestamp, int):
        timestamp = None

    if event_type == "PRICE_UPDATE":
        payload = data if isinstance(data, dict) else message
        return WsPriceUpdate(
            data=data,
            timestamp=timestamp,
            raw=message,
            token_id=str(payload.get("tokenId", "")),
            price=payload.get("price"),
        )
    if event_type == "WHALE_TRADE":
        return WsWhaleTrade(data=data, timestamp=timestamp, raw=message)
    return WsEvent(type=event_type, data=data, timestamp=timestamp, raw=message)


class PolyforgeWebSocketClient:
    """Synchronous client for the Polyforge native WebSocket gateway.

    The platform gateway authenticates non-browser clients with the
    ``pf_token`` cookie by default and accepts JSON messages such as
    ``SUBSCRIBE_PRICES``, ``SUBSCRIBE_WHALES``, and ``PING``.
    """

    def __init__(
        self,
        *,
        token: str,
        api_url: str = "https://api.polyforge.app",
        timeout: float | None = None,
        origin: str | None = None,
        auth_mode: WsAuthMode = "cookie",
    ) -> None:
        if not token:
            raise ValueError("token is required")
        if auth_mode not in ("cookie", "query"):
            raise ValueError("auth_mode must be 'cookie' or 'query'")
        self._token = token
        self._auth_mode = auth_mode
        self._url = _build_ws_url(api_url, token if auth_mode == "query" else None)
        self._timeout = timeout
        self._origin = origin
        self._ws: Any | None = None
        self._price_subscriptions: set[str] = set()
        self._strategy_subscriptions: set[str] = set()
        self._whale_subscribed = False

    @property
    def url(self) -> str:
        return self._url

    def __enter__(self) -> "PolyforgeWebSocketClient":
        return self.connect()

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()

    def connect(self) -> "PolyforgeWebSocketClient":
        cookie = f"pf_token={self._token}" if self._auth_mode == "cookie" else None
        self._ws = _create_connection(
            self._url,
            timeout=self._timeout,
            cookie=cookie,
            origin=self._origin,
        )
        self._send_subscription_state()
        return self

    def reconnect(self) -> "PolyforgeWebSocketClient":
        self.close()
        return self.connect()

    def close(self) -> None:
        if self._ws is not None:
            self._ws.close()
            self._ws = None

    def send(self, message: WsMessage) -> None:
        if self._ws is None:
            raise RuntimeError("WebSocket is not connected")
        self._ws.send(json.dumps(message))

    def receive(self) -> WsMessage:
        if self._ws is None:
            raise RuntimeError("WebSocket is not connected")
        while True:
            raw = self._ws.recv()
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            try:
                message = json.loads(str(raw))
            except json.JSONDecodeError:
                continue
            if isinstance(message, dict) and isinstance(message.get("type"), str):
                return message

    def iter_messages(self) -> Iterator[WsMessage]:
        while True:
            try:
                yield self.receive()
            except StopIteration:
                return

    def receive_event(self) -> WsEvent:
        return _parse_event(self.receive())

    def iter_events(self) -> Iterator[WsEvent]:
        for message in self.iter_messages():
            yield _parse_event(message)

    def subscribe_prices(self, token_ids: list[str]) -> None:
        self._price_subscriptions.update(token_ids)
        self.send({"type": "SUBSCRIBE_PRICES", "tokenIds": token_ids})

    def unsubscribe_prices(self, token_ids: list[str]) -> None:
        for token_id in token_ids:
            self._price_subscriptions.discard(token_id)
        self.send({"type": "UNSUBSCRIBE_PRICES", "tokenIds": token_ids})

    def subscribe_whales(self) -> None:
        self._whale_subscribed = True
        self.send({"type": "SUBSCRIBE_WHALES"})

    def unsubscribe_whales(self) -> None:
        self._whale_subscribed = False
        self.send({"type": "UNSUBSCRIBE_WHALES"})

    def subscribe_strategy(self, strategy_id: str) -> None:
        self._strategy_subscriptions.add(strategy_id)
        self.send({"type": "SUBSCRIBE_STRATEGY", "strategyId": strategy_id})

    def unsubscribe_strategy(self, strategy_id: str) -> None:
        self._strategy_subscriptions.discard(strategy_id)
        self.send({"type": "UNSUBSCRIBE_STRATEGY", "strategyId": strategy_id})

    def ping(self) -> None:
        self.send({"type": "PING"})

    def _send_subscription_state(self) -> None:
        if self._price_subscriptions:
            self.send({
                "type": "SUBSCRIBE_PRICES",
                "tokenIds": sorted(self._price_subscriptions),
            })
        for strategy_id in sorted(self._strategy_subscriptions):
            self.send({"type": "SUBSCRIBE_STRATEGY", "strategyId": strategy_id})
        if self._whale_subscribed:
            self.send({"type": "SUBSCRIBE_WHALES"})


class AsyncPolyforgeWebSocketClient:
    """Async wrapper around :class:`PolyforgeWebSocketClient`."""

    def __init__(
        self,
        *,
        token: str,
        api_url: str = "https://api.polyforge.app",
        timeout: float | None = None,
        origin: str | None = None,
        auth_mode: WsAuthMode = "cookie",
    ) -> None:
        self._client = PolyforgeWebSocketClient(
            token=token,
            api_url=api_url,
            timeout=timeout,
            origin=origin,
            auth_mode=auth_mode,
        )

    @property
    def url(self) -> str:
        return self._client.url

    async def __aenter__(self) -> "AsyncPolyforgeWebSocketClient":
        await self.connect()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        await self.close()

    async def connect(self) -> "AsyncPolyforgeWebSocketClient":
        await asyncio.to_thread(self._client.connect)
        return self

    async def reconnect(self) -> "AsyncPolyforgeWebSocketClient":
        await asyncio.to_thread(self._client.reconnect)
        return self

    async def close(self) -> None:
        await asyncio.to_thread(self._client.close)

    async def send(self, message: WsMessage) -> None:
        await asyncio.to_thread(self._client.send, message)

    async def receive(self) -> WsMessage:
        return await asyncio.to_thread(self._client.receive)

    async def receive_event(self) -> WsEvent:
        return await asyncio.to_thread(self._client.receive_event)

    async def iter_messages(self) -> AsyncIterator[WsMessage]:
        while True:
            try:
                yield await self.receive()
            except StopIteration:
                return

    async def iter_events(self) -> AsyncIterator[WsEvent]:
        async for message in self.iter_messages():
            yield _parse_event(message)

    async def subscribe_prices(self, token_ids: list[str]) -> None:
        await asyncio.to_thread(self._client.subscribe_prices, token_ids)

    async def unsubscribe_prices(self, token_ids: list[str]) -> None:
        await asyncio.to_thread(self._client.unsubscribe_prices, token_ids)

    async def subscribe_whales(self) -> None:
        await asyncio.to_thread(self._client.subscribe_whales)

    async def unsubscribe_whales(self) -> None:
        await asyncio.to_thread(self._client.unsubscribe_whales)

    async def subscribe_strategy(self, strategy_id: str) -> None:
        await asyncio.to_thread(self._client.subscribe_strategy, strategy_id)

    async def unsubscribe_strategy(self, strategy_id: str) -> None:
        await asyncio.to_thread(self._client.unsubscribe_strategy, strategy_id)

    async def ping(self) -> None:
        await asyncio.to_thread(self._client.ping)
