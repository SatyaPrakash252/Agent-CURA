"""
Project Cura - API Route Tests.

Tests REST API endpoints using FastAPI TestClient.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create a test client with mocked dependencies."""
    # Mock the settings and services before importing the app
    with patch("app.config.get_settings") as mock_settings, \
         patch("app.services.transcriber.load_model"), \
         patch("app.services.transcriber.is_model_loaded", return_value=True), \
         patch("app.middleware.auth.bootstrap_admin_user", new_callable=AsyncMock):

        settings = MagicMock()
        settings.GROQ_API_KEY = "test-key"
        settings.SUPABASE_URL = "https://test.supabase.co"
        settings.SUPABASE_KEY = "test-key"
        settings.WHISPER_MODEL_SIZE = "tiny"
        settings.WHISPER_DEVICE = "cpu"
        settings.WHISPER_COMPUTE_TYPE = "int8"
        settings.MODEL_DOWNLOAD_ROOT = "./test_models"
        settings.JWT_SECRET_KEY = "test-jwt-secret"
        settings.JWT_ALGORITHM = "HS256"
        settings.JWT_EXPIRY_MINUTES = 60
        settings.ADMIN_USERNAME = "admin"
        settings.ADMIN_PASSWORD = "admin123"
        settings.RATE_LIMIT_REQUESTS = 1000
        settings.RATE_LIMIT_WINDOW_SECONDS = 60
        settings.CORS_ORIGINS = ["http://localhost:3000"]
        mock_settings.return_value = settings

        from app.main import app
        yield TestClient(app)


class TestRootEndpoint:
    def test_root(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["version"] == "2.0.0"
        assert "api_prefix" in data


class TestHealthEndpoint:
    def test_health_v1(self, client):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "whisper_loaded" in data
        assert "groq_configured" in data
        assert "supabase_connected" in data

    def test_health_legacy(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200


class TestAuthEndpoints:
    @patch("app.api.routes_auth.get_user_by_username", new_callable=AsyncMock)
    @patch("app.api.routes_auth.update_user_last_login", new_callable=AsyncMock)
    @patch("app.api.routes_auth.log_audit", new_callable=AsyncMock)
    def test_login_success(self, mock_audit, mock_update, mock_get_user, client):
        from app.middleware.auth import hash_password
        mock_get_user.return_value = {
            "username": "admin",
            "password_hash": hash_password("admin123"),
            "full_name": "Administrator",
            "role": "admin",
            "is_active": True,
        }

        response = client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "admin123",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["username"] == "admin"

    @patch("app.api.routes_auth.get_user_by_username", new_callable=AsyncMock)
    def test_login_invalid_password(self, mock_get_user, client):
        from app.middleware.auth import hash_password
        mock_get_user.return_value = {
            "username": "admin",
            "password_hash": hash_password("correct-password"),
            "full_name": "Admin",
            "role": "admin",
            "is_active": True,
        }

        response = client.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "wrong-password",
        })
        assert response.status_code == 401

    @patch("app.api.routes_auth.get_user_by_username", new_callable=AsyncMock)
    def test_login_user_not_found(self, mock_get_user, client):
        mock_get_user.return_value = None

        response = client.post("/api/v1/auth/login", json={
            "username": "nonexistent",
            "password": "pass",
        })
        assert response.status_code == 401


class TestConsultationEndpoints:
    def _get_auth_token(self, client) -> str:
        """Helper to get a valid JWT token for protected routes."""
        from app.middleware.auth import create_access_token
        return create_access_token({"sub": "test-user", "role": "doctor"})

    @patch("app.api.routes_consultation.get_recent_consultations", new_callable=AsyncMock)
    def test_list_consultations(self, mock_recent, client):
        mock_recent.return_value = []
        token = self._get_auth_token(client)
        response = client.get(
            "/api/v1/consultation/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    @patch("app.api.routes_consultation.get_dashboard_stats", new_callable=AsyncMock)
    def test_dashboard_stats(self, mock_stats, client):
        mock_stats.return_value = {
            "patient_count": 10,
            "today_sessions": 3,
            "avg_confidence": 91.5,
        }
        token = self._get_auth_token(client)
        response = client.get(
            "/api/v1/consultation/stats/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["patient_count"] == 10
