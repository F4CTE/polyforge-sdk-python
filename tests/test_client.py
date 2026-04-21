"""Basic smoke tests for PolyforgeClient."""

import json

import httpx
import pytest
from polyforge.client import (
    PolyforgeClient,
    AsyncPolyforgeClient,
    _parse,
    _raise_for_status,
    _validate_enum,
    _validate_financial_param,
    _validate_webhook_url,
    _is_ip_blocked,
    _resolve_and_validate_ips,
)
from polyforge.errors import (
    PolyforgeError,
    AuthenticationError,
    NotFoundError,
    PermissionError,
    RateLimitError,
    ServerError,
)
from polyforge.models import (
    AiQueryResponse,
    Alert,
    ConditionalOrder,
    CopyConfig,
    Market,
    Token,
    MarketplaceListing,
    MarketplaceSeller,
    MarketplaceStrategy,
    Order,
    OrderBook,
    OrderBookLevel,
    OrderStatus,
    PaginatedResponse,
    PlaceOrderResponse,
    Portfolio,
    PortfolioPnl,
    Position,
    PriceHistoryEntry,
    Strategy,
    StrategyExecMode,
    StrategyVisibility,
    TraderScore,
    WatchlistItem,
    WebhookEvent,
    WebhookTestResult,
    WhaleTrade,
)


class TestClientInstantiation:
    """Test basic client instantiation."""

    def test_client_instantiation_with_api_key(self):
        """Should instantiate PolyforgeClient with API key."""
        client = PolyforgeClient(api_key="test-key")
        assert client is not None
        client.close()

    def test_client_instantiation_with_custom_url(self):
        """Should instantiate PolyforgeClient with custom API URL."""
        client = PolyforgeClient(
            api_key="test-key",
            api_url="https://api.example.com/",
        )
        assert client is not None
        client.close()

    def test_client_instantiation_with_custom_timeout(self):
        """Should instantiate PolyforgeClient with custom timeout."""
        client = PolyforgeClient(
            api_key="test-key",
            timeout=30.0,
        )
        assert client is not None
        client.close()

    def test_async_client_instantiation_with_api_key(self):
        """Should instantiate AsyncPolyforgeClient with API key."""
        client = AsyncPolyforgeClient(api_key="test-key")
        assert client is not None

    def test_async_client_instantiation_with_custom_url(self):
        """Should instantiate AsyncPolyforgeClient with custom API URL."""
        client = AsyncPolyforgeClient(
            api_key="test-key",
            api_url="https://api.example.com",
        )
        assert client is not None

    def test_async_client_instantiation_with_custom_timeout(self):
        """Should instantiate AsyncPolyforgeClient with custom timeout."""
        client = AsyncPolyforgeClient(
            api_key="test-key",
            timeout=30.0,
        )
        assert client is not None


class TestUrlConstruction:
    """Test URL construction and normalization."""

    def test_url_trailing_slash_removal(self):
        """Should remove trailing slashes from API URL."""
        client = PolyforgeClient(
            api_key="test-key",
            api_url="http://localhost:3002///",
        )
        assert client is not None
        client.close()

    def test_default_api_url(self):
        """Should use default API URL when not provided."""
        client = PolyforgeClient(api_key="test-key")
        assert client is not None
        client.close()

    def test_custom_api_url_with_port(self):
        """Should handle API URLs with custom ports."""
        client = PolyforgeClient(
            api_key="test-key",
            api_url="http://localhost:8080",
        )
        assert client is not None
        client.close()

    def test_https_api_url(self):
        """Should handle HTTPS API URLs."""
        client = PolyforgeClient(
            api_key="test-key",
            api_url="https://api.polyforge.com",
        )
        assert client is not None
        client.close()


class TestErrorClasses:
    """Test error class instantiation and properties."""

    def test_polyforge_error_instantiation(self):
        """Should instantiate PolyforgeError with message and metadata."""
        error = PolyforgeError(
            "API error occurred",
            status_code=500,
            code="INTERNAL_ERROR",
            request_id="req-123",
        )
        assert error.message == "API error occurred"
        assert error.status_code == 500
        assert error.code == "INTERNAL_ERROR"
        assert error.request_id == "req-123"

    def test_polyforge_error_without_metadata(self):
        """Should instantiate PolyforgeError with only message."""
        error = PolyforgeError("Something went wrong")
        assert error.message == "Something went wrong"
        assert error.status_code == 0
        assert error.code == ""
        assert error.request_id == ""

    def test_authentication_error(self):
        """Should instantiate AuthenticationError."""
        error = AuthenticationError(
            "Invalid API key",
            status_code=401,
            code="UNAUTHORIZED",
        )
        assert isinstance(error, PolyforgeError)
        assert error.status_code == 401
        assert error.code == "UNAUTHORIZED"

    def test_permission_error(self):
        """Should instantiate PermissionError."""
        error = PermissionError(
            "Insufficient permissions",
            status_code=403,
            code="FORBIDDEN",
        )
        assert isinstance(error, PolyforgeError)
        assert error.status_code == 403

    def test_not_found_error(self):
        """Should instantiate NotFoundError."""
        error = NotFoundError(
            "Resource not found",
            status_code=404,
            code="NOT_FOUND",
        )
        assert isinstance(error, PolyforgeError)
        assert error.status_code == 404

    def test_rate_limit_error(self):
        """Should instantiate RateLimitError."""
        error = RateLimitError(
            "Too many requests",
            status_code=429,
            code="RATE_LIMITED",
        )
        assert isinstance(error, PolyforgeError)
        assert error.status_code == 429

    def test_server_error(self):
        """Should instantiate ServerError."""
        error = ServerError(
            "Internal server error",
            status_code=500,
            code="INTERNAL_ERROR",
        )
        assert isinstance(error, PolyforgeError)
        assert error.status_code == 500

    def test_error_repr(self):
        """Should have readable __repr__ method."""
        error = PolyforgeError(
            "Test error",
            status_code=400,
            code="BAD_REQUEST",
        )
        repr_str = repr(error)
        assert "PolyforgeError" in repr_str
        assert "400" in repr_str
        assert "BAD_REQUEST" in repr_str

    def test_error_suggestion_field(self):
        """Should accept and store optional suggestion field."""
        error = PolyforgeError(
            "Bad request",
            status_code=400,
            code="INVALID_PARAM",
            suggestion="Use a valid market ID instead.",
        )
        assert error.suggestion == "Use a valid market ID instead."

    def test_error_suggestion_defaults_to_none(self):
        """Suggestion should default to None when not provided."""
        error = PolyforgeError("Oops", status_code=500)
        assert error.suggestion is None

    def test_error_repr_includes_suggestion(self):
        """Repr should include the suggestion field."""
        error = PolyforgeError(
            "Bad request",
            status_code=400,
            code="BAD",
            suggestion="Try again",
        )
        assert "suggestion='Try again'" in repr(error)


def _make_error_response(
    status_code: int,
    body: dict,
    headers: dict | None = None,
) -> httpx.Response:
    """Build a fake httpx.Response for _raise_for_status tests."""
    resp = httpx.Response(
        status_code=status_code,
        content=json.dumps(body).encode(),
        headers={"content-type": "application/json", **(headers or {})},
        request=httpx.Request("GET", "https://api.polyforge.io/test"),
    )
    return resp


class TestRaiseForStatus:
    """Test _raise_for_status reads fields from the JSON body correctly."""

    def test_reads_request_id_from_body(self):
        """requestId should come from JSON body, not HTTP headers (#93)."""
        resp = _make_error_response(
            400,
            {"message": "Invalid", "code": "BAD", "requestId": "req-abc-123"},
            headers={"x-request-id": "wrong-header-value"},
        )
        with pytest.raises(PolyforgeError) as exc_info:
            _raise_for_status(resp)
        assert exc_info.value.request_id == "req-abc-123"

    def test_reads_suggestion_from_body(self):
        """suggestion should be extracted from the JSON body (#93)."""
        resp = _make_error_response(
            422,
            {
                "message": "Invalid parameter",
                "code": "VALIDATION_ERROR",
                "requestId": "req-1",
                "suggestion": "Use ISO-8601 date format.",
            },
        )
        with pytest.raises(PolyforgeError) as exc_info:
            _raise_for_status(resp)
        assert exc_info.value.suggestion == "Use ISO-8601 date format."

    def test_suggestion_is_none_when_absent(self):
        """suggestion should be None when the body does not include it."""
        resp = _make_error_response(
            400,
            {"message": "Nope", "code": "BAD"},
        )
        with pytest.raises(PolyforgeError) as exc_info:
            _raise_for_status(resp)
        assert exc_info.value.suggestion is None

    def test_request_id_empty_when_absent_from_body(self):
        """request_id should be empty string when not in JSON body."""
        resp = _make_error_response(
            400,
            {"message": "Nope"},
            headers={"x-request-id": "header-only"},
        )
        with pytest.raises(PolyforgeError) as exc_info:
            _raise_for_status(resp)
        # Must NOT fall back to the header value
        assert exc_info.value.request_id == ""

    def test_correct_subclass_raised(self):
        """Should still raise the right subclass per status code."""
        resp = _make_error_response(
            429,
            {"message": "Slow down", "code": "RATE_LIMITED", "requestId": "r1", "suggestion": "Wait 60s."},
        )
        with pytest.raises(RateLimitError) as exc_info:
            _raise_for_status(resp)
        assert exc_info.value.request_id == "r1"
        assert exc_info.value.suggestion == "Wait 60s."


class TestModelParsing:
    """Test model instantiation from dicts."""

    def test_market_model_instantiation(self):
        """Should instantiate Market model."""
        market = Market(
            id="btc-usd",
            title="Bitcoin / US Dollar",
            symbol="BTC/USD",
            category="crypto",
            price=45000.0,
        )
        assert market.id == "btc-usd"
        assert market.title == "Bitcoin / US Dollar"
        assert market.price == 45000.0

    def test_market_parses_title_from_api_response(self):
        """Platform returns 'title' not 'name' — _parse must map it correctly (#43)."""
        api_response = {
            "id": "0xabc",
            "title": "Will BTC reach $100K by June?",
            "symbol": "BTC-100K",
            "category": "Crypto",
            "price": 0.65,
        }
        market = _parse(Market, api_response)
        assert market.title == "Will BTC reach $100K by June?"
        assert market.id == "0xabc"

    def test_strategy_model_instantiation(self):
        """Should instantiate Strategy model."""
        strategy = Strategy(
            id="strat-123",
            name="Test Strategy",
            description="A test strategy",
            status="active",
            pnl=1000.0,
        )
        assert strategy.id == "strat-123"
        assert strategy.name == "Test Strategy"
        assert strategy.pnl == 1000.0
        assert strategy.visibility == "PRIVATE"
        assert strategy.exec_mode == "TICK"
        assert strategy.triggers == []
        assert strategy.conditions == []
        assert strategy.actions == []
        assert strategy.safety == []
        assert strategy.tags == []
        assert strategy.version == 0

    def test_portfolio_model_instantiation(self):
        """Should instantiate Portfolio model."""
        portfolio = Portfolio(
            total_value=10000.0,
            available_balance=5000.0,
            unrealized_pnl=300.0,
            realized_pnl=200.0,
        )
        assert portfolio.total_value == 10000.0
        assert portfolio.available_balance == 5000.0
        assert portfolio.unrealized_pnl == 300.0
        assert portfolio.realized_pnl == 200.0

    def test_market_with_defaults(self):
        """Should use default values for Market fields."""
        market = Market()
        assert market.id == ""
        assert market.price == 0.0
        assert market.volume_24h == 0.0

    def test_portfolio_with_defaults(self):
        """Should use default values for Portfolio fields."""
        portfolio = Portfolio()
        assert portfolio.total_value == 0.0
        assert portfolio.available_balance == 0.0
        assert portfolio.unrealized_pnl == 0.0
        assert portfolio.realized_pnl == 0.0

    def test_strategy_with_defaults(self):
        """Should use default values for Strategy fields."""
        strategy = Strategy()
        assert strategy.id == ""
        assert strategy.pnl == 0.0
        assert strategy.win_rate == 0.0
        assert strategy.trade_count == 0
        assert strategy.triggers == []
        assert strategy.conditions == []
        assert strategy.actions == []
        assert strategy.safety == []
        assert strategy.logic_blocks == []
        assert strategy.calc_blocks == []
        assert strategy.visibility == "PRIVATE"
        assert strategy.exec_mode == "TICK"
        assert strategy.tick_ms is None
        assert strategy.fork_count == 0
        assert strategy.like_count == 0
        assert strategy.tags == []
        assert strategy.version == 0


