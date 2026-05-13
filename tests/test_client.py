"""Basic smoke tests for PolyforgeClient."""

import json

import httpx
import pytest
from polyforge.client import (
    PolyforgeClient,
    AsyncPolyforgeClient,
    _parse,
    _parse_pagination,
    _raise_for_status,
    _validate_enum,
    _validate_financial_param,
    _validate_webhook_url,
    _is_ip_blocked,
    _resolve_and_validate_ips,
    _VALID_ORDER_TYPES,
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
    MatchSyncResult,
    SystemHealthAuthenticated,
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
    Rebate,
    RedeemPositionResponse,
    RewardsMarketDetail,
    RewardsSponsorUrl,
    MyReferralsResponse,
    RewardMarket,
    Strategy,
    StrategyExecMode,
    StrategyVisibility,
    TraderScore,
    UserReward,
    UserRewardsTotal,
    UserSponsoredMarkets,
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

    def test_start_strategy_sends_mode_field(self):
        """start_strategy() must send {mode: 'live'|'paper'} to match platform contract (#196)."""
        import inspect

        source = inspect.getsource(PolyforgeClient.start_strategy)
        assert '"mode"' in source or "'mode'" in source, "start_strategy() must send 'mode' field"
        assert "paperMode" not in source, "start_strategy() must not send obsolete 'paperMode' field"


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

    def test_valid_order_types_match_platform_dto(self):
        """SDK order types must include all values from platform's OrderTypeDto."""
        platform_order_types = {"GTC", "GTD", "FOK", "FAK", "POST_ONLY"}
        assert _VALID_ORDER_TYPES == platform_order_types

    def test_place_order_accepts_fak(self):
        """FAK is a valid platform order type — SDK must not reject it."""
        _validate_enum("order_type", "FAK", _VALID_ORDER_TYPES)

    def test_place_order_accepts_post_only(self):
        """POST_ONLY is a valid platform order type — SDK must not reject it."""
        _validate_enum("order_type", "POST_ONLY", _VALID_ORDER_TYPES)


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
        assert "kalshi_subaccount" in params

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
        assert "kalshi_subaccount" in params

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
        assert '"kalshiSubaccount"' in source


class TestUpdateStrategyParams:
    """Tests for update_strategy() accepting all platform-supported fields (#144)."""

    def test_update_strategy_accepts_all_params(self):
        """update_strategy() must accept visibility, exec_mode, blocks, tags, etc."""
        import inspect
        sig = inspect.signature(PolyforgeClient.update_strategy)
        params = set(sig.parameters.keys())
        for expected in (
            "name", "description", "market_id", "visibility", "exec_mode",
            "tick_ms", "triggers", "conditions", "actions", "safety",
            "logic_blocks", "calc_blocks", "tags", "variables", "canvas",
            "market_slots", "kalshi_subaccount",
        ):
            assert expected in params, f"missing param: {expected}"

    def test_async_update_strategy_accepts_all_params(self):
        """Async update_strategy() must also accept the expanded params."""
        import inspect
        sig = inspect.signature(AsyncPolyforgeClient.update_strategy)
        params = set(sig.parameters.keys())
        for expected in (
            "name", "description", "market_id", "visibility", "exec_mode",
            "tick_ms", "triggers", "conditions", "actions", "safety",
            "logic_blocks", "calc_blocks", "tags", "variables", "canvas",
            "market_slots", "kalshi_subaccount",
        ):
            assert expected in params, f"missing async param: {expected}"

    def test_update_strategy_sends_camel_case_fields(self):
        """update_strategy() must send camelCase field names to the API."""
        import inspect
        source = inspect.getsource(PolyforgeClient.update_strategy)
        for camel in (
            '"visibility"', '"execMode"', '"tickMs"', '"triggers"',
            '"conditions"', '"actions"', '"safety"', '"logicBlocks"',
            '"calcBlocks"', '"tags"', '"variables"', '"canvas"',
            '"marketSlots"', '"kalshiSubaccount"',
        ):
            assert camel in source, f"missing camelCase key: {camel}"

    def test_update_strategy_params_are_keyword_only(self):
        """All update params after strategy_id must be keyword-only."""
        import inspect
        sig = inspect.signature(PolyforgeClient.update_strategy)
        for pname, param in sig.parameters.items():
            if pname == "self":
                continue
            if pname == "strategy_id":
                assert param.kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
            else:
                assert param.kind == inspect.Parameter.KEYWORD_ONLY, f"{pname} should be keyword-only"


class TestPaginatedResponseDataField:
    """Tests for PaginatedResponse using flat pagination shape matching platform."""

    def test_paginated_response_uses_data_field(self):
        """PaginatedResponse must have a 'data' field, not 'items'."""
        pr = PaginatedResponse(
            data=["a", "b", "c"],
            total=3, page=1, limit=10,
        )
        assert pr.data == ["a", "b", "c"]

    def test_paginated_response_items_is_alias(self):
        """PaginatedResponse.items must be a backward-compat alias for data."""
        pr = PaginatedResponse(
            data=["x", "y"],
            total=2, page=1, limit=10,
        )
        assert pr.items == ["x", "y"]
        assert pr.items is pr.data

    def test_paginated_response_default_empty(self):
        """PaginatedResponse data should default to empty list."""
        pr = PaginatedResponse()
        assert pr.data == []
        assert pr.items == []
        assert pr.page == 1
        assert pr.limit == 10
        assert pr.total == 0
        assert pr.total_pages == 0
        assert pr.has_next is False

    def test_paginated_response_no_has_more(self):
        """PaginatedResponse must NOT have a has_more field."""
        assert not hasattr(PaginatedResponse(), "has_more")

    def test_pagination_flat_fields(self):
        """Pagination metadata must be accessed as flat fields on PaginatedResponse."""
        pr = PaginatedResponse(
            data=[1, 2, 3],
            page=2, limit=20, total=50, total_pages=3, has_next=True,
        )
        assert pr.page == 2
        assert pr.limit == 20
        assert pr.total == 50
        assert pr.total_pages == 3
        assert pr.has_next is True

    def test_paginated_response_has_no_pagination_attr(self):
        """PaginatedResponse must NOT have a nested pagination object."""
        pr = PaginatedResponse()
        assert not hasattr(pr, "pagination")


class TestParsePagination:
    """Tests for _parse_pagination helper — flat field extraction."""

    def test_extracts_flat_pagination(self):
        """_parse_pagination must extract flat fields from the response root."""
        raw = {
            "data": [1, 2, 3],
            "page": 2,
            "limit": 20,
            "total": 150,
            "totalPages": 8,
            "hasNext": True,
        }
        pag = _parse_pagination(raw)
        assert isinstance(pag, dict)
        assert pag["page"] == 2
        assert pag["limit"] == 20
        assert pag["total"] == 150
        assert pag["total_pages"] == 8
        assert pag["has_next"] is True

    def test_defaults_when_fields_missing(self):
        """_parse_pagination must return defaults when fields are absent."""
        raw = {"data": []}
        pag = _parse_pagination(raw)
        assert pag["page"] == 1
        assert pag["limit"] == 10
        assert pag["total"] == 0
        assert pag["total_pages"] == 0
        assert pag["has_next"] is False

    def test_camel_case_total_pages(self):
        """_parse_pagination must map totalPages (camelCase) to total_pages."""
        raw = {"totalPages": 5}
        pag = _parse_pagination(raw)
        assert pag["total_pages"] == 5


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
            avg_price="0.55",
            current_price="0.65",
            unrealized_pnl="10.00",
            realized_pnl="5.00",
        )
        assert isinstance(pos.size, str)
        assert isinstance(pos.avg_price, str)
        assert pos.unrealized_pnl == "10.00"


class TestPositionOrderFieldAlignment:
    """Tests for Position and Order field alignment with platform contract (#143)."""

    def test_position_has_token_id(self):
        """Position must have token_id field (#143)."""
        pos = Position(token_id="0xabc123")
        assert pos.token_id == "0xabc123"

    def test_position_has_outcome(self):
        """Position must have outcome field for YES/NO (#143)."""
        pos_yes = Position(outcome="YES")
        pos_no = Position(outcome="NO")
        assert pos_yes.outcome == "YES"
        assert pos_no.outcome == "NO"

    def test_position_uses_avg_price_not_entry_price(self):
        """Position must use avg_price (platform field), not entry_price (#143)."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(Position)}
        assert "avg_price" in field_names
        assert "entry_price" not in field_names

    def test_position_no_market_name_phantom_field(self):
        """Position must not have phantom market_name field (#143)."""
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(Position)}
        assert "market_name" not in field_names

    def test_position_parses_from_api(self):
        """_parse must map camelCase platform fields to Position (#143)."""
        api_response = {
            "id": "pos-1",
            "marketId": "mkt-abc",
            "tokenId": "0xtoken",
            "outcome": "YES",
            "side": "BUY",
            "size": "50.00",
            "avgPrice": "0.60",
            "currentPrice": "0.70",
            "unrealizedPnl": "5.00",
            "realizedPnl": "0.00",
            "openedAt": "2026-01-01T00:00:00Z",
        }
        pos = _parse(Position, api_response)
        assert pos.token_id == "0xtoken"
        assert pos.outcome == "YES"
        assert pos.avg_price == "0.60"

    def test_order_has_token_id(self):
        """Order must have token_id field (#143)."""
        order = Order(token_id="0xdef456")
        assert order.token_id == "0xdef456"

    def test_order_has_outcome(self):
        """Order must have outcome field for YES/NO (#143)."""
        order = Order(outcome="NO")
        assert order.outcome == "NO"

    def test_order_has_intent_id(self):
        """Order must have intent_id field (#143)."""
        order = Order(intent_id="intent-xyz")
        assert order.intent_id == "intent-xyz"

    def test_order_intent_id_defaults_none(self):
        """Order intent_id must default to None (optional field) (#143)."""
        order = Order()
        assert order.intent_id is None

    def test_order_parses_token_id_and_outcome_from_api(self):
        """_parse must map tokenId and outcome to Order (#143)."""
        api_response = {
            "id": "ord-2",
            "marketId": "mkt-abc",
            "tokenId": "0xtoken",
            "outcome": "YES",
            "intentId": "intent-99",
            "side": "BUY",
            "price": "0.65",
            "size": "100.00",
            "status": "LIVE",
        }
        order = _parse(Order, api_response)
        assert order.token_id == "0xtoken"
        assert order.outcome == "YES"
        assert order.intent_id == "intent-99"


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
    """Tests for PriceHistoryEntry model (#51, #148)."""

    def test_price_history_entry_ohlcv_fields(self):
        """PriceHistoryEntry must have timestamp and OHLCV fields."""
        entry = PriceHistoryEntry(
            timestamp="2026-04-13T00:00:00Z",
            open=0.45, high=0.70, low=0.40, close=0.65, volume=1234.5,
        )
        assert entry.timestamp == "2026-04-13T00:00:00Z"
        assert entry.open == 0.45
        assert entry.high == 0.70
        assert entry.low == 0.40
        assert entry.close == 0.65
        assert entry.volume == 1234.5

    def test_price_history_entry_price_compat(self):
        """PriceHistoryEntry.price should alias close for backward compatibility (#148)."""
        entry = PriceHistoryEntry(close=0.65)
        assert entry.price == 0.65

    def test_price_history_entry_defaults(self):
        """PriceHistoryEntry defaults should be sensible."""
        entry = PriceHistoryEntry()
        assert entry.timestamp == ""
        assert entry.open == 0.0
        assert entry.high == 0.0
        assert entry.low == 0.0
        assert entry.close == 0.0
        assert entry.volume == 0.0
        assert entry.price == 0.0


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

    def test_parse_ohlcv_candle_from_platform_response(self):
        """_parse must map platform OHLCV candle shape to PriceHistoryEntry (#148)."""
        from polyforge.client import _parse

        candle = {
            "time": "2026-04-13T12:00:00Z",
            "open": "0.450000",
            "high": "0.700000",
            "low": "0.400000",
            "close": "0.650000",
            "volume": "1234.560000",
        }
        entry = _parse(PriceHistoryEntry, candle)
        assert entry.timestamp == "2026-04-13T12:00:00Z"
        assert entry.open == 0.45
        assert entry.high == 0.70
        assert entry.low == 0.40
        assert entry.close == 0.65
        assert entry.volume == 1234.56
        assert entry.price == 0.65

    def test_parse_ohlcv_candle_zero_defaults(self):
        """_parse handles '0' string values from platform correctly (#148)."""
        from polyforge.client import _parse

        candle = {
            "time": "2026-04-13T12:00:00Z",
            "open": "0",
            "high": "0",
            "low": "0",
            "close": "0",
            "volume": "0",
        }
        entry = _parse(PriceHistoryEntry, candle)
        assert entry.timestamp == "2026-04-13T12:00:00Z"
        assert entry.open == 0.0
        assert entry.close == 0.0


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

    # -- Regression: price must be sent as string (#162 / POLA-332) --

    def test_sync_create_alert_sends_price_as_string(self):
        """create_alert() must convert price to str for @IsNumberString."""
        import inspect

        source = inspect.getsource(PolyforgeClient.create_alert)
        assert 'str(price)' in source, (
            "price must be serialised as str(price) — platform requires @IsNumberString"
        )

    def test_async_create_alert_sends_price_as_string(self):
        """Async create_alert() must convert price to str for @IsNumberString."""
        import inspect

        source = inspect.getsource(AsyncPolyforgeClient.create_alert)
        assert 'str(price)' in source, (
            "price must be serialised as str(price) — platform requires @IsNumberString"
        )


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
        assert "_parse_pagination(raw)" in source


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
        assert "_parse_pagination(raw)" in source

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
        for name in ("sort", "category", "search", "limit", "page"):
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
        for name in ("period", "limit", "page"):
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
        assert "limit" in params

    def test_sync_get_top_whales_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_top_whales)
        assert "/api/v1/whales/top" in source
        assert "_get" in source

    def test_sync_get_top_whales_sends_sort_by(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_top_whales)
        assert '"sortBy"' in source, "sync get_top_whales must send 'sortBy' (not 'sort') as query param"

    def test_async_get_top_whales_sends_sort_by(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_top_whales)
        assert '"sortBy"' in source, "async get_top_whales must send 'sortBy' (not 'sort') as query param"

    def test_sync_get_top_whales_sends_limit(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_top_whales)
        assert '"limit"' in source, "sync get_top_whales must include 'limit' query param"

    def test_async_get_top_whales_sends_limit(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_top_whales)
        assert '"limit"' in source, "async get_top_whales must include 'limit' query param"

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


