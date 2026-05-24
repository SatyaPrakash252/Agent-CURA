"""
Project Cura - JWT Authentication Middleware.

Provides JWT token generation, verification, and a FastAPI dependency
for protecting routes. Includes first-run admin user bootstrap.
"""

import hashlib
import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from app.models.database import (
    create_user,
    get_user_by_username,
    update_user_last_login,
)

logger = logging.getLogger(__name__)

_security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash a password with SHA-256. Use bcrypt in production."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return hash_password(plain) == hashed


def create_access_token(data: dict) -> str:
    """Create a JWT access token with expiry."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRY_MINUTES)
    payload = {**data, "exp": expire, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and verify a JWT token. Returns payload or None."""
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid token: %s", e)
        return None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
) -> dict:
    """
    FastAPI dependency to extract and verify the current user from JWT.

    Raises HTTPException 401 if the token is missing, invalid, or the user
    is not found.
    """
    # Allow WebSocket and health endpoints to pass through
    if request.url.path.startswith("/ws/") or request.url.path.endswith("/health"):
        return {"username": "system", "role": "system"}

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await get_user_by_username(username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def bootstrap_admin_user() -> None:
    """
    Create the default admin user on first startup if no users exist.
    Uses ADMIN_USERNAME and ADMIN_PASSWORD from settings.
    """
    settings = get_settings()
    existing = await get_user_by_username(settings.ADMIN_USERNAME)
    if existing:
        logger.info("Admin user '%s' already exists", settings.ADMIN_USERNAME)
        return

    logger.info("Creating default admin user: %s", settings.ADMIN_USERNAME)
    await create_user(
        username=settings.ADMIN_USERNAME,
        password_hash=hash_password(settings.ADMIN_PASSWORD),
        full_name="Administrator",
        role="admin",
    )
    logger.info("Default admin user created successfully")