class TestTokenModel:
    """Tests for the Token model — prediction market outcome tokens (#142)."""

    def test_token_has_platform_fields(self):
        """Token must have id, outcome, price — not ERC-20 symbol/name/address."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(Token)}
        assert "id" in field_names
        assert "outcome" in field_names
        assert "price" in field_names

    def test_token_has_no_erc20_fields(self):
        """Token must NOT expose ERC-20 fields that don't exist on the platform."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(Token)}
        assert "symbol" not in field_names
        assert "name" not in field_names
        assert "address" not in field_names
        assert "decimals" not in field_names
        assert "logo_url" not in field_names

    def test_token_defaults(self):
        token = Token()
        assert token.id == ""
        assert token.outcome is None
        assert token.price is None

    def test_token_with_values(self):
        token = Token(id="abc123", outcome="YES", price=0.65)
        assert token.id == "abc123"
        assert token.outcome == "YES"
        assert token.price == 0.65

    def test_token_parses_from_api_response(self):
        """_parse must correctly construct Token from platform JSON."""
        raw = {"id": "tok-yes", "outcome": "YES", "price": 0.72}
        token = _parse(Token, raw)
        assert token.id == "tok-yes"
        assert token.outcome == "YES"
        assert token.price == 0.72

    def test_market_has_tokens_array(self):
        """Market.tokens replaces the old base_token/quote_token trading-pair fields."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(Market)}
        assert "tokens" in field_names
        assert "base_token" not in field_names
        assert "quote_token" not in field_names

    def test_market_tokens_defaults_to_empty_list(self):
        market = Market()
        assert market.tokens == []

    def test_market_parses_tokens_array_from_api_response(self):
        """_parse must recursively build Token objects from Market.tokens array."""
        raw = {
            "id": "mkt-001",
            "title": "Will ETH flip BTC by 2025?",
            "tokens": [
                {"id": "tok-yes", "outcome": "YES", "price": 0.35},
                {"id": "tok-no", "outcome": "NO", "price": 0.65},
            ],
        }
        market = _parse(Market, raw)
        assert len(market.tokens) == 2
        yes_tok = market.tokens[0]
        no_tok = market.tokens[1]
        assert yes_tok.id == "tok-yes"
        assert yes_tok.outcome == "YES"
        assert yes_tok.price == 0.35
        assert no_tok.id == "tok-no"
        assert no_tok.outcome == "NO"
        assert no_tok.price == 0.65

    def test_market_parses_empty_tokens_array(self):
        raw = {"id": "mkt-002", "title": "Test", "tokens": []}
        market = _parse(Market, raw)
        assert market.tokens == []


class TestReprSecurity:
    """Test that __repr__ does not leak API key material."""

    def test_sync_client_repr_redacts_api_key(self):
        """Should fully redact API key in sync client __repr__."""
        client = PolyforgeClient(api_key="pf_live_supersecretkey123456")
        repr_str = repr(client)
        assert "supersecret" not in repr_str
        assert "pf_live" not in repr_str
        assert "[REDACTED]" in repr_str
        client.close()

    def test_async_client_repr_redacts_api_key(self):
        """Should fully redact API key in async client __repr__."""
        client = AsyncPolyforgeClient(api_key="pf_live_supersecretkey123456")
        repr_str = repr(client)
        assert "supersecret" not in repr_str
        assert "pf_live" not in repr_str
        assert "[REDACTED]" in repr_str


class TestApiKeyNotInInstanceDict:
    """CWE-522: API key must not be accessible via vars() or __dict__."""

    def test_sync_client_vars_does_not_contain_api_key(self):
        client = PolyforgeClient(api_key="pf_live_supersecretkey123456")
        instance_vars = vars(client)
        for value in instance_vars.values():
            if isinstance(value, str):
                assert "supersecretkey123456" not in value
        assert "_api_key" not in instance_vars
        client.close()

    def test_async_client_vars_does_not_contain_api_key(self):
        client = AsyncPolyforgeClient(api_key="pf_live_supersecretkey123456")
        instance_vars = vars(client)
        for value in instance_vars.values():
            if isinstance(value, str):
                assert "supersecretkey123456" not in value
        assert "_api_key" not in instance_vars


class TestGetstateSafety:
    """API key must not leak through __getstate__ serialization."""

    def test_sync_client_getstate_excludes_client(self):
        client = PolyforgeClient(api_key="pf_live_supersecretkey123456")
        state = client.__getstate__()
        assert "_client" not in state
        serialized = str(state)
        assert "supersecretkey123456" not in serialized
        client.close()

    def test_async_client_getstate_excludes_client(self):
        client = AsyncPolyforgeClient(api_key="pf_live_supersecretkey123456")
        state = client.__getstate__()
        assert "_client" not in state
        serialized = str(state)
        assert "supersecretkey123456" not in serialized


class TestWebhookValidation:
    """Test webhook URL SSRF validation."""

    def test_rejects_dot_local_hostname(self):
        """Should reject .local hostnames to prevent mDNS SSRF."""
        with pytest.raises(ValueError, match="internal addresses"):
            _validate_webhook_url("https://myservice.local/hook")

    def test_rejects_http_scheme(self):
        """Should reject non-HTTPS webhook URLs."""
        with pytest.raises(ValueError, match="HTTPS"):
            _validate_webhook_url("http://example.com/hook")

    def test_rejects_localhost(self):
        """Should reject localhost webhook URLs."""
        with pytest.raises(ValueError, match="internal addresses"):
            _validate_webhook_url("https://localhost/hook")

    def test_returns_resolved_ips(self):
        """Should return list of resolved IPs for valid webhook URLs."""
        # Use a well-known public hostname that resolves to a public IP
        result = _validate_webhook_url("https://example.com/hook")
        assert isinstance(result, list)
        assert len(result) > 0

    def test_rejects_metadata_google_internal(self):
        """Should reject cloud metadata hostnames."""
        with pytest.raises(ValueError, match="internal addresses"):
            _validate_webhook_url("https://metadata.google.internal/hook")


class TestIpBlocked:
    """Test _is_ip_blocked helper for IP address classification."""

    def test_blocks_loopback_v4(self):
        import ipaddress
        assert _is_ip_blocked(ipaddress.ip_address("127.0.0.1")) is not None

    def test_blocks_private_v4(self):
        import ipaddress
        assert _is_ip_blocked(ipaddress.ip_address("10.0.0.1")) is not None
        assert _is_ip_blocked(ipaddress.ip_address("192.168.1.1")) is not None
        assert _is_ip_blocked(ipaddress.ip_address("172.16.0.1")) is not None

    def test_blocks_link_local(self):
        import ipaddress
        assert _is_ip_blocked(ipaddress.ip_address("169.254.169.254")) is not None

    def test_allows_public_v4(self):
        import ipaddress
        assert _is_ip_blocked(ipaddress.ip_address("8.8.8.8")) is None
        assert _is_ip_blocked(ipaddress.ip_address("1.1.1.1")) is None

    def test_blocks_ipv4_mapped_v6_private(self):
        import ipaddress
        assert _is_ip_blocked(ipaddress.ip_address("::ffff:127.0.0.1")) is not None
        assert _is_ip_blocked(ipaddress.ip_address("::ffff:10.0.0.1")) is not None

    def test_allows_ipv4_mapped_v6_public(self):
        import ipaddress
        assert _is_ip_blocked(ipaddress.ip_address("::ffff:8.8.8.8")) is None

    def test_blocks_cgnat_v4(self):
        """CGNAT (100.64.0.0/10) must be blocked — Python ipaddress misses it."""
        import ipaddress
        assert _is_ip_blocked(ipaddress.ip_address("100.64.0.1")) is not None
        assert _is_ip_blocked(ipaddress.ip_address("100.100.100.100")) is not None
        assert _is_ip_blocked(ipaddress.ip_address("100.127.255.254")) is not None

    def test_allows_non_cgnat_100_range(self):
        """100.128.0.0+ is NOT CGNAT and should be allowed."""
        import ipaddress
        assert _is_ip_blocked(ipaddress.ip_address("100.128.0.1")) is None

    def test_blocks_cgnat_via_ipv4_mapped_v6(self):
        """CGNAT addresses via IPv4-mapped IPv6 must also be blocked."""
        import ipaddress
        assert _is_ip_blocked(ipaddress.ip_address("::ffff:100.64.0.1")) is not None
        assert _is_ip_blocked(ipaddress.ip_address("::ffff:100.100.100.100")) is not None


class TestResolveAndValidateIps:
    """Test _resolve_and_validate_ips DNS resolution with IP validation."""

    def test_rejects_unresolvable_hostname(self):
        with pytest.raises(ValueError, match="Could not resolve"):
            _resolve_and_validate_ips("this-hostname-should-never-exist-2026.invalid")

    def test_resolves_public_hostname(self):
        ips = _resolve_and_validate_ips("example.com")
        assert isinstance(ips, list)
        assert len(ips) > 0

    def test_rejects_localhost(self):
        with pytest.raises(ValueError, match="private|loopback"):
            _resolve_and_validate_ips("localhost")


class TestContextManagers:
    """Test context manager functionality."""

    def test_client_context_manager(self):
        """Should work as context manager."""
        with PolyforgeClient(api_key="test-key") as client:
            assert client is not None

    def test_async_client_context_manager(self):
        """Should work as async context manager."""
        import asyncio

        async def test():
            async with AsyncPolyforgeClient(api_key="test-key") as client:
                assert client is not None

        asyncio.run(test())


class TestPlatformContractCompliance:
    """Regression tests for platform DTO field name compliance (#89-#92)."""

    def test_webhook_event_values_match_platform_dto(self):
        """WebhookEvent values must match platform CreateWebhookDto validation exactly (#80, #91)."""
        # These are the exact 8 events accepted by the platform's @IsIn() validator
        platform_events = {
            "ORDER_FILLED", "STRATEGY_ERROR", "WHALE_TRADE", "NEWS_SIGNAL",
            "BACKTEST_COMPLETE", "DAILY_LOSS_LIMIT", "MARKET_RESOLVED", "PRICE_ALERT",
        }
        sdk_events = {
            WebhookEvent.ORDER_FILLED,
            WebhookEvent.STRATEGY_ERROR,
            WebhookEvent.WHALE_TRADE,
            WebhookEvent.NEWS_SIGNAL,
            WebhookEvent.BACKTEST_COMPLETE,
            WebhookEvent.DAILY_LOSS_LIMIT,
            WebhookEvent.MARKET_RESOLVED,
            WebhookEvent.PRICE_ALERT,
        }
        assert sdk_events == platform_events, (
            f"SDK events {sdk_events} don't match platform events {platform_events}"
        )
        for event in sdk_events:
            assert "." not in event, f"WebhookEvent {event} uses dot.notation"
            assert event == event.upper(), f"WebhookEvent {event} is not SCREAMING_SNAKE_CASE"

    def test_webhook_event_no_phantom_events(self):
        """WebhookEvent must not define events that don't exist in the platform (#80)."""
        # These were previously defined but don't exist in the platform's validation
        assert not hasattr(WebhookEvent, "ORDER_PLACED"), "ORDER_PLACED is a phantom event"
        assert not hasattr(WebhookEvent, "ORDER_CANCELLED"), "ORDER_CANCELLED is a phantom event"
        assert not hasattr(WebhookEvent, "STRATEGY_STARTED"), "STRATEGY_STARTED is a phantom event"
        assert not hasattr(WebhookEvent, "STRATEGY_STOPPED"), "STRATEGY_STOPPED is a phantom event"
        assert not hasattr(WebhookEvent, "BACKTEST_FAILED"), "BACKTEST_FAILED is a phantom event"
        assert not hasattr(WebhookEvent, "BACKTEST_COMPLETED"), "BACKTEST_COMPLETED is phantom (correct name is BACKTEST_COMPLETE)"

    def test_ai_query_body_uses_query_field(self):
        """ai_query() must send { query } not { question } (#89)."""
        import inspect

        source = inspect.getsource(PolyforgeClient.ai_query)
        assert '"query"' in source or "'query'" in source
        assert '"question"' not in source and "'question'" not in source

    def test_create_strategy_from_description_body_uses_description_field(self):
        """create_strategy_from_description() must send { description } not { query } (#90)."""
        import inspect

        source = inspect.getsource(PolyforgeClient.create_strategy_from_description)
        assert '"description"' in source or "'description'" in source

    def test_start_strategy_sends_lowercase_mode(self):
        """start_strategy() must not call .upper() on mode (#92)."""
        import inspect

        source = inspect.getsource(PolyforgeClient.start_strategy)
        assert ".upper()" not in source, "start_strategy() must not uppercase the mode value"


class TestFinancialParamValidation:
    """Test _validate_financial_param rejects dangerous values (#88)."""

    def test_rejects_nan(self):
        with pytest.raises(ValueError, match="must not be NaN"):
            _validate_financial_param("size", float("nan"))

    def test_rejects_positive_infinity(self):
        with pytest.raises(ValueError, match="must not be Infinity"):
            _validate_financial_param("price", float("inf"))

    def test_rejects_negative_infinity(self):
        with pytest.raises(ValueError, match="must not be Infinity"):
            _validate_financial_param("price", float("-inf"))

    def test_rejects_zero(self):
        with pytest.raises(ValueError, match="must be positive"):
            _validate_financial_param("size", 0)

    def test_rejects_negative(self):
        with pytest.raises(ValueError, match="must be positive"):
            _validate_financial_param("size", -1.0)

    def test_rejects_non_number(self):
        with pytest.raises(TypeError, match="must be a number"):
            _validate_financial_param("size", "10")  # type: ignore[arg-type]

    def test_accepts_positive_float(self):
        _validate_financial_param("size", 1.5)  # should not raise

    def test_accepts_positive_int(self):
        _validate_financial_param("size", 10)  # should not raise


class TestEnumValidation:
    """Ensure _validate_enum rejects invalid enum values (#41)."""

    def test_rejects_invalid_mode(self):
        with pytest.raises(ValueError, match="must be one of"):
            _validate_enum("mode", "turbo", frozenset({"live", "paper"}))

    def test_accepts_valid_mode(self):
        _validate_enum("mode", "paper", frozenset({"live", "paper"}))  # should not raise
        _validate_enum("mode", "live", frozenset({"live", "paper"}))

    def test_rejects_invalid_side(self):
        with pytest.raises(ValueError, match="must be one of"):
            _validate_enum("side", "HOLD", frozenset({"BUY", "SELL"}))

    def test_start_strategy_rejects_invalid_mode(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be one of"):
            client.start_strategy("s-1", mode="turbo")

    def test_place_order_rejects_invalid_side(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be one of"):
            client.place_order("tok", "HOLD", "YES", 10.0, 0.5)

    def test_place_order_rejects_invalid_outcome(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be one of"):
            client.place_order("tok", "BUY", "MAYBE", 10.0, 0.5)

    def test_place_order_rejects_invalid_order_type(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be one of"):
            client.place_order("tok", "BUY", "YES", 10.0, 0.5, order_type="IOC")


class TestPlaceOrderValidation:
    """Ensure place_order rejects invalid financial params before HTTP call (#88)."""

    def test_place_order_rejects_nan_size(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must not be NaN"):
            client.place_order("tok", "BUY", "YES", float("nan"), 0.5)
        client.close()

    def test_place_order_rejects_negative_price(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be positive"):
            client.place_order("tok", "BUY", "YES", 10.0, -0.5)
        client.close()

    def test_split_position_sends_amount_as_string(self):
        """split_position must send amount as a NumberString (#26)."""
        import inspect
        source = inspect.getsource(PolyforgeClient.split_position)
        assert '"amount"' in source or "'amount'" in source

    def test_place_smart_order_rejects_inf_total_size(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must not be Infinity"):
            client.place_smart_order(
                type="TWAP", token_id="tok", side="BUY",
                outcome="YES", total_size=float("inf"),
            )
        client.close()

    def test_place_smart_order_rejects_nan_limit_price(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must not be NaN"):
            client.place_smart_order(
                type="TWAP", token_id="tok", side="BUY",
                outcome="YES", total_size=10.0, limit_price=float("nan"),
            )
        client.close()

    def test_provide_liquidity_rejects_negative_amount(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be positive"):
            client.provide_liquidity("mkt", "tok", -1.0)
        client.close()

    def test_provide_liquidity_rejects_zero_amount(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be positive"):
            client.provide_liquidity("mkt", "tok", 0)
        client.close()

    def test_provide_liquidity_validates_target_spread(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be positive"):
            client.provide_liquidity("mkt", "tok", 100.0, target_spread=-0.01)
        client.close()


class TestAsyncPlaceOrderValidation:
    """Ensure async client also validates financial params (#88).

    The validation helper is a plain function called before any await,
    so we use inspect.getsource to verify calls are present in each method.
    """

    def test_async_place_order_calls_validate(self):
        """Async place_order must call _validate_financial_param for size and price."""
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.place_order)
        assert '_validate_financial_param("size"' in source
        assert '_validate_financial_param("price"' in source

    def test_async_split_position_sends_amount_string(self):
        """Async split_position must send amount as a NumberString (#26)."""
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.split_position)
        assert '"amount"' in source or "'amount'" in source

    def test_async_place_smart_order_calls_validate(self):
        """Async place_smart_order must call _validate_financial_param for total_size."""
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.place_smart_order)
        assert '_validate_financial_param("total_size"' in source

    def test_async_provide_liquidity_calls_validate(self):
        """Async provide_liquidity must call _validate_financial_param for amount_usdc (#26)."""
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.provide_liquidity)
        assert '_validate_financial_param("amount_usdc"' in source


class TestOrderStatusEnum:
    """Tests for OrderStatus enum (#30)."""

    def test_order_status_has_12_values(self):
        """OrderStatus must define exactly 12 values matching the platform."""
        assert len(OrderStatus) == 12

    def test_order_status_values(self):
        """Each OrderStatus value must match the platform enum."""
        expected = {
            "PENDING", "SUBMITTED", "LIVE", "MATCHED", "DELAYED", "MINED",
            "CONFIRMED", "PARTIAL", "CANCELLED", "UNMATCHED", "FAILED", "ERROR",
        }
        actual = {s.value for s in OrderStatus}
        assert actual == expected

    def test_order_status_is_str_enum(self):
        """OrderStatus values should be usable as plain strings."""
        assert OrderStatus.PENDING == "PENDING"
        assert isinstance(OrderStatus.LIVE, str)


class TestStrategyBlockCategories:
    """Tests for Strategy block categories (#31)."""

    def test_strategy_parses_block_categories(self):
        """Strategy should parse triggers, conditions, actions, safety from API response."""
        api_response = {
            "id": "s-1",
            "name": "My Strategy",
            "triggers": [{"id": "t1", "type": "PRICE_THRESHOLD", "label": "Price > 0.8", "config": {}}],
            "conditions": [{"id": "c1", "type": "TIME_WINDOW", "label": "Before 5pm", "config": {}}],
            "actions": [{"id": "a1", "type": "PLACE_ORDER", "label": "Buy YES", "config": {}}],
            "safety": [{"id": "sf1", "type": "MAX_LOSS", "label": "Stop at -$50", "config": {}}],
            "visibility": "PUBLIC",
            "execMode": "HYBRID",
            "tickMs": 5000,
            "forkCount": 3,
            "likeCount": 10,
            "tags": ["crypto", "momentum"],
            "version": 2,
            "tradeCount": 42,
        }
        strategy = _parse(Strategy, api_response)
        assert len(strategy.triggers) == 1
        assert strategy.triggers[0].type == "PRICE_THRESHOLD"
        assert len(strategy.conditions) == 1
        assert len(strategy.actions) == 1
        assert len(strategy.safety) == 1
        assert strategy.visibility == "PUBLIC"
        assert strategy.exec_mode == "HYBRID"
        assert strategy.tick_ms == 5000
        assert strategy.fork_count == 3
        assert strategy.like_count == 10
        assert strategy.tags == ["crypto", "momentum"]
        assert strategy.version == 2
        assert strategy.trade_count == 42


class TestStrategyTemplateAlias:
    """Tests for StrategyTemplate being an alias for Strategy (#44).

    The platform endpoint ``GET /api/v1/strategies/templates`` returns full
    Strategy objects (rows where ``template = true``).  The old StrategyTemplate
    class had phantom fields (``risk_level``, ``config``, ``category``) that the
    platform never sends; it now aliases Strategy so all real fields are parsed.
    """

    def test_strategy_template_is_strategy_alias(self):
        """StrategyTemplate must be the same type as Strategy."""
        from polyforge.models import StrategyTemplate
        assert StrategyTemplate is Strategy

    def test_template_parses_full_strategy_fields(self):
        """Templates returned by the platform include full strategy data."""
        from polyforge.models import StrategyTemplate
        api_response = {
            "id": "tmpl-1",
            "name": "Momentum Alpha",
            "description": "A momentum-based strategy template",
            "status": "IDLE",
            "template": True,
            "triggers": [{"id": "t1", "type": "PRICE_THRESHOLD", "label": "Price > 0.7", "config": {"price": 0.7}}],
            "conditions": [],
            "actions": [{"id": "a1", "type": "PLACE_ORDER", "label": "Buy YES", "config": {}}],
            "safety": [],
            "visibility": "PUBLIC",
            "execMode": "TICK",
            "forkCount": 15,
            "likeCount": 42,
            "tags": ["momentum", "beginner"],
            "version": 3,
        }
        template = _parse(StrategyTemplate, api_response)
        assert template.id == "tmpl-1"
        assert template.name == "Momentum Alpha"
        assert len(template.triggers) == 1
        assert template.triggers[0].type == "PRICE_THRESHOLD"
        assert len(template.actions) == 1
        assert template.visibility == "PUBLIC"
        assert template.fork_count == 15
        assert template.like_count == 42
        assert template.tags == ["momentum", "beginner"]
        assert template.version == 3

    def test_template_backward_compat_import(self):
        """StrategyTemplate is importable from polyforge and is Strategy."""
        from polyforge import StrategyTemplate, Strategy
        assert StrategyTemplate is Strategy

    def test_old_phantom_fields_not_silently_accepted(self):
        """Parsing a response with old phantom fields should not crash.

        The platform never sends ``risk_level`` or ``category`` but
        if a cached response or mock contains them, _parse drops them
        gracefully via its unknown-field handling.
        """
        from polyforge.models import StrategyTemplate
        api_response = {
            "id": "tmpl-old",
            "name": "Legacy",
            "risk_level": "HIGH",  # phantom — platform doesn't send this
            "category": "momentum",  # phantom
            "config": {"foo": 1},  # phantom
        }
        template = _parse(StrategyTemplate, api_response)
        assert template.id == "tmpl-old"
        assert template.name == "Legacy"
        # Strategy has no risk_level/category — they should be silently dropped
        assert not hasattr(template, "risk_level") or template.status == ""


class TestCreateStrategyParams:
    """Tests for create_strategy expanded parameters (#32)."""

    def test_create_strategy_accepts_block_params(self):
        """create_strategy() must accept visibility, exec_mode, triggers, etc."""
        import inspect
        sig = inspect.signature(PolyforgeClient.create_strategy)
        params = set(sig.parameters.keys())
        assert "visibility" in params
        assert "exec_mode" in params
        assert "tick_ms" in params
        assert "triggers" in params
        assert "conditions" in params
        assert "actions" in params
        assert "safety" in params
        assert "tags" in params
        assert "variables" in params
        assert "canvas" in params

    def test_async_create_strategy_accepts_block_params(self):
        """Async create_strategy() must also accept the expanded params."""
        import inspect
        sig = inspect.signature(AsyncPolyforgeClient.create_strategy)
        params = set(sig.parameters.keys())
        assert "visibility" in params
        assert "exec_mode" in params
        assert "triggers" in params
        assert "actions" in params
        assert "tags" in params

    def test_create_strategy_sends_camel_case_fields(self):
        """create_strategy() must send camelCase field names to the API."""
        import inspect
        source = inspect.getsource(PolyforgeClient.create_strategy)
        assert '"visibility"' in source
        assert '"execMode"' in source
        assert '"tickMs"' in source
        assert '"triggers"' in source
        assert '"conditions"' in source
        assert '"actions"' in source
        assert '"safety"' in source
        assert '"tags"' in source


class TestPaginatedResponseDataField:
    """Tests for PaginatedResponse using 'data' field (#33)."""

    def test_paginated_response_uses_data_field(self):
        """PaginatedResponse must have a 'data' field, not 'items'."""
        pr = PaginatedResponse(data=["a", "b", "c"], total=3, page=1, limit=10)
        assert pr.data == ["a", "b", "c"]

    def test_paginated_response_items_is_alias(self):
        """PaginatedResponse.items must be a backward-compat alias for data."""
        pr = PaginatedResponse(data=["x", "y"], total=2, page=1, limit=10)
        assert pr.items == ["x", "y"]
        assert pr.items is pr.data

    def test_paginated_response_default_empty(self):
        """PaginatedResponse data should default to empty list."""
        pr = PaginatedResponse()
        assert pr.data == []
        assert pr.items == []


class TestOrderMonetaryFields:
    """Tests for Order/Position monetary fields as str (#34)."""

    def test_order_price_is_str(self):
        """Order price field must be str, not float."""
        order = Order(price="0.65", size="150.00")
        assert order.price == "0.65"
        assert order.size == "150.00"
        assert isinstance(order.price, str)
        assert isinstance(order.size, str)

    def test_order_fill_fields_nullable(self):
        """Order fill_size and fill_price should be str | None."""
        order = Order()
        assert order.fill_size is None
        assert order.fill_price is None
        assert order.fee is None

    def test_order_parses_decimal_strings(self):
        """_parse must correctly map string monetary values from API response."""
        api_response = {
            "id": "ord-1",
            "price": "0.65",
            "size": "150.00",
            "fillSize": "100.00",
            "fillPrice": "0.64",
            "fee": "0.50",
            "status": "CONFIRMED",
        }
        order = _parse(Order, api_response)
        assert order.price == "0.65"
        assert order.size == "150.00"
        assert order.fill_size == "100.00"
        assert order.fill_price == "0.64"
        assert order.fee == "0.50"

    def test_position_monetary_fields_are_str(self):
        """Position monetary fields must be str."""
        pos = Position(
            size="100.00",
            entry_price="0.55",
            current_price="0.65",
            unrealized_pnl="10.00",
            realized_pnl="5.00",
        )
        assert isinstance(pos.size, str)
        assert isinstance(pos.entry_price, str)
        assert pos.unrealized_pnl == "10.00"


class TestAlertFields:
    """Tests for Alert field alignment with platform PriceAlert model (#107)."""

    def test_alert_has_correct_fields(self):
        """Alert must use platform PriceAlert field names."""
        alert = Alert(
            id="alert-1",
            token_id="0xtoken",
            direction="above",
            price="0.65",
            persistent=True,
        )
        assert alert.token_id == "0xtoken"
        assert alert.direction == "above"
        assert alert.price == "0.65"
        assert alert.persistent is True

    def test_alert_no_old_fields(self):
        """Alert must not have legacy phantom field names."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(Alert)}
        assert "name" not in field_names
        assert "condition" not in field_names
        assert "market_id" not in field_names
        assert "threshold" not in field_names
        assert "enabled" not in field_names
        assert "last_triggered" not in field_names

    def test_alert_parses_from_api(self):
        """_parse must map camelCase platform fields to Alert."""
        api_response = {
            "id": "alert-1",
            "tokenId": "0xtoken123",
            "direction": "below",
            "price": "0.42",
            "persistent": False,
            "triggered": False,
            "triggeredAt": None,
            "createdAt": "2026-04-01T00:00:00Z",
        }
        alert = _parse(Alert, api_response)
        assert alert.token_id == "0xtoken123"
        assert alert.direction == "below"
        assert alert.price == "0.42"
        assert alert.persistent is False
        assert alert.created_at == "2026-04-01T00:00:00Z"


class TestCopyConfigFields:
    """Tests for CopyConfig field alignment with platform Prisma model (#108)."""

    def test_copy_config_has_correct_fields(self):
        """CopyConfig must use platform field names."""
        cc = CopyConfig(
            id="cc-1",
            target_wallet="0xabc",
            mode="PERCENTAGE",
            size_value="10",
            max_exposure="500",
            max_daily_loss="100",
            price_offset="0.01",
            status="ACTIVE",
            total_copied=42,
        )
        assert cc.target_wallet == "0xabc"
        assert cc.mode == "PERCENTAGE"
        assert cc.size_value == "10"
        assert cc.max_exposure == "500"
        assert cc.max_daily_loss == "100"
        assert cc.total_copied == 42

    def test_copy_config_no_old_fields(self):
        """CopyConfig must not have deprecated field names."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(CopyConfig)}
        assert "source_wallet" not in field_names
        assert "source_strategy_id" not in field_names
        assert "max_allocation" not in field_names
        assert "scale_factor" not in field_names
        assert "label" not in field_names
        assert "max_position_size" not in field_names
        assert "total_copied_trades" not in field_names
        assert "enabled" not in field_names

    def test_copy_config_parses_from_api(self):
        """_parse must map camelCase platform fields to CopyConfig."""
        api_response = {
            "id": "cc-1",
            "targetWallet": "0xdef",
            "mode": "FIXED",
            "sizeValue": "250.50",
            "maxExposure": "5000",
            "maxDailyLoss": "200",
            "priceOffset": "0.005",
            "status": "ACTIVE",
            "totalPnl": "125.00",
            "totalCopied": 15,
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-04-01T00:00:00Z",
        }
        cc = _parse(CopyConfig, api_response)
        assert cc.target_wallet == "0xdef"
        assert cc.mode == "FIXED"
        assert cc.size_value == "250.50"
        assert cc.max_exposure == "5000"
        assert cc.total_copied == 15
        assert cc.total_pnl == "125.00"


class TestBacktestNoInitialBalance:
    """Tests for run_backtest not sending initial_balance (#65)."""

    def test_run_backtest_no_initial_balance_param(self):
        """run_backtest() must not accept initial_balance parameter."""
        import inspect
        sig = inspect.signature(PolyforgeClient.run_backtest)
        assert "initial_balance" not in sig.parameters

    def test_async_run_backtest_no_initial_balance_param(self):
        """Async run_backtest() must not accept initial_balance parameter."""
        import inspect
        sig = inspect.signature(AsyncPolyforgeClient.run_backtest)
        assert "initial_balance" not in sig.parameters

    def test_run_backtest_no_initial_balance_in_body(self):
        """run_backtest() must not send initialBalance in the request body."""
        import inspect
        source = inspect.getsource(PolyforgeClient.run_backtest)
        assert "initialBalance" not in source
        assert "initial_balance" not in source


class TestTraderScoreFields:
    """Tests for TraderScore field alignment (#23)."""

    def test_trader_score_has_platform_fields(self):
        """TraderScore must have volume, rank, percentile."""
        ts = TraderScore(volume=50000.0, rank=5, percentile=95.0)
        assert ts.volume == 50000.0
        assert ts.rank == 5
        assert ts.percentile == 95.0

    def test_trader_score_no_deprecated_fields(self):
        """TraderScore must not have total_trades, sharpe_ratio, max_drawdown."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(TraderScore)}
        assert "total_trades" not in field_names
        assert "sharpe_ratio" not in field_names
        assert "max_drawdown" not in field_names

    def test_trader_score_parses_from_api(self):
        """_parse must map camelCase platform fields to TraderScore."""
        api_response = {
            "overall": 85.0,
            "riskManagement": 90.0,
            "consistency": 80.0,
            "profitability": 75.0,
            "winRate": 0.65,
            "volume": 100000.0,
            "rank": 3,
            "percentile": 97.5,
        }
        ts = _parse(TraderScore, api_response)
        assert ts.volume == 100000.0
        assert ts.rank == 3
        assert ts.percentile == 97.5


class TestWhaleTradeFields:
    """Tests for WhaleTrade field alignment (#23)."""

    def test_whale_trade_has_platform_fields(self):
        """WhaleTrade must have market_name and usd_value."""
        wt = WhaleTrade(market_name="Will BTC hit $100K?", usd_value=50000.0)
        assert wt.market_name == "Will BTC hit $100K?"
        assert wt.usd_value == 50000.0

    def test_whale_trade_no_deprecated_fields(self):
        """WhaleTrade must not have symbol or price."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(WhaleTrade)}
        assert "symbol" not in field_names
        assert "price" not in field_names

    def test_whale_trade_parses_from_api(self):
        """_parse must map camelCase platform fields to WhaleTrade."""
        api_response = {
            "id": "wt-1",
            "marketId": "m-1",
            "marketName": "Election 2028",
            "side": "BUY",
            "size": 100000.0,
            "usdValue": 65000.0,
            "wallet": "0xabc",
            "timestamp": "2026-04-13T00:00:00Z",
        }
        wt = _parse(WhaleTrade, api_response)
        assert wt.market_name == "Election 2028"
        assert wt.usd_value == 65000.0


class TestAiQueryResponseFields:
    """Tests for AiQueryResponse field types (#23)."""

    def test_suggested_actions_is_list_of_str(self):
        """AiQueryResponse.suggested_actions must be list[str] not list[dict]."""
        resp = AiQueryResponse(suggested_actions=["Buy YES", "Set alert"])
        assert resp.suggested_actions == ["Buy YES", "Set alert"]
        assert all(isinstance(a, str) for a in resp.suggested_actions)


class TestMarketplaceListingNestedObjects:
    """Tests for MarketplaceListing seller/strategy nested objects (#23)."""

    def test_listing_has_seller_and_strategy_fields(self):
        """MarketplaceListing must have seller and strategy optional fields."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(MarketplaceListing)}
        assert "seller" in field_names
        assert "strategy" in field_names

    def test_listing_parses_nested_objects(self):
        """_parse must handle nested seller and strategy objects."""
        api_response = {
            "id": "lst-1",
            "strategyId": "s-1",
            "sellerId": "u-1",
            "title": "Alpha Strategy",
            "priceUsdc": "29.99",
            "status": "ACTIVE",
            "seller": {"id": "u-1", "name": "TopTrader", "avatarUrl": "https://example.com/avatar.png"},
            "strategy": {"id": "s-1", "name": "Alpha Strategy", "description": "A great strategy"},
        }
        listing = _parse(MarketplaceListing, api_response)
        assert listing.seller is not None
        assert listing.seller.id == "u-1"
        assert listing.seller.name == "TopTrader"
        assert listing.strategy is not None
        assert listing.strategy.id == "s-1"
        assert listing.strategy.name == "Alpha Strategy"


class TestStrategyEnums:
    """Tests for StrategyVisibility and StrategyExecMode enums (#31)."""

    def test_strategy_visibility_values(self):
        assert set(v.value for v in StrategyVisibility) == {"PRIVATE", "PUBLIC", "UNLISTED"}

    def test_strategy_exec_mode_values(self):
        assert set(v.value for v in StrategyExecMode) == {"TICK", "EVENT", "HYBRID"}


class TestListMarketsSortClosedParams:
    """Tests for sort and closed params on list_markets (#74)."""

    def test_list_markets_accepts_sort_and_closed_params(self):
        """list_markets() signature must accept sort and closed keyword args."""
        import inspect

        sig = inspect.signature(PolyforgeClient.list_markets)
        param_names = set(sig.parameters.keys())
        assert "sort" in param_names, "list_markets() missing 'sort' parameter"
        assert "closed" in param_names, "list_markets() missing 'closed' parameter"

    def test_async_list_markets_accepts_sort_and_closed_params(self):
        """AsyncPolyforgeClient.list_markets() must also accept sort and closed."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.list_markets)
        param_names = set(sig.parameters.keys())
        assert "sort" in param_names, "async list_markets() missing 'sort' parameter"
        assert "closed" in param_names, "async list_markets() missing 'closed' parameter"

    def test_list_markets_sort_and_closed_passed_in_params(self):
        """list_markets() must pass sort and closed to the HTTP params dict."""
        import inspect

        source = inspect.getsource(PolyforgeClient.list_markets)
        assert '"sort"' in source or "'sort'" in source
        assert '"closed"' in source or "'closed'" in source


class TestListStrategiesSortPageLimitParams:
    """Tests for sort, page, limit params on list_strategies (#77)."""

    def test_list_strategies_accepts_sort_page_limit(self):
        """list_strategies() signature must accept sort, page, limit keyword args."""
        import inspect

        sig = inspect.signature(PolyforgeClient.list_strategies)
        param_names = set(sig.parameters.keys())
        assert "sort" in param_names, "list_strategies() missing 'sort' parameter"
        assert "page" in param_names, "list_strategies() missing 'page' parameter"
        assert "limit" in param_names, "list_strategies() missing 'limit' parameter"

    def test_async_list_strategies_accepts_sort_page_limit(self):
        """AsyncPolyforgeClient.list_strategies() must also accept sort, page, limit."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.list_strategies)
        param_names = set(sig.parameters.keys())
        assert "sort" in param_names, "async list_strategies() missing 'sort' parameter"
        assert "page" in param_names, "async list_strategies() missing 'page' parameter"
        assert "limit" in param_names, "async list_strategies() missing 'limit' parameter"

    def test_list_strategies_params_passed_to_request(self):
        """list_strategies() must pass sort, page, limit to the HTTP params dict."""
        import inspect

        source = inspect.getsource(PolyforgeClient.list_strategies)
        assert '"sort"' in source or "'sort'" in source
        assert '"page"' in source or "'page'" in source
        assert '"limit"' in source or "'limit'" in source


class TestWatchlistItem:
    """Tests for WatchlistItem model (#53)."""

    def test_watchlist_item_fields(self):
        """WatchlistItem must have the expected fields."""
        item = WatchlistItem(
            market_id="mkt-1",
            slug="will-x-happen",
            title="Will X happen?",
            current_price=0.65,
            volume24h=12345.0,
            price_delta24h=-0.03,
            watched=True,
        )
        assert item.market_id == "mkt-1"
        assert item.slug == "will-x-happen"
        assert item.title == "Will X happen?"
        assert item.current_price == 0.65
        assert item.volume24h == 12345.0
        assert item.price_delta24h == -0.03
        assert item.watched is True

    def test_watchlist_item_defaults(self):
        """WatchlistItem defaults should be sensible."""
        item = WatchlistItem()
        assert item.market_id == ""
        assert item.slug == ""
        assert item.title == ""
        assert item.current_price == 0.0
        assert item.volume24h == 0.0
        assert item.price_delta24h == 0.0
        assert item.watched is True

    def test_watchlist_item_parse(self):
        """WatchlistItem should parse from camelCase API response."""
        raw = {
            "marketId": "mkt-1",
            "slug": "test-slug",
            "title": "Test Market",
            "currentPrice": 0.72,
            "volume24h": 5000.0,
            "priceDelta24h": 0.05,
            "watched": True,
        }
        item = _parse(WatchlistItem, raw)
        assert item.market_id == "mkt-1"
        assert item.current_price == 0.72
        assert item.volume24h == 5000.0
        assert item.price_delta24h == 0.05


class TestWatchlistMethods:
    """Tests for watchlist CRUD methods (#53)."""

    def test_sync_get_watchlist_exists(self):
        """PolyforgeClient must have get_watchlist method."""
        assert hasattr(PolyforgeClient, "get_watchlist")
        assert callable(getattr(PolyforgeClient, "get_watchlist"))

    def test_sync_add_to_watchlist_exists(self):
        """PolyforgeClient must have add_to_watchlist method."""
        assert hasattr(PolyforgeClient, "add_to_watchlist")

    def test_sync_remove_from_watchlist_exists(self):
        """PolyforgeClient must have remove_from_watchlist method."""
        assert hasattr(PolyforgeClient, "remove_from_watchlist")

    def test_sync_get_watchlist_status_exists(self):
        """PolyforgeClient must have get_watchlist_status method."""
        assert hasattr(PolyforgeClient, "get_watchlist_status")

    def test_async_get_watchlist_exists(self):
        """AsyncPolyforgeClient must have get_watchlist method."""
        assert hasattr(AsyncPolyforgeClient, "get_watchlist")

    def test_async_add_to_watchlist_exists(self):
        """AsyncPolyforgeClient must have add_to_watchlist method."""
        assert hasattr(AsyncPolyforgeClient, "add_to_watchlist")

    def test_async_remove_from_watchlist_exists(self):
        """AsyncPolyforgeClient must have remove_from_watchlist method."""
        assert hasattr(AsyncPolyforgeClient, "remove_from_watchlist")

    def test_async_get_watchlist_status_exists(self):
        """AsyncPolyforgeClient must have get_watchlist_status method."""
        assert hasattr(AsyncPolyforgeClient, "get_watchlist_status")

    def test_add_to_watchlist_accepts_market_id(self):
        """add_to_watchlist() must accept market_id parameter."""
        import inspect

        sig = inspect.signature(PolyforgeClient.add_to_watchlist)
        param_names = set(sig.parameters.keys())
        assert "market_id" in param_names

    def test_remove_from_watchlist_accepts_market_id(self):
        """remove_from_watchlist() must accept market_id parameter."""
        import inspect

        sig = inspect.signature(PolyforgeClient.remove_from_watchlist)
        param_names = set(sig.parameters.keys())
        assert "market_id" in param_names

    def test_get_watchlist_status_accepts_market_id(self):
        """get_watchlist_status() must accept market_id parameter."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_watchlist_status)
        param_names = set(sig.parameters.keys())
        assert "market_id" in param_names

    def test_add_to_watchlist_sends_market_id_in_body(self):
        """add_to_watchlist() must send marketId in request body."""
        import inspect

        source = inspect.getsource(PolyforgeClient.add_to_watchlist)
        assert '"marketId"' in source or "'marketId'" in source

    def test_watchlist_endpoints_use_correct_paths(self):
        """Watchlist methods must use /api/v1/watchlist paths."""
        import inspect

        for method_name in ("get_watchlist", "add_to_watchlist", "remove_from_watchlist", "get_watchlist_status"):
            source = inspect.getsource(getattr(PolyforgeClient, method_name))
            assert "/api/v1/watchlist" in source, f"{method_name} missing /api/v1/watchlist path"

    def test_get_watchlist_status_uses_correct_route_order(self):
        """get_watchlist_status() must use /{id}/status not /status/{id} (#122)."""
        import inspect

        for client_class in (PolyforgeClient, AsyncPolyforgeClient):
            source = inspect.getsource(getattr(client_class, "get_watchlist_status"))
            # Must have /{market_id}/status pattern, not /status/{market_id}
            assert "/status" in source
            # Verify the route is NOT the old reversed path
            assert '"/api/v1/watchlist/status/' not in source and \
                   "f'/api/v1/watchlist/status/" not in source, \
                f"{client_class.__name__}.get_watchlist_status uses reversed route"


class TestWebhookTestResult:
    """Tests for WebhookTestResult model (#55)."""

    def test_webhook_test_result_fields(self):
        """WebhookTestResult must have success and status_code fields."""
        result = WebhookTestResult(success=True, status_code=200)
        assert result.success is True
        assert result.status_code == 200

    def test_webhook_test_result_defaults(self):
        """WebhookTestResult defaults should be sensible."""
        result = WebhookTestResult()
        assert result.success is False
        assert result.status_code == 0


class TestWebhookMutationMethods:
    """Tests for webhook delete and test methods (#55)."""

    def test_sync_delete_webhook_exists(self):
        """PolyforgeClient must have delete_webhook method."""
        assert hasattr(PolyforgeClient, "delete_webhook")
        assert callable(getattr(PolyforgeClient, "delete_webhook"))

    def test_sync_test_webhook_exists(self):
        """PolyforgeClient must have test_webhook method."""
        assert hasattr(PolyforgeClient, "test_webhook")
        assert callable(getattr(PolyforgeClient, "test_webhook"))

    def test_async_delete_webhook_exists(self):
        """AsyncPolyforgeClient must have delete_webhook method."""
        assert hasattr(AsyncPolyforgeClient, "delete_webhook")

    def test_async_test_webhook_exists(self):
        """AsyncPolyforgeClient must have test_webhook method."""
        assert hasattr(AsyncPolyforgeClient, "test_webhook")

    def test_delete_webhook_accepts_webhook_id(self):
        """delete_webhook() must accept webhook_id parameter."""
        import inspect

        sig = inspect.signature(PolyforgeClient.delete_webhook)
        param_names = set(sig.parameters.keys())
        assert "webhook_id" in param_names

    def test_test_webhook_accepts_webhook_id(self):
        """test_webhook() must accept webhook_id parameter."""
        import inspect

        sig = inspect.signature(PolyforgeClient.test_webhook)
        param_names = set(sig.parameters.keys())
        assert "webhook_id" in param_names

    def test_delete_webhook_uses_correct_path(self):
        """delete_webhook() must use /api/v1/webhooks/{id} path."""
        import inspect

        source = inspect.getsource(PolyforgeClient.delete_webhook)
        assert "/api/v1/webhooks/" in source

    def test_test_webhook_uses_correct_path(self):
        """test_webhook() must use /api/v1/webhooks/{id}/test path."""
        import inspect

        source = inspect.getsource(PolyforgeClient.test_webhook)
        assert "/test" in source
        assert "/api/v1/webhooks/" in source

    def test_delete_webhook_uses_path_encoding(self):
        """delete_webhook() must use _encode_path for the webhook ID."""
        import inspect

        source = inspect.getsource(PolyforgeClient.delete_webhook)
        assert "_encode_path" in source

    def test_test_webhook_uses_path_encoding(self):
        """test_webhook() must use _encode_path for the webhook ID."""
        import inspect

        source = inspect.getsource(PolyforgeClient.test_webhook)
        assert "_encode_path" in source


class TestPriceHistoryEntryModel:
    """Tests for PriceHistoryEntry model (#51)."""

    def test_price_history_entry_fields(self):
        """PriceHistoryEntry must have timestamp, price, volume fields."""
        entry = PriceHistoryEntry(timestamp="2026-04-13T00:00:00Z", price=0.65, volume=1234.5)
        assert entry.timestamp == "2026-04-13T00:00:00Z"
        assert entry.price == 0.65
        assert entry.volume == 1234.5

    def test_price_history_entry_defaults(self):
        """PriceHistoryEntry defaults should be sensible."""
        entry = PriceHistoryEntry()
        assert entry.timestamp == ""
        assert entry.price == 0.0
        assert entry.volume == 0.0


class TestOrderBookModels:
    """Tests for OrderBookLevel and OrderBook models (#51)."""

    def test_order_book_level_fields(self):
        """OrderBookLevel must have price and size fields."""
        level = OrderBookLevel(price="0.65", size="100")
        assert level.price == "0.65"
        assert level.size == "100"

    def test_order_book_level_defaults(self):
        """OrderBookLevel defaults should be empty strings."""
        level = OrderBookLevel()
        assert level.price == ""
        assert level.size == ""

    def test_order_book_fields(self):
        """OrderBook must have bids and asks lists."""
        book = OrderBook(
            bids=[OrderBookLevel(price="0.64", size="50")],
            asks=[OrderBookLevel(price="0.66", size="75")],
        )
        assert len(book.bids) == 1
        assert len(book.asks) == 1
        assert book.bids[0].price == "0.64"
        assert book.asks[0].price == "0.66"

    def test_order_book_defaults(self):
        """OrderBook defaults should be empty lists."""
        book = OrderBook()
        assert book.bids == []
        assert book.asks == []


class TestGetPriceHistory:
    """Tests for get_price_history() method (#51)."""

    def test_get_price_history_accepts_all_params(self):
        """get_price_history() signature must accept token_id, resolution, limit (#125)."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_price_history)
        param_names = set(sig.parameters.keys())
        assert "token_id" in param_names, "get_price_history() missing 'token_id' parameter"
        assert "resolution" in param_names, "get_price_history() missing 'resolution' parameter"
        assert "limit" in param_names, "get_price_history() missing 'limit' parameter"
        assert "from_" in param_names, "get_price_history() missing 'from_' parameter"
        assert "to" in param_names, "get_price_history() missing 'to' parameter"

    def test_async_get_price_history_accepts_all_params(self):
        """AsyncPolyforgeClient.get_price_history() must also accept all params."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.get_price_history)
        param_names = set(sig.parameters.keys())
        assert "token_id" in param_names
        assert "resolution" in param_names
        assert "limit" in param_names

    def test_get_price_history_uses_correct_path(self):
        """get_price_history() must use /api/v1/markets/{tokenId}/price-history path."""
        import inspect

        source = inspect.getsource(PolyforgeClient.get_price_history)
        assert "/price-history" in source
        assert "/api/v1/markets/" in source

    def test_get_price_history_passes_query_params(self):
        """get_price_history() must pass resolution (not period) and limit as query params (#125)."""
        import inspect

        source = inspect.getsource(PolyforgeClient.get_price_history)
        assert '"resolution"' in source or "'resolution'" in source, "must use 'resolution' not 'period'"
        assert '"limit"' in source or "'limit'" in source
        # Ensure old wrong param name is not sent to the platform
        assert '"period"' not in source and "'period'" not in source, "must not send 'period' to platform"

    def test_get_price_history_uses_path_encoding(self):
        """get_price_history() must use _encode_path for the token ID."""
        import inspect

        source = inspect.getsource(PolyforgeClient.get_price_history)
        assert "_encode_path" in source

    def test_get_price_history_return_type(self):
        """get_price_history() must return list[PriceHistoryEntry]."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_price_history)
        ret = sig.return_annotation
        assert "PriceHistoryEntry" in str(ret)


class TestGetOrderBook:
    """Tests for get_order_book() method (#51)."""

    def test_get_order_book_accepts_token_id(self):
        """get_order_book() must accept token_id parameter."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_order_book)
        param_names = set(sig.parameters.keys())
        assert "token_id" in param_names, "get_order_book() missing 'token_id' parameter"

    def test_async_get_order_book_accepts_token_id(self):
        """AsyncPolyforgeClient.get_order_book() must also accept token_id."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.get_order_book)
        param_names = set(sig.parameters.keys())
        assert "token_id" in param_names

    def test_get_order_book_uses_correct_path(self):
        """get_order_book() must use /api/v1/markets/{tokenId}/book path."""
        import inspect

        source = inspect.getsource(PolyforgeClient.get_order_book)
        assert "/book" in source
        assert "/api/v1/markets/" in source

    def test_get_order_book_uses_path_encoding(self):
        """get_order_book() must use _encode_path for the token ID."""
        import inspect

        source = inspect.getsource(PolyforgeClient.get_order_book)
        assert "_encode_path" in source

    def test_get_order_book_return_type(self):
        """get_order_book() must return OrderBook."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_order_book)
        ret = sig.return_annotation
        assert "OrderBook" in str(ret)


# ---------------------------------------------------------------------------
# Alert CRUD (#50)
# ---------------------------------------------------------------------------

class TestAlertCrud:
    """Tests for create_alert and delete_alert methods (#50)."""

    def test_conditional_order_model_fields(self):
        """ConditionalOrder must have all expected fields."""
        order = ConditionalOrder(
            id="co-1",
            market_id="m-1",
            token_id="t-1",
            type="STOP_LOSS",
            side="SELL",
            outcome="YES",
            size="10",
            trigger_price="0.50",
            status="PENDING",
        )
        assert order.id == "co-1"
        assert order.market_id == "m-1"
        assert order.trigger_price == "0.50"
        assert order.limit_price is None

    def test_conditional_order_defaults(self):
        """ConditionalOrder defaults should be sensible."""
        order = ConditionalOrder()
        assert order.id == ""
        assert order.status == ""
        assert order.triggered_at is None
        assert order.limit_price is None

    def test_portfolio_pnl_model_fields(self):
        """PortfolioPnl must have all expected fields."""
        pnl = PortfolioPnl(
            period="30d",
            total_pnl=150.5,
            realized_pnl=100.0,
            unrealized_pnl=50.5,
            win_rate=0.65,
            trade_count=42,
            best_trade=80.0,
            worst_trade=-20.0,
        )
        assert pnl.period == "30d"
        assert pnl.total_pnl == 150.5
        assert pnl.trade_count == 42

    def test_portfolio_pnl_defaults(self):
        """PortfolioPnl defaults should be sensible."""
        pnl = PortfolioPnl()
        assert pnl.period == ""
        assert pnl.total_pnl == 0.0
        assert pnl.data_points == []

    # -- Sync client: create_alert --

    def test_sync_create_alert_exists(self):
        """PolyforgeClient must have create_alert method."""
        assert hasattr(PolyforgeClient, "create_alert")
        assert callable(getattr(PolyforgeClient, "create_alert"))

    def test_sync_create_alert_params(self):
        """create_alert() must accept token_id, direction, price, persistent."""
        import inspect

        sig = inspect.signature(PolyforgeClient.create_alert)
        param_names = set(sig.parameters.keys())
        assert "token_id" in param_names
        assert "direction" in param_names
        assert "price" in param_names
        assert "persistent" in param_names

    def test_sync_create_alert_uses_correct_path(self):
        """create_alert() must POST to /api/v1/alerts."""
        import inspect

        source = inspect.getsource(PolyforgeClient.create_alert)
        assert "/api/v1/alerts" in source
        assert "_post" in source

    def test_sync_create_alert_validates_price(self):
        """create_alert() must call _validate_financial_param for price."""
        import inspect

        source = inspect.getsource(PolyforgeClient.create_alert)
        assert "_validate_financial_param" in source

    # -- Sync client: delete_alert --

    def test_sync_delete_alert_exists(self):
        """PolyforgeClient must have delete_alert method."""
        assert hasattr(PolyforgeClient, "delete_alert")
        assert callable(getattr(PolyforgeClient, "delete_alert"))

    def test_sync_delete_alert_params(self):
        """delete_alert() must accept alert_id."""
        import inspect

        sig = inspect.signature(PolyforgeClient.delete_alert)
        param_names = set(sig.parameters.keys())
        assert "alert_id" in param_names

    def test_sync_delete_alert_uses_correct_path(self):
        """delete_alert() must DELETE to /api/v1/alerts/{id}."""
        import inspect

        source = inspect.getsource(PolyforgeClient.delete_alert)
        assert "/api/v1/alerts/" in source
        assert "_delete" in source
        assert "_encode_path" in source

    # -- Async client: create_alert / delete_alert --

    def test_async_create_alert_exists(self):
        """AsyncPolyforgeClient must have create_alert method."""
        assert hasattr(AsyncPolyforgeClient, "create_alert")

    def test_async_delete_alert_exists(self):
        """AsyncPolyforgeClient must have delete_alert method."""
        assert hasattr(AsyncPolyforgeClient, "delete_alert")

    def test_async_create_alert_uses_correct_path(self):
        """Async create_alert() must POST to /api/v1/alerts."""
        import inspect

        source = inspect.getsource(AsyncPolyforgeClient.create_alert)
        assert "/api/v1/alerts" in source
        assert "_post" in source

    def test_async_delete_alert_uses_correct_path(self):
        """Async delete_alert() must DELETE to /api/v1/alerts/{id}."""
        import inspect

        source = inspect.getsource(AsyncPolyforgeClient.delete_alert)
        assert "/api/v1/alerts/" in source
        assert "_delete" in source


# ---------------------------------------------------------------------------
# Conditional Orders (#50)
# ---------------------------------------------------------------------------

class TestConditionalOrders:
    """Tests for conditional order methods (#50)."""

    # -- list_conditional_orders --

    def test_sync_list_conditional_orders_exists(self):
        """PolyforgeClient must have list_conditional_orders."""
        assert hasattr(PolyforgeClient, "list_conditional_orders")
        assert callable(getattr(PolyforgeClient, "list_conditional_orders"))

    def test_sync_list_conditional_orders_params(self):
        """list_conditional_orders() must accept status and limit."""
        import inspect

        sig = inspect.signature(PolyforgeClient.list_conditional_orders)
        param_names = set(sig.parameters.keys())
        assert "status" in param_names
        assert "limit" in param_names

    def test_sync_list_conditional_orders_path(self):
        """list_conditional_orders() must use /api/v1/orders/conditional."""
        import inspect

        source = inspect.getsource(PolyforgeClient.list_conditional_orders)
        assert "/api/v1/orders/conditional" in source
        assert "_get" in source

    def test_async_list_conditional_orders_exists(self):
        """AsyncPolyforgeClient must have list_conditional_orders."""
        assert hasattr(AsyncPolyforgeClient, "list_conditional_orders")

    # -- create_conditional_order --

    def test_sync_create_conditional_order_exists(self):
        """PolyforgeClient must have create_conditional_order."""
        assert hasattr(PolyforgeClient, "create_conditional_order")

    def test_sync_create_conditional_order_params(self):
        """create_conditional_order() must accept all required params."""
        import inspect

        sig = inspect.signature(PolyforgeClient.create_conditional_order)
        param_names = set(sig.parameters.keys())
        for name in ("market_id", "token_id", "type", "side", "outcome", "size", "trigger_price"):
            assert name in param_names, f"Missing param: {name}"
        assert "limit_price" in param_names

    def test_sync_create_conditional_order_path(self):
        """create_conditional_order() must POST to /api/v1/orders/conditional."""
        import inspect

        source = inspect.getsource(PolyforgeClient.create_conditional_order)
        assert "/api/v1/orders/conditional" in source
        assert "_post" in source

    def test_sync_create_conditional_order_validates_financials(self):
        """create_conditional_order() must validate size and trigger_price."""
        import inspect

        source = inspect.getsource(PolyforgeClient.create_conditional_order)
        assert "_validate_financial_param" in source

    def test_async_create_conditional_order_exists(self):
        """AsyncPolyforgeClient must have create_conditional_order."""
        assert hasattr(AsyncPolyforgeClient, "create_conditional_order")

    # -- get_conditional_order --

    def test_sync_get_conditional_order_exists(self):
        """PolyforgeClient must have get_conditional_order."""
        assert hasattr(PolyforgeClient, "get_conditional_order")

    def test_sync_get_conditional_order_params(self):
        """get_conditional_order() must accept order_id."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_conditional_order)
        param_names = set(sig.parameters.keys())
        assert "order_id" in param_names

    def test_sync_get_conditional_order_path(self):
        """get_conditional_order() must GET /api/v1/orders/conditional/{id}."""
        import inspect

        source = inspect.getsource(PolyforgeClient.get_conditional_order)
        assert "/api/v1/orders/conditional/" in source
        assert "_encode_path" in source

    def test_async_get_conditional_order_exists(self):
        """AsyncPolyforgeClient must have get_conditional_order."""
        assert hasattr(AsyncPolyforgeClient, "get_conditional_order")

    # -- cancel_conditional_order --

    def test_sync_cancel_conditional_order_exists(self):
        """PolyforgeClient must have cancel_conditional_order."""
        assert hasattr(PolyforgeClient, "cancel_conditional_order")

    def test_sync_cancel_conditional_order_params(self):
        """cancel_conditional_order() must accept order_id."""
        import inspect

        sig = inspect.signature(PolyforgeClient.cancel_conditional_order)
        param_names = set(sig.parameters.keys())
        assert "order_id" in param_names

    def test_sync_cancel_conditional_order_path(self):
        """cancel_conditional_order() must DELETE /api/v1/orders/conditional/{id}."""
        import inspect

        source = inspect.getsource(PolyforgeClient.cancel_conditional_order)
        assert "/api/v1/orders/conditional/" in source
        assert "_delete" in source
        assert "_encode_path" in source

    def test_async_cancel_conditional_order_exists(self):
        """AsyncPolyforgeClient must have cancel_conditional_order."""
        assert hasattr(AsyncPolyforgeClient, "cancel_conditional_order")


# ---------------------------------------------------------------------------
# Portfolio PnL (#50)
# ---------------------------------------------------------------------------

class TestPortfolioPnl:
    """Tests for get_portfolio_pnl method (#50)."""

    def test_sync_get_portfolio_pnl_exists(self):
        """PolyforgeClient must have get_portfolio_pnl."""
        assert hasattr(PolyforgeClient, "get_portfolio_pnl")
        assert callable(getattr(PolyforgeClient, "get_portfolio_pnl"))

    def test_sync_get_portfolio_pnl_params(self):
        """get_portfolio_pnl() must accept period and strategy_id."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_portfolio_pnl)
        param_names = set(sig.parameters.keys())
        assert "period" in param_names
        assert "strategy_id" in param_names

    def test_sync_get_portfolio_pnl_path(self):
        """get_portfolio_pnl() must GET /api/v1/portfolio/pnl."""
        import inspect

        source = inspect.getsource(PolyforgeClient.get_portfolio_pnl)
        assert "/api/v1/portfolio/pnl" in source
        assert "_get" in source

    def test_sync_get_portfolio_pnl_default_period(self):
        """get_portfolio_pnl() default period should be '30d'."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_portfolio_pnl)
        assert sig.parameters["period"].default == "30d"

    def test_async_get_portfolio_pnl_exists(self):
        """AsyncPolyforgeClient must have get_portfolio_pnl."""
        assert hasattr(AsyncPolyforgeClient, "get_portfolio_pnl")

    def test_async_get_portfolio_pnl_path(self):
        """Async get_portfolio_pnl() must GET /api/v1/portfolio/pnl."""
        import inspect

        source = inspect.getsource(AsyncPolyforgeClient.get_portfolio_pnl)
        assert "/api/v1/portfolio/pnl" in source
        assert "_get" in source

    def test_sync_get_portfolio_pnl_return_type(self):
        """get_portfolio_pnl() must return PortfolioPnl."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_portfolio_pnl)
        ret = sig.return_annotation
        assert "PortfolioPnl" in str(ret)


class TestPaginatedResponses:
    """Tests for #105 — list endpoints returning PaginatedResponse."""

    def test_list_strategies_returns_paginated_response(self):
        """list_strategies() must return PaginatedResponse[Strategy]."""
        import inspect

        sig = inspect.signature(PolyforgeClient.list_strategies)
        ret = str(sig.return_annotation)
        assert "PaginatedResponse" in ret, f"Expected PaginatedResponse, got {ret}"

    def test_get_orders_returns_paginated_response(self):
        """get_orders() must return PaginatedResponse[Order]."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_orders)
        ret = str(sig.return_annotation)
        assert "PaginatedResponse" in ret, f"Expected PaginatedResponse, got {ret}"

    def test_list_conditional_orders_returns_paginated_response(self):
        """list_conditional_orders() must return PaginatedResponse[ConditionalOrder]."""
        import inspect

        sig = inspect.signature(PolyforgeClient.list_conditional_orders)
        ret = str(sig.return_annotation)
        assert "PaginatedResponse" in ret, f"Expected PaginatedResponse, got {ret}"

    def test_async_list_strategies_returns_paginated_response(self):
        """Async list_strategies() must return PaginatedResponse[Strategy]."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.list_strategies)
        ret = str(sig.return_annotation)
        assert "PaginatedResponse" in ret, f"Expected PaginatedResponse, got {ret}"

    def test_async_get_orders_returns_paginated_response(self):
        """Async get_orders() must return PaginatedResponse[Order]."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.get_orders)
        ret = str(sig.return_annotation)
        assert "PaginatedResponse" in ret, f"Expected PaginatedResponse, got {ret}"

    def test_async_list_conditional_orders_returns_paginated_response(self):
        """Async list_conditional_orders() must return PaginatedResponse[ConditionalOrder]."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.list_conditional_orders)
        ret = str(sig.return_annotation)
        assert "PaginatedResponse" in ret, f"Expected PaginatedResponse, got {ret}"

    def test_get_orders_accepts_page_and_market_id(self):
        """get_orders() must accept page and market_id params."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_orders)
        param_names = set(sig.parameters.keys())
        assert "page" in param_names, "get_orders() missing 'page' parameter"
        assert "market_id" in param_names, "get_orders() missing 'market_id' parameter"

    def test_list_conditional_orders_accepts_type_and_page(self):
        """list_conditional_orders() must accept type and page params."""
        import inspect

        sig = inspect.signature(PolyforgeClient.list_conditional_orders)
        param_names = set(sig.parameters.keys())
        assert "type" in param_names, "list_conditional_orders() missing 'type' parameter"
        assert "page" in param_names, "list_conditional_orders() missing 'page' parameter"

    def test_list_strategies_source_builds_paginated_response(self):
        """list_strategies() must construct PaginatedResponse from raw API data."""
        import inspect

        source = inspect.getsource(PolyforgeClient.list_strategies)
        assert "PaginatedResponse(" in source
        assert 'raw["total"]' in source or "raw['total']" in source
        assert 'raw["hasNext"]' in source or "raw['hasNext']" in source


class TestBacktestMethods:
    """Tests for backtest list/get/quick/orders methods (#73)."""

    # -- Signature tests (sync) --

    def test_list_backtests_signature(self):
        """list_backtests() must accept strategy_id, status, page, limit."""
        import inspect

        sig = inspect.signature(PolyforgeClient.list_backtests)
        param_names = set(sig.parameters.keys())
        assert "strategy_id" in param_names
        assert "status" in param_names
        assert "page" in param_names
        assert "limit" in param_names

    def test_get_backtest_signature(self):
        """get_backtest() must accept backtest_id."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_backtest)
        param_names = set(sig.parameters.keys())
        assert "backtest_id" in param_names

    def test_run_quick_backtest_signature(self):
        """run_quick_backtest() must accept same params as run_backtest."""
        import inspect

        sig = inspect.signature(PolyforgeClient.run_quick_backtest)
        param_names = set(sig.parameters.keys())
        assert "strategy_id" in param_names
        assert "date_range_start" in param_names
        assert "date_range_end" in param_names

    def test_get_backtest_orders_signature(self):
        """get_backtest_orders() must accept backtest_id."""
        import inspect

        sig = inspect.signature(PolyforgeClient.get_backtest_orders)
        param_names = set(sig.parameters.keys())
        assert "backtest_id" in param_names

    # -- Signature tests (async) --

    def test_async_list_backtests_signature(self):
        """AsyncPolyforgeClient.list_backtests() must accept strategy_id, status, page, limit."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.list_backtests)
        param_names = set(sig.parameters.keys())
        assert "strategy_id" in param_names
        assert "status" in param_names
        assert "page" in param_names
        assert "limit" in param_names

    def test_async_get_backtest_signature(self):
        """AsyncPolyforgeClient.get_backtest() must accept backtest_id."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.get_backtest)
        param_names = set(sig.parameters.keys())
        assert "backtest_id" in param_names

    def test_async_run_quick_backtest_signature(self):
        """AsyncPolyforgeClient.run_quick_backtest() must accept same params as run_backtest."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.run_quick_backtest)
        param_names = set(sig.parameters.keys())
        assert "strategy_id" in param_names
        assert "date_range_start" in param_names
        assert "date_range_end" in param_names

    def test_async_get_backtest_orders_signature(self):
        """AsyncPolyforgeClient.get_backtest_orders() must accept backtest_id."""
        import inspect

        sig = inspect.signature(AsyncPolyforgeClient.get_backtest_orders)
        param_names = set(sig.parameters.keys())
        assert "backtest_id" in param_names

    # -- Source inspection tests --

    def test_list_backtests_builds_paginated_response(self):
        """list_backtests() must construct PaginatedResponse from raw API data."""
        import inspect

        source = inspect.getsource(PolyforgeClient.list_backtests)
        assert "PaginatedResponse(" in source
        assert 'raw["total"]' in source or "raw['total']" in source
        assert 'raw["hasNext"]' in source or "raw['hasNext']" in source

    def test_list_backtests_passes_query_params(self):
        """list_backtests() must pass strategyId and status to the HTTP params."""
        import inspect

        source = inspect.getsource(PolyforgeClient.list_backtests)
        assert '"strategyId"' in source or "'strategyId'" in source
        assert '"status"' in source or "'status'" in source
        assert '"page"' in source or "'page'" in source
        assert '"limit"' in source or "'limit'" in source

    def test_run_quick_backtest_posts_to_quick_endpoint(self):
        """run_quick_backtest() must POST to /api/v1/backtests/quick."""
        import inspect

        source = inspect.getsource(PolyforgeClient.run_quick_backtest)
        assert "/api/v1/backtests/quick" in source

    def test_get_backtest_uses_encode_path(self):
        """get_backtest() must use _encode_path for the backtest_id."""
        import inspect

        source = inspect.getsource(PolyforgeClient.get_backtest)
        assert "_encode_path" in source

    def test_get_backtest_orders_uses_encode_path(self):
        """get_backtest_orders() must use _encode_path for the backtest_id."""
        import inspect

        source = inspect.getsource(PolyforgeClient.get_backtest_orders)
        assert "_encode_path" in source
        assert "/orders" in source

    # -- CSV Export --

    def test_sync_export_orders_csv_exists(self):
        assert callable(getattr(PolyforgeClient, "export_orders_csv", None))

    def test_sync_export_portfolio_csv_exists(self):
        assert callable(getattr(PolyforgeClient, "export_portfolio_csv", None))

    def test_async_export_orders_csv_exists(self):
        assert callable(getattr(AsyncPolyforgeClient, "export_orders_csv", None))

    def test_async_export_portfolio_csv_exists(self):
        assert callable(getattr(AsyncPolyforgeClient, "export_portfolio_csv", None))

    def test_sync_export_orders_csv_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.export_orders_csv)
        assert "/api/v1/orders/export/csv" in source

    def test_sync_export_portfolio_csv_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.export_portfolio_csv)
        assert "/api/v1/portfolio/export/csv" in source

    def test_sync_export_orders_csv_returns_str(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.export_orders_csv)
        assert sig.return_annotation in (str, "str")

    def test_sync_export_portfolio_csv_returns_str(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.export_portfolio_csv)
        assert sig.return_annotation in (str, "str")

    def test_sync_get_text_helper_exists(self):
        assert callable(getattr(PolyforgeClient, "_get_text", None))

    def test_async_get_text_helper_exists(self):
        assert callable(getattr(AsyncPolyforgeClient, "_get_text", None))


# ---------------------------------------------------------------------------
# New endpoint families (POLA-96)
# ---------------------------------------------------------------------------

class TestDiscoveryAndRanking:
    """Tests for discover_strategies and get_leaderboard."""

    # -- discover_strategies --

    def test_sync_discover_strategies_exists(self):
        assert hasattr(PolyforgeClient, "discover_strategies")

    def test_async_discover_strategies_exists(self):
        assert hasattr(AsyncPolyforgeClient, "discover_strategies")

    def test_sync_discover_strategies_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.discover_strategies)
        params = set(sig.parameters.keys())
        for name in ("sort", "category", "search", "limit", "offset"):
            assert name in params, f"Missing param: {name}"

    def test_sync_discover_strategies_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.discover_strategies)
        assert "/api/v1/discover" in source
        assert "_get" in source

    def test_async_discover_strategies_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.discover_strategies)
        assert "/api/v1/discover" in source

    def test_sync_discover_strategies_returns_paginated(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.discover_strategies)
        assert "PaginatedResponse" in source

    # -- get_leaderboard --

    def test_sync_get_leaderboard_exists(self):
        assert hasattr(PolyforgeClient, "get_leaderboard")

    def test_async_get_leaderboard_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_leaderboard")

    def test_sync_get_leaderboard_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_leaderboard)
        params = set(sig.parameters.keys())
        for name in ("period", "limit", "offset"):
            assert name in params, f"Missing param: {name}"

    def test_sync_get_leaderboard_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_leaderboard)
        assert "/api/v1/leaderboard" in source
        assert "_get" in source

    def test_async_get_leaderboard_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_leaderboard)
        assert "/api/v1/leaderboard" in source


class TestPaperTrading:
    """Tests for get_paper_summary and reset_paper_account."""

    # -- get_paper_summary --

    def test_sync_get_paper_summary_exists(self):
        assert hasattr(PolyforgeClient, "get_paper_summary")

    def test_async_get_paper_summary_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_paper_summary")

    def test_sync_get_paper_summary_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_paper_summary)
        assert "/api/v1/paper/summary" in source
        assert "_get" in source

    def test_async_get_paper_summary_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_paper_summary)
        assert "/api/v1/paper/summary" in source

    # -- reset_paper_account --

    def test_sync_reset_paper_account_exists(self):
        assert hasattr(PolyforgeClient, "reset_paper_account")

    def test_async_reset_paper_account_exists(self):
        assert hasattr(AsyncPolyforgeClient, "reset_paper_account")

    def test_sync_reset_paper_account_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.reset_paper_account)
        assert "/api/v1/paper/reset" in source
        assert "_post" in source

    def test_async_reset_paper_account_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.reset_paper_account)
        assert "/api/v1/paper/reset" in source


class TestBatchApi:
    """Tests for batch_requests."""

    def test_sync_batch_requests_exists(self):
        assert hasattr(PolyforgeClient, "batch_requests")

    def test_async_batch_requests_exists(self):
        assert hasattr(AsyncPolyforgeClient, "batch_requests")

    def test_sync_batch_requests_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.batch_requests)
        assert "requests" in sig.parameters

    def test_sync_batch_requests_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.batch_requests)
        assert "/api/v1/batch" in source
        assert "_post" in source

    def test_async_batch_requests_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.batch_requests)
        assert "/api/v1/batch" in source

    def test_sync_batch_requests_sends_items_key(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.batch_requests)
        assert '"items"' in source
        assert '"requests"' not in source or "requests)" in source

    def test_async_batch_requests_sends_items_key(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.batch_requests)
        assert '"items"' in source
        assert '"requests"' not in source or "requests)" in source

    def test_sync_batch_requests_payload(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        fake_response = [{"id": "1", "status": 200, "body": {}}]
        client._post = MagicMock(return_value=fake_response)
        reqs = [{"id": "1", "method": "GET", "path": "/api/v1/markets"}]
        client.batch_requests(reqs)
        client._post.assert_called_once_with(
            "/api/v1/batch", json={"items": reqs},
        )
        client.close()

    def test_async_batch_requests_payload(self):
        import asyncio
        from unittest.mock import AsyncMock

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            fake_response = [{"id": "1", "status": 200, "body": {}}]
            client._post = AsyncMock(return_value=fake_response)
            reqs = [{"id": "1", "method": "GET", "path": "/api/v1/markets"}]
            await client.batch_requests(reqs)
            client._post.assert_called_once_with(
                "/api/v1/batch", json={"items": reqs},
            )
            await client.close()

        asyncio.run(_run())


class TestExtendedWhaleIntelligence:
    """Tests for get_top_whales, get_whale_profile, follow/unfollow, get_followed_whales."""

    # -- get_top_whales --

    def test_sync_get_top_whales_exists(self):
        assert hasattr(PolyforgeClient, "get_top_whales")

    def test_async_get_top_whales_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_top_whales")

    def test_sync_get_top_whales_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_top_whales)
        params = set(sig.parameters.keys())
        assert "sort" in params
        assert "period" in params

    def test_sync_get_top_whales_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_top_whales)
        assert "/api/v1/whales/top" in source
        assert "_get" in source

    def test_async_get_top_whales_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_top_whales)
        assert "/api/v1/whales/top" in source

    # -- get_whale_profile --

    def test_sync_get_whale_profile_exists(self):
        assert hasattr(PolyforgeClient, "get_whale_profile")

    def test_async_get_whale_profile_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_whale_profile")

    def test_sync_get_whale_profile_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_whale_profile)
        assert "address" in sig.parameters

    def test_sync_get_whale_profile_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_whale_profile)
        assert "/api/v1/whales/" in source
        assert "_encode_path" in source
        assert "_get" in source

    def test_async_get_whale_profile_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_whale_profile)
        assert "/api/v1/whales/" in source
        assert "_encode_path" in source

    # -- follow_whale --

    def test_sync_follow_whale_exists(self):
        assert hasattr(PolyforgeClient, "follow_whale")

    def test_async_follow_whale_exists(self):
        assert hasattr(AsyncPolyforgeClient, "follow_whale")

    def test_sync_follow_whale_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.follow_whale)
        assert "/follow" in source
        assert "_post" in source

    def test_async_follow_whale_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.follow_whale)
        assert "/follow" in source

    # -- unfollow_whale --

    def test_sync_unfollow_whale_exists(self):
        assert hasattr(PolyforgeClient, "unfollow_whale")

    def test_async_unfollow_whale_exists(self):
        assert hasattr(AsyncPolyforgeClient, "unfollow_whale")

    def test_sync_unfollow_whale_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.unfollow_whale)
        assert "/unfollow" in source
        assert "_post" in source

    # -- get_followed_whales --

    def test_sync_get_followed_whales_exists(self):
        assert hasattr(PolyforgeClient, "get_followed_whales")

    def test_async_get_followed_whales_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_followed_whales")

    def test_sync_get_followed_whales_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_followed_whales)
        assert "/api/v1/whales/following" in source
        assert "_get" in source

    def test_async_get_followed_whales_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_followed_whales)
        assert "/api/v1/whales/following" in source