class TestWhaleLeaderboardAlertFilterActions:
    """Tests for whale leaderboard, whale alert filter CRUD, and actions endpoint."""

    # -- get_whale_leaderboard --

    def test_sync_get_whale_leaderboard_exists(self):
        assert hasattr(PolyforgeClient, "get_whale_leaderboard")

    def test_async_get_whale_leaderboard_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_whale_leaderboard")

    def test_sync_get_whale_leaderboard_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_whale_leaderboard)
        params = set(sig.parameters.keys())
        assert "period" in params
        assert "limit" in params

    def test_sync_get_whale_leaderboard_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_whale_leaderboard)
        assert "/api/v1/whales/leaderboard" in source
        assert "_get" in source

    def test_async_get_whale_leaderboard_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_whale_leaderboard)
        assert "/api/v1/whales/leaderboard" in source

    def test_sync_get_whale_leaderboard_sends_period(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_whale_leaderboard)
        assert '"period"' in source

    def test_sync_get_whale_leaderboard_sends_limit(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_whale_leaderboard)
        assert '"limit"' in source

    # -- get_whale_alert_filter --

    def test_sync_get_whale_alert_filter_exists(self):
        assert hasattr(PolyforgeClient, "get_whale_alert_filter")

    def test_async_get_whale_alert_filter_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_whale_alert_filter")

    def test_sync_get_whale_alert_filter_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_whale_alert_filter)
        assert "/api/v1/whales/alerts/filter" in source
        assert "_get" in source

    def test_async_get_whale_alert_filter_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_whale_alert_filter)
        assert "/api/v1/whales/alerts/filter" in source

    # -- set_whale_alert_filter --

    def test_sync_set_whale_alert_filter_exists(self):
        assert hasattr(PolyforgeClient, "set_whale_alert_filter")

    def test_async_set_whale_alert_filter_exists(self):
        assert hasattr(AsyncPolyforgeClient, "set_whale_alert_filter")

    def test_sync_set_whale_alert_filter_params(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.set_whale_alert_filter)
        params = set(sig.parameters.keys())
        assert "min_size" in params
        assert "market_ids" in params
        assert "wallet_addresses" in params
        assert "sides" in params
        assert "active" in params

    def test_sync_set_whale_alert_filter_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.set_whale_alert_filter)
        assert "/api/v1/whales/alerts/filter" in source
        assert "_put" in source

    def test_async_set_whale_alert_filter_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.set_whale_alert_filter)
        assert "/api/v1/whales/alerts/filter" in source
        assert "_put" in source

    def test_sync_set_whale_alert_filter_sends_camel_case(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.set_whale_alert_filter)
        assert '"minSize"' in source
        assert '"marketIds"' in source
        assert '"walletAddresses"' in source

    # -- delete_whale_alert_filter --

    def test_sync_delete_whale_alert_filter_exists(self):
        assert hasattr(PolyforgeClient, "delete_whale_alert_filter")

    def test_async_delete_whale_alert_filter_exists(self):
        assert hasattr(AsyncPolyforgeClient, "delete_whale_alert_filter")

    def test_sync_delete_whale_alert_filter_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.delete_whale_alert_filter)
        assert "/api/v1/whales/alerts/filter" in source
        assert "_delete" in source

    def test_async_delete_whale_alert_filter_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.delete_whale_alert_filter)
        assert "/api/v1/whales/alerts/filter" in source
        assert "_delete" in source

    # -- get_actions --

    def test_sync_get_actions_exists(self):
        assert hasattr(PolyforgeClient, "get_actions")

    def test_async_get_actions_exists(self):
        assert hasattr(AsyncPolyforgeClient, "get_actions")

    def test_sync_get_actions_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_actions)
        assert "/api/v1/actions" in source
        assert "_get" in source

    def test_async_get_actions_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_actions)
        assert "/api/v1/actions" in source

    # -- model defaults --

    def test_whale_leaderboard_entry_defaults(self):
        from polyforge.models import WhaleLeaderboardEntry
        entry = WhaleLeaderboardEntry()
        assert entry.rank == 0
        assert entry.wallet_address == ""
        assert entry.smart_money_score == ""
        assert entry.total_pnl == ""
        assert entry.trade_count == 0

    def test_whale_alert_filter_defaults(self):
        from polyforge.models import WhaleAlertFilter
        f = WhaleAlertFilter()
        assert f.id == ""
        assert f.min_size is None
        assert f.market_ids == []
        assert f.wallet_addresses == []
        assert f.sides == []
        assert f.active is True

    def test_actions_schema_defaults(self):
        from polyforge.models import ActionsSchema, ActionDefinition, ActionParameter
        schema = ActionsSchema()
        assert schema.version == ""
        assert schema.actions == []
        ad = ActionDefinition()
        assert ad.name == ""
        assert ad.parameters == []
        ap = ActionParameter()
        assert ap.name == ""
        assert ap.required is False

    # -- _put helper exists --

    def test_sync_put_helper_exists(self):
        assert hasattr(PolyforgeClient, "_put")

    def test_async_put_helper_exists(self):
        assert hasattr(AsyncPolyforgeClient, "_put")


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

    def test_batch_orders_validates_minimum(self):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="at least 1"):
            client.batch_orders([])
        client.close()

    def test_batch_orders_validates_maximum(self):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="at most 15"):
            client.batch_orders([{"tokenId": f"t{i}"} for i in range(16)])
        client.close()

    def test_batch_orders_rejects_nan_order_size(self):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="NaN"):
            client.batch_orders([{
                "tokenId": "tok",
                "side": "BUY",
                "outcome": "YES",
                "size": float("nan"),
                "price": 0.5,
            }])
        client.close()

    def test_batch_orders_rejects_invalid_order_enum(self):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="must be one of"):
            client.batch_orders([{
                "tokenId": "tok",
                "side": "HOLD",
                "outcome": "YES",
                "size": 10,
                "price": 0.5,
            }])
        client.close()

    def test_bulk_cancel_orders_validates_minimum(self):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="at least 1"):
            client.bulk_cancel_orders([])
        client.close()

    def test_bulk_cancel_orders_validates_maximum(self):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="at most 3000"):
            client.bulk_cancel_orders(["x"] * 3001)
        client.close()


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

    @staticmethod
    def _client_with(handler):
        transport = httpx.MockTransport(handler)
        client = PolyforgeClient(api_key="test", api_url="http://localhost:9999")
        client._client = httpx.Client(
            base_url="http://localhost:9999",
            headers={"Authorization": "Bearer test"},
            transport=transport,
        )
        return client

    @staticmethod
    def _async_client_with(handler):
        transport = httpx.MockTransport(handler)
        client = AsyncPolyforgeClient(api_key="test", api_url="http://localhost:9999")
        client._client = httpx.AsyncClient(
            base_url="http://localhost:9999",
            headers={"Authorization": "Bearer test"},
            transport=transport,
        )
        return client

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
        assert "activity_type" in params

    def test_get_polymarket_portfolio_reads_entries_wrapper(self):
        def handler(request):
            assert request.url.path == "/api/v1/portfolio/polymarket/portfolio"
            return httpx.Response(200, json={
                "entries": [
                    {"asset": "BTC", "size": "10", "avgPrice": "0.50"},
                ],
            })

        client = self._client_with(handler)
        try:
            entries = client.get_polymarket_portfolio()
            assert len(entries) == 1
            assert entries[0].asset == "BTC"
            assert entries[0].size == "10"
            assert entries[0].avg_price == "0.50"
        finally:
            client.close()

    def test_get_polymarket_earnings_reads_entries_wrapper(self):
        def handler(request):
            assert request.url.path == "/api/v1/portfolio/polymarket/earnings"
            return httpx.Response(200, json={
                "entries": [
                    {
                        "date": "2026-01-01",
                        "earnings": "50.0",
                        "volume": "1000.0",
                        "winRate": "0.6",
                    },
                ],
            })

        client = self._client_with(handler)
        try:
            entries = client.get_polymarket_earnings()
            assert len(entries) == 1
            assert entries[0].date == "2026-01-01"
            assert entries[0].earnings == "50.0"
            assert entries[0].win_rate == "0.6"
        finally:
            client.close()

    def test_get_polymarket_activity_reads_activities_wrapper_and_filter(self):
        captured = {}

        def handler(request):
            captured["params"] = dict(request.url.params)
            assert request.url.path == "/api/v1/portfolio/polymarket/activity"
            return httpx.Response(200, json={
                "activities": [
                    {"id": "act-1", "type": "trade", "amount": "12.5"},
                ],
            })

        client = self._client_with(handler)
        try:
            activities = client.get_polymarket_activity(activity_type="trade")
            assert captured["params"] == {"type": "trade"}
            assert len(activities) == 1
            assert activities[0].id == "act-1"
            assert activities[0].type == "trade"
            assert activities[0].amount == "12.5"
        finally:
            client.close()

    def test_async_polymarket_wrappers_match_sync_fields(self):
        import asyncio

        def handler(request):
            if request.url.path.endswith("/portfolio"):
                return httpx.Response(200, json={
                    "entries": [{"asset": "ETH", "size": "2"}],
                })
            if request.url.path.endswith("/earnings"):
                return httpx.Response(200, json={
                    "entries": [{"date": "2026-01-02", "earnings": "5"}],
                })
            if request.url.path.endswith("/activity"):
                return httpx.Response(200, json={
                    "activities": [{"id": "act-2", "type": "deposit"}],
                })
            return httpx.Response(404)

        async def _run():
            client = self._async_client_with(handler)
            try:
                portfolio = await client.get_polymarket_portfolio()
                earnings = await client.get_polymarket_earnings()
                activity = await client.get_polymarket_activity()
                assert portfolio[0].asset == "ETH"
                assert earnings[0].date == "2026-01-02"
                assert activity[0].id == "act-2"
            finally:
                await client.close()

        asyncio.run(_run())


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


class TestRedeemPosition:
    """Tests for redeem_position response type (POLA-478, POLA-488).

    The platform returns positionId (not orderId) from /api/v1/orders/redeem.
    POLA-488: return type must be RedeemPositionResponse (not PlaceOrderResponse).
    """

    def test_redeem_position_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "redeem_position", None))

    def test_redeem_position_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "redeem_position", None))

    def test_redeem_position_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.redeem_position)
        assert "/api/v1/orders/redeem" in source

    def test_redeem_position_parses_position_id_not_order_id(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.redeem_position)
        assert 'data["positionId"]' in source
        assert 'data["orderId"]' not in source

    def test_redeem_position_async_parses_position_id_not_order_id(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.redeem_position)
        assert 'data["positionId"]' in source
        assert 'data["orderId"]' not in source

    def test_redeem_position_returns_redeem_position_response(self):
        import typing
        hints = typing.get_type_hints(PolyforgeClient.redeem_position)
        assert hints["return"] is RedeemPositionResponse

    def test_redeem_position_async_returns_redeem_position_response(self):
        import typing
        hints = typing.get_type_hints(AsyncPolyforgeClient.redeem_position)
        assert hints["return"] is RedeemPositionResponse

    def test_redeem_position_response_model(self):
        resp = RedeemPositionResponse(position_id="pos-1", intent_id="int-1", status="REDEEMED")
        assert resp.position_id == "pos-1"
        assert resp.intent_id == "int-1"
        assert resp.status == "REDEEMED"

    def test_redeem_position_response_defaults(self):
        resp = RedeemPositionResponse()
        assert resp.position_id == ""
        assert resp.intent_id == ""
        assert resp.status == ""



class TestRewardsModels:
    """Tests for Rewards dataclass models."""

    def test_reward_market_defaults(self):
        rm = RewardMarket()
        assert rm.condition_id == ""
        assert rm.rewards_daily == ""
        assert rm.rewards_max_spread == ""
        assert rm.rewards_min_size == ""
        assert rm.start_date == ""
        assert rm.end_date == ""

    def test_reward_market_with_values(self):
        rm = RewardMarket(
            condition_id="0xabc",
            rewards_daily="100.5",
            rewards_max_spread="0.05",
            rewards_min_size="25",
            start_date="2025-01-01",
            end_date="2025-12-31",
        )
        assert rm.condition_id == "0xabc"
        assert rm.rewards_daily == "100.5"

    def test_user_reward_defaults(self):
        ur = UserReward()
        assert ur.date == ""
        assert ur.amount == ""
        assert ur.market == ""

    def test_user_rewards_total_defaults(self):
        urt = UserRewardsTotal()
        assert urt.total == ""
        assert urt.by_date == []

    def test_rebate_defaults(self):
        r = Rebate()
        assert r.date == ""
        assert r.amount == ""
        assert r.fees_paid == ""

    def test_parse_reward_market(self):
        data = {
            "conditionId": "0xabc",
            "rewardsDaily": "100",
            "rewardsMaxSpread": "0.05",
            "rewardsMinSize": "25",
            "startDate": "2025-01-01",
            "endDate": "2025-12-31",
        }
        rm = _parse(RewardMarket, data)
        assert rm.condition_id == "0xabc"
        assert rm.rewards_daily == "100"
        assert rm.rewards_max_spread == "0.05"
        assert rm.rewards_min_size == "25"
        assert rm.start_date == "2025-01-01"
        assert rm.end_date == "2025-12-31"

    def test_parse_user_reward(self):
        data = {"date": "2025-04-01", "amount": "12.5", "market": "Will X happen?"}
        ur = _parse(UserReward, data)
        assert ur.date == "2025-04-01"
        assert ur.amount == "12.5"
        assert ur.market == "Will X happen?"

    def test_parse_user_rewards_total(self):
        data = {"total": "500.25", "byDate": [{"date": "2025-04-01", "amount": "50"}]}
        urt = _parse(UserRewardsTotal, data)
        assert urt.total == "500.25"
        assert len(urt.by_date) == 1

    def test_parse_rebate(self):
        data = {"date": "2025-04-01", "amount": "3.5", "feesPaid": "10.0"}
        r = _parse(Rebate, data)
        assert r.date == "2025-04-01"
        assert r.amount == "3.5"
        assert r.fees_paid == "10.0"

    def test_rewards_market_detail_defaults(self):
        rmd = RewardsMarketDetail()
        assert rmd.condition_id == ""
        assert rmd.rate_per_day == ""
        assert rmd.total_rewards == ""
        assert rmd.remaining_reward_amount == ""
        assert rmd.max_spread == ""
        assert rmd.min_size == ""
        assert rmd.start_date == ""
        assert rmd.end_date == ""

    def test_parse_rewards_market_detail(self):
        data = {
            "conditionId": "0xabc",
            "rate_per_day": "50.0",
            "total_rewards": "1000.0",
            "remaining_reward_amount": "500.0",
            "max_spread": "0.02",
            "min_size": "100",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
        }
        rmd = _parse(RewardsMarketDetail, data)
        assert rmd.condition_id == "0xabc"
        assert rmd.rate_per_day == "50.0"
        assert rmd.total_rewards == "1000.0"
        assert rmd.remaining_reward_amount == "500.0"
        assert rmd.max_spread == "0.02"
        assert rmd.min_size == "100"
        assert rmd.start_date == "2025-01-01"
        assert rmd.end_date == "2025-12-31"

    def test_user_sponsored_markets_defaults(self):
        usm = UserSponsoredMarkets()
        assert usm.markets == []

    def test_parse_user_sponsored_markets(self):
        data = {"markets": [{"id": "m1"}, {"id": "m2"}]}
        usm = _parse(UserSponsoredMarkets, data)
        assert len(usm.markets) == 2

    def test_rewards_sponsor_url_defaults(self):
        rsu = RewardsSponsorUrl()
        assert rsu.url == ""

    def test_parse_rewards_sponsor_url(self):
        data = {"url": "https://polymarket.com/event/some-slug/rewards"}
        rsu = _parse(RewardsSponsorUrl, data)
        assert rsu.url == "https://polymarket.com/event/some-slug/rewards"


class TestRewardsMethods:
    """Tests for Rewards API methods on sync and async clients."""

    REWARD_METHODS = [
        "list_rewards_markets",
        "get_rewards_for_market",
        "get_user_rewards",
        "get_user_rewards_total",
        "get_user_rewards_percentages",
        "get_user_rewards_per_market",
        "get_rebates",
        "get_market_rewards_detail",
        "get_user_sponsored_markets",
        "get_rewards_sponsor_url",
    ]

    @pytest.mark.parametrize("method", REWARD_METHODS)
    def test_sync_method_exists(self, method):
        assert hasattr(PolyforgeClient, method)
        assert callable(getattr(PolyforgeClient, method))

    @pytest.mark.parametrize("method", REWARD_METHODS)
    def test_async_method_exists(self, method):
        assert hasattr(AsyncPolyforgeClient, method)
        assert callable(getattr(AsyncPolyforgeClient, method))

    def test_get_rewards_for_market_accepts_condition_id(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_rewards_for_market)
        assert "condition_id" in sig.parameters

    def test_get_rewards_for_market_uses_encode_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_rewards_for_market)
        assert "_encode_path(condition_id)" in source

    def test_sync_endpoints_use_correct_paths(self):
        import inspect
        path_map = {
            "list_rewards_markets": "/api/v1/rewards/markets",
            "get_rewards_for_market": "/api/v1/rewards/markets/",
            "get_user_rewards": "/api/v1/rewards/user",
            "get_user_rewards_total": "/api/v1/rewards/user/total",
            "get_user_rewards_percentages": "/api/v1/rewards/user/percentages",
            "get_user_rewards_per_market": "/api/v1/rewards/user/markets",
            "get_rebates": "/api/v1/rewards/rebates",
            "get_market_rewards_detail": "/api/v1/rewards/market/",
            "get_user_sponsored_markets": "/api/v1/rewards/user/sponsored-markets",
            "get_rewards_sponsor_url": "/api/v1/rewards/sponsor-url/",
        }
        for method_name, expected_path in path_map.items():
            source = inspect.getsource(getattr(PolyforgeClient, method_name))
            assert expected_path in source, f"{method_name} missing path {expected_path}"

    def test_async_endpoints_use_correct_paths(self):
        import inspect
        path_map = {
            "list_rewards_markets": "/api/v1/rewards/markets",
            "get_rewards_for_market": "/api/v1/rewards/markets/",
            "get_user_rewards": "/api/v1/rewards/user",
            "get_user_rewards_total": "/api/v1/rewards/user/total",
            "get_user_rewards_percentages": "/api/v1/rewards/user/percentages",
            "get_user_rewards_per_market": "/api/v1/rewards/user/markets",
            "get_rebates": "/api/v1/rewards/rebates",
            "get_market_rewards_detail": "/api/v1/rewards/market/",
            "get_user_sponsored_markets": "/api/v1/rewards/user/sponsored-markets",
            "get_rewards_sponsor_url": "/api/v1/rewards/sponsor-url/",
        }
        for method_name, expected_path in path_map.items():
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert expected_path in source, f"async {method_name} missing path {expected_path}"

    def test_async_methods_use_await(self):
        import inspect
        for method_name in self.REWARD_METHODS:
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert "await" in source or "async" in source, f"async {method_name} not using await"

    def test_get_market_rewards_detail_returns_detail(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "conditionId": "0xabc",
            "rate_per_day": "50.0",
            "total_rewards": "1000.0",
            "remaining_reward_amount": "500.0",
            "max_spread": "0.02",
            "min_size": "100",
        })
        result = client.get_market_rewards_detail(market_id="some-market")
        assert result.condition_id == "0xabc"
        assert result.rate_per_day == "50.0"
        client._get.assert_called_once_with("/api/v1/rewards/market/some-market")
        client.close()

    def test_get_market_rewards_detail_returns_none_for_null(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value=None)
        result = client.get_market_rewards_detail(market_id="unknown")
        assert result is None
        client.close()

    def test_get_user_sponsored_markets_returns_data(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={"markets": [{"id": "m1"}, {"id": "m2"}]})
        result = client.get_user_sponsored_markets()
        assert len(result.markets) == 2
        client._get.assert_called_once_with("/api/v1/rewards/user/sponsored-markets")
        client.close()

    def test_get_rewards_sponsor_url_returns_url(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={"url": "https://polymarket.com/event/test/rewards"})
        result = client.get_rewards_sponsor_url(market_id="some-market")
        assert result.url == "https://polymarket.com/event/test/rewards"
        client._get.assert_called_once_with("/api/v1/rewards/sponsor-url/some-market")
        client.close()


