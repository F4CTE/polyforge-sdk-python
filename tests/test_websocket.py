import json

import pytest

from polyforge.websocket import (
    PolyforgeWebSocketClient,
    WsEvent,
    WsPriceUpdate,
    WsWhaleTrade,
    _build_ws_url,
)


class FakeSocket:
    def __init__(self, messages=None):
        self.sent = []
        self.closed = False
        self.messages = list(messages or [])

    def send(self, payload):
        self.sent.append(payload)

    def recv(self):
        if not self.messages:
            raise StopIteration
        return self.messages.pop(0)

    def close(self):
        self.closed = True


def test_build_ws_url_uses_ws_scheme_and_token_query():
    assert _build_ws_url("https://api.polyforge.app/api/v1") == "wss://api.polyforge.app/ws"
    assert (
        _build_ws_url("https://api.polyforge.app/api/v1", "jwt-token")
        == "wss://api.polyforge.app/ws?token=jwt-token"
    )
    assert (
        _build_ws_url("http://localhost:3002", "jwt token")
        == "ws://localhost:3002/ws?token=jwt+token"
    )


def test_sync_client_connects_with_websocket_client_dependency(monkeypatch):
    created = {}
    socket = FakeSocket()

    def fake_create_connection(url, timeout=None, header=None, cookie=None, origin=None):
        created["url"] = url
        created["timeout"] = timeout
        created["header"] = header
        created["cookie"] = cookie
        created["origin"] = origin
        return socket

    monkeypatch.setattr("polyforge.websocket._create_connection", fake_create_connection)

    client = PolyforgeWebSocketClient(
        token="jwt-token",
        api_url="https://api.polyforge.app/api/v1",
        timeout=7.5,
        origin="https://app.polyforge.app",
    )

    assert client.connect() is client
    assert created["url"] == "wss://api.polyforge.app/ws"
    assert created["timeout"] == 7.5
    assert created["cookie"] == "pf_token=jwt-token"
    assert created["origin"] == "https://app.polyforge.app"


def test_sync_client_can_use_query_token_auth_for_compatibility(monkeypatch):
    created = {}
    socket = FakeSocket()

    def fake_create_connection(url, timeout=None, header=None, cookie=None, origin=None):
        created["url"] = url
        created["cookie"] = cookie
        return socket

    monkeypatch.setattr("polyforge.websocket._create_connection", fake_create_connection)

    client = PolyforgeWebSocketClient(token="jwt-token", auth_mode="query").connect()

    assert client.url == "wss://api.polyforge.app/ws?token=jwt-token"
    assert created["url"] == "wss://api.polyforge.app/ws?token=jwt-token"
    assert created["cookie"] is None


def test_sync_client_sends_gateway_subscription_messages(monkeypatch):
    socket = FakeSocket()
    monkeypatch.setattr("polyforge.websocket._create_connection", lambda *args, **kwargs: socket)

    client = PolyforgeWebSocketClient(token="jwt-token").connect()
    client.subscribe_prices(["token-a", "token-b"])
    client.unsubscribe_prices(["token-a"])
    client.subscribe_whales()
    client.unsubscribe_whales()
    client.ping()

    assert [json.loads(payload) for payload in socket.sent] == [
        {"type": "SUBSCRIBE_PRICES", "tokenIds": ["token-a", "token-b"]},
        {"type": "UNSUBSCRIBE_PRICES", "tokenIds": ["token-a"]},
        {"type": "SUBSCRIBE_WHALES"},
        {"type": "UNSUBSCRIBE_WHALES"},
        {"type": "PING"},
    ]


def test_sync_client_tracks_subscriptions_across_reconnect(monkeypatch):
    first_socket = FakeSocket()
    second_socket = FakeSocket()
    sockets = [first_socket, second_socket]
    monkeypatch.setattr("polyforge.websocket._create_connection", lambda *args, **kwargs: sockets.pop(0))

    client = PolyforgeWebSocketClient(token="jwt-token").connect()
    client.subscribe_prices(["token-a"])
    client.subscribe_whales()
    client.reconnect()

    assert first_socket.closed is True
    assert [json.loads(payload) for payload in second_socket.sent] == [
        {"type": "SUBSCRIBE_PRICES", "tokenIds": ["token-a"]},
        {"type": "SUBSCRIBE_WHALES"},
    ]