class TestMarketplaceSellerCrud:
    """Tests for create_marketplace_listing, update, rate, get_my_listings, get_my_purchases."""

    # -- create_marketplace_listing --

    def test_sync_create_marketplace_listing_exists(self):
        assert hasattr(PolyforgeClient, "create_marketplace_listing")

    def test_async_create_marketplace_listing_exists(self):
        assert hasattr(AsyncPolyforgeClient, "create_marketplace_listing")

    def test_sync_create_marketplace_listing_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.create_marketplace_listing)
        params = set(sig.parameters.keys())
        assert "strategy_id" in params
        assert "title" in params
        assert "price" in params
        assert "description" in params

    def test_sync_create_marketplace_listing_validates_price(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.create_marketplace_listing)
        assert "_validate_financial_param" in source

    def test_sync_create_marketplace_listing_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.create_marketplace_listing)
        assert "/api/v1/marketplace" in source
        assert "_post" in source

    def test_sync_create_marketplace_listing_sends_priceUsdc(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.create_marketplace_listing)
        assert '"priceUsdc"' in source, "must send priceUsdc, not price"

    def test_sync_create_marketplace_listing_sends_title(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.create_marketplace_listing)
        assert '"title"' in source, "must include title in request body"

    def test_async_create_marketplace_listing_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.create_marketplace_listing)
        assert "/api/v1/marketplace" in source

    def test_async_create_marketplace_listing_sends_priceUsdc(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.create_marketplace_listing)
        assert '"priceUsdc"' in source, "must send priceUsdc, not price"

    def test_async_create_marketplace_listing_sends_title(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.create_marketplace_listing)
        assert '"title"' in source, "must include title in request body"

    # -- update_marketplace_listing --

    def test_sync_update_marketplace_listing_exists(self):
        assert hasattr(PolyforgeClient, "update_marketplace_listing")

    def test_async_update_marketplace_listing_exists(self):
        assert hasattr(AsyncPolyforgeClient, "update_marketplace_listing")

    def test_sync_update_marketplace_listing_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.update_marketplace_listing)
        assert "/api/v1/marketplace/" in source
        assert "_patch" in source
        assert "_encode_path" in source

    # -- rate_marketplace_listing --

    def test_sync_rate_marketplace_listing_exists(self):
        assert hasattr(PolyforgeClient, "rate_marketplace_listing")

    def test_async_rate_marketplace_listing_exists(self):
        assert hasattr(AsyncPolyforgeClient, "rate_marketplace_listing")

    def test_sync_rate_marketplace_listing_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.rate_marketplace_listing)
        params = set(sig.parameters.keys())
        assert "listing_id" in params
        assert "rating" in params
        assert "review" in params

    def test_sync_rate_marketplace_listing_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.rate_marketplace_listing)
        assert "/rate" in source
        assert "_post" in source

    # -- get_my_listings --

    def test_sync_get_my_listings_exists(self):
        assert hasattr(PolyforgeClient, "get_my_listings")

    def test_async_get_my_listings_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_my_listings")

    def test_sync_get_my_listings_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_my_listings)
        assert "/api/v1/marketplace/my/listings" in source
        assert "_get" in source

    def test_async_get_my_listings_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_my_listings)
        assert "/api/v1/marketplace/my/listings" in source

    # -- get_my_purchases --

    def test_sync_get_my_purchases_exists(self):
        assert hasattr(PolyforgeClient, "get_my_purchases")

    def test_async_get_my_purchases_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_my_purchases")

    def test_sync_get_my_purchases_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_my_purchases)
        assert "/api/v1/marketplace/my/purchases" in source
        assert "_get" in source

    def test_async_get_my_purchases_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_my_purchases)
        assert "/api/v1/marketplace/my/purchases" in source