class TestCrossVenueArbitrage:
    """Tests for cross-venue arbitrage endpoints (8 new SDK methods)."""

    def test_sync_get_cross_venue_opportunities(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value=[{
            "matchId": "m1", "polymarketId": "p1", "kalshiId": "k1",
            "polymarketTitle": "BTC Poly", "kalshiTitle": "BTC Kalshi",
            "category": "Crypto", "confidence": 0.9,
            "polymarketYes": 0.4, "kalshiYes": 0.5,
            "spreadPct": 10.0, "direction": "buy_poly_sell_kalshi",
        }])
        result = client.get_cross_venue_opportunities(min_spread=5.0)
        assert len(result) == 1
        assert result[0].match_id == "m1"
        assert result[0].spread_pct == 10.0
        client._get.assert_called_once_with("/api/v1/arbitrage/cross-venue", params={"minSpread": 5.0})
        client.close()

    def test_sync_get_cross_venue_for_market(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value=[{
            "matchId": "m1", "polymarketId": "p1", "kalshiId": "k1",
            "polymarketTitle": "BTC", "kalshiTitle": "BTC K",
            "category": "Crypto", "confidence": 0.85,
            "polymarketYes": 0.4, "kalshiYes": 0.5,
            "spreadPct": 10.0, "direction": "buy_poly_sell_kalshi",
        }])
        result = client.get_cross_venue_opportunities_for_market("p1")
        assert len(result) == 1
        assert result[0].polymarket_id == "p1"
        client.close()

    def test_sync_get_market_matches(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={"matches": [{"id": "m1"}], "total": 1})
        result = client.get_market_matches(verified=True, limit=10)
        assert result["total"] == 1
        client._get.assert_called_once_with(
            "/api/v1/arbitrage/matches",
            params={"limit": 10, "offset": 0, "verified": "true"},
        )
        client.close()

    def test_sync_get_market_match(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "id": "m1", "polymarketId": "p1", "kalshiId": "k1",
            "confidence": 0.9, "matchMethod": "auto_tfidf",
            "verified": True, "createdAt": "2026-04-24T00:00:00Z",
            "updatedAt": "2026-04-24T00:00:00Z",
        })
        result = client.get_market_match("m1")
        assert result.id == "m1"
        assert result.verified is True
        client.close()

    def test_sync_sync_market_matches(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={"matched": 12})
        result = client.sync_market_matches()
        assert isinstance(result, MatchSyncResult)
        assert result.matched == 12
        client._post.assert_called_once_with(
            "/api/v1/arbitrage/matches/sync",
        )
        client.close()

    def test_sync_get_spread_comparison(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value=[{
            "matchId": "m1",
            "polymarket": {"marketId": "p1", "title": "BTC Poly", "yesBid": 0.4, "noAsk": 0.6},
            "kalshi": {"marketId": "k1", "title": "BTC Kalshi", "yesBid": 0.5, "noAsk": 0.5},
            "yesSpreadPct": 10.0, "noSpreadPct": 10.0,
            "confidence": 0.9, "verified": True,
        }])
        result = client.get_spread_comparison()
        assert len(result) == 1
        assert result[0].yes_spread_pct == 10.0
        assert result[0].polymarket.market_id == "p1"
        client.close()

    def test_sync_get_arbitrage_history(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "snapshots": [{"id": "s1", "matchId": "m1", "spreadPct": 5.0}],
            "total": 1,
        })
        result = client.get_arbitrage_history(match_id="m1", limit=10)
        assert result["total"] == 1
        client._get.assert_called_once_with(
            "/api/v1/arbitrage/history",
            params={"limit": 10, "offset": 0, "matchId": "m1"},
        )
        client.close()

    def test_sync_get_arbitrage_alerts(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value=[{
            "id": "a1", "minSpreadPct": 5.0, "marketId": None,
            "active": True, "triggeredAt": None, "createdAt": "2026-04-24T00:00:00Z",
        }])
        result = client.get_arbitrage_alerts()
        assert len(result) == 1
        assert result[0].min_spread_pct == 5.0
        assert result[0].active is True
        client.close()

    def test_sync_create_arbitrage_alert(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={
            "id": "a1", "minSpreadPct": 5.0, "marketId": "p1",
            "active": True, "triggeredAt": None, "createdAt": "2026-04-24T00:00:00Z",
        })
        result = client.create_arbitrage_alert(min_spread_pct=5.0, market_id="p1")
        assert result.id == "a1"
        assert result.market_id == "p1"
        client._post.assert_called_once_with(
            "/api/v1/arbitrage/alerts",
            json={"minSpreadPct": "5.0", "marketId": "p1"},
        )
        client.close()

    def test_sync_delete_arbitrage_alert(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._delete = MagicMock(return_value=None)
        client.delete_arbitrage_alert("a1")
        client._delete.assert_called_once_with("/api/v1/arbitrage/alerts/a1")
        client.close()

    def test_sync_get_cross_venue_comparison(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "matchId": "m1",
            "polymarket": {"marketId": "p1", "title": "BTC Poly", "yesPrice": 0.4, "noPrice": 0.6},
            "kalshi": {"marketId": "k1", "title": "BTC Kalshi", "yesPrice": 0.5, "noPrice": 0.5},
            "spreadPct": 10.0, "confidence": 0.9, "verified": True,
        })
        result = client.get_cross_venue_comparison("m1")
        assert result.match_id == "m1"
        assert result.spread_pct == 10.0
        assert result.polymarket.market_id == "p1"
        assert result.kalshi.yes_price == 0.5
        assert result.verified is True
        client._get.assert_called_once_with("/api/v1/arbitrage/cross-venue/m1/comparison")
        client.close()

    def test_sync_get_matches_by_market(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value=[{
            "id": "m1", "polymarketId": "p1", "kalshiId": "k1",
            "confidence": 0.9, "matchMethod": "auto_tfidf",
            "verified": True, "createdAt": "2026-04-24T00:00:00Z",
            "updatedAt": "2026-04-24T00:00:00Z",
        }])
        result = client.get_matches_by_market("p1")
        assert len(result) == 1
        assert result[0].id == "m1"
        assert result[0].polymarket_id == "p1"
        client._get.assert_called_once_with("/api/v1/arbitrage/matches/market/p1")
        client.close()

    def test_admin_only_match_mutations_are_not_public_client_methods(self):
        admin_only_methods = [
            "create_match",
            "verify_match",
            "delete_match",
            "sync_matches",
        ]

        for method_name in admin_only_methods:
            assert not hasattr(PolyforgeClient, method_name)
            assert not hasattr(AsyncPolyforgeClient, method_name)

    def test_async_cross_venue_methods_exist(self):
        import inspect
        methods = [
            "get_cross_venue_opportunities",
            "get_cross_venue_opportunities_for_market",
            "get_market_matches",
            "get_market_match",
            "sync_market_matches",
            "get_spread_comparison",
            "get_arbitrage_history",
            "get_arbitrage_alerts",
            "create_arbitrage_alert",
            "delete_arbitrage_alert",
            "get_cross_venue_comparison",
            "get_matches_by_market",
        ]
        for method_name in methods:
            assert hasattr(AsyncPolyforgeClient, method_name), f"AsyncPolyforgeClient missing {method_name}"
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert "await" in source, f"async {method_name} not using await"


class TestHealthEndpoint:
    """Tests for the authenticated health-check endpoint."""

    def test_sync_get_health_authenticated(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "status": "operational",
            "service": "api-service",
            "version": "2.0.0",
            "uptime": 3600.0,
            "db": {"connections": 5, "status": "ok"},
            "redis": {"memoryUsageMb": 128, "status": "ok"},
            "queueDepth": 0,
        })
        result = client.get_health_authenticated()
        assert isinstance(result, SystemHealthAuthenticated)
        assert result.status == "operational"
        assert result.service == "api-service"
        assert result.db == {"connections": 5, "status": "ok"}
        client._get.assert_called_once_with("/api/v1/status")
        client.close()

    def test_async_get_health_authenticated_is_coroutine(self):
        import inspect
        assert hasattr(AsyncPolyforgeClient, "get_health_authenticated"), \
            "AsyncPolyforgeClient missing get_health_authenticated"
        source = inspect.getsource(AsyncPolyforgeClient.get_health_authenticated)
        assert "await" in source, "async get_health_authenticated not using await"


class TestPositionPlatformContract:
    """Position model must match the platform contract (closes #143)."""

    def test_position_has_token_id_field(self):
        pos = Position(token_id="tok-1")
        assert pos.token_id == "tok-1"

    def test_position_has_outcome_field(self):
        pos = Position(outcome="YES")
        assert pos.outcome == "YES"

    def test_position_uses_avg_price_not_entry_price(self):
        pos = Position(avg_price="0.55")
        assert pos.avg_price == "0.55"

    def test_position_no_entry_price_field(self):
        assert not hasattr(Position, "entry_price") or "entry_price" not in {
            f.name for f in __import__("dataclasses").fields(Position)
        }

    def test_position_no_market_name_field(self):
        assert "market_name" not in {
            f.name for f in __import__("dataclasses").fields(Position)
        }

    def test_position_token_id_defaults_to_empty(self):
        pos = Position()
        assert pos.token_id == ""

    def test_position_outcome_defaults_to_empty(self):
        pos = Position()
        assert pos.outcome == ""

    def test_position_avg_price_defaults_to_empty(self):
        pos = Position()
        assert pos.avg_price == ""

    def test_position_parses_from_platform_response(self):
        api_response = {
            "id": "pos-1",
            "marketId": "mkt-1",
            "tokenId": "tok-1",
            "outcome": "YES",
            "side": "BUY",
            "size": "100.00",
            "avgPrice": "0.55",
            "currentPrice": "0.65",
            "unrealizedPnl": "10.00",
            "realizedPnl": "0.00",
            "openedAt": "2026-01-01T00:00:00Z",
        }
        pos = _parse(Position, api_response)
        assert pos.id == "pos-1"
        assert pos.market_id == "mkt-1"
        assert pos.token_id == "tok-1"
        assert pos.outcome == "YES"
        assert pos.avg_price == "0.55"
        assert pos.current_price == "0.65"


class TestOrderPlatformContract:
    """Order model must match the platform contract (closes #143)."""

    def test_order_has_token_id_field(self):
        order = Order(token_id="tok-1")
        assert order.token_id == "tok-1"

    def test_order_has_outcome_field(self):
        order = Order(outcome="NO")
        assert order.outcome == "NO"

    def test_order_has_intent_id_field(self):
        order = Order(intent_id="int-1")
        assert order.intent_id == "int-1"

    def test_order_token_id_defaults_to_empty(self):
        order = Order()
        assert order.token_id == ""

    def test_order_outcome_defaults_to_empty(self):
        order = Order()
        assert order.outcome == ""

    def test_order_intent_id_defaults_to_none(self):
        order = Order()
        assert order.intent_id is None

    def test_order_parses_from_platform_response(self):
        api_response = {
            "id": "ord-1",
            "marketId": "mkt-1",
            "tokenId": "tok-1",
            "outcome": "YES",
            "strategyId": "str-1",
            "intentId": "int-1",
            "side": "BUY",
            "orderType": "LIMIT",
            "status": "CONFIRMED",
            "price": "0.65",
            "size": "150.00",
            "fillSize": "100.00",
            "fillPrice": "0.64",
            "fee": "0.50",
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-01T01:00:00Z",
        }
        order = _parse(Order, api_response)
        assert order.id == "ord-1"
        assert order.token_id == "tok-1"
        assert order.outcome == "YES"
        assert order.intent_id == "int-1"
        assert order.strategy_id == "str-1"


class TestEndpointPathRegression:
    """Regression tests for issue #149: 12 SDK paths that previously returned 404.

    Each test asserts the exact platform-correct path is present in the method
    source so a future edit cannot silently revert to the broken path.
    """

    def test_sync_get_news_signals_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_news_signals)
        assert "/api/v1/news/signals" in source
        assert "/api/v1/signals/news" not in source

    def test_async_get_news_signals_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_news_signals)
        assert "/api/v1/news/signals" in source
        assert "/api/v1/signals/news" not in source

    def test_sync_get_accuracy_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_accuracy)
        assert "/api/v1/accuracy/me" in source
        assert '"/api/v1/accuracy"' not in source

    def test_async_get_accuracy_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_accuracy)
        assert "/api/v1/accuracy/me" in source
        assert '"/api/v1/accuracy"' not in source

    def test_sync_get_portfolio_review_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_portfolio_review)
        assert "/api/v1/ai/portfolio-review" in source
        assert "/api/v1/portfolio/review" not in source

    def test_async_get_portfolio_review_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_portfolio_review)
        assert "/api/v1/ai/portfolio-review" in source
        assert "/api/v1/portfolio/review" not in source

    def test_sync_get_market_sentiment_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_market_sentiment)
        assert "/api/v1/news/sentiment/" in source
        assert "/api/v1/market-sentiment/" not in source

    def test_async_get_market_sentiment_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.get_market_sentiment)
        assert "/api/v1/news/sentiment/" in source
        assert "/api/v1/market-sentiment/" not in source

    def test_sync_provide_liquidity_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.provide_liquidity)
        assert "/api/v1/lp/provide" in source
        assert "/api/v1/liquidity/provide" not in source

    def test_async_provide_liquidity_path(self):
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.provide_liquidity)
        assert "/api/v1/lp/provide" in source
        assert "/api/v1/liquidity/provide" not in source

    def test_sync_rollback_strategy_full_path(self):
        """Platform path is /strategies/{id}/versions/{vid}/rollback, NOT /strategies/{id}/rollback/{vid}."""
        import inspect
        import re
        source = inspect.getsource(PolyforgeClient.rollback_strategy)
        assert re.search(r"/strategies/.*?/versions/.*?/rollback", source), (
            "rollback_strategy must use path .../versions/{vid}/rollback, not .../rollback/{vid}"
        )

    def test_async_rollback_strategy_full_path(self):
        """Platform path is /strategies/{id}/versions/{vid}/rollback, NOT /strategies/{id}/rollback/{vid}."""
        import inspect
        import re
        source = inspect.getsource(AsyncPolyforgeClient.rollback_strategy)
        assert re.search(r"/strategies/.*?/versions/.*?/rollback", source), (
            "rollback_strategy must use path .../versions/{vid}/rollback, not .../rollback/{vid}"
        )


class TestSseStreamTimeout:
    """Regression tests for SSE stream timeout — POLA-340 / #154."""

    def test_sync_client_accepts_stream_timeout_param(self):
        """PolyforgeClient.__init__ must accept stream_timeout keyword."""
        import inspect
        sig = inspect.signature(PolyforgeClient.__init__)
        assert "stream_timeout" in sig.parameters

    def test_async_client_accepts_stream_timeout_param(self):
        """AsyncPolyforgeClient.__init__ must accept stream_timeout keyword."""
        import inspect
        sig = inspect.signature(AsyncPolyforgeClient.__init__)
        assert "stream_timeout" in sig.parameters

    def test_sync_client_default_stream_timeout_is_24h(self):
        """PolyforgeClient stream_timeout default must be 86400.0 (24 hours)."""
        import inspect
        sig = inspect.signature(PolyforgeClient.__init__)
        assert sig.parameters["stream_timeout"].default == 86400.0

    def test_async_client_default_stream_timeout_is_24h(self):
        """AsyncPolyforgeClient stream_timeout default must be 86400.0 (24 hours)."""
        import inspect
        sig = inspect.signature(AsyncPolyforgeClient.__init__)
        assert sig.parameters["stream_timeout"].default == 86400.0

    def test_sync_client_stores_stream_timeout(self):
        """PolyforgeClient must store stream_timeout as _stream_timeout attribute."""
        client = PolyforgeClient(api_key="test-key", stream_timeout=300.0)
        assert client._stream_timeout == 300.0
        client.close()

    def test_async_client_stores_stream_timeout(self):
        """AsyncPolyforgeClient must store stream_timeout as _stream_timeout attribute."""
        client = AsyncPolyforgeClient(api_key="test-key", stream_timeout=300.0)
        assert client._stream_timeout == 300.0

    def test_sync_watch_strategy_uses_stream_timeout(self):
        """watch_strategy must pass _stream_timeout to httpx, not the default timeout."""
        import inspect
        source = inspect.getsource(PolyforgeClient.watch_strategy)
        assert "self._stream_timeout" in source
        assert "httpx.Timeout" in source

    def test_async_watch_strategy_uses_stream_timeout(self):
        """async watch_strategy must pass _stream_timeout to httpx, not the default timeout."""
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.watch_strategy)
        assert "self._stream_timeout" in source
        assert "httpx.Timeout" in source


# ---------------------------------------------------------------------------
# POLA-830 — User Management P2 (profile/settings/tickets/prefs)
# ---------------------------------------------------------------------------

