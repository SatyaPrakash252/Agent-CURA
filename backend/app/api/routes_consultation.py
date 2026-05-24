"""
Project Cura - Consultation REST API Routes.

Provides endpoints for starting, finalizing, and querying consultations.
"""

import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.agents.orchestrator import Orchestrator
from app.models.database import (
    get_consultation,
    get_dashboard_stats,
    get_recent_consultations,
    get_patient,
    create_patient,
)
from app.models.schemas import (
    ConsultationFinalizeRequest,
    ConsultationResult,
    ConsultationStartRequest,
    PatientCreate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/consultation", tags=["Consultation"])


@router.post("/start")
async def start_consultation(request: ConsultationStartRequest) -> dict:
    """
    Initialize a new consultation session.

    If session_id is not provided, one will be auto-generated.

    Args:
        request: ConsultationStartRequest with patient_id and optional session_id.

    Returns:
        Dict with session_id, patient_id, and status.
    """
    session_id = request.session_id if request.session_id else str(uuid4())
    logger.info(
        "Starting consultation session %s for patient %s",
        session_id,
        request.patient_id,
    )
    return {
        "session_id": session_id,
        "patient_id": request.patient_id,
        "status": "started",
    }


@router.post("/finalize", response_model=ConsultationResult)
async def finalize_consultation(
    request: ConsultationFinalizeRequest,
) -> ConsultationResult:
    """
    Finalize a consultation by processing the transcript through the AI pipeline.

    Runs the full Scribe -> Auditor -> Billing pipeline and returns
    the complete ConsultationResult.

    Args:
        request: ConsultationFinalizeRequest with transcript and metadata.

    Returns:
        Complete ConsultationResult.

    Raises:
        HTTPException: 400 if transcript is empty, 500 on processing failure.
    """
    if not request.transcript or not request.transcript.strip():
        raise HTTPException(
            status_code=400,
            detail="Transcript cannot be empty.",
        )

    session_id = request.session_id if request.session_id else str(uuid4())
    logger.info(
        "Finalizing consultation %s for patient %s (transcript length: %d)",
        session_id,
        request.patient_id,
        len(request.transcript),
    )

    try:
        # Create or update patient details if provided
        p_record = await get_patient(request.patient_id)
        if p_record is None or request.patient_name:
            patient_data = PatientCreate(
                patient_id=request.patient_id,
                name=request.patient_name or (p_record.get("name") if p_record else f"Patient {request.patient_id}"),
                age=request.patient_age if request.patient_age is not None else (p_record.get("age") if p_record else 35),
                gender=request.patient_gender or (p_record.get("gender") if p_record else "Unknown"),
                contact=request.patient_contact or (p_record.get("contact") if p_record else "N/A"),
                notes=request.patient_notes or (p_record.get("notes") if p_record else "Auto-registered/updated during finalize."),
            )
            await create_patient(patient_data)
            logger.info("Auto-created/updated patient record for %s inside finalize", request.patient_id)

        orchestrator = Orchestrator()
        result = await orchestrator.process_consultation(
            transcript=request.transcript,
            patient_id=request.patient_id,
            session_id=session_id,
            speaker_segments=request.speaker_segments,
        )
        return result
    except Exception as e:
        logger.error("Consultation finalization failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process consultation: {str(e)}",
        )


@router.get("/{session_id}")
async def get_consultation_result(session_id: str) -> dict:
    """
    Retrieve a consultation result by session_id.

    Args:
        session_id: The session identifier.

    Returns:
        The consultation record.

    Raises:
        HTTPException: 404 if not found.
    """
    result = await get_consultation(session_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Consultation {session_id} not found.",
        )
    return result


@router.get("/{session_id}/fhir")
async def get_consultation_fhir(session_id: str) -> dict:
    """
    Retrieve the FHIR bundle for a consultation.

    Args:
        session_id: The session identifier.

    Returns:
        The FHIR Bundle dict.

    Raises:
        HTTPException: 404 if consultation or FHIR bundle not found.
    """
    result = await get_consultation(session_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Consultation {session_id} not found.",
        )

    fhir_bundle = result.get("fhir_bundle")
    if fhir_bundle is None:
        raise HTTPException(
            status_code=404,
            detail=f"No FHIR bundle available for consultation {session_id}.",
        )

    return fhir_bundle


@router.get("/")
async def list_recent_consultations() -> list[dict]:
    """Fetch the 20 most recent consultations across all patients."""
    return await get_recent_consultations(limit=20)


@router.get("/stats/dashboard")
async def dashboard_stats() -> dict:
    """Aggregate dashboard statistics (patient count, sessions today, avg confidence)."""
    return await get_dashboard_stats()