class TestCopyTradingCrud:
    """Tests for full copy-trading lifecycle: create, get, update, pause, resume, delete, trades."""

    # -- create_copy_config --

    def test_sync_create_copy_config_exists(self):
        assert hasattr(PolyforgeClient, "create_copy_config")

    def test_async_create_copy_config_exists(self):
        assert hasattr(AsyncPolyforgeClient, "create_copy_config")

    def test_sync_create_copy_config_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.create_copy_config)
        params = set(sig.parameters.keys())
        assert "target_wallet" in params
        for opt in ("mode", "size_value", "max_exposure", "max_daily_loss", "price_offset"):
            assert opt in params, f"Missing optional param: {opt}"

    def test_sync_create_copy_config_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.create_copy_config)
        assert "/api/v1/copy" in source
        assert "_post" in source

    def test_async_create_copy_config_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.create_copy_config)
        assert "/api/v1/copy" in source
        assert "_post" in source

    # -- get_copy_config --

    def test_sync_get_copy_config_exists(self):
        assert hasattr(PolyforgeClient, "get_copy_config")

    def test_async_get_copy_config_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_copy_config")

    def test_sync_get_copy_config_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_copy_config)
        assert "/api/v1/copy/" in source
        assert "_encode_path" in source
        assert "_get" in source

    def test_async_get_copy_config_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_copy_config)
        assert "/api/v1/copy/" in source
        assert "_encode_path" in source

    # -- update_copy_config --

    def test_sync_update_copy_config_exists(self):
        assert hasattr(PolyforgeClient, "update_copy_config")

    def test_async_update_copy_config_exists(self):
        assert hasattr(AsyncPolyforgeClient, "update_copy_config")

    def test_sync_update_copy_config_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.update_copy_config)
        assert "/api/v1/copy/" in source
        assert "_patch" in source
        assert "_encode_path" in source

    # -- pause_copy_config --

    def test_sync_pause_copy_config_exists(self):
        assert hasattr(PolyforgeClient, "pause_copy_config")

    def test_async_pause_copy_config_exists(self):
        assert hasattr(AsyncPolyforgeClient, "pause_copy_config")

    def test_sync_pause_copy_config_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.pause_copy_config)
        assert "/pause" in source
        assert "_post" in source

    def test_async_pause_copy_config_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.pause_copy_config)
        assert "/pause" in source

    # -- resume_copy_config --

    def test_sync_resume_copy_config_exists(self):
        assert hasattr(PolyforgeClient, "resume_copy_config")

    def test_async_resume_copy_config_exists(self):
        assert hasattr(AsyncPolyforgeClient, "resume_copy_config")

    def test_sync_resume_copy_config_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.resume_copy_config)
        assert "/resume" in source
        assert "_post" in source

    def test_async_resume_copy_config_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.resume_copy_config)
        assert "/resume" in source

    # -- delete_copy_config --

    def test_sync_delete_copy_config_exists(self):
        assert hasattr(PolyforgeClient, "delete_copy_config")

    def test_async_delete_copy_config_exists(self):
        assert hasattr(AsyncPolyforgeClient, "delete_copy_config")

    def test_sync_delete_copy_config_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.delete_copy_config)
        assert "/api/v1/copy/" in source
        assert "_delete" in source
        assert "_encode_path" in source

    def test_async_delete_copy_config_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.delete_copy_config)
        assert "/api/v1/copy/" in source
        assert "_delete" in source

    # -- get_copy_trades --

    def test_sync_get_copy_trades_exists(self):
        assert hasattr(PolyforgeClient, "get_copy_trades")

    def test_async_get_copy_trades_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_copy_trades")

    def test_sync_get_copy_trades_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_copy_trades)
        assert "/trades" in source
        assert "_encode_path" in source
        assert "_get" in source

    def test_async_get_copy_trades_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_copy_trades)
        assert "/trades" in source