class TestProfileMethods:
    """Tests for profile management endpoints (sync + async)."""

    PROFILE_METHODS = [
        "update_my_profile",
        "change_password",
        "update_profile_notifications",
        "get_public_profile",
        "toggle_follow",
    ]

    @pytest.mark.parametrize("method", PROFILE_METHODS)
    def test_sync_method_exists(self, method):
        assert hasattr(PolyforgeClient, method)
        assert callable(getattr(PolyforgeClient, method))

    @pytest.mark.parametrize("method", PROFILE_METHODS)
    def test_async_method_exists(self, method):
        assert hasattr(AsyncPolyforgeClient, method)
        assert callable(getattr(AsyncPolyforgeClient, method))

    def test_sync_endpoints_use_correct_paths(self):
        import inspect
        path_map = {
            "update_my_profile": "/api/v1/profile/me",
            "change_password": "/api/v1/profile/password",
            "update_profile_notifications": "/api/v1/profile/notifications",
            "get_public_profile": "/api/v1/profile/",
            "toggle_follow": "/follow",
        }
        for method_name, expected_path in path_map.items():
            source = inspect.getsource(getattr(PolyforgeClient, method_name))
            assert expected_path in source, f"{method_name} missing path {expected_path}"

    def test_async_endpoints_use_correct_paths(self):
        import inspect
        path_map = {
            "update_my_profile": "/api/v1/profile/me",
            "change_password": "/api/v1/profile/password",
            "update_profile_notifications": "/api/v1/profile/notifications",
            "get_public_profile": "/api/v1/profile/",
            "toggle_follow": "/follow",
        }
        for method_name, expected_path in path_map.items():
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert expected_path in source, f"async {method_name} missing path {expected_path}"

    def test_async_methods_use_await(self):
        import inspect
        for method_name in self.PROFILE_METHODS:
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert "await" in source, f"async {method_name} not using await"

    def test_sync_update_my_profile(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._patch = MagicMock(return_value={"displayName": "Alice", "bio": "hi", "avatarUrl": None})
        result = client.update_my_profile(display_name="Alice", bio="hi")
        client._patch.assert_called_once_with(
            "/api/v1/profile/me",
            json={"displayName": "Alice", "bio": "hi"},
        )
        assert result["displayName"] == "Alice"
        client.close()

    def test_sync_change_password(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={"message": "Password changed"})
        result = client.change_password(current_password="old", new_password="new12345")
        client._post.assert_called_once_with(
            "/api/v1/profile/password",
            json={"currentPassword": "old", "newPassword": "new12345"},
        )
        assert result["message"] == "Password changed"
        client.close()

    def test_sync_get_public_profile(self):
        from unittest.mock import MagicMock
        from polyforge.models import UserProfile
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "username": "alice",
            "displayName": "Alice",
            "bio": "builder",
            "avatarUrl": None,
            "followersCount": 10,
            "followingCount": 5,
            "isFollowing": False,
            "publicStrategyCount": 3,
            "joinedAt": "2024-01-01T00:00:00Z",
        })
        result = client.get_public_profile("alice")
        assert isinstance(result, UserProfile)
        assert result.username == "alice"
        assert result.followers_count == 10
        client.close()

    def test_sync_toggle_follow(self):
        from unittest.mock import MagicMock
        from polyforge.models import FollowResult
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={"following": True, "followersCount": 11})
        result = client.toggle_follow("alice")
        assert isinstance(result, FollowResult)
        assert result.following is True
        assert result.followers_count == 11
        client.close()

    def test_sync_update_profile_notifications(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._patch = MagicMock(return_value={"message": "Notification preferences updated"})
        result = client.update_profile_notifications({"emailEnabled": True})
        client._patch.assert_called_once_with(
            "/api/v1/profile/notifications",
            json={"emailEnabled": True},
        )
        assert result["message"] == "Notification preferences updated"
        client.close()


class TestSettingsMethods:
    """Tests for settings endpoints (sync + async)."""

    SETTINGS_METHODS = [
        "update_settings_profile",
        "get_notification_settings",
        "update_notification_settings",
        "update_settings_password",
        "get_beta_usage",
        "get_gas_settings",
    ]

    @pytest.mark.parametrize("method", SETTINGS_METHODS)
    def test_sync_method_exists(self, method):
        assert hasattr(PolyforgeClient, method)
        assert callable(getattr(PolyforgeClient, method))

    @pytest.mark.parametrize("method", SETTINGS_METHODS)
    def test_async_method_exists(self, method):
        assert hasattr(AsyncPolyforgeClient, method)
        assert callable(getattr(AsyncPolyforgeClient, method))

    def test_sync_endpoints_use_correct_paths(self):
        import inspect
        path_map = {
            "update_settings_profile": "/api/v1/settings/profile",
            "get_notification_settings": "/api/v1/settings/notifications",
            "update_notification_settings": "/api/v1/settings/notifications",
            "update_settings_password": "/api/v1/settings/password",
            "get_beta_usage": "/api/v1/settings/beta-usage",
            "get_gas_settings": "/api/v1/settings/gas",
        }
        for method_name, expected_path in path_map.items():
            source = inspect.getsource(getattr(PolyforgeClient, method_name))
            assert expected_path in source, f"{method_name} missing path {expected_path}"

    def test_async_endpoints_use_correct_paths(self):
        import inspect
        path_map = {
            "update_settings_profile": "/api/v1/settings/profile",
            "get_notification_settings": "/api/v1/settings/notifications",
            "update_notification_settings": "/api/v1/settings/notifications",
            "update_settings_password": "/api/v1/settings/password",
            "get_beta_usage": "/api/v1/settings/beta-usage",
            "get_gas_settings": "/api/v1/settings/gas",
        }
        for method_name, expected_path in path_map.items():
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert expected_path in source, f"async {method_name} missing path {expected_path}"

    def test_async_methods_use_await(self):
        import inspect
        for method_name in self.SETTINGS_METHODS:
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert "await" in source or "async" in source, f"async {method_name} not using await"

    def test_sync_update_settings_profile(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._patch = MagicMock(return_value={"displayName": "Bob"})
        result = client.update_settings_profile(display_name="Bob", twitter_handle="@bob")
        client._patch.assert_called_once_with(
            "/api/v1/settings/profile",
            json={"displayName": "Bob", "twitterHandle": "@bob"},
        )
        assert result["displayName"] == "Bob"
        client.close()

    def test_sync_get_notification_settings(self):
        from unittest.mock import MagicMock
        from polyforge.models import NotificationSettings
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "emailEnabled": True,
            "telegramEnabled": False,
            "discordEnabled": False,
            "onOrderFilled": True,
            "onStrategyError": True,
            "onBacktestComplete": False,
            "onDailyLossLimit": False,
            "onMarketResolved": False,
            "onSomeoneForked": False,
            "onSomeoneFollowed": False,
            "onSomeoneLiked": False,
            "onSomeoneCommented": False,
        })
        result = client.get_notification_settings()
        assert isinstance(result, NotificationSettings)
        assert result.email_enabled is True
        assert result.on_order_filled is True
        client.close()

    def test_sync_update_notification_settings_kwargs(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._patch = MagicMock(return_value={"message": "ok"})
        client.update_notification_settings(email_enabled=True, on_order_filled=False)
        client._patch.assert_called_once_with(
            "/api/v1/settings/notifications",
            json={"emailEnabled": True, "onOrderFilled": False},
        )
        client.close()

    def test_sync_get_beta_usage(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={"betaEnabled": True})
        result = client.get_beta_usage()
        client._get.assert_called_once_with("/api/v1/settings/beta-usage")
        assert result["betaEnabled"] is True
        client.close()

    def test_sync_get_gas_settings(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={"gasLevel": "standard"})
        result = client.get_gas_settings()
        client._get.assert_called_once_with("/api/v1/settings/gas")
        assert result["gasLevel"] == "standard"
        client.close()


class TestTicketMethods:
    """Tests for support tickets endpoints (sync + async)."""

    TICKET_METHODS = [
        "list_tickets",
        "create_ticket",
        "get_ticket",
        "add_ticket_message",
    ]

    @pytest.mark.parametrize("method", TICKET_METHODS)
    def test_sync_method_exists(self, method):
        assert hasattr(PolyforgeClient, method)
        assert callable(getattr(PolyforgeClient, method))

    @pytest.mark.parametrize("method", TICKET_METHODS)
    def test_async_method_exists(self, method):
        assert hasattr(AsyncPolyforgeClient, method)
        assert callable(getattr(AsyncPolyforgeClient, method))

    def test_sync_endpoints_use_correct_paths(self):
        import inspect
        path_map = {
            "list_tickets": "/api/v1/tickets",
            "create_ticket": "/api/v1/tickets",
            "get_ticket": "/api/v1/tickets/",
            "add_ticket_message": "/messages",
        }
        for method_name, expected_path in path_map.items():
            source = inspect.getsource(getattr(PolyforgeClient, method_name))
            assert expected_path in source, f"{method_name} missing path {expected_path}"

    def test_async_endpoints_use_correct_paths(self):
        import inspect
        path_map = {
            "list_tickets": "/api/v1/tickets",
            "create_ticket": "/api/v1/tickets",
            "get_ticket": "/api/v1/tickets/",
            "add_ticket_message": "/messages",
        }
        for method_name, expected_path in path_map.items():
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert expected_path in source, f"async {method_name} missing path {expected_path}"

    def test_async_methods_use_await(self):
        import inspect
        for method_name in self.TICKET_METHODS:
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert "await" in source, f"async {method_name} not using await"

    def test_sync_list_tickets(self):
        from unittest.mock import MagicMock
        from polyforge.models import SupportTicket
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "data": [{"id": "t1", "subject": "Help", "category": "GENERAL", "priority": "MEDIUM", "status": "OPEN", "body": "Need help", "messages": [], "createdAt": "2024-01-01", "updatedAt": "2024-01-01"}],
            "pagination": {"total": 1, "page": 1, "limit": 20, "totalPages": 1},
        })
        result = client.list_tickets()
        assert len(result.data) == 1
        assert isinstance(result.data[0], SupportTicket)
        assert result.data[0].subject == "Help"
        client.close()

    def test_sync_create_ticket(self):
        from unittest.mock import MagicMock
        from polyforge.models import SupportTicket
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={
            "id": "t2", "subject": "Bug", "category": "BUG", "priority": "HIGH",
            "status": "OPEN", "body": "Something broke", "messages": [],
            "createdAt": "2024-01-01", "updatedAt": "2024-01-01",
        })
        result = client.create_ticket(subject="Bug", body="Something broke", category="BUG", priority="HIGH")
        client._post.assert_called_once_with(
            "/api/v1/tickets",
            json={"subject": "Bug", "body": "Something broke", "category": "BUG", "priority": "HIGH"},
        )
        assert isinstance(result, SupportTicket)
        assert result.category == "BUG"
        client.close()

    def test_sync_get_ticket(self):
        from unittest.mock import MagicMock
        from polyforge.models import SupportTicket
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "id": "t1", "subject": "Help", "category": "GENERAL",
            "priority": "MEDIUM", "status": "OPEN", "body": "content",
            "messages": [{"id": "m1", "body": "reply", "author": "agent", "createdAt": "2024-01-02"}],
            "createdAt": "2024-01-01", "updatedAt": "2024-01-02",
        })
        result = client.get_ticket("t1")
        assert isinstance(result, SupportTicket)
        assert result.id == "t1"
        client.close()

    def test_sync_add_ticket_message(self):
        from unittest.mock import MagicMock
        from polyforge.models import TicketMessage
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={
            "id": "m2", "body": "thanks", "author": "user", "createdAt": "2024-01-03",
        })
        result = client.add_ticket_message("t1", body="thanks")
        client._post.assert_called_once_with(
            "/api/v1/tickets/t1/messages",
            json={"body": "thanks"},
        )
        assert isinstance(result, TicketMessage)
        assert result.body == "thanks"
        client.close()


class TestNotificationPreferenceMethods:
    """Tests for notification preference endpoints (sync + async)."""

    PREF_METHODS = [
        "get_notification_preferences",
        "update_notification_preferences",
    ]

    @pytest.mark.parametrize("method", PREF_METHODS)
    def test_sync_method_exists(self, method):
        assert hasattr(PolyforgeClient, method)
        assert callable(getattr(PolyforgeClient, method))

    @pytest.mark.parametrize("method", PREF_METHODS)
    def test_async_method_exists(self, method):
        assert hasattr(AsyncPolyforgeClient, method)
        assert callable(getattr(AsyncPolyforgeClient, method))

    def test_sync_endpoints_use_correct_paths(self):
        import inspect
        for method_name in self.PREF_METHODS:
            source = inspect.getsource(getattr(PolyforgeClient, method_name))
            assert "/api/v1/users/me/notification-preferences" in source

    def test_async_endpoints_use_correct_paths(self):
        import inspect
        for method_name in self.PREF_METHODS:
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert "/api/v1/users/me/notification-preferences" in source

    def test_async_methods_use_await(self):
        import inspect
        for method_name in self.PREF_METHODS:
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert "await" in source, f"async {method_name} not using await"

    def test_sync_get_notification_preferences(self):
        from unittest.mock import MagicMock
        from polyforge.models import EventNotificationPreferences, EventNotificationPref
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "preferences": [
                {"event": "ORDER_FILLED", "inApp": True, "email": False, "push": True},
            ],
            "emailDigest": "daily",
        })
        result = client.get_notification_preferences()
        assert isinstance(result, EventNotificationPreferences)
        assert len(result.preferences) == 1
        assert result.preferences[0].event == "ORDER_FILLED"
        assert result.email_digest == "daily"
        client.close()

    def test_sync_update_notification_preferences(self):
        from unittest.mock import MagicMock
        from polyforge.models import EventNotificationPreferences
        client = PolyforgeClient(api_key="test-key")
        client._put = MagicMock(return_value={
            "preferences": [
                {"event": "ORDER_FILLED", "inApp": True, "email": True, "push": True},
            ],
            "emailDigest": "weekly",
        })
        prefs = [{"event": "ORDER_FILLED", "inApp": True, "email": True, "push": True}]
        result = client.update_notification_preferences(preferences=prefs, email_digest="weekly")
        client._put.assert_called_once_with(
            "/api/v1/users/me/notification-preferences",
            json={"preferences": prefs, "emailDigest": "weekly"},
        )
        assert isinstance(result, EventNotificationPreferences)
        assert result.email_digest == "weekly"
        client.close()


class TestVenuePreferenceMethods:
    """Tests for venue preference endpoints (sync + async)."""

    VENUE_METHODS = [
        "get_venue_preferences",
        "update_venue_preferences",
    ]

    @pytest.mark.parametrize("method", VENUE_METHODS)
    def test_sync_method_exists(self, method):
        assert hasattr(PolyforgeClient, method)
        assert callable(getattr(PolyforgeClient, method))

    @pytest.mark.parametrize("method", VENUE_METHODS)
    def test_async_method_exists(self, method):
        assert hasattr(AsyncPolyforgeClient, method)
        assert callable(getattr(AsyncPolyforgeClient, method))

    def test_sync_endpoints_use_correct_paths(self):
        import inspect
        for method_name in self.VENUE_METHODS:
            source = inspect.getsource(getattr(PolyforgeClient, method_name))
            assert "/api/v1/users/me/venue-preferences" in source

    def test_async_endpoints_use_correct_paths(self):
        import inspect
        for method_name in self.VENUE_METHODS:
            source = inspect.getsource(getattr(AsyncPolyforgeClient, method_name))
            assert "/api/v1/users/me/venue-preferences" in source

    def test_sync_get_venue_preferences(self):
        from unittest.mock import MagicMock
        from polyforge.models import VenuePreferences
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "defaultVenue": "polymarket",
            "enabledVenues": ["polymarket", "kalshi"],
            "singlePlatformMode": False,
        })
        result = client.get_venue_preferences()
        assert isinstance(result, VenuePreferences)
        assert result.default_venue == "polymarket"
        assert "kalshi" in result.enabled_venues
        client.close()

    def test_sync_update_venue_preferences(self):
        from unittest.mock import MagicMock
        from polyforge.models import VenuePreferences
        client = PolyforgeClient(api_key="test-key")
        client._patch = MagicMock(return_value={
            "defaultVenue": "kalshi",
            "enabledVenues": ["kalshi"],
            "singlePlatformMode": True,
        })
        result = client.update_venue_preferences(default_venue="kalshi", single_platform_mode=True)
        client._patch.assert_called_once_with(
            "/api/v1/users/me/venue-preferences",
            json={"defaultVenue": "kalshi", "singlePlatformMode": True},
        )
        assert isinstance(result, VenuePreferences)
        assert result.single_platform_mode is True
        client.close()


class TestUserManagementModels:
    """Tests for new user management models."""

    def test_user_profile_defaults(self):
        from polyforge.models import UserProfile
        p = UserProfile()
        assert p.username == ""
        assert p.followers_count == 0
        assert p.is_following is False

    def test_follow_result_defaults(self):
        from polyforge.models import FollowResult
        f = FollowResult()
        assert f.following is False
        assert f.followers_count == 0

    def test_notification_settings_defaults(self):
        from polyforge.models import NotificationSettings
        n = NotificationSettings()
        assert n.email_enabled is False
        assert n.on_order_filled is False

    def test_event_notification_pref_defaults(self):
        from polyforge.models import EventNotificationPref
        e = EventNotificationPref()
        assert e.event == ""
        assert e.in_app is False

    def test_event_notification_preferences_defaults(self):
        from polyforge.models import EventNotificationPreferences
        e = EventNotificationPreferences()
        assert e.preferences == []
        assert e.email_digest == ""

    def test_venue_preferences_defaults(self):
        from polyforge.models import VenuePreferences
        v = VenuePreferences()
        assert v.default_venue == ""
        assert v.enabled_venues == []
        assert v.single_platform_mode is False

    def test_support_ticket_defaults(self):
        from polyforge.models import SupportTicket
        t = SupportTicket()
        assert t.subject == ""
        assert t.category == "GENERAL"
        assert t.priority == "MEDIUM"
        assert t.messages == []

    def test_ticket_message_defaults(self):
        from polyforge.models import TicketMessage
        m = TicketMessage()
        assert m.body == ""
        assert m.author == ""


class TestSnakeToCamelHelper:
    """Tests for the _snake_to_camel helper."""

    def test_basic_conversion(self):
        from polyforge.client import _snake_to_camel
        assert _snake_to_camel("email_enabled") == "emailEnabled"
        assert _snake_to_camel("on_order_filled") == "onOrderFilled"
        assert _snake_to_camel("single") == "single"

    def test_multi_word(self):
        from polyforge.client import _snake_to_camel
        assert _snake_to_camel("drawdown_lookback_hours") == "drawdownLookbackHours"


class TestPutHelper:
    """Tests for _put helper on both clients."""

    def test_sync_put_exists(self):
        assert hasattr(PolyforgeClient, "_put")

    def test_async_put_exists(self):
        assert hasattr(AsyncPolyforgeClient, "_put")


class TestParseNonFiniteFloats:
    """_parse() must reject non-finite float strings (#201)."""

    def test_parse_rejects_nan_string(self):
        """float('nan') should be rejected during parsing."""
        import dataclasses

        @dataclasses.dataclass
        class FakeModel:
            price: float = 0.0

        with pytest.raises(ValueError, match="Non-finite"):
            _parse(FakeModel, {"price": "nan"})

    def test_parse_rejects_inf_string(self):
        """float('inf') should be rejected during parsing."""
        import dataclasses

        @dataclasses.dataclass
        class FakeModel:
            price: float = 0.0

        with pytest.raises(ValueError, match="Non-finite"):
            _parse(FakeModel, {"price": "inf"})

    def test_parse_rejects_negative_inf_string(self):
        """float('-inf') should be rejected during parsing."""
        import dataclasses

        @dataclasses.dataclass
        class FakeModel:
            price: float = 0.0

        with pytest.raises(ValueError, match="Non-finite"):
            _parse(FakeModel, {"price": "-inf"})

    def test_parse_accepts_normal_float_string(self):
        """Normal numeric strings should still parse correctly."""
        import dataclasses

        @dataclasses.dataclass
        class FakeModel:
            price: float = 0.0

        result = _parse(FakeModel, {"price": "1.23"})
        assert result.price == 1.23


class TestArbitrageParamValidation:
    """Arbitrage and risk-settings methods must validate financial params (#200)."""

    def test_get_arbitrage_opportunities_rejects_nan(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="NaN"):
            client.get_arbitrage_opportunities(min_margin=float("nan"))
        client.close()

    def test_get_arbitrage_opportunities_rejects_inf(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="Infinity"):
            client.get_arbitrage_opportunities(min_margin=float("inf"))
        client.close()

    def test_get_arbitrage_opportunities_rejects_negative(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="positive"):
            client.get_arbitrage_opportunities(min_margin=-1.0)
        client.close()

    def test_get_cross_venue_opportunities_rejects_inf(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="Infinity"):
            client.get_cross_venue_opportunities(min_spread=float("inf"))
        client.close()

    def test_get_cross_venue_opportunities_rejects_nan(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="NaN"):
            client.get_cross_venue_opportunities(min_spread=float("nan"))
        client.close()

    def test_get_cross_venue_opportunities_for_market_rejects_nan(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="NaN"):
            client.get_cross_venue_opportunities_for_market("m1", min_spread=float("nan"))
        client.close()

    def test_create_arbitrage_alert_rejects_negative(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="positive"):
            client.create_arbitrage_alert(min_spread_pct=-1.0)
        client.close()

    def test_create_arbitrage_alert_rejects_nan(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="NaN"):
            client.create_arbitrage_alert(min_spread_pct=float("nan"))
        client.close()

    def test_update_risk_settings_rejects_nan_threshold(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="NaN"):
            client.update_risk_settings(drawdown_threshold_pct=float("nan"))
        client.close()

    def test_update_risk_settings_rejects_inf_threshold(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="Infinity"):
            client.update_risk_settings(drawdown_threshold_pct=float("inf"))
        client.close()

    def test_update_risk_settings_rejects_negative_threshold(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="positive"):
            client.update_risk_settings(drawdown_threshold_pct=-5.0)
        client.close()

    def test_update_risk_settings_skips_validation_when_none(self):
        """None values should not trigger validation — only supplied fields are validated."""
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._patch = MagicMock(return_value={
            "drawdownEnabled": True,
            "drawdownLookbackHours": 24,
            "drawdownThresholdPct": "0.1",
            "circuitBreakerTripped": False,
            "circuitBreakerTrippedAt": None,
        })
        result = client.update_risk_settings(drawdown_enabled=True)
        assert result.drawdown_enabled is True
        client.close()

    def test_async_get_arbitrage_opportunities_rejects_nan(self):
        import asyncio

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            with pytest.raises(ValueError, match="NaN"):
                await client.get_arbitrage_opportunities(min_margin=float("nan"))
            await client.close()

        asyncio.run(_run())

    def test_async_get_cross_venue_opportunities_rejects_inf(self):
        import asyncio

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            with pytest.raises(ValueError, match="Infinity"):
                await client.get_cross_venue_opportunities(min_spread=float("inf"))
            await client.close()

        asyncio.run(_run())

    def test_async_create_arbitrage_alert_rejects_negative(self):
        import asyncio

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            with pytest.raises(ValueError, match="positive"):
                await client.create_arbitrage_alert(min_spread_pct=-1.0)
            await client.close()

        asyncio.run(_run())

    def test_async_update_risk_settings_rejects_nan_threshold(self):
        import asyncio

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            with pytest.raises(ValueError, match="NaN"):
                await client.update_risk_settings(drawdown_threshold_pct=float("nan"))
            await client.close()

        asyncio.run(_run())

    def test_async_update_risk_settings_skips_validation_when_none(self):
        """None drawdown_threshold_pct must not trigger validation in async client."""
        import asyncio
        from unittest.mock import AsyncMock

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            client._patch = AsyncMock(return_value={
                "drawdownEnabled": True,
                "drawdownLookbackHours": 24,
                "drawdownThresholdPct": "0.1",
                "circuitBreakerTripped": False,
                "circuitBreakerTrippedAt": None,
            })
            result = await client.update_risk_settings(drawdown_enabled=True)
            assert result.drawdown_enabled is True
            await client.close()

        asyncio.run(_run())


