"""
Project Cura - Rate Limiter Middleware.

Simple in-memory token-bucket rate limiter for FastAPI.
Tracks request counts per client IP within a sliding window.
"""

import time
import logging
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import get_settings

logger = logging.getLogger(__name__)


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    In-memory rate limiter based on client IP.

    Allows RATE_LIMIT_REQUESTS requests per RATE_LIMIT_WINDOW_SECONDS window.
    WebSocket connections and health checks are excluded.
    """

    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = defaultdict(list)
        settings = get_settings()
        self._max_requests = settings.RATE_LIMIT_REQUESTS
        self._window = settings.RATE_LIMIT_WINDOW_SECONDS

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request, considering proxy headers."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for WebSocket, health checks, and static files
        path = request.url.path
        if (
            path.startswith("/ws/")
            or path.endswith("/health")
            or path == "/"
            or path.startswith("/docs")
            or path.startswith("/openapi")
        ):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
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
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please try again later.",
                    "retry_after": self._window,
                },
                headers={"Retry-After": str(self._window)},
            )

        self._requests[client_ip].append(now)
        response = await call_next(request)
        return response
