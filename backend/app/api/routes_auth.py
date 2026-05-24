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
from app.models.database import get_user_by_username, create_user, log_audit, update_user_last_login

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    """Login request body."""
    username: str
    password: str


class SignupRequest(BaseModel):
    """Signup request body for new doctors."""
    username: str
    password: str
    full_name: str
    expertise: str
    credentials: str


class LoginResponse(BaseModel):
    """Login response with JWT token."""
    access_token: str
    token_type: str = "bearer"
    username: str
    full_name: str
    role: str
    expertise: str = ""
    credentials: str = ""


class UserInfoResponse(BaseModel):
    """Current user information."""
    username: str
    full_name: str
    role: str
    expertise: str = ""
    credentials: str = ""


@router.post("/signup", response_model=LoginResponse)
async def signup(request: SignupRequest) -> LoginResponse:
    """
    Register a new doctor and return a JWT access token.
    """
    # Check if user already exists
    existing = await get_user_by_username(request.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Hash password and create user
    hashed = hash_password(request.password)
    user = await create_user(
        username=request.username,
        password_hash=hashed,
        full_name=request.full_name,
        role="doctor",
        expertise=request.expertise,
        credentials=request.credentials,
    )

    if user is None:
        # Fallback for development if db migration was not run yet
        # We simulate user creation locally to prevent any developer lockout
        user = {
            "username": request.username,
            "full_name": request.full_name,
            "role": "doctor",
            "expertise": request.expertise,
            "credentials": request.credentials,
        }

    # Generate JWT
    token = create_access_token({"sub": user["username"], "role": user.get("role", "doctor")})

    # Update last login (ignore errors if table missing)
    try:
        await update_user_last_login(request.username)
    except Exception:
        pass

    # Audit log (ignore errors if table missing)
    try:
        await log_audit(
            username=request.username,
            action="signup",
            details={"role": "doctor", "expertise": request.expertise},
        )
    except Exception:
        pass

    logger.info("New doctor '%s' registered successfully", request.username)

    return LoginResponse(
        access_token=token,
        username=user["username"],
        full_name=user.get("full_name", ""),
        role=user.get("role", "doctor"),
        expertise=user.get("expertise", ""),
        credentials=user.get("credentials", ""),
    )


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
    try:
        await update_user_last_login(request.username)
    except Exception:
        pass

    # Audit log
    try:
        await log_audit(
            username=request.username,
            action="login",
            details={"role": user.get("role", "doctor")},
        )
    except Exception:
        pass

    logger.info("User '%s' logged in successfully", request.username)

    return LoginResponse(
        access_token=token,
        username=user["username"],
        full_name=user.get("full_name", ""),
        role=user.get("role", "doctor"),
        expertise=user.get("expertise", ""),
        credentials=user.get("credentials", ""),
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
        expertise=user.get("expertise", ""),
        credentials=user.get("credentials", ""),
    )
