"""Polyforge SDK error types."""

from __future__ import annotations


class PolyforgeError(Exception):
    """Base exception for all Polyforge API errors.

    Attributes:
        status_code: HTTP status code returned by the API.
        code: Machine-readable error code from the API response body.
        message: Human-readable error description.
        request_id: Unique identifier for the failed request, useful for support.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 0,
        code: str = "",
        request_id: str = "",
        suggestion: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.request_id = request_id
        self.suggestion = suggestion

    def __repr__(self) -> str:
        return (
            f"PolyforgeError(status_code={self.status_code!r}, "
            f"code={self.code!r}, message={self.message!r}, "
            f"request_id={self.request_id!r}, "
            f"suggestion={self.suggestion!r})"
        )


class AuthenticationError(PolyforgeError):
    """Raised when the API key is invalid or missing (HTTP 401)."""


class PermissionError(PolyforgeError):
    """Raised when the API key lacks required permissions (HTTP 403)."""


class NotFoundError(PolyforgeError):
    """Raised when the requested resource does not exist (HTTP 404)."""


class RateLimitError(PolyforgeError):
    """Raised when the API rate limit is exceeded (HTTP 429)."""


class ServerError(PolyforgeError):
    """Raised for server-side errors (HTTP 5xx)."""
