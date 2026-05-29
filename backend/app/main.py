"""
Project Cura - FastAPI Application Entry Point.

Creates the FastAPI app with CORS middleware, rate limiting,
router registration, lifespan management for Whisper model
pre-loading and admin user bootstrap, and health check.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_auth import router as auth_router
from app.api.routes_consultation import router as consultation_router
from app.api.routes_database import router as database_router
from app.api.routes_fhir import router as fhir_router
from app.api.routes_patients import router as patients_router
from app.api.ws_audio import router as ws_router
from app.config import get_settings
from app.middleware.auth import bootstrap_admin_user
from app.middleware.rate_limiter import RateLimiterMiddleware
from app.models.schemas import HealthResponse
from app.services.transcriber import is_model_loaded, load_model

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.

    Pre-loads the Whisper model and bootstraps the admin user at startup.
    """
    logger.info("Project Cura API v2.0.0 starting up...")

    # Pre-initialize database connectivity and tables at startup
    from app.models.database import init_db
    try:
        logger.info("Pre-initializing database connectivity and tables...")
        init_db()
        logger.info("Database pre-initialization complete.")
    except Exception as db_err:
        logger.error("Failed to pre-initialize database: %s", db_err)

    # Pre-load Whisper model only if Deepgram is NOT configured (Whisper is the fallback)
    settings = get_settings()
    has_deepgram = bool(settings.DEEPGRAM_API_KEY and len(settings.DEEPGRAM_API_KEY.strip()) > 0)

    if has_deepgram:
        logger.info("Deepgram API key detected — using Deepgram as primary STT engine.")
        logger.info("Whisper model will lazy-load only if Deepgram fails (fallback mode).")
    else:
        try:
            logger.info("No Deepgram API key — pre-loading local Whisper model...")
            load_model()
            logger.info("Whisper model pre-loaded successfully.")
        except Exception as e:
            logger.error("Failed to pre-load Whisper model: %s", e)
            logger.warning("Whisper model will be loaded on first transcription request.")

    # Bootstrap admin user
    try:
        await bootstrap_admin_user()
    except Exception as e:
        logger.error("Failed to bootstrap admin user: %s", e)

    # Synchronize local SQLite records to Supabase at startup
    from app.models.database import sync_sqlite_to_supabase
    try:
        await sync_sqlite_to_supabase()
    except Exception as sync_err:
        logger.error("Failed to run database sync at startup: %s", sync_err)

    yield

    logger.info("Project Cura API shutting down...")


# Create FastAPI application
app = FastAPI(
    title="Project Cura API",
    description=(
        "Healthcare AI Documentation Platform — "
        "Real-time medical consultation transcription, "
        "SOAP note generation, clinical auditing, billing code extraction, "
        "and FHIR bundle management."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiter middleware
app.add_middleware(RateLimiterMiddleware)

# Include API routers (versioned)
app.include_router(auth_router)
app.include_router(consultation_router)
app.include_router(database_router)
app.include_router(patients_router)
app.include_router(fhir_router)
app.include_router(ws_router)


@app.get("/", tags=["Root"])
async def root() -> dict:
    """Root endpoint returning a welcome message."""
    return {
        "message": "Welcome to Project Cura API",
        "version": "2.0.0",
        "api_prefix": "/api/v1",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


@app.get("/api/v1/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """
    API health check endpoint.

    Returns the status of critical subsystems:
    - Whisper model loading status
    - Groq API key configuration
    - Supabase connection configuration
    """
    settings = get_settings()

    groq_configured = bool(settings.GROQ_API_KEY and len(settings.GROQ_API_KEY) > 0)
    supabase_connected = bool(
        settings.SUPABASE_URL
        and settings.SUPABASE_KEY
        and len(settings.SUPABASE_URL) > 0
    )
    deepgram_configured = bool(
        settings.DEEPGRAM_API_KEY
        and len(settings.DEEPGRAM_API_KEY.strip()) > 0
    )

    # Whisper is the fallback — if Deepgram is configured, STT is healthy regardless
    whisper_status = is_model_loaded() or deepgram_configured

    return HealthResponse(
        status="healthy",
        whisper_loaded=whisper_status,
        groq_configured=groq_configured,
        supabase_connected=supabase_connected,
        deepgram_configured=deepgram_configured,
        version="2.0.0",
    )


# Keep backward-compatible health endpoint
@app.get("/api/health", response_model=HealthResponse, tags=["Health"], include_in_schema=False)
async def health_check_legacy() -> HealthResponse:
    """Legacy health check endpoint for backward compatibility."""
    return await health_check()