class TestTradingCopyNumericValidation:
    """Trading and copy endpoints reject malformed numeric request fields (#204)."""

    @pytest.mark.parametrize("method_name,arg_name", [
        ("close_position", "size"),
        ("split_position", "amount"),
        ("merge_positions", "amount"),
    ])
    def test_position_methods_reject_non_finite_number_strings(self, method_name, arg_name):
        client = PolyforgeClient(api_key="test")
        kwargs = {arg_name: "Infinity"}
        with pytest.raises(ValueError, match="Infinity"):
            getattr(client, method_name)("tok", **kwargs)
        client.close()

    @pytest.mark.parametrize("method_name,arg_name", [
        ("close_position", "size"),
        ("split_position", "amount"),
        ("merge_positions", "amount"),
    ])
    def test_position_methods_reject_negative_number_strings(self, method_name, arg_name):
        client = PolyforgeClient(api_key="test")
        kwargs = {arg_name: "-1"}
        with pytest.raises(ValueError, match="positive"):
            getattr(client, method_name)("tok", **kwargs)
        client.close()

    def test_set_whale_alert_filter_rejects_nan_min_size(self):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="NaN"):
            client.set_whale_alert_filter(min_size="NaN")
        client.close()

    @pytest.mark.parametrize("field,kwargs", [
        ("size_value", {"size_value": float("nan")}),
        ("max_exposure", {"max_exposure": float("inf")}),
        ("max_daily_loss", {"max_daily_loss": -1.0}),
    ])
    def test_create_copy_config_rejects_invalid_positive_numeric_fields(self, field, kwargs):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="NaN|Infinity|positive"):
            client.create_copy_config("0x0000000000000000000000000000000000000001", **kwargs)
        client.close()

    def test_create_copy_config_rejects_non_finite_price_offset(self):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="Infinity"):
            client.create_copy_config(
                "0x0000000000000000000000000000000000000001",
                price_offset=float("-inf"),
            )
        client.close()

    def test_create_copy_config_allows_negative_price_offset(self):
        from unittest.mock import MagicMock

        client = PolyforgeClient(api_key="test")
        client._post = MagicMock(return_value={
            "id": "copy-1",
            "userId": "user-1",
            "targetWallet": "0x0000000000000000000000000000000000000001",
            "mode": "PERCENTAGE",
            "sizeValue": "10",
            "maxExposure": "500",
            "maxDailyLoss": "100",
            "priceOffset": "-0.5",
            "status": "ACTIVE",
            "totalCopied": 0,
            "totalPnl": "0",
            "createdAt": "2026-04-29T00:00:00Z",
            "updatedAt": "2026-04-29T00:00:00Z",
        })
        client.create_copy_config(
            "0x0000000000000000000000000000000000000001",
            price_offset=-0.5,
        )
        client._post.assert_called_once()
        assert client._post.call_args.kwargs["json"]["priceOffset"] == -0.5
        client.close()

    def test_update_copy_config_rejects_invalid_numeric_kwargs(self):
        client = PolyforgeClient(api_key="test")
        with pytest.raises(ValueError, match="Infinity"):
            client.update_copy_config("copy-1", maxExposure="Infinity")
        client.close()

    def test_update_copy_config_allows_negative_price_offset(self):
        from unittest.mock import MagicMock

        client = PolyforgeClient(api_key="test")
        client._patch = MagicMock(return_value={
            "id": "copy-1",
            "userId": "user-1",
            "targetWallet": "0x0000000000000000000000000000000000000001",
            "mode": "PERCENTAGE",
            "sizeValue": "10",
            "maxExposure": "500",
            "maxDailyLoss": "100",
            "priceOffset": "-0.5",
            "status": "ACTIVE",
            "totalCopied": 0,
            "totalPnl": "0",
            "createdAt": "2026-04-29T00:00:00Z",
            "updatedAt": "2026-04-29T00:00:00Z",
        })
        client.update_copy_config("copy-1", priceOffset=-0.5)
        client._patch.assert_called_once()
        assert client._patch.call_args.kwargs["json"]["priceOffset"] == -0.5
        client.close()

    def test_async_batch_orders_rejects_infinite_order_price(self):
        import asyncio

        async def _run():
            client = AsyncPolyforgeClient(api_key="test")
            with pytest.raises(ValueError, match="Infinity"):
                await client.batch_orders([{
                    "tokenId": "tok",
                    "side": "BUY",
                    "outcome": "YES",
                    "size": 10,
                    "price": float("inf"),
                }])
            await client.close()

        asyncio.run(_run())

    def test_async_copy_and_whale_paths_validate_before_awaiting(self):
        import asyncio

        async def _run():
            client = AsyncPolyforgeClient(api_key="test")
            with pytest.raises(ValueError, match="NaN"):
                await client.set_whale_alert_filter(min_size="NaN")
            with pytest.raises(ValueError, match="positive"):
                await client.create_copy_config(
                    "0x0000000000000000000000000000000000000001",
                    max_daily_loss=0,
                )
            with pytest.raises(ValueError, match="Infinity"):
                await client.update_copy_config("copy-1", priceOffset="Infinity")
            await client.close()

        asyncio.run(_run())


# ── POLA-1847: 9 sports markets endpoints ────────────────────────────────────


class TestSportsEndpointsPresence:
    """Surface check: all 9 sports methods exist on both clients (POLA-1847)."""

    METHODS = (
        "list_sports_categories",
        "list_sports_markets",
        "list_sports_events",
        "get_sports_event",
        "list_sports_milestones",
        "get_sports_live_data",
        "list_sports_combos",
        "get_sports_combo_collection",
        "lookup_sports_combo",
    )

    def test_all_methods_present_on_sync_client(self):
        for name in self.METHODS:
            assert callable(getattr(PolyforgeClient, name, None)), name

    def test_all_methods_present_on_async_client(self):
        for name in self.METHODS:
            assert callable(getattr(AsyncPolyforgeClient, name, None)), name


class TestSportsEndpointsPaths:
    """Verify each sports method targets the correct controller path."""

    def test_list_sports_categories_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.list_sports_categories)
        assert '"/api/v1/sports/categories"' in src

    def test_list_sports_markets_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.list_sports_markets)
        assert '"/api/v1/sports/markets"' in src

    def test_list_sports_events_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.list_sports_events)
        assert '"/api/v1/sports/events"' in src

    def test_get_sports_event_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.get_sports_event)
        assert "/api/v1/sports/events/" in src

    def test_list_sports_milestones_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.list_sports_milestones)
        assert '"/api/v1/sports/milestones"' in src

    def test_get_sports_live_data_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.get_sports_live_data)
        assert "/api/v1/sports/live-data/" in src

    def test_list_sports_combos_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.list_sports_combos)
        assert '"/api/v1/sports/combos"' in src

    def test_get_sports_combo_collection_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.get_sports_combo_collection)
        assert "/api/v1/sports/combos/" in src

    def test_lookup_sports_combo_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.lookup_sports_combo)
        assert '"/api/v1/sports/combos/lookup"' in src


class TestSportsEndpointsParams:
    """Verify each sports method exposes the expected keyword parameters."""

    def test_list_sports_markets_signature(self):
        import inspect
        params = set(inspect.signature(PolyforgeClient.list_sports_markets).parameters)
        for required in (
            "page", "limit", "category", "search", "series_ticker",
            "event_ticker", "live_only", "sort",
        ):
            assert required in params, required

    def test_list_sports_markets_passes_camel_case_query_keys(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.list_sports_markets)
        # Server expects camelCase query keys, not snake_case.
        for key in ('"seriesTicker"', '"eventTicker"', '"liveOnly"', '"sort"'):
            assert key in src, key

    def test_list_sports_events_signature(self):
        import inspect
        params = set(inspect.signature(PolyforgeClient.list_sports_events).parameters)
        for required in ("page", "limit", "category", "series_ticker", "status"):
            assert required in params, required

    def test_list_sports_milestones_signature(self):
        import inspect
        params = set(inspect.signature(PolyforgeClient.list_sports_milestones).parameters)
        for required in ("page", "limit", "event_ticker", "status"):
            assert required in params, required

    def test_list_sports_combos_signature(self):
        import inspect
        params = set(inspect.signature(PolyforgeClient.list_sports_combos).parameters)
        for required in ("page", "limit", "series_ticker"):
            assert required in params, required

    def test_async_list_sports_markets_signature(self):
        import inspect
        params = set(inspect.signature(AsyncPolyforgeClient.list_sports_markets).parameters)
        assert {"sort", "live_only", "series_ticker", "event_ticker"} <= params


class TestSportsEnumValidation:
    """Reject invalid enum values without making a network call."""

    def test_invalid_sort_rejected(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="sort"):
                client.list_sports_markets(sort="trending")
        finally:
            client.close()

    def test_invalid_event_status_rejected(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="status"):
                client.list_sports_events(status="POSTGAME")
        finally:
            client.close()

    def test_async_invalid_sort_rejected(self):
        import asyncio

        async def _run():
            client = AsyncPolyforgeClient(api_key="test")
            try:
                with pytest.raises(ValueError, match="sort"):
                    await client.list_sports_markets(sort="garbage")
            finally:
                await client.close()

        asyncio.run(_run())


class TestSportsEndpointRoundtrips:
    """Stub the HTTP layer with httpx.MockTransport and exercise each method."""

    @staticmethod
    def _client_with(handler):
        transport = httpx.MockTransport(handler)
        client = PolyforgeClient(api_key="test", api_url="http://localhost:9999")
        client._client = httpx.Client(
            base_url="http://localhost:9999",
            headers={"Authorization": "Bearer test"},
            transport=transport,
        )
        return client

    def test_list_sports_categories_returns_array(self):
        def handler(request):
            assert request.method == "GET"
            assert request.url.path == "/api/v1/sports/categories"
            return httpx.Response(200, json=[
                {"category": "nba", "label": "NBA",
                 "seriesTickers": ["KXNBAGAME"], "marketCount": 12}
            ])
        client = self._client_with(handler)
        try:
            cats = client.list_sports_categories()
            assert isinstance(cats, list)
            assert cats[0]["category"] == "nba"
            assert cats[0]["marketCount"] == 12
        finally:
            client.close()

    def test_list_sports_markets_sends_params_and_parses_pagination(self):
        captured = {}

        def handler(request):
            captured["url"] = request.url
            return httpx.Response(200, json={
                "data": [{"ticker": "KXNBAGAME-1"}],
                "total": 1, "page": 1, "limit": 10,
                "totalPages": 1, "hasNext": False,
            })

        client = self._client_with(handler)
        try:
            res = client.list_sports_markets(
                category="nba",
                series_ticker="KXNBAGAME",
                live_only=True,
                sort="closing_soon",
                page=2,
                limit=5,
            )
            qp = dict(captured["url"].params)
            assert qp["category"] == "nba"
            assert qp["seriesTicker"] == "KXNBAGAME"
            # httpx lowercases booleans → "true"; the controller DTO maps "true" → True.
            assert qp["liveOnly"] == "true"
            assert qp["sort"] == "closing_soon"
            assert qp["page"] == "2"
            assert qp["limit"] == "5"
            assert "search" not in qp  # None values stripped
            assert isinstance(res, PaginatedResponse)
            assert res.total == 1
            assert res.page == 1
            assert res.data[0]["ticker"] == "KXNBAGAME-1"
        finally:
            client.close()

    def test_list_sports_events_sends_params(self):
        captured = {}

        def handler(request):
            captured["url"] = request.url
            return httpx.Response(200, json={
                "data": [], "total": 0, "page": 1, "limit": 10, "totalPages": 0,
            })
        client = self._client_with(handler)
        try:
            client.list_sports_events(status="LIVE", series_ticker="KXNBAGAME")
            qp = dict(captured["url"].params)
            assert qp["status"] == "LIVE"
            assert qp["seriesTicker"] == "KXNBAGAME"
        finally:
            client.close()

    def test_get_sports_event_url_encodes_ticker(self):
        captured = {}

        def handler(request):
            # httpx.URL.path is decoded; raw_path keeps the percent-encoding.
            captured["raw_path"] = request.url.raw_path
            return httpx.Response(200, json={"event": {"ticker": "T/1"}, "markets": []})
        client = self._client_with(handler)
        try:
            res = client.get_sports_event("T/1")
            assert captured["raw_path"] == b"/api/v1/sports/events/T%2F1"
            assert res["event"]["ticker"] == "T/1"
            assert res["markets"] == []
        finally:
            client.close()

    def test_list_sports_milestones_returns_cursor_dict(self):
        def handler(request):
            assert request.url.path == "/api/v1/sports/milestones"
            return httpx.Response(200, json={
                "milestones": [{"id": "m1"}],
                "cursor": "next-page-token",
            })
        client = self._client_with(handler)
        try:
            res = client.list_sports_milestones(event_ticker="EVT", limit=20)
            assert res["cursor"] == "next-page-token"
            assert res["milestones"][0]["id"] == "m1"
        finally:
            client.close()

    def test_get_sports_live_data_returns_payload(self):
        def handler(request):
            assert request.url.path == "/api/v1/sports/live-data/abc"
            return httpx.Response(200, json={"liveData": {"score": "10-7"}})
        client = self._client_with(handler)
        try:
            assert client.get_sports_live_data("abc") == {"liveData": {"score": "10-7"}}
        finally:
            client.close()

    def test_list_sports_combos_sends_series_ticker(self):
        captured = {}

        def handler(request):
            captured["url"] = request.url
            return httpx.Response(200, json={"collections": [], "cursor": None})
        client = self._client_with(handler)
        try:
            client.list_sports_combos(series_ticker="KXNBAGAME")
            assert captured["url"].params["seriesTicker"] == "KXNBAGAME"
        finally:
            client.close()

    def test_get_sports_combo_collection_url_encodes_ticker(self):
        captured = {}

        def handler(request):
            captured["raw_path"] = request.url.raw_path
            return httpx.Response(200, json={"collections": [], "cursor": None})
        client = self._client_with(handler)
        try:
            client.get_sports_combo_collection("KX/COMBO 1")
            assert captured["raw_path"] == b"/api/v1/sports/combos/KX%2FCOMBO%201"
        finally:
            client.close()

    def test_lookup_sports_combo_posts_payload(self):
        captured = {}

        def handler(request):
            captured["method"] = request.method
            captured["path"] = request.url.path
            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={
                "eventTicker": "EVT", "marketTicker": "MKT",
            })
        client = self._client_with(handler)
        try:
            res = client.lookup_sports_combo(
                "COL",
                [{"marketTicker": "M1", "eventTicker": "E1", "side": "yes"}],
            )
            assert captured["method"] == "POST"
            assert captured["path"] == "/api/v1/sports/combos/lookup"
            assert captured["body"]["collectionTicker"] == "COL"
            assert captured["body"]["selectedMarkets"][0]["side"] == "yes"
            assert res == {"eventTicker": "EVT", "marketTicker": "MKT"}
        finally:
            client.close()

    def test_lookup_sports_combo_returns_none_on_null_body(self):
        # Server returns JSON `null` when no match — SDK must surface as None.
        def handler(request):
            return httpx.Response(200, content=b"null", headers={"content-type": "application/json"})
        client = self._client_with(handler)
        try:
            res = client.lookup_sports_combo("COL", [])
            assert res is None
        finally:
            client.close()


# ---------------------------------------------------------------------------
# ── POLA-1857: misc public utility endpoints ────────────────────────────────


class TestMiscUtilityEndpointsPresence:
    """Surface check: all 18 misc utility methods exist on both clients."""

    METHODS = (
        "get_accuracy_overview",
        "get_feed",
        "list_journal",
        "list_notifications",
        "get_my_referrals",
        "preview_fees",
        "list_fee_schedules",
        "get_fee_schedules",
        "list_market_alerts",
        "create_market_alert",
        "delete_market_alert",
        "get_market_history",
        "get_market_sentiment_report",
        "vote_market_sentiment",
        "update_order_journal",
        "list_combo_collections",
        "get_combo_collection",
        "lookup_combo_market",
        "lookup_combo_ticker",
        "get_correlation_categories",
    )

    def test_all_methods_present_on_sync_client(self):
        for name in self.METHODS:
            assert callable(getattr(PolyforgeClient, name, None)), name

    def test_all_methods_present_on_async_client(self):
        for name in self.METHODS:
            assert callable(getattr(AsyncPolyforgeClient, name, None)), name

    def test_deprecated_method_aliases_remain_present(self):
        assert callable(getattr(PolyforgeClient, "list_feed", None))
        assert callable(getattr(AsyncPolyforgeClient, "list_feed", None))


class TestMiscUtilityEndpointPaths:
    """Verify each new method targets the correct controller path."""

    def _src(self, method):
        import inspect
        return inspect.getsource(method)

    def test_get_accuracy_overview_path(self):
        assert '"/api/v1/accuracy"' in self._src(PolyforgeClient.get_accuracy_overview)

    def test_get_feed_path(self):
        assert '"/api/v1/feed"' in self._src(PolyforgeClient.get_feed)

    def test_list_feed_deprecated_alias_points_to_get_feed(self):
        assert "get_feed" in self._src(PolyforgeClient.list_feed)

    def test_list_journal_path(self):
        assert '"/api/v1/journal"' in self._src(PolyforgeClient.list_journal)

    def test_list_notifications_path(self):
        assert '"/api/v1/notifications"' in self._src(PolyforgeClient.list_notifications)

    def test_get_my_referrals_path(self):
        assert '"/api/v1/referrals/me"' in self._src(PolyforgeClient.get_my_referrals)

    def test_preview_fees_path(self):
        assert '"/api/v1/fees/preview"' in self._src(PolyforgeClient.preview_fees)

    def test_list_fee_schedules_path(self):
        assert '"/api/v1/fees/schedules"' in self._src(PolyforgeClient.list_fee_schedules)
        assert "list_fee_schedules" in self._src(PolyforgeClient.get_fee_schedules)

    def test_list_market_alerts_path(self):
        assert "/api/v1/markets/" in self._src(PolyforgeClient.list_market_alerts)
        assert "/alerts" in self._src(PolyforgeClient.list_market_alerts)

    def test_create_market_alert_path(self):
        src = self._src(PolyforgeClient.create_market_alert)
        assert "/api/v1/markets/" in src and "/alerts" in src

    def test_delete_market_alert_path(self):
        src = self._src(PolyforgeClient.delete_market_alert)
        assert "/api/v1/markets/" in src and "/alerts/" in src

    def test_get_market_history_path(self):
        assert "/history" in self._src(PolyforgeClient.get_market_history)

    def test_market_sentiment_report_path(self):
        assert "/sentiment" in self._src(PolyforgeClient.get_market_sentiment_report)
        assert "/sentiment" in self._src(PolyforgeClient.vote_market_sentiment)

    def test_update_order_journal_path(self):
        src = self._src(PolyforgeClient.update_order_journal)
        assert "/api/v1/orders/" in src and "/journal" in src

    def test_combo_collection_paths(self):
        assert '"/api/v1/markets/combo/collections"' in self._src(
            PolyforgeClient.list_combo_collections
        )
        assert "/api/v1/markets/combo/collections/" in self._src(
            PolyforgeClient.get_combo_collection
        )

    def test_lookup_combo_market_path(self):
        assert '"/api/v1/markets/combo/lookup"' in self._src(
            PolyforgeClient.lookup_combo_market
        )
        assert "lookup_combo_market" in self._src(PolyforgeClient.lookup_combo_ticker)

    def test_correlation_categories_path(self):
        assert '"/api/v1/analytics/correlation/categories"' in self._src(
            PolyforgeClient.get_correlation_categories
        )


