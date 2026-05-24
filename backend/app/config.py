"""
Project Cura - Application Configuration.

Reads configuration from the .env file in the parent directory
and provides a singleton settings instance via get_settings().
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    # --- External Services ---
    GROQ_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # --- Whisper ---
    WHISPER_MODEL_SIZE: str = "small"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"
    MODEL_DOWNLOAD_ROOT: str = "../models"

    # --- CORS ---
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # --- JWT Authentication ---
    JWT_SECRET_KEY: str = "change-this-to-a-random-64-char-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 480

    # --- Default Admin (created on first startup if no users exist) ---
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"

    # --- Rate Limiting ---
    RATE_LIMIT_REQUESTS: int = 30  # requests per window
    RATE_LIMIT_WINDOW_SECONDS: int = 60  # window size

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""
    return Settings()