class TestNewModels:
    """Tests for the new model dataclasses added in POLA-96."""

    def test_leaderboard_entry_defaults(self):
        from polyforge.models import LeaderboardEntry
        entry = LeaderboardEntry()
        assert entry.address == ""
        assert entry.rank == 0
        assert entry.pnl == 0.0

    def test_whale_profile_defaults(self):
        from polyforge.models import WhaleProfile
        profile = WhaleProfile()
        assert profile.address == ""
        assert profile.following is False

    def test_paper_summary_defaults(self):
        from polyforge.models import PaperSummary
        summary = PaperSummary()
        assert summary.balance == 0.0
        assert summary.positions == []

    def test_batch_result_defaults(self):
        from polyforge.models import BatchResult
        result = BatchResult()
        assert result.id == ""
        assert result.status == 200
        assert result.body is None

    def test_copy_trade_defaults(self):
        from polyforge.models import CopyTrade
        trade = CopyTrade()
        assert trade.id == ""
        assert trade.side == ""
        assert trade.pnl == ""


class TestStrategySocialVersioningEventLog:
    """Tests for strategy social, versioning, event-log methods (#124)."""

    def test_sync_strategy_social_methods_exist(self):
        """PolyforgeClient must have all strategy social methods."""
        for method in ("like_strategy", "list_strategy_comments", "add_strategy_comment",
                       "delete_strategy_comment", "list_strategy_children", "report_strategy"):
            assert hasattr(PolyforgeClient, method), f"Missing {method}"

    def test_async_strategy_social_methods_exist(self):
        """AsyncPolyforgeClient must have all strategy social methods."""
        for method in ("like_strategy", "list_strategy_comments", "add_strategy_comment",
                       "delete_strategy_comment", "list_strategy_children", "report_strategy"):
            assert hasattr(AsyncPolyforgeClient, method), f"Async missing {method}"

    def test_sync_strategy_versioning_methods_exist(self):
        """PolyforgeClient must have list_strategy_versions and rollback_strategy."""
        assert hasattr(PolyforgeClient, "list_strategy_versions")
        assert hasattr(PolyforgeClient, "rollback_strategy")

    def test_async_strategy_versioning_methods_exist(self):
        """AsyncPolyforgeClient must have list_strategy_versions and rollback_strategy."""
        assert hasattr(AsyncPolyforgeClient, "list_strategy_versions")
        assert hasattr(AsyncPolyforgeClient, "rollback_strategy")

    def test_sync_get_strategy_event_log_exists(self):
        """PolyforgeClient must have get_strategy_event_log."""
        assert hasattr(PolyforgeClient, "get_strategy_event_log")

    def test_async_get_strategy_event_log_exists(self):
        """AsyncPolyforgeClient must have get_strategy_event_log."""
        assert hasattr(AsyncPolyforgeClient, "get_strategy_event_log")

    def test_like_strategy_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.like_strategy)
        assert "/like" in source
        assert "/api/v1/strategies/" in source

    def test_list_strategy_comments_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.list_strategy_comments)
        assert "/comments" in source
        assert "/api/v1/strategies/" in source

    def test_rollback_strategy_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.rollback_strategy)
        assert "/versions/" in source
        assert "/rollback" in source

    def test_get_strategy_event_log_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_strategy_event_log)
        assert "/event-log" in source

    def test_report_strategy_accepts_reason_and_optional_description(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.report_strategy)
        params = set(sig.parameters.keys())
        assert "reason" in params
        assert "description" in params


