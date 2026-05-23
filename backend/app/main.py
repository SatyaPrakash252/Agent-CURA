"""
Project Cura - FastAPI Application Entry Point.

Creates the FastAPI app with CORS middleware, router registration,
lifespan management for Whisper model pre-loading, and health check.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_consultation import router as consultation_router
from app.api.routes_patients import router as patients_router
from app.api.ws_audio import router as ws_router
from app.config import get_settings
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

    Pre-loads the Whisper model at startup so the first request
    does not incur model loading latency.
    """
    logger.info("Project Cura API starting up...")

    # Pre-load Whisper model
    try:
        logger.info("Pre-loading Whisper model...")
        load_model()
        logger.info("Whisper model pre-loaded successfully.")
    except Exception as e:
        logger.error("Failed to pre-load Whisper model: %s", e)
        logger.warning("Whisper model will be loaded on first transcription request.")

    yield

    logger.info("Project Cura API shutting down...")


# Create FastAPI application
app = FastAPI(
    title="Project Cura API",
    description=(
        "Healthcare AI Documentation Platform - "
        "Real-time medical consultation transcription, "
        "SOAP note generation, clinical auditing, and billing code extraction."
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

# Include API routers
app.include_router(consultation_router)
app.include_router(patients_router)
app.include_router(ws_router)


@app.get("/", tags=["Root"])
async def root() -> dict:
    """Root endpoint returning a welcome message."""
    return {
        "message": "Welcome to Project Cura API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
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

    return HealthResponse(
        status="healthy",
        whisper_loaded=is_model_loaded(),
        groq_configured=groq_configured,
        supabase_connected=supabase_connected,
        version="2.0.0",
    )
