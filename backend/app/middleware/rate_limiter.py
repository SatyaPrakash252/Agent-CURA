"""
Project Cura - Rate Limiter Middleware.

Pure ASGI rate limiter middleware. Bypasses WebSockets at the ASGI scope level
to prevent BaseHTTPMiddleware from breaking WebSocket connection upgrades.
Tracks request counts per client IP within a sliding window.
"""

import time
import logging
from collections import defaultdict

from starlette.types import ASGIApp, Scope, Receive, Send
from starlette.responses import JSONResponse

from app.config import get_settings

logger = logging.getLogger(__name__)


class RateLimiterMiddleware:
    """
    In-memory rate limiter based on client IP.

    Allows RATE_LIMIT_REQUESTS requests per RATE_LIMIT_WINDOW_SECONDS window.
    WebSocket connections, health checks, root, and docs are excluded.
    """

    def __init__(self, app: ASGIApp):
        self.app = app
        self._requests: dict[str, list[float]] = defaultdict(list)
        settings = get_settings()
        self._max_requests = settings.RATE_LIMIT_REQUESTS
        self._window = settings.RATE_LIMIT_WINDOW_SECONDS

    def _get_client_ip(self, scope: Scope) -> str:
        """Extract client IP from ASGI scope, considering proxy headers."""
        headers = dict(scope.get("headers", []))
        forwarded = headers.get(b"x-forwarded-for")
        if forwarded:
            try:
                return forwarded.decode("utf-8").split(",")[0].strip()
            except Exception:
                pass
        
        client = scope.get("client")
        return client[0] if client else "unknown"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # 1. Bypasses rate limiting for WebSockets, health checks, root, and docs
        if scope["type"] == "websocket":
            await self.app(scope, receive, send)
            return

        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if (
            path.startswith("/ws/")
            or path.endswith("/health")
            or path == "/"
            or path.startswith("/docs")
            or path.startswith("/openapi")
        ):
            await self.app(scope, receive, send)
            return

        # 2. Extract IP and evaluate rate limits
        client_ip = self._get_client_ip(scope)
        now = time.time()
        window_start = now - self._window

        # Clean old entries
        self._requests[client_ip] = [
            t for t in self._requests[client_ip] if t > window_start
        ]

        if len(self._requests[client_ip]) >= self._max_requests:
            logger.warning(
                "Rate limit exceeded for %s (%d requests in %ds)",
                client_ip,
                len(self._requests[client_ip]),
                self._window,
            )
            response = JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please try again later.",
                    "retry_after": self._window,
                },
                headers={"Retry-After": str(self._window)},
            )
            await response(scope, receive, send)
            return

        self._requests[client_ip].append(now)
        await self.app(scope, receive, send)