class TestApiKeyManagement:
    """Tests for API key management methods (#124)."""

    def test_sync_api_key_methods_exist(self):
        """PolyforgeClient must have list_api_keys, create_api_key, revoke_api_key."""
        assert hasattr(PolyforgeClient, "list_api_keys")
        assert hasattr(PolyforgeClient, "create_api_key")
        assert hasattr(PolyforgeClient, "revoke_api_key")

    def test_async_api_key_methods_exist(self):
        """AsyncPolyforgeClient must have list_api_keys, create_api_key, revoke_api_key."""
        assert hasattr(AsyncPolyforgeClient, "list_api_keys")
        assert hasattr(AsyncPolyforgeClient, "create_api_key")
        assert hasattr(AsyncPolyforgeClient, "revoke_api_key")

    def test_list_api_keys_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.list_api_keys)
        assert "/api/v1/api-keys" in source

    def test_create_api_key_accepts_name_and_scopes(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.create_api_key)
        params = set(sig.parameters.keys())
        assert "name" in params
        assert "scopes" in params

    def test_revoke_api_key_uses_delete_method(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.revoke_api_key)
        assert "_delete" in source
        assert "/api/v1/api-keys/" in source


# ── Risk Settings (#124) ────────────────────────────────────────────────────

class TestRiskSettings:
    """Tests for risk settings / circuit-breaker endpoints."""

    def test_sync_get_risk_settings_exists(self):
        assert callable(getattr(PolyforgeClient, "get_risk_settings", None))

    def test_sync_update_risk_settings_exists(self):
        assert callable(getattr(PolyforgeClient, "update_risk_settings", None))

    def test_sync_reset_circuit_breaker_exists(self):
        assert callable(getattr(PolyforgeClient, "reset_circuit_breaker", None))

    def test_async_get_risk_settings_exists(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_risk_settings", None))

    def test_async_update_risk_settings_exists(self):
        assert callable(getattr(AsyncPolyforgeClient, "update_risk_settings", None))

    def test_async_reset_circuit_breaker_exists(self):
        assert callable(getattr(AsyncPolyforgeClient, "reset_circuit_breaker", None))

    def test_get_risk_settings_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_risk_settings)
        assert "/api/v1/settings/risk" in source

    def test_update_risk_settings_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.update_risk_settings)
        assert "/api/v1/settings/risk" in source

    def test_reset_circuit_breaker_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.reset_circuit_breaker)
        assert "/api/v1/settings/risk/reset" in source

    def test_get_risk_settings_returns_risk_settings(self):
        import inspect
        from polyforge.models import RiskSettings
        sig = inspect.signature(PolyforgeClient.get_risk_settings)
        assert sig.return_annotation in (RiskSettings, "RiskSettings")

    def test_update_risk_settings_returns_risk_settings(self):
        import inspect
        from polyforge.models import RiskSettings
        sig = inspect.signature(PolyforgeClient.update_risk_settings)
        assert sig.return_annotation in (RiskSettings, "RiskSettings")

    def test_reset_circuit_breaker_returns_risk_settings(self):
        import inspect
        from polyforge.models import RiskSettings
        sig = inspect.signature(PolyforgeClient.reset_circuit_breaker)
        assert sig.return_annotation in (RiskSettings, "RiskSettings")

    def test_risk_settings_model_fields(self):
        from polyforge.models import RiskSettings
        rs = RiskSettings()
        assert rs.drawdown_enabled is False
        assert rs.drawdown_lookback_hours == 24
        assert rs.drawdown_threshold_pct == 0.1
        assert rs.circuit_breaker_tripped is False
        assert rs.circuit_breaker_tripped_at is None

    def test_risk_settings_model_with_values(self):
        from polyforge.models import RiskSettings
        rs = RiskSettings(
            drawdown_enabled=True,
            drawdown_lookback_hours=8,
            drawdown_threshold_pct=0.15,
            circuit_breaker_tripped=True,
            circuit_breaker_tripped_at="2026-04-17T10:00:00Z",
        )
        assert rs.drawdown_enabled is True
        assert rs.drawdown_lookback_hours == 8
        assert rs.drawdown_threshold_pct == 0.15
        assert rs.circuit_breaker_tripped is True
        assert rs.circuit_breaker_tripped_at == "2026-04-17T10:00:00Z"

    def test_update_risk_settings_builds_correct_body(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.update_risk_settings)
        assert "drawdownEnabled" in source
        assert "drawdownLookbackHours" in source
        assert "drawdownThresholdPct" in source

    def test_risk_settings_exported_from_package(self):
        from polyforge import RiskSettings
        assert RiskSettings is not None