class TestMiscUtilityEnumValidation:
    """Pre-network validation guards reject obvious garbage inputs."""

    def test_invalid_market_alert_outcome_rejected(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="outcome"):
                client.create_market_alert(
                    "m1", outcome="MAYBE", condition="above", threshold=0.5
                )
        finally:
            client.close()

    def test_invalid_market_alert_condition_rejected(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="condition"):
                client.create_market_alert(
                    "m1", outcome="YES", condition="across", threshold=0.5
                )
        finally:
            client.close()

    def test_threshold_out_of_range_rejected(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="threshold"):
                client.create_market_alert(
                    "m1", outcome="YES", condition="above", threshold=0.999
                )
            with pytest.raises(ValueError, match="threshold"):
                client.create_market_alert(
                    "m1", outcome="YES", condition="above", threshold=0.0
                )
        finally:
            client.close()

    def test_invalid_market_history_period_rejected(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="period"):
                client.get_market_history("m1", period="365d")
        finally:
            client.close()

    def test_invalid_journal_mood_rejected(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="mood"):
                client.list_journal(mood="HAPPY")
        finally:
            client.close()

    def test_invalid_order_journal_mood_rejected(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="mood"):
                client.update_order_journal("ord-1", mood="ANGRY")
        finally:
            client.close()

    def test_invalid_feed_side_rejected(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="side"):
                client.get_feed(side="LONG")
        finally:
            client.close()

    def test_preview_fees_rejects_invalid_side_and_finance(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="side"):
                client.preview_fees(
                    token_id="t1", side="LONG", size=1, price=0.5
                )
            with pytest.raises(ValueError, match="size"):
                client.preview_fees(
                    token_id="t1", side="BUY", size=0, price=0.5
                )
            with pytest.raises(ValueError, match="price"):
                client.preview_fees(
                    token_id="t1", side="BUY", size=1, price=float("nan")
                )
        finally:
            client.close()

    def test_lookup_combo_validates_legs(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.raises(ValueError, match="ticker"):
                client.lookup_combo_market("col", [{"ticker": "", "outcome": "yes"}])
            with pytest.raises(ValueError, match="outcome"):
                client.lookup_combo_market("col", [{"ticker": "T1", "outcome": "buy"}])
            with pytest.raises(TypeError, match="dict"):
                client.lookup_combo_market("col", ["not-a-dict"])  # type: ignore[list-item]
        finally:
            client.close()


class TestMiscUtilityEndpointRoundtrips:
    """Stub the HTTP layer with httpx.MockTransport and exercise each method."""

    @staticmethod
    def _client_with(handler):
        transport = httpx.MockTransport(handler)
        client = PolyforgeClient(api_key="test", api_url="http://localhost:9999")
        client._client = httpx.Client(
            base_url="http://localhost:9999",
            headers={"Authorization": "Bearer test"},
            transport=transport,
        )
        return client

    def test_get_accuracy_overview_parses_payload(self):
        def handler(request):
            assert request.url.path == "/api/v1/accuracy"
            return httpx.Response(200, json={
                "brierScore": 0.21, "totalPredictions": 12,
                "correctPredictions": 9, "winRate": "0.75",
                "calibration": [
                    {"bucketMid": 0.5, "frequency": 0.6, "count": 4},
                ],
                "byCategory": {
                    "Politics": {"count": 5, "brierScore": 0.18},
                },
            })
        client = self._client_with(handler)
        try:
            score = client.get_accuracy_overview()
            assert score.total_predictions == 12
            assert score.correct_predictions == 9
            assert score.calibration[0].count == 4
            assert score.by_category["Politics"].brier_score == 0.18
        finally:
            client.close()

    def test_get_feed_strips_none_and_validates_side(self):
        captured = {}

        def handler(request):
            captured["url"] = request.url
            return httpx.Response(200, json={
                "data": [{"id": "wh1"}], "total": 1, "page": 1, "limit": 20,
                "totalPages": 1, "hasNext": False,
            })
        client = self._client_with(handler)
        try:
            res = client.get_feed(side="BUY", min_size="100", page=1, limit=20)
            qp = dict(captured["url"].params)
            assert qp["side"] == "BUY"
            assert qp["minSize"] == "100"
            assert "marketId" not in qp
            assert isinstance(res, PaginatedResponse)
            assert res.data[0]["id"] == "wh1"
        finally:
            client.close()

    def test_list_feed_deprecated_alias_uses_get_feed(self):
        client = PolyforgeClient(api_key="test")
        try:
            with pytest.warns(DeprecationWarning), pytest.raises(ValueError, match="side"):
                client.list_feed(side="LONG")
        finally:
            client.close()

    def test_list_journal_passes_mood_and_paginates(self):
        captured = {}

        def handler(request):
            captured["url"] = request.url
            return httpx.Response(200, json={
                "data": [{"id": "ord-1", "mood": "CONFIDENT"}],
                "total": 1, "page": 1, "limit": 20,
                "totalPages": 1, "hasNext": False,
            })
        client = self._client_with(handler)
        try:
            res = client.list_journal(mood="CONFIDENT")
            qp = dict(captured["url"].params)
            assert qp["mood"] == "CONFIDENT"
            assert res.data[0]["mood"] == "CONFIDENT"
        finally:
            client.close()

    def test_list_notifications_returns_paginated(self):
        def handler(request):
            assert request.url.path == "/api/v1/notifications"
            return httpx.Response(200, json={
                "data": [{"id": "n1"}],
                "total": 1, "page": 1, "limit": 20,
                "totalPages": 1, "hasNext": False,
            })
        client = self._client_with(handler)
        try:
            res = client.list_notifications()
            assert res.total == 1
            assert res.data[0]["id"] == "n1"
        finally:
            client.close()

    def test_get_my_referrals_parses_nested_stats(self):
        def handler(request):
            assert request.url.path == "/api/v1/referrals/me"
            return httpx.Response(200, json={
                "referralCode": "ABC12345",
                "referralLink": "https://polyforge.trade/ref/ABC12345",
                "stats": {
                    "invited": 3, "signedUp": 2, "active": 1, "creditsEarned": 10,
                },
                "referrals": [],
            })
        client = self._client_with(handler)
        try:
            info = client.get_my_referrals()
            assert isinstance(info, MyReferralsResponse)
            assert info.referral_code == "ABC12345"
            assert info.signed_up == 2
            assert info.stats.signed_up == 2
            assert info.stats.credits_earned == 10
        finally:
            client.close()

    def test_my_referrals_response_is_canonical_public_type(self):
        from polyforge import MyReferralsResponse as ExportedResponse
        from polyforge import ReferralInfo, ReferralStats

        response = ExportedResponse(referral_code="ABC12345")
        assert isinstance(response, MyReferralsResponse)
        assert response.referral_code == "ABC12345"
        assert ReferralInfo is ExportedResponse
        assert ReferralStats is ExportedResponse

    def test_preview_fees_posts_camel_body_and_parses_response(self):
        captured = {}

        def handler(request):
            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={
                "polymarket": {
                    "venue": "POLYMARKET", "feeBps": 0, "feeUsd": 0,
                    "totalCostUsd": 50, "isMaker": False,
                },
                "kalshi": None,
                "savings": 0,
                "recommendedVenue": "POLYMARKET",
                "marketMatch": None,
            })
        client = self._client_with(handler)
        try:
            res = client.preview_fees(
                token_id="t1", side="BUY", size=100, price=0.5,
                order_type="POST_ONLY",
            )
            assert captured["body"]["tokenId"] == "t1"
            assert captured["body"]["orderType"] == "POST_ONLY"
            assert res.polymarket.venue == "POLYMARKET"
            assert res.kalshi is None
            assert res.recommended_venue == "POLYMARKET"
        finally:
            client.close()

    def test_list_fee_schedules_passthrough(self):
        def handler(request):
            assert request.url.path == "/api/v1/fees/schedules"
            return httpx.Response(200, json={
                "polymarket": [{"role": "MAKER", "feeBps": 0}],
                "kalshi": [],
            })
        client = self._client_with(handler)
        try:
            res = client.list_fee_schedules()
            assert res["polymarket"][0]["feeBps"] == 0
        finally:
            client.close()

    def test_get_fee_schedules_alias_delegates_to_list_fee_schedules(self):
        def handler(request):
            assert request.url.path == "/api/v1/fees/schedules"
            return httpx.Response(200, json={
                "polymarket": [],
                "kalshi": [{"role": "TAKER", "feeBps": 7}],
            })
        client = self._client_with(handler)
        try:
            res = client.get_fee_schedules()
            assert res["kalshi"][0]["feeBps"] == 7
        finally:
            client.close()

    def test_list_and_create_and_delete_market_alert(self):
        captured = {}

        def handler(request):
            captured["method"] = request.method
            captured["raw_path"] = request.url.raw_path
            if request.method == "GET":
                return httpx.Response(200, json={
                    "data": [{
                        "id": "a1", "marketId": "m1", "outcome": "YES",
                        "condition": "above", "threshold": 0.5,
                        "triggered": False, "createdAt": "2026-05-01T00:00:00Z",
                    }],
                })
            if request.method == "POST":
                captured["body"] = json.loads(request.content)
                return httpx.Response(201, json={
                    "id": "a2", "marketId": "m1", "outcome": "YES",
                    "condition": "below", "threshold": 0.6,
                    "triggered": False, "createdAt": "2026-05-01T00:00:00Z",
                })
            if request.method == "DELETE":
                return httpx.Response(204)
            return httpx.Response(405)

        client = self._client_with(handler)
        try:
            alerts = client.list_market_alerts("m 1")
            assert captured["raw_path"] == b"/api/v1/markets/m%201/alerts"
            assert alerts[0].id == "a1"
            assert alerts[0].threshold == 0.5

            created = client.create_market_alert(
                "m1", outcome="YES", condition="below", threshold=0.6,
            )
            assert captured["body"]["threshold"] == 0.6
            assert created.id == "a2"

            client.delete_market_alert("m1", "a/2")
            assert captured["raw_path"] == b"/api/v1/markets/m1/alerts/a%2F2"
        finally:
            client.close()

    def test_get_market_history_sends_period_and_parses_points(self):
        captured = {}

        def handler(request):
            captured["url"] = request.url
            return httpx.Response(200, json={
                "data": [
                    {"timestamp": "2026-05-01T00:00:00Z",
                     "yesPrice": 0.51, "noPrice": 0.49, "volume": 1000},
                ],
            })
        client = self._client_with(handler)
        try:
            points = client.get_market_history("m1", period="30d")
            assert dict(captured["url"].params)["period"] == "30d"
            assert points[0].yes_price == 0.51
            assert points[0].volume == 1000
        finally:
            client.close()

    def test_market_sentiment_report_get_and_post_parse(self):
        captured = {}

        def handler(request):
            captured["method"] = request.method
            return httpx.Response(200, json={
                "yesPercent": 60, "noPercent": 40, "totalVotes": 5,
                "userVote": {"direction": "BUY", "confidence": 0.8},
            })
        client = self._client_with(handler)
        try:
            report = client.get_market_sentiment_report("m1")
            assert captured["method"] == "GET"
            assert report.user_vote is not None
            assert report.user_vote.direction == "BUY"

            voted = client.vote_market_sentiment("m1")
            assert captured["method"] == "POST"
            assert voted.total_votes == 5
        finally:
            client.close()

    def test_update_order_journal_patches_with_optional_note(self):
        captured = {}

        def handler(request):
            captured["method"] = request.method
            captured["raw_path"] = request.url.raw_path
            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={
                "id": "ord-1", "mood": "CONFIDENT", "note": "good entry",
            })
        client = self._client_with(handler)
        try:
            order = client.update_order_journal(
                "ord 1", mood="CONFIDENT", note="good entry",
            )
            assert captured["method"] == "PATCH"
            assert captured["raw_path"] == b"/api/v1/orders/ord%201/journal"
            assert captured["body"] == {"mood": "CONFIDENT", "note": "good entry"}
            assert order.id == "ord-1"
        finally:
            client.close()

    def test_update_order_journal_omits_note_when_none(self):
        captured = {}

        def handler(request):
            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={"id": "ord-1", "mood": "FOMO"})
        client = self._client_with(handler)
        try:
            client.update_order_journal("ord-1", mood="FOMO")
            assert captured["body"] == {"mood": "FOMO"}
        finally:
            client.close()

    def test_combo_collection_endpoints_passthrough(self):
        captured = {}

        def handler(request):
            captured["path"] = request.url.path
            captured["raw_path"] = request.url.raw_path
            captured["params"] = dict(request.url.params)
            return httpx.Response(200, json={"collections": [], "cursor": None})
        client = self._client_with(handler)
        try:
            client.list_combo_collections(series_ticker="KX", limit=10)
            assert captured["path"] == "/api/v1/markets/combo/collections"
            assert captured["params"]["seriesTicker"] == "KX"
            assert captured["params"]["limit"] == "10"

            client.get_combo_collection("KX/COLL 1")
            assert captured["raw_path"] == b"/api/v1/markets/combo/collections/KX%2FCOLL%201"
        finally:
            client.close()

    def test_lookup_combo_market_posts_legs(self):
        captured = {}

        def handler(request):
            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={
                "ticker": "MK1", "yesTicker": "MK1Y",
            })
        client = self._client_with(handler)
        try:
            res = client.lookup_combo_market(
                "COL", [{"ticker": "T1", "outcome": "yes"}],
            )
            assert captured["body"]["collectionTicker"] == "COL"
            assert captured["body"]["legs"][0]["outcome"] == "yes"
            assert res["ticker"] == "MK1"
        finally:
            client.close()

    def test_lookup_combo_ticker_alias_delegates_to_lookup_combo_market(self):
        captured = {}

        def handler(request):
            captured["path"] = request.url.path
            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={
                "ticker": "MK2", "yesTicker": "MK2Y",
            })
        client = self._client_with(handler)
        try:
            res = client.lookup_combo_ticker(
                "COL", [{"ticker": "T2", "outcome": "no"}],
            )
            assert captured["path"] == "/api/v1/markets/combo/lookup"
            assert captured["body"]["collectionTicker"] == "COL"
            assert captured["body"]["legs"][0]["outcome"] == "no"
            assert res["ticker"] == "MK2"
        finally:
            client.close()

    def test_get_correlation_categories_parses_matrix(self):
        def handler(request):
            assert request.url.path == "/api/v1/analytics/correlation/categories"
            return httpx.Response(200, json={
                "categories": ["Politics", "Sports"],
                "matrix": [[1.0, 0.3], [0.3, 1.0]],
                "updatedAt": "2026-05-01T00:00:00Z",
            })
        client = self._client_with(handler)
        try:
            report = client.get_correlation_categories()
            assert report.categories == ["Politics", "Sports"]
            assert report.matrix[0][1] == 0.3
            assert report.updated_at == "2026-05-01T00:00:00Z"
        finally:
            client.close()


class TestMiscUtilityEndpointsAsync:
    """Smoke-check that the async client mirrors the sync surface end-to-end."""

    @staticmethod
    def _async_client_with(handler):
        transport = httpx.MockTransport(handler)
        client = AsyncPolyforgeClient(api_key="test", api_url="http://localhost:9999")
        client._client = httpx.AsyncClient(
            base_url="http://localhost:9999",
            headers={"Authorization": "Bearer test"},
            transport=transport,
        )
        return client

    def test_async_create_and_delete_market_alert(self):
        import asyncio

        captured = {}

        def handler(request):
            captured["method"] = request.method
            if request.method == "POST":
                captured["body"] = json.loads(request.content)
                return httpx.Response(201, json={
                    "id": "a1", "marketId": "m1", "outcome": "YES",
                    "condition": "above", "threshold": 0.5,
                    "triggered": False, "createdAt": "2026-05-01T00:00:00Z",
                })
            if request.method == "DELETE":
                return httpx.Response(204)
            return httpx.Response(405)

        async def _run():
            client = self._async_client_with(handler)
            created = await client.create_market_alert(
                "m1", outcome="YES", condition="above", threshold=0.5,
            )
            assert captured["body"]["condition"] == "above"
            assert created.id == "a1"

            await client.delete_market_alert("m1", "a1")
            assert captured["method"] == "DELETE"
            await client.close()

        asyncio.run(_run())

    def test_async_invalid_market_history_period_rejected(self):
        import asyncio

        async def _run():
            client = AsyncPolyforgeClient(api_key="test")
            try:
                with pytest.raises(ValueError, match="period"):
                    await client.get_market_history("m1", period="garbage")
            finally:
                await client.close()

        asyncio.run(_run())

    def test_async_lookup_combo_validates_legs_before_request(self):
        import asyncio

        async def _run():
            client = AsyncPolyforgeClient(api_key="test")
            try:
                with pytest.raises(ValueError, match="outcome"):
                    await client.lookup_combo_market(
                        "COL", [{"ticker": "T1", "outcome": "buy"}],
                    )
            finally:
                await client.close()

        asyncio.run(_run())

    def test_async_aliases_delegate_to_canonical_methods(self):
        import asyncio

        calls = []

        def handler(request):
            calls.append((request.method, request.url.path))
            if request.url.path == "/api/v1/feed":
                return httpx.Response(200, json={
                    "data": [], "total": 0, "page": 1, "limit": 20,
                    "totalPages": 0, "hasNext": False,
                })
            if request.url.path == "/api/v1/fees/schedules":
                return httpx.Response(200, json={"polymarket": [], "kalshi": []})
            if request.url.path == "/api/v1/markets/combo/lookup":
                return httpx.Response(200, json={"ticker": "MK1"})
            return httpx.Response(404)

        async def _run():
            client = self._async_client_with(handler)
            try:
                await client.get_feed(side="BUY")
                await client.get_fee_schedules()
                await client.lookup_combo_ticker(
                    "COL", [{"ticker": "T1", "outcome": "yes"}],
                )
            finally:
                await client.close()

        asyncio.run(_run())
        assert calls == [
            ("GET", "/api/v1/feed"),
            ("GET", "/api/v1/fees/schedules"),
            ("POST", "/api/v1/markets/combo/lookup"),
        ]

# Cross-Venue Arb Execution / Positions / Risk (POLA-1851)
# ---------------------------------------------------------------------------


def _arb_position_payload(**overrides):
    """Server-shaped ArbPosition row (Decimals serialize as strings)."""
    base = {
        "id": "pos-1",
        "userId": "u1",
        "matchId": "m1",
        "status": "OPEN",
        "buyVenue": "POLYMARKET",
        "buyOrderId": "po-buy",
        "buyTokenId": "tok-buy",
        "buyPrice": "0.42",
        "buySize": "100.0",
        "buyFillPrice": "0.42",
        "buyFillSize": "100.0",
        "sellVenue": "KALSHI",
        "sellOrderId": "po-sell",
        "sellTokenId": "tok-sell",
        "sellPrice": "0.50",
        "sellSize": "100.0",
        "sellFillPrice": "0.50",
        "sellFillSize": "100.0",
        "entrySpreadPct": "8.0000",
        "currentSpreadPct": "7.5",
        "realizedPnl": None,
        "unrealizedPnl": "1.50",
        "openedAt": "2026-05-01T00:00:00Z",
        "closedAt": None,
        "createdAt": "2026-04-30T23:55:00Z",
        "updatedAt": "2026-05-01T00:00:01Z",
    }
    base.update(overrides)
    return base


