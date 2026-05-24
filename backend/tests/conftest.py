"""
Project Cura - Test Configuration and Fixtures.

Provides pytest fixtures for mocking external services (Groq LLM, Supabase)
and creating test clients.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_settings():
    """Mock application settings."""
    settings = MagicMock()
    settings.GROQ_API_KEY = "test-groq-key"
    settings.SUPABASE_URL = "https://test.supabase.co"
    settings.SUPABASE_KEY = "test-supabase-key"
    settings.WHISPER_MODEL_SIZE = "tiny"
    settings.WHISPER_DEVICE = "cpu"
    settings.WHISPER_COMPUTE_TYPE = "int8"
    settings.MODEL_DOWNLOAD_ROOT = "./test_models"
    settings.JWT_SECRET_KEY = "test-jwt-secret"
    settings.JWT_ALGORITHM = "HS256"
    settings.JWT_EXPIRY_MINUTES = 60
    settings.ADMIN_USERNAME = "admin"
    settings.ADMIN_PASSWORD = "admin123"
    settings.RATE_LIMIT_REQUESTS = 100
    settings.RATE_LIMIT_WINDOW_SECONDS = 60
    settings.CORS_ORIGINS = ["http://localhost:3000"]
    return settings


@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    client = MagicMock()

    # Mock table().select().execute() chain
    mock_response = MagicMock()
    mock_response.data = []
    mock_response.count = 0

    table = MagicMock()
    table.select.return_value = table
    table.insert.return_value = table
    table.update.return_value = table
    table.eq.return_value = table
    table.or_.return_value = table
    table.gte.return_value = table
    table.limit.return_value = table
    table.order.return_value = table
    table.execute.return_value = mock_response

    client.table.return_value = table
    return client


@pytest.fixture
def mock_llm_response():
    """Create a mock LLM chain response for SOAP note generation."""
    return {
        "detected_language": "English",
        "subjective": "Patient reports persistent headache for 3 days.",
        "objective": "BP 120/80, Temp 98.6F. No focal neurological deficits.",
        "assessment": "Tension-type headache, likely stress-related.",
        "plan": "Prescribe ibuprofen 400mg TID for 5 days. Rest advised. Follow-up in 1 week if symptoms persist.",
    }


@pytest.fixture
def sample_transcript():
    """Sample consultation transcript for testing."""
    return """
Doctor: Good morning, what brings you in today?
Patient: I've been having a headache for the last 3 days.
Doctor: Can you describe the pain? Is it on one side or both?
Patient: It's on both sides, like a pressure feeling.
Doctor: Any nausea, vomiting, or sensitivity to light?
Patient: No, just the headache.
Doctor: Let me check your vitals. Blood pressure is 120/80, temperature is normal.
Doctor: This looks like a tension headache. I'll prescribe ibuprofen 400mg three times a day for 5 days.
Doctor: Try to rest and come back if it doesn't improve in a week.
""".strip()


@pytest.fixture
def sample_soap():
    """Sample SOAP note for testing."""
    from app.models.schemas import SOAPNote
    return SOAPNote(
        subjective="Patient reports persistent headache for 3 days, bilateral, pressure-like quality. Denies nausea, vomiting, photophobia.",
        objective="BP 120/80, Temp 98.6F. No focal neurological deficits.",
        assessment="Tension-type headache, likely stress-related.",
        plan="Prescribe ibuprofen 400mg TID for 5 days. Rest advised. Follow-up in 1 week if symptoms persist.",
    )