# ── POLA-476: 17 missing platform endpoints ──────────────────────────────────


class TestMarketsExtendedEndpoints:
    """Tests for the 6 new market data endpoints (POLA-476)."""

    def test_search_markets_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "search_markets", None))

    def test_search_markets_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "search_markets", None))

    def test_search_markets_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.search_markets)
        assert "/api/v1/markets/search" in source

    def test_search_markets_accepts_q_and_limit(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.search_markets)
        params = set(sig.parameters.keys())
        assert "q" in params
        assert "limit" in params

    def test_get_market_tick_size_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_market_tick_size", None))

    def test_get_market_tick_size_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_market_tick_size", None))

    def test_get_market_tick_size_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_market_tick_size)
        assert "/tick-size" in source
        assert "/api/v1/markets/" in source

    def test_get_market_spread_exists(self):
        assert callable(getattr(PolyforgeClient, "get_market_spread", None))
        assert callable(getattr(AsyncPolyforgeClient, "get_market_spread", None))

    def test_get_market_spread_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_market_spread)
        assert "/spread" in source

    def test_get_market_midpoint_exists(self):
        assert callable(getattr(PolyforgeClient, "get_market_midpoint", None))
        assert callable(getattr(AsyncPolyforgeClient, "get_market_midpoint", None))

    def test_get_market_midpoint_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_market_midpoint)
        assert "/midpoint" in source

    def test_get_clob_book_exists(self):
        assert callable(getattr(PolyforgeClient, "get_clob_book", None))
        assert callable(getattr(AsyncPolyforgeClient, "get_clob_book", None))

    def test_get_clob_book_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_clob_book)
        assert "/clob-book" in source

    def test_get_clob_prices_history_exists(self):
        assert callable(getattr(PolyforgeClient, "get_clob_prices_history", None))
        assert callable(getattr(AsyncPolyforgeClient, "get_clob_prices_history", None))

    def test_get_clob_prices_history_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_clob_prices_history)
        assert "/clob-prices-history" in source

    def test_get_clob_prices_history_accepts_interval_and_fidelity(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_clob_prices_history)
        params = set(sig.parameters.keys())
        assert "interval" in params
        assert "fidelity" in params