class TestArbValidationHelpers:
    """Client-side guards for trading-impact arb endpoints (POLA-1851)."""

    def test_size_below_one_rejected(self):
        from polyforge.client import _validate_arb_size
        with pytest.raises(ValueError, match="between 1 and 10000"):
            _validate_arb_size(0.5)

    def test_size_above_ten_thousand_rejected(self):
        from polyforge.client import _validate_arb_size
        with pytest.raises(ValueError, match="between 1 and 10000"):
            _validate_arb_size(10001)

    def test_size_nan_rejected(self):
        from polyforge.client import _validate_arb_size
        with pytest.raises(ValueError, match="finite"):
            _validate_arb_size(float("nan"))

    def test_size_inf_rejected(self):
        from polyforge.client import _validate_arb_size
        with pytest.raises(ValueError, match="finite"):
            _validate_arb_size(float("inf"))

    def test_size_non_number_rejected(self):
        from polyforge.client import _validate_arb_size
        with pytest.raises(TypeError):
            _validate_arb_size("100")  # type: ignore[arg-type]

    def test_size_bool_rejected(self):
        from polyforge.client import _validate_arb_size
        with pytest.raises(TypeError):
            _validate_arb_size(True)  # type: ignore[arg-type]

    def test_slippage_below_zero_rejected(self):
        from polyforge.client import _validate_arb_slippage
        with pytest.raises(ValueError, match="between 0 and 5"):
            _validate_arb_slippage(-0.1)

    def test_slippage_above_five_rejected(self):
        from polyforge.client import _validate_arb_slippage
        with pytest.raises(ValueError, match="between 0 and 5"):
            _validate_arb_slippage(5.01)

    def test_slippage_nan_rejected(self):
        from polyforge.client import _validate_arb_slippage
        with pytest.raises(ValueError, match="finite"):
            _validate_arb_slippage(float("nan"))


class TestArbValidators_POLA_1873:
    """Validator parity with the MCP shim (POLA-1853) and TS SDK (POLA-1850).

    These tests guard the additions from POLA-1873: ``match_id`` length,
    ``ArbPositionStatus`` allowlist, and the ``limit``/``offset`` page bounds.
    """

    def test_match_id_empty_rejected(self):
        from polyforge.client import _validate_arb_match_id
        with pytest.raises(ValueError, match="between 1 and 255"):
            _validate_arb_match_id("")

    def test_match_id_too_long_rejected(self):
        from polyforge.client import _validate_arb_match_id
        with pytest.raises(ValueError, match="between 1 and 255"):
            _validate_arb_match_id("x" * 256)

    def test_match_id_non_uuid_rejected(self):
        from polyforge.client import _validate_arb_match_id
        with pytest.raises(ValueError, match="valid UUID"):
            _validate_arb_match_id("match-1")

    def test_match_id_uuid_accepted(self):
        from polyforge.client import _validate_arb_match_id
        _validate_arb_match_id("550e8400-e29b-41d4-a716-446655440000")

    def test_match_id_non_string_rejected(self):
        from polyforge.client import _validate_arb_match_id
        with pytest.raises(TypeError, match="must be a string"):
            _validate_arb_match_id(123)  # type: ignore[arg-type]

    def test_position_status_unknown_rejected(self):
        from polyforge.client import _validate_arb_position_status
        with pytest.raises(ValueError, match="status must be one of"):
            _validate_arb_position_status("EXPIRED")

    def test_position_status_all_six_accepted(self):
        from polyforge.client import _validate_arb_position_status
        for value in ("PENDING", "PARTIAL", "OPEN", "CLOSING", "CLOSED", "FAILED"):
            _validate_arb_position_status(value)

    def test_arb_literal_types_exported_from_package(self):
        from polyforge import ArbPositionStatus, Venue
        assert "PENDING" in ArbPositionStatus.__args__
        assert "POLYMARKET" in Venue.__args__
        assert "KALSHI" in Venue.__args__
        assert "POLYMARKET_US" in Venue.__args__

    def test_limit_below_one_rejected(self):
        from polyforge.client import _validate_arb_limit
        with pytest.raises(ValueError, match="between 1 and 100"):
            _validate_arb_limit(0)

    def test_limit_above_hundred_rejected(self):
        from polyforge.client import _validate_arb_limit
        with pytest.raises(ValueError, match="between 1 and 100"):
            _validate_arb_limit(101)

    def test_limit_bool_rejected(self):
        from polyforge.client import _validate_arb_limit
        # ``bool`` is a subclass of ``int`` in Python — guard against it.
        with pytest.raises(TypeError, match="limit must be an int"):
            _validate_arb_limit(True)  # type: ignore[arg-type]

    def test_offset_negative_rejected(self):
        from polyforge.client import _validate_arb_offset
        with pytest.raises(ValueError, match="must be >= 0"):
            _validate_arb_offset(-1)

    def test_execute_arb_validates_match_id_before_post(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock()
        with pytest.raises(ValueError, match="between 1 and 255"):
            client.execute_arb(match_id="x" * 256, size=100.0)
        client._post.assert_not_called()
        client.close()

    def test_list_arb_positions_validates_limit_before_get(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock()
        with pytest.raises(ValueError, match="between 1 and 100"):
            client.list_arb_positions(limit=200)
        client._get.assert_not_called()
        client.close()

    def test_list_arb_positions_validates_status_before_get(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock()
        with pytest.raises(ValueError, match="status must be one of"):
            client.list_arb_positions(status="EXPIRED")  # type: ignore[arg-type]
        client._get.assert_not_called()
        client.close()


VALID_ARB_MATCH_ID = "550e8400-e29b-41d4-a716-446655440000"


def _assert_valid_idempotency_key(value: object) -> None:
    assert isinstance(value, str)
    assert 8 <= len(value) <= 128


class TestIdempotencyKeyHeaders:
    """Trading writes must satisfy the platform IdempotencyInterceptor."""

    def test_sync_trading_writes_generate_idempotency_key(self):
        from unittest.mock import MagicMock

        place_order_payload = {"orderId": "ord-1", "intentId": "int-1", "status": "PENDING"}
        smart_payload = {"smartOrderId": "smart-1", "type": "TWAP", "status": "PENDING", "slicesTotal": 1}
        conditional_payload = {
            "id": "co-1",
            "marketId": "m-1",
            "tokenId": "tok",
            "type": "STOP_LOSS",
            "side": "SELL",
            "outcome": "YES",
            "size": "1",
            "triggerPrice": "0.4",
            "status": "PENDING",
        }
        arb_payload = {
            "arbPositionId": "arb-1",
            "buyLeg": None,
            "sellLeg": None,
            "entrySpreadPct": 0.0,
            "status": "PENDING",
        }

        cases = [
            ("_post", place_order_payload, lambda c: c.place_order("tok", "BUY", "YES", 1.0, 0.5)),
            ("_delete", {}, lambda c: c.cancel_order("ord-1")),
            ("_post", {"results": []}, lambda c: c.batch_orders([{
                "tokenId": "tok", "side": "BUY", "outcome": "YES", "size": 1.0, "price": 0.5,
            }])),
            ("_delete_json", {"cancelled": [], "errors": []}, lambda c: c.bulk_cancel_orders(["ord-1"])),
            ("_post", place_order_payload, lambda c: c.close_position("tok")),
            ("_post", {"positionId": "pos-1", "intentId": "int-1", "status": "REDEEMED"}, lambda c: c.redeem_position(position_id="pos-1")),
            ("_post", place_order_payload, lambda c: c.split_position("tok", 1)),
            ("_post", place_order_payload, lambda c: c.merge_positions("tok", 1)),
            ("_post", smart_payload, lambda c: c.place_smart_order(type="TWAP", token_id="tok", side="BUY", outcome="YES", total_size=1.0)),
            ("_delete", {}, lambda c: c.cancel_smart_order("smart-1")),
            ("_post", conditional_payload, lambda c: c.create_conditional_order("m-1", "tok", "STOP_LOSS", "SELL", "YES", 1.0, 0.4)),
            ("_delete", None, lambda c: c.cancel_conditional_order("co-1")),
            ("_post", arb_payload, lambda c: c.execute_arb(match_id=VALID_ARB_MATCH_ID, size=1.0)),
            ("_post", {"status": "CLOSING", "positionId": "arb-1"}, lambda c: c.close_arb_position("arb-1")),
        ]

        for helper_name, response, call in cases:
            client = PolyforgeClient(api_key="test-key")
            helper = MagicMock(return_value=response)
            setattr(client, helper_name, helper)
            call(client)
            _assert_valid_idempotency_key(helper.call_args.kwargs.get("idempotency_key"))
            client.close()

    def test_sync_trading_write_preserves_explicit_idempotency_key(self):
        from unittest.mock import MagicMock

        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={"orderId": "ord-1", "intentId": "int-1", "status": "PENDING"})
        client.place_order(
            "tok",
            "BUY",
            "YES",
            1.0,
            0.5,
            idempotency_key="order-submit-123",
        )
        assert client._post.call_args.kwargs["idempotency_key"] == "order-submit-123"
        client.close()

    def test_async_trading_writes_generate_idempotency_key(self):
        import asyncio
        from unittest.mock import AsyncMock

        async def _run():
            place_order_payload = {"orderId": "ord-1", "intentId": "int-1", "status": "PENDING"}
            smart_payload = {"smartOrderId": "smart-1", "type": "TWAP", "status": "PENDING", "slicesTotal": 1}
            conditional_payload = {
                "id": "co-1",
                "marketId": "m-1",
                "tokenId": "tok",
                "type": "STOP_LOSS",
                "side": "SELL",
                "outcome": "YES",
                "size": "1",
                "triggerPrice": "0.4",
                "status": "PENDING",
            }
            arb_payload = {
                "arbPositionId": "arb-1",
                "buyLeg": None,
                "sellLeg": None,
                "entrySpreadPct": 0.0,
                "status": "PENDING",
            }
            cases = [
                ("_post", place_order_payload, lambda c: c.place_order("tok", "BUY", "YES", 1.0, 0.5)),
                ("_delete", {}, lambda c: c.cancel_order("ord-1")),
                ("_post", {"results": []}, lambda c: c.batch_orders([{
                    "tokenId": "tok", "side": "BUY", "outcome": "YES", "size": 1.0, "price": 0.5,
                }])),
                ("_delete_json", {"cancelled": [], "errors": []}, lambda c: c.bulk_cancel_orders(["ord-1"])),
                ("_post", place_order_payload, lambda c: c.close_position("tok")),
                ("_post", {"positionId": "pos-1", "intentId": "int-1", "status": "REDEEMED"}, lambda c: c.redeem_position(position_id="pos-1")),
                ("_post", place_order_payload, lambda c: c.split_position("tok", 1)),
                ("_post", place_order_payload, lambda c: c.merge_positions("tok", 1)),
                ("_post", smart_payload, lambda c: c.place_smart_order(type="TWAP", token_id="tok", side="BUY", outcome="YES", total_size=1.0)),
                ("_delete", {}, lambda c: c.cancel_smart_order("smart-1")),
                ("_post", conditional_payload, lambda c: c.create_conditional_order("m-1", "tok", "STOP_LOSS", "SELL", "YES", 1.0, 0.4)),
                ("_delete", None, lambda c: c.cancel_conditional_order("co-1")),
                ("_post", arb_payload, lambda c: c.execute_arb(match_id=VALID_ARB_MATCH_ID, size=1.0)),
                ("_post", {"status": "CLOSING", "positionId": "arb-1"}, lambda c: c.close_arb_position("arb-1")),
            ]

            for helper_name, response, call in cases:
                client = AsyncPolyforgeClient(api_key="test-key")
                helper = AsyncMock(return_value=response)
                setattr(client, helper_name, helper)
                await call(client)
                _assert_valid_idempotency_key(helper.call_args.kwargs.get("idempotency_key"))
                await client.close()

        asyncio.run(_run())

    def test_async_trading_write_preserves_explicit_idempotency_key(self):
        import asyncio
        from unittest.mock import AsyncMock

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            client._post = AsyncMock(return_value={
                "arbPositionId": "arb-1",
                "buyLeg": None,
                "sellLeg": None,
                "entrySpreadPct": 0.0,
                "status": "PENDING",
            })
            await client.execute_arb(
                match_id=VALID_ARB_MATCH_ID,
                size=1.0,
                idempotency_key="arb-submit-123",
            )
            assert client._post.call_args.kwargs["idempotency_key"] == "arb-submit-123"
            await client.close()

        asyncio.run(_run())


class TestArbExecutionSync:
    """Happy-path coverage for the 7 PolyforgeClient arb methods (POLA-1851)."""

    def test_execute_arb_sends_only_provided_fields(self):
        from unittest.mock import MagicMock
        from polyforge.models import ArbExecutionLeg, ArbExecutionResult
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={
            "arbPositionId": "pos-1",
            "buyLeg": {"venue": "POLYMARKET", "intentId": "i1", "tokenId": "tok-b", "price": 0.42},
            "sellLeg": {"venue": "KALSHI", "intentId": "i2", "tokenId": "tok-s", "price": 0.50},
            "entrySpreadPct": 8.0,
            "status": "PENDING",
        })
        result = client.execute_arb(match_id=VALID_ARB_MATCH_ID, size=100.0)
        assert isinstance(result, ArbExecutionResult)
        assert result.arb_position_id == "pos-1"
        assert isinstance(result.buy_leg, ArbExecutionLeg)
        assert result.buy_leg.venue == "POLYMARKET"
        assert result.sell_leg is not None and result.sell_leg.intent_id == "i2"
        assert result.entry_spread_pct == 8.0
        assert result.status == "PENDING"
        # max_slippage_pct omitted -> body must not include it
        client._post.assert_called_once()
        assert client._post.call_args.args == ("/api/v1/arbitrage/execute",)
        assert client._post.call_args.kwargs["json"] == {"matchId": VALID_ARB_MATCH_ID, "size": 100.0}
        _assert_valid_idempotency_key(client._post.call_args.kwargs["idempotency_key"])
        client.close()

    def test_execute_arb_includes_max_slippage(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={
            "arbPositionId": "pos-2", "buyLeg": None, "sellLeg": None,
            "entrySpreadPct": 0.0, "status": "PENDING",
        })
        client.execute_arb(
            match_id=VALID_ARB_MATCH_ID,
            size=100.0,
            max_slippage_pct=1.5,
        )
        client._post.assert_called_once()
        assert client._post.call_args.args == ("/api/v1/arbitrage/execute",)
        assert client._post.call_args.kwargs["json"] == {
            "matchId": VALID_ARB_MATCH_ID,
            "size": 100.0,
            "maxSlippagePct": 1.5,
        }
        _assert_valid_idempotency_key(client._post.call_args.kwargs["idempotency_key"])
        client.close()

    def test_execute_arb_validates_size_before_post(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock()
        with pytest.raises(ValueError, match="between 1 and 10000"):
            client.execute_arb(match_id=VALID_ARB_MATCH_ID, size=10001)
        client._post.assert_not_called()
        client.close()

    def test_execute_arb_validates_slippage_before_post(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock()
        with pytest.raises(ValueError, match="between 0 and 5"):
            client.execute_arb(
                match_id=VALID_ARB_MATCH_ID,
                size=100,
                max_slippage_pct=10,
            )
        client._post.assert_not_called()
        client.close()

    def test_list_arb_positions_default_pagination(self):
        from unittest.mock import MagicMock
        from polyforge.models import ArbPosition
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "positions": [_arb_position_payload()],
            "total": 1,
        })
        result = client.list_arb_positions()
        assert result.total == 1
        assert len(result.positions) == 1
        assert isinstance(result.positions[0], ArbPosition)
        assert result.positions[0].id == "pos-1"
        assert result.positions[0].buy_venue == "POLYMARKET"
        client._get.assert_called_once_with(
            "/api/v1/arbitrage/positions",
            params={"limit": 50, "offset": 0},
        )
        client.close()

    def test_list_arb_positions_with_status_filter(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={"positions": [], "total": 0})
        result = client.list_arb_positions(status="OPEN", limit=25, offset=10)
        assert result.total == 0
        assert result.positions == []
        client._get.assert_called_once_with(
            "/api/v1/arbitrage/positions",
            params={"limit": 25, "offset": 10, "status": "OPEN"},
        )
        client.close()

    def test_get_arb_position_url_encodes_id(self):
        from unittest.mock import MagicMock
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value=_arb_position_payload(id="pos with space"))
        result = client.get_arb_position("pos with space")
        assert result.id == "pos with space"
        # Path-segment encoding must escape spaces, not pass them raw.
        client._get.assert_called_once_with("/api/v1/arbitrage/positions/pos%20with%20space")
        client.close()

    def test_close_arb_position_returns_typed_response(self):
        from unittest.mock import MagicMock
        from polyforge.models import ArbCloseResponse
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={"status": "CLOSING", "positionId": "pos-1"})
        result = client.close_arb_position("pos-1")
        assert isinstance(result, ArbCloseResponse)
        assert result.status == "CLOSING"
        assert result.position_id == "pos-1"
        client._post.assert_called_once()
        assert client._post.call_args.args == ("/api/v1/arbitrage/positions/pos-1/close",)
        _assert_valid_idempotency_key(client._post.call_args.kwargs["idempotency_key"])
        client.close()

    def test_get_arb_risk_dashboard_parses_nested_exposure(self):
        from unittest.mock import MagicMock
        from polyforge.models import ArbNetExposure
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value={
            "openPositions": 3,
            "pendingPositions": 1,
            "totalDeployed": 1234.56,
            "netExposure": {"polymarket": 600.0, "kalshi": 634.56},
            "totalRealizedPnl": 12.5,
            "totalUnrealizedPnl": -3.25,
            "avgSpreadPct": 6.5,
            "positionsByStatus": {"OPEN": 3, "PENDING": 1, "CLOSED": 5},
        })
        result = client.get_arb_risk_dashboard()
        assert result.open_positions == 3
        assert result.pending_positions == 1
        assert result.total_deployed == 1234.56
        assert isinstance(result.net_exposure, ArbNetExposure)
        assert result.net_exposure.polymarket == 600.0
        assert result.net_exposure.kalshi == 634.56
        assert result.positions_by_status == {"OPEN": 3, "PENDING": 1, "CLOSED": 5}
        client._get.assert_called_once_with("/api/v1/arbitrage/risk/dashboard")
        client.close()

    def test_get_arb_settlement_risks_returns_list(self):
        from unittest.mock import MagicMock
        from polyforge.models import ArbSettlementRisk
        client = PolyforgeClient(api_key="test-key")
        client._get = MagicMock(return_value=[
            {
                "matchId": "m1",
                "polymarketTitle": "BTC > 100k by EOY",
                "kalshiTitle": "BTC over 100k 2026",
                "polymarketEndDate": "2026-12-31T00:00:00Z",
                "kalshiEndDate": "2027-01-15T00:00:00Z",
                "endDateDiffDays": 15.0,
                "confidence": 0.92,
                "riskLevel": "MEDIUM",
                "reason": "Resolution windows differ by 15 days.",
            },
        ])
        result = client.get_arb_settlement_risks()
        assert len(result) == 1
        assert isinstance(result[0], ArbSettlementRisk)
        assert result[0].risk_level == "MEDIUM"
        assert result[0].end_date_diff_days == 15.0
        client._get.assert_called_once_with("/api/v1/arbitrage/risk/settlement")
        client.close()

    def test_refresh_arb_pnl_returns_updated_count(self):
        from unittest.mock import MagicMock
        from polyforge.models import ArbPnlRefreshResult
        client = PolyforgeClient(api_key="test-key")
        client._post = MagicMock(return_value={"updated": 7})
        result = client.refresh_arb_pnl()
        assert isinstance(result, ArbPnlRefreshResult)
        assert result.updated == 7
        client._post.assert_called_once_with("/api/v1/arbitrage/risk/refresh-pnl")
        client.close()


