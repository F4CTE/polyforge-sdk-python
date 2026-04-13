"""Basic smoke tests for PolyforgeClient."""

import pytest
from polyforge.client import (
    PolyforgeClient,
    AsyncPolyforgeClient,
    _parse,
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
from polyforge.models import Market, Strategy, Portfolio, WebhookEvent


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
        assert strategy.blocks == []


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

    def test_webhook_event_values_are_screaming_snake_case(self):
        """WebhookEvent values must use SCREAMING_SNAKE_CASE, not dot.notation (#91)."""
        events = [
            WebhookEvent.ORDER_FILLED,
            WebhookEvent.ORDER_PLACED,
            WebhookEvent.ORDER_CANCELLED,
            WebhookEvent.STRATEGY_STARTED,
            WebhookEvent.STRATEGY_STOPPED,
            WebhookEvent.STRATEGY_ERROR,
            WebhookEvent.BACKTEST_COMPLETED,
            WebhookEvent.BACKTEST_FAILED,
        ]
        for event in events:
            assert "." not in event, f"WebhookEvent {event} uses dot.notation instead of SCREAMING_SNAKE_CASE"
            assert event == event.upper(), f"WebhookEvent {event} is not SCREAMING_SNAKE_CASE"

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

    def test_split_position_rejects_zero_size(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be positive"):
            client.split_position("tok", 0, 0.5)
        client.close()

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

    def test_provide_liquidity_rejects_negative_spread(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be positive"):
            client.provide_liquidity("tok", -0.01, 100.0)
        client.close()

    def test_provide_liquidity_rejects_zero_size(self):
        client = PolyforgeClient(api_key="test-key")
        with pytest.raises(ValueError, match="must be positive"):
            client.provide_liquidity("tok", 0.05, 0)
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

    def test_async_split_position_calls_validate(self):
        """Async split_position must call _validate_financial_param for size and price."""
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.split_position)
        assert '_validate_financial_param("size"' in source
        assert '_validate_financial_param("price"' in source

    def test_async_place_smart_order_calls_validate(self):
        """Async place_smart_order must call _validate_financial_param for total_size."""
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.place_smart_order)
        assert '_validate_financial_param("total_size"' in source

    def test_async_provide_liquidity_calls_validate(self):
        """Async provide_liquidity must call _validate_financial_param for spread and size."""
        import inspect
        source = inspect.getsource(AsyncPolyforgeClient.provide_liquidity)
        assert '_validate_financial_param("spread"' in source
        assert '_validate_financial_param("size"' in source