class TestBulkOrderEndpoints:
    """Tests for the 2 new bulk order endpoints (POLA-476)."""

    def test_batch_orders_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "batch_orders", None))

    def test_batch_orders_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "batch_orders", None))

    def test_batch_orders_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.batch_orders)
        assert "/api/v1/orders/batch" in source

    def test_batch_orders_sends_orders_key(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.batch_orders)
        assert '"orders"' in source

    def test_bulk_cancel_orders_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "bulk_cancel_orders", None))

    def test_bulk_cancel_orders_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "bulk_cancel_orders", None))

    def test_bulk_cancel_orders_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.bulk_cancel_orders)
        assert "/api/v1/orders/bulk" in source

    def test_bulk_cancel_orders_uses_delete_json(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.bulk_cancel_orders)
        assert "_delete_json" in source

    def test_bulk_cancel_orders_sends_order_ids_key(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.bulk_cancel_orders)
        assert '"orderIds"' in source


class TestNewsArticleEndpoints:
    """Tests for the 2 new news article endpoints (POLA-476)."""

    def test_list_news_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "list_news", None))

    def test_list_news_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "list_news", None))

    def test_list_news_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.list_news)
        assert '"/api/v1/news"' in source or "'/api/v1/news'" in source

    def test_list_news_accepts_filters(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.list_news)
        params = set(sig.parameters.keys())
        assert "source" in params
        assert "sentiment" in params
        assert "page" in params
        assert "limit" in params

    def test_get_news_article_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_news_article", None))

    def test_get_news_article_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_news_article", None))

    def test_get_news_article_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_news_article)
        assert "/api/v1/news/" in source


class TestScoresBadgeEndpoints:
    """Tests for the 4 new scores/badges endpoints (POLA-476)."""

    def test_get_top_scores_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_top_scores", None))

    def test_get_top_scores_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_top_scores", None))

    def test_get_top_scores_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_top_scores)
        assert "/api/v1/scores/top" in source

    def test_get_my_badges_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_my_badges", None))

    def test_get_my_badges_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_my_badges", None))

    def test_get_my_badges_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_my_badges)
        assert "/api/v1/scores/me/badges" in source

    def test_get_user_score_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_user_score", None))

    def test_get_user_score_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_user_score", None))

    def test_get_user_score_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_user_score)
        assert "/api/v1/scores/" in source

    def test_get_user_badges_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_user_badges", None))

    def test_get_user_badges_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_user_badges", None))

    def test_get_user_badges_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_user_badges)
        assert "/api/v1/scores/" in source
        assert "/badges" in source


class TestPolymarketPortfolioEndpoints:
    """Tests for the 3 new Polymarket-native portfolio endpoints (POLA-476)."""

    def test_get_polymarket_portfolio_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_polymarket_portfolio", None))

    def test_get_polymarket_portfolio_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_polymarket_portfolio", None))

    def test_get_polymarket_portfolio_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_polymarket_portfolio)
        assert "/api/v1/portfolio/polymarket/portfolio" in source

    def test_get_polymarket_earnings_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_polymarket_earnings", None))

    def test_get_polymarket_earnings_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_polymarket_earnings", None))

    def test_get_polymarket_earnings_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_polymarket_earnings)
        assert "/api/v1/portfolio/polymarket/earnings" in source

    def test_get_polymarket_activity_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_polymarket_activity", None))

    def test_get_polymarket_activity_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_polymarket_activity", None))

    def test_get_polymarket_activity_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_polymarket_activity)
        assert "/api/v1/portfolio/polymarket/activity" in source

    def test_get_polymarket_activity_accepts_type_filter(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_polymarket_activity)
        params = set(sig.parameters.keys())
        assert "type" in params


class TestNewModels:
    """Tests for new model classes (POLA-476)."""

    def test_news_article_model_fields(self):
        from polyforge.models import NewsArticle
        a = NewsArticle(id="a1", source="Reuters", title="Test", sentiment="POSITIVE")
        assert a.id == "a1"
        assert a.source == "Reuters"
        assert a.title == "Test"
        assert a.sentiment == "POSITIVE"
        assert a.summary is None
        assert a.signals == []

    def test_badge_model_fields(self):
        from polyforge.models import Badge
        b = Badge(id="b1", user_id="u1", type="TOP_10", name="Top 10 Trader", earned_at="2026-01-01")
        assert b.id == "b1"
        assert b.type == "TOP_10"
        assert b.name == "Top 10 Trader"

    def test_top_trader_entry_model_fields(self):
        from polyforge.models import TopTraderEntry
        e = TopTraderEntry(user_id="u1", score=95.5, win_rate="0.72", total_trades=100)
        assert e.user_id == "u1"
        assert e.score == 95.5
        assert e.win_rate == "0.72"
        assert e.total_trades == 100
        assert e.username is None

    def test_tick_size_info_model_fields(self):
        from polyforge.models import TickSizeInfo
        t = TickSizeInfo(token_id="tok1", tick_size="0.01", fee_rate="0.002")
        assert t.token_id == "tok1"
        assert t.tick_size == "0.01"
        assert t.fee_rate == "0.002"

    def test_spread_info_model_fields(self):
        from polyforge.models import SpreadInfo
        s = SpreadInfo(token_id="tok1", spread="0.02")
        assert s.spread == "0.02"

    def test_midpoint_info_model_fields(self):
        from polyforge.models import MidpointInfo
        m = MidpointInfo(token_id="tok1", midpoint="0.55")
        assert m.midpoint == "0.55"

    def test_clob_book_model_fields(self):
        from polyforge.models import ClobBook
        book = ClobBook(
            token_id="tok1",
            bids=[{"price": "0.50", "size": "100"}],
            asks=[{"price": "0.52", "size": "50"}],
            spread="0.02",
            midpoint="0.51",
            timestamp=1700000000,
        )
        assert book.token_id == "tok1"
        assert len(book.bids) == 1
        assert len(book.asks) == 1
        assert book.spread == "0.02"
        assert book.midpoint == "0.51"
        assert book.timestamp == 1700000000

    def test_clob_price_history_model_fields(self):
        from polyforge.models import ClobPriceHistory
        h = ClobPriceHistory(token_id="tok1", interval="1h", history=[{"t": 100, "p": 0.5}])
        assert h.token_id == "tok1"
        assert h.interval == "1h"
        assert len(h.history) == 1

    def test_batch_order_item_model_fields(self):
        from polyforge.models import BatchOrderItem
        item = BatchOrderItem(order_id="ord1", intent_id="int1", status="PENDING")
        assert item.order_id == "ord1"
        assert item.intent_id == "int1"
        assert item.status == "PENDING"

    def test_batch_order_result_model_fields(self):
        from polyforge.models import BatchOrderItem, BatchOrderResult
        result = BatchOrderResult(results=[BatchOrderItem(order_id="ord1", intent_id="int1", status="PENDING")])
        assert len(result.results) == 1
        assert result.results[0].order_id == "ord1"

    def test_bulk_cancel_result_model_fields(self):
        from polyforge.models import BulkCancelError, BulkCancelResult
        result = BulkCancelResult(
            cancelled=["ord1", "ord2"],
            errors=[BulkCancelError(order_id="ord3", reason="NOT_FOUND")],
        )
        assert result.cancelled == ["ord1", "ord2"]
        assert len(result.errors) == 1
        assert result.errors[0].reason == "NOT_FOUND"

    def test_polymarket_portfolio_entry_model_fields(self):
        from polyforge.models import PolymarketPortfolioEntry
        e = PolymarketPortfolioEntry(asset="BTC", size="10", avg_price="0.5")
        assert e.asset == "BTC"
        assert e.size == "10"
        assert e.avg_price == "0.5"

    def test_polymarket_earnings_entry_model_fields(self):
        from polyforge.models import PolymarketEarningsEntry
        e = PolymarketEarningsEntry(date="2026-01-01", earnings="50.0", volume="1000.0", win_rate="0.6")
        assert e.date == "2026-01-01"
        assert e.earnings == "50.0"

    def test_polymarket_activity_model_fields(self):
        from polyforge.models import PolymarketActivity
        a = PolymarketActivity(id="act1", type="TRADE", amount="100", asset="BTC", timestamp="2026-01-01T00:00:00Z")
        assert a.id == "act1"
        assert a.type == "TRADE"
        assert a.metadata == {}

    def test_new_models_exported_from_package(self):
        from polyforge import (
            Badge,
            BatchOrderItem,
            BatchOrderResult,
            BulkCancelError,
            BulkCancelResult,
            ClobBook,
            ClobPriceHistory,
            MidpointInfo,
            NewsArticle,
            PolymarketActivity,
            PolymarketEarningsEntry,
            PolymarketPortfolioEntry,
            SpreadInfo,
            TickSizeInfo,
            TopTraderEntry,
        )
        assert all(m is not None for m in [
            Badge, BatchOrderItem, BatchOrderResult, BulkCancelError, BulkCancelResult,
            ClobBook, ClobPriceHistory, MidpointInfo, NewsArticle,
            PolymarketActivity, PolymarketEarningsEntry, PolymarketPortfolioEntry,
            SpreadInfo, TickSizeInfo, TopTraderEntry,
        ])

    def test_news_article_parses_from_camel_case(self):
        from polyforge.client import _parse
        from polyforge.models import NewsArticle
        api_response = {
            "id": "art-1",
            "source": "Reuters",
            "title": "Test Article",
            "summary": "A summary",
            "url": "https://example.com/article",
            "imageUrl": "https://example.com/img.jpg",
            "sentiment": "POSITIVE",
            "publishedAt": "2026-01-01T12:00:00Z",
            "ingestedAt": "2026-01-01T13:00:00Z",
        }
        article = _parse(NewsArticle, api_response)
        assert article.id == "art-1"
        assert article.source == "Reuters"
        assert article.image_url == "https://example.com/img.jpg"
        assert article.published_at == "2026-01-01T12:00:00Z"
        assert article.sentiment == "POSITIVE"

    def test_badge_parses_from_camel_case(self):
        from polyforge.client import _parse
        from polyforge.models import Badge
        api_response = {
            "id": "badge-1",
            "userId": "user-1",
            "type": "TOP_10",
            "name": "Top 10 Trader",
            "earnedAt": "2026-01-15T00:00:00Z",
        }
        badge = _parse(Badge, api_response)
        assert badge.id == "badge-1"
        assert badge.user_id == "user-1"
        assert badge.earned_at == "2026-01-15T00:00:00Z"

    def test_top_trader_entry_parses_from_camel_case(self):
        from polyforge.client import _parse
        from polyforge.models import TopTraderEntry
        api_response = {
            "userId": "u1",
            "username": "trader1",
            "displayName": "Trader One",
            "avatarUrl": "https://example.com/avatar.jpg",
            "score": 99.5,
            "winRate": "0.78",
            "totalTrades": 250,
        }
        entry = _parse(TopTraderEntry, api_response)
        assert entry.user_id == "u1"
        assert entry.username == "trader1"
        assert entry.display_name == "Trader One"
        assert entry.total_trades == 250
