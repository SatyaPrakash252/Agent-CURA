"""
Project Cura - Authentication API Routes.

Provides login and user info endpoints.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.middleware.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.models.database import get_user_by_username, log_audit, update_user_last_login

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    """Login request body."""
    username: str
    password: str


class LoginResponse(BaseModel):
    """Login response with JWT token."""
    access_token: str
    token_type: str = "bearer"
    username: str
    full_name: str
    role: str


class UserInfoResponse(BaseModel):
    """Current user information."""
    username: str
    full_name: str
    role: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest) -> LoginResponse:
    """
    Authenticate a user and return a JWT access token.

    Args:
        request: LoginRequest with username and password.

    Returns:
        LoginResponse with JWT token and user details.

    Raises:
        HTTPException 401 if credentials are invalid.
    """
    user = await get_user_by_username(request.username)
    if user is None or not verify_password(request.password, user.get("password_hash", "")):
        logger.warning("Failed login attempt for user: %s", request.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Generate JWT
    token = create_access_token({"sub": user["username"], "role": user.get("role", "doctor")})

    # Update last login
    await update_user_last_login(request.username)

    # Audit log
    await log_audit(
        username=request.username,
        action="login",
        details={"role": user.get("role", "doctor")},
    )

    logger.info("User '%s' logged in successfully", request.username)

    return LoginResponse(
        access_token=token,
        username=user["username"],
        full_name=user.get("full_name", ""),
        role=user.get("role", "doctor"),
    )


@router.get("/me", response_model=UserInfoResponse)
async def get_me(user: dict = Depends(get_current_user)) -> UserInfoResponse:
    """
    Get the current authenticated user's information.

    Returns:
        UserInfoResponse with username, name, and role.
    """
    return UserInfoResponse(
        username=user.get("username", ""),
        full_name=user.get("full_name", ""),
        role=user.get("role", ""),
    )