def test_sync_client_iter_messages_returns_decoded_gateway_events(monkeypatch):
    socket = FakeSocket(
        [
            "not-json",
            json.dumps({"type": "AUTH_OK", "timestamp": 1}),
            json.dumps({"type": "PRICE_UPDATE", "data": {"tokenId": "t1", "price": 0.42}}),
            json.dumps({"type": "WHALE_TRADE", "data": {"walletAddress": "0xabc"}}),
        ]
    )
    monkeypatch.setattr("polyforge.websocket._create_connection", lambda *args, **kwargs: socket)

    client = PolyforgeWebSocketClient(token="jwt-token").connect()

    assert [msg["type"] for msg in client.iter_messages()] == [
        "AUTH_OK",
        "PRICE_UPDATE",
        "WHALE_TRADE",
    ]


def test_sync_client_receive_event_models_known_gateway_events(monkeypatch):
    socket = FakeSocket(
        [
            json.dumps({"type": "PRICE_UPDATE", "data": {"tokenId": "t1", "price": "0.42"}, "timestamp": 11}),
            json.dumps({"type": "WHALE_TRADE", "data": {"walletAddress": "0xabc"}, "timestamp": 12}),
            json.dumps({"type": "NOTIFICATION", "data": {"title": "Broadcast"}, "timestamp": 13}),
        ]
    )
    monkeypatch.setattr("polyforge.websocket._create_connection", lambda *args, **kwargs: socket)

    client = PolyforgeWebSocketClient(token="jwt-token").connect()

    price = client.receive_event()
    whale = client.receive_event()
    notification = client.receive_event()

    assert price == WsPriceUpdate(
        data={"tokenId": "t1", "price": "0.42"},
        timestamp=11,
        raw=price.raw,
        token_id="t1",
        price="0.42",
    )
    raw = price.raw
    assert raw is not None
    assert raw["type"] == "PRICE_UPDATE"
    assert whale == WsWhaleTrade(data={"walletAddress": "0xabc"}, timestamp=12, raw=whale.raw)
    assert notification == WsEvent(type="NOTIFICATION", data={"title": "Broadcast"}, timestamp=13, raw=notification.raw)


def test_sync_client_closes_underlying_socket(monkeypatch):
    socket = FakeSocket()
    monkeypatch.setattr("polyforge.websocket._create_connection", lambda *args, **kwargs: socket)

    client = PolyforgeWebSocketClient(token="jwt-token").connect()
    client.close()

    assert socket.closed is True


@pytest.mark.asyncio
async def test_async_client_can_subscribe_and_read_without_blocking_event_loop(monkeypatch):
    from polyforge.websocket import AsyncPolyforgeWebSocketClient

    socket = FakeSocket([json.dumps({"type": "PONG", "timestamp": 1})])
    monkeypatch.setattr("polyforge.websocket._create_connection", lambda *args, **kwargs: socket)
    to_thread_calls = []

    async def fake_to_thread(func, *args, **kwargs):
        to_thread_calls.append(func.__name__)
        return func(*args, **kwargs)

    monkeypatch.setattr("polyforge.websocket.asyncio.to_thread", fake_to_thread)

    async with AsyncPolyforgeWebSocketClient(token="jwt-token") as client:
        await client.subscribe_prices(["token-a"])
        message = await client.receive()

    assert json.loads(socket.sent[0]) == {
        "type": "SUBSCRIBE_PRICES",
        "tokenIds": ["token-a"],
    }
    assert message == {"type": "PONG", "timestamp": 1}
    assert socket.closed is True
    assert to_thread_calls == ["connect", "subscribe_prices", "receive", "close"]


@pytest.mark.asyncio
async def test_async_client_tracks_subscriptions_across_reconnect(monkeypatch):
    from polyforge.websocket import AsyncPolyforgeWebSocketClient

    first_socket = FakeSocket()
    second_socket = FakeSocket()
    sockets = [first_socket, second_socket]
    monkeypatch.setattr("polyforge.websocket._create_connection", lambda *args, **kwargs: sockets.pop(0))
    to_thread_calls = []

    async def fake_to_thread(func, *args, **kwargs):
        to_thread_calls.append(func.__name__)
        return func(*args, **kwargs)

    monkeypatch.setattr("polyforge.websocket.asyncio.to_thread", fake_to_thread)

    async with AsyncPolyforgeWebSocketClient(token="jwt-token") as client:
        await client.subscribe_prices(["token-a"])
        await client.subscribe_strategy("strategy-a")
        await client.subscribe_whales()
        await client.reconnect()

    assert first_socket.closed is True
    assert [json.loads(payload) for payload in second_socket.sent] == [
        {"type": "SUBSCRIBE_PRICES", "tokenIds": ["token-a"]},
        {"type": "SUBSCRIBE_STRATEGY", "strategyId": "strategy-a"},
        {"type": "SUBSCRIBE_WHALES"},
    ]
    assert second_socket.closed is True
    assert to_thread_calls == [
        "connect",
        "subscribe_prices",
        "subscribe_strategy",
        "subscribe_whales",
        "reconnect",
        "close",
    ]