class TestArbExecutionAsync:
    """Async coverage mirror for the 7 AsyncPolyforgeClient arb methods (POLA-1851)."""

    def test_async_methods_are_coroutines(self):
        import inspect
        ac = AsyncPolyforgeClient(api_key="test-key")
        for name in (
            "execute_arb",
            "list_arb_positions",
            "get_arb_position",
            "close_arb_position",
            "get_arb_risk_dashboard",
            "get_arb_settlement_risks",
            "refresh_arb_pnl",
        ):
            method = getattr(ac, name)
            assert inspect.iscoroutinefunction(method), f"{name} must be async"

    def test_async_execute_arb_validates_before_awaiting(self):
        import asyncio
        from unittest.mock import AsyncMock

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            client._post = AsyncMock()
            with pytest.raises(ValueError, match="between 1 and 10000"):
                await client.execute_arb(match_id=VALID_ARB_MATCH_ID, size=0)
            client._post.assert_not_awaited()
            await client.close()

        asyncio.run(_run())

    def test_async_execute_arb_happy_path(self):
        import asyncio
        from unittest.mock import AsyncMock
        from polyforge.models import ArbExecutionResult

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            client._post = AsyncMock(return_value={
                "arbPositionId": "pos-9",
                "buyLeg": {"venue": "KALSHI", "intentId": "i9", "tokenId": "t9", "price": 0.31},
                "sellLeg": {"venue": "POLYMARKET", "intentId": "i10", "tokenId": "t10", "price": 0.40},
                "entrySpreadPct": 9.0,
                "status": "PENDING",
            })
            result = await client.execute_arb(
                match_id=VALID_ARB_MATCH_ID,
                size=200.0,
                max_slippage_pct=2.0,
            )
            assert isinstance(result, ArbExecutionResult)
            assert result.arb_position_id == "pos-9"
            assert result.buy_leg is not None and result.buy_leg.price == 0.31
            client._post.assert_awaited_once()
            assert client._post.await_args.args == ("/api/v1/arbitrage/execute",)
            assert client._post.await_args.kwargs["json"] == {
                "matchId": VALID_ARB_MATCH_ID,
                "size": 200.0,
                "maxSlippagePct": 2.0,
            }
            _assert_valid_idempotency_key(client._post.await_args.kwargs["idempotency_key"])
            await client.close()

        asyncio.run(_run())

    def test_async_close_arb_position_happy_path(self):
        import asyncio
        from unittest.mock import AsyncMock
        from polyforge.models import ArbCloseResponse

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            client._post = AsyncMock(return_value={"status": "CLOSING", "positionId": "pos-9"})
            result = await client.close_arb_position("pos-9")
            assert isinstance(result, ArbCloseResponse)
            assert result.status == "CLOSING"
            client._post.assert_awaited_once()
            assert client._post.await_args.args == ("/api/v1/arbitrage/positions/pos-9/close",)
            _assert_valid_idempotency_key(client._post.await_args.kwargs["idempotency_key"])
            await client.close()

        asyncio.run(_run())

    def test_async_list_arb_positions_default_pagination(self):
        import asyncio
        from unittest.mock import AsyncMock

        async def _run():
            client = AsyncPolyforgeClient(api_key="test-key")
            client._get = AsyncMock(return_value={"positions": [], "total": 0})
            result = await client.list_arb_positions()
            assert result.total == 0
            client._get.assert_awaited_once_with(
                "/api/v1/arbitrage/positions",
                params={"limit": 50, "offset": 0},
            )
            await client.close()

        asyncio.run(_run())


class TestArbHttpErrorMapping:
    """4xx responses on ``execute_arb``/``close_arb_position`` MUST raise typed
    PolyforgeError subclasses with the backend ``code`` preserved verbatim.

    Trading-impact paths must surface server validation immediately — never
    swallow, never auto-retry.
    """

    @staticmethod
    def _client_with_transport(handler):
        transport = httpx.MockTransport(handler)
        client = PolyforgeClient(api_key="test-key")
        client._client = httpx.Client(
            base_url=client._api_url,
            headers={"Authorization": "Bearer test-key", "Content-Type": "application/json"},
            transport=transport,
        )
        return client

    def test_execute_arb_404_raises_not_found_with_code(self):
        def handler(request):
            assert request.url.path == "/api/v1/arbitrage/execute"
            return httpx.Response(
                404,
                json={"message": "match not found", "code": "MATCH_NOT_FOUND", "requestId": "req-1"},
            )

        client = self._client_with_transport(handler)
        try:
            with pytest.raises(NotFoundError) as exc_info:
                client.execute_arb(match_id=VALID_ARB_MATCH_ID, size=100)
            assert exc_info.value.code == "MATCH_NOT_FOUND"
            assert exc_info.value.request_id == "req-1"
        finally:
            client.close()

    def test_execute_arb_400_raises_polyforge_error_with_code(self):
        # 400 maps to base PolyforgeError (no dedicated subclass for 400).
        def handler(request):
            return httpx.Response(
                400,
                json={"message": "venues not connected", "code": "VENUES_NOT_CONNECTED"},
            )

        client = self._client_with_transport(handler)
        try:
            with pytest.raises(PolyforgeError) as exc_info:
                client.execute_arb(match_id=VALID_ARB_MATCH_ID, size=100)
            assert exc_info.value.code == "VENUES_NOT_CONNECTED"
            assert exc_info.value.status_code == 400
        finally:
            client.close()

    def test_execute_arb_401_raises_authentication_error(self):
        def handler(request):
            return httpx.Response(
                401,
                json={"message": "missing token", "code": "UNAUTHENTICATED"},
            )

        client = self._client_with_transport(handler)
        try:
            with pytest.raises(AuthenticationError) as exc_info:
                client.execute_arb(match_id=VALID_ARB_MATCH_ID, size=100)
            assert exc_info.value.code == "UNAUTHENTICATED"
        finally:
            client.close()

    def test_execute_arb_does_not_retry_on_5xx(self):
        # If the SDK ever started auto-retrying, this counter would exceed 1.
        # Trading-impact endpoints must fail fast on the very first error.
        calls = {"n": 0}

        def handler(request):
            calls["n"] += 1
            return httpx.Response(
                500,
                json={"message": "boom", "code": "INTERNAL"},
            )

        client = self._client_with_transport(handler)
        try:
            with pytest.raises(ServerError):
                client.execute_arb(match_id=VALID_ARB_MATCH_ID, size=100)
        finally:
            client.close()
        assert calls["n"] == 1, f"execute_arb auto-retried (saw {calls['n']} calls)"

    def test_close_arb_position_404_raises_not_found_with_code(self):
        def handler(request):
            assert request.url.path == "/api/v1/arbitrage/positions/missing/close"
            return httpx.Response(
                404,
                json={"message": "no such position", "code": "ARB_POSITION_NOT_FOUND"},
            )

        client = self._client_with_transport(handler)
        try:
            with pytest.raises(NotFoundError) as exc_info:
                client.close_arb_position("missing")
            assert exc_info.value.code == "ARB_POSITION_NOT_FOUND"
        finally:
            client.close()

    def test_close_arb_position_does_not_retry_on_5xx(self):
        calls = {"n": 0}

        def handler(request):
            calls["n"] += 1
            return httpx.Response(
                503,
                json={"message": "downstream broken", "code": "DOWNSTREAM_UNAVAILABLE"},
            )

        client = self._client_with_transport(handler)
        try:
            with pytest.raises(ServerError):
                client.close_arb_position("pos-1")
        finally:
            client.close()
        assert calls["n"] == 1, f"close_arb_position auto-retried (saw {calls['n']} calls)"

# ── POLA-1844: Public user profile lookups ────────────────────────────────


class TestPublicUserProfileEndpoints:
    """Five public profile endpoints sourced from the weekly SDK audit."""

    def test_get_user_performance_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_user_performance", None))

    def test_get_user_performance_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_user_performance", None))

    def test_get_user_performance_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_user_performance)
        assert "/api/v1/users/" in source
        assert "/performance" in source

    def test_get_user_performance_default_period_is_30d(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_user_performance)
        assert sig.parameters["period"].default == "30d"

    def test_get_user_performance_encodes_username(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_user_performance)
        assert "_encode_path(username)" in source

    def test_get_user_strategies_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_user_strategies", None))

    def test_get_user_strategies_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_user_strategies", None))

    def test_get_user_strategies_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_user_strategies)
        assert "/api/v1/users/" in source
        assert "/strategies" in source

    def test_get_user_strategies_default_visibility_public(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_user_strategies)
        assert sig.parameters["visibility"].default == "PUBLIC"

    def test_get_user_activity_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_user_activity", None))

    def test_get_user_activity_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_user_activity", None))

    def test_get_user_activity_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_user_activity)
        assert "/api/v1/users/" in source
        assert "/activity" in source

    def test_get_user_profile_badges_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_user_profile_badges", None))

    def test_get_user_profile_badges_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_user_profile_badges", None))

    def test_get_user_badges_by_username_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_user_badges_by_username", None))

    def test_get_user_badges_by_username_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_user_badges_by_username", None))

    def test_get_user_badges_by_username_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_user_badges_by_username)
        assert "/api/v1/users/" in source
        assert "/badges" in source

    def test_get_user_profile_badges_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_user_badges_by_username)
        assert "/api/v1/users/" in source
        assert "/badges" in source

    def test_get_my_following_exists_sync(self):
        assert callable(getattr(PolyforgeClient, "get_my_following", None))

    def test_get_my_following_exists_async(self):
        assert callable(getattr(AsyncPolyforgeClient, "get_my_following", None))

    def test_get_my_following_uses_correct_path(self):
        import inspect
        source = inspect.getsource(PolyforgeClient.get_my_following)
        assert "/api/v1/users/me/following" in source

    def test_get_my_following_returns_paginated_response(self):
        import inspect
        sig = inspect.signature(PolyforgeClient.get_my_following)
        assert "PaginatedResponse" in str(sig.return_annotation)

    def test_get_user_performance_unwraps_data_envelope(self, monkeypatch):
        client = PolyforgeClient(api_key="test")
        captured: dict = {}

        def fake_get(path: str, params=None):
            captured["path"] = path
            captured["params"] = params
            return {"data": [{"date": "2026-04-01", "pnl": 12.5, "cumPnl": 12.5}]}

        monkeypatch.setattr(client, "_get", fake_get)
        result = client.get_user_performance("alice", "7d")

        assert captured["path"] == "/api/v1/users/alice/performance"
        assert captured["params"] == {"period": "7d"}
        assert len(result) == 1
        assert result[0].date == "2026-04-01"
        assert result[0].pnl == 12.5
        assert result[0].cum_pnl == 12.5

    def test_get_user_activity_url_encodes_username(self, monkeypatch):
        client = PolyforgeClient(api_key="test")
        captured: dict = {}

        def fake_get(path: str, params=None):
            captured["path"] = path
            return {"data": []}

        monkeypatch.setattr(client, "_get", fake_get)
        client.get_user_activity("john doe")
        assert captured["path"] == "/api/v1/users/john%20doe/activity"

    def test_get_my_following_returns_full_pagination(self, monkeypatch):
        client = PolyforgeClient(api_key="test")

        def fake_get(path: str, params=None):
            return {
                "data": [
                    {"id": "u1", "username": "alice", "displayName": "Alice", "avatarUrl": None},
                ],
                "total": 1, "page": 1, "limit": 20, "totalPages": 1, "hasNext": False,
            }

        monkeypatch.setattr(client, "_get", fake_get)
        result = client.get_my_following(page=1, limit=20)

        assert result.total == 1
        assert result.page == 1
        assert result.limit == 20
        assert result.total_pages == 1
        assert result.has_next is False
        assert len(result.data) == 1
        assert result.data[0].username == "alice"
        assert result.data[0].display_name == "Alice"

    def test_get_user_profile_badges_propagates_404(self, monkeypatch):
        from polyforge.errors import NotFoundError

        client = PolyforgeClient(api_key="test")

        def fake_get(path: str, params=None):
            raise NotFoundError("User not found", status_code=404, code="NOT_FOUND")

        monkeypatch.setattr(client, "_get", fake_get)
        with pytest.warns(DeprecationWarning), pytest.raises(NotFoundError):
            client.get_user_profile_badges("ghost")

    def test_get_user_badges_by_username_propagates_404(self, monkeypatch):
        from polyforge.errors import NotFoundError

        client = PolyforgeClient(api_key="test")

        def fake_get(path: str, params=None):
            raise NotFoundError("User not found", status_code=404, code="NOT_FOUND")

        monkeypatch.setattr(client, "_get", fake_get)
        with pytest.raises(NotFoundError):
            client.get_user_badges_by_username("ghost")


# ── Rewards Endpoint Coverage (POLA-3324) ────────────────────────────────────

REWARDS_METHODS = (
    "get_market_rewards_detail",
    "get_user_sponsored_markets",
    "get_rewards_sponsor_url",
)


class TestRewardsEndpointsPresence:
    """Surface check: all 3 new rewards methods exist on both clients (POLA-3324)."""

    def test_all_methods_present_on_sync_client(self):
        for name in REWARDS_METHODS:
            assert callable(getattr(PolyforgeClient, name, None)), name

    def test_all_methods_present_on_async_client(self):
        for name in REWARDS_METHODS:
            assert callable(getattr(AsyncPolyforgeClient, name, None)), name


class TestRewardsEndpointsPaths:
    """Verify each new rewards method targets the correct controller path."""

    def test_get_market_rewards_detail_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.get_market_rewards_detail)
        assert '"/api/v1/rewards/market/"' in src or '/api/v1/rewards/market/' in src

    def test_get_user_sponsored_markets_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.get_user_sponsored_markets)
        assert '"/api/v1/rewards/user/sponsored-markets"' in src

    def test_get_rewards_sponsor_url_path(self):
        import inspect
        src = inspect.getsource(PolyforgeClient.get_rewards_sponsor_url)
        assert '"/api/v1/rewards/sponsor-url/"' in src or '/api/v1/rewards/sponsor-url/' in src


class TestRewardsEndpointRoundtrips:
    """Stub the HTTP layer and exercise each new rewards method."""

    @staticmethod
    def _client_with(handler):
        transport = httpx.MockTransport(handler)
        client = PolyforgeClient(api_key="test", api_url="http://localhost:9999")
        client._client = httpx.Client(
            base_url="http://localhost:9999",
            headers={"Authorization": "Bearer test"},
            transport=transport,
        )
        return client

    def test_get_market_rewards_detail_returns_model(self):
        def handler(request):
            assert request.method == "GET"
            assert request.url.path == "/api/v1/rewards/market/market-abc"
            return httpx.Response(200, json={
                "conditionId": "cond-1",
                "ratePerDay": "100.0",
                "totalRewards": "5000.0",
                "remainingRewardAmount": "2500.0",
                "maxSpread": "0.05",
                "minSize": "10.0",
                "startDate": "2026-01-01",
                "endDate": "2026-12-31",
            })

        client = self._client_with(handler)
        try:
            result = client.get_market_rewards_detail("market-abc")
            assert isinstance(result, RewardsMarketDetail)
            assert result.condition_id == "cond-1"
            assert result.rate_per_day == "100.0"
            assert result.remaining_reward_amount == "2500.0"
        finally:
            client.close()

    def test_get_market_rewards_detail_encodes_market_id(self):
        captured = {}

        def handler(request):
            captured["raw_path"] = request.url.raw_path
            return httpx.Response(200, json={
                "conditionId": "", "ratePerDay": "", "totalRewards": "",
                "remainingRewardAmount": "", "maxSpread": "", "minSize": "",
                "startDate": "", "endDate": "",
            })

        client = self._client_with(handler)
        try:
            client.get_market_rewards_detail("market/with/slashes")
            assert captured["raw_path"] == b"/api/v1/rewards/market/market%2Fwith%2Fslashes"
        finally:
            client.close()

    def test_get_market_rewards_detail_returns_none_on_null(self):
        def handler(request):
            return httpx.Response(200, content=b"null",
                                  headers={"Content-Type": "application/json"})

        client = self._client_with(handler)
        try:
            result = client.get_market_rewards_detail("ghost-market")
            assert result is None
        finally:
            client.close()

    def test_get_user_sponsored_markets_returns_model(self):
        def handler(request):
            assert request.method == "GET"
            assert request.url.path == "/api/v1/rewards/user/sponsored-markets"
            return httpx.Response(200, json={"markets": [{"conditionId": "c1"}, {"conditionId": "c2"}]})

        client = self._client_with(handler)
        try:
            result = client.get_user_sponsored_markets()
            assert isinstance(result, UserSponsoredMarkets)
            assert result.markets == [{"conditionId": "c1"}, {"conditionId": "c2"}]
        finally:
            client.close()

    def test_get_user_sponsored_markets_empty(self):
        def handler(request):
            return httpx.Response(200, json={"markets": []})

        client = self._client_with(handler)
        try:
            result = client.get_user_sponsored_markets()
            assert isinstance(result, UserSponsoredMarkets)
            assert result.markets == []
        finally:
            client.close()

    def test_get_rewards_sponsor_url_returns_model(self):
        def handler(request):
            assert request.method == "GET"
            assert request.url.path == "/api/v1/rewards/sponsor-url/market-xyz"
            return httpx.Response(200, json={"url": "https://polymarket.com/sponsor/m-xyz"})

        client = self._client_with(handler)
        try:
            result = client.get_rewards_sponsor_url("market-xyz")
            assert isinstance(result, RewardsSponsorUrl)
            assert result.url == "https://polymarket.com/sponsor/m-xyz"
        finally:
            client.close()

    def test_get_rewards_sponsor_url_encodes_market_id(self):
        captured = {}

        def handler(request):
            captured["raw_path"] = request.url.raw_path
            return httpx.Response(200, json={"url": ""})

        client = self._client_with(handler)
        try:
            client.get_rewards_sponsor_url("market/with/slashes")
            assert captured["raw_path"] == b"/api/v1/rewards/sponsor-url/market%2Fwith%2Fslashes"
        finally:
            client.close()
