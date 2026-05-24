"""
Project Cura - FHIR API Routes.

Provides endpoints for FHIR bundle transmission and status tracking.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_current_user
from app.models.database import (
    get_consultation,
    log_audit,
    save_fhir_transmission,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/fhir", tags=["FHIR"])


@router.post("/transmit/{session_id}")
async def transmit_fhir_bundle(
    session_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Transmit (record) a FHIR bundle for a consultation.

    In a production environment, this would forward the bundle to an
    actual FHIR server (e.g., HAPI FHIR, Azure FHIR). Currently, it
    records the transmission in the database for audit purposes.

    Args:
        session_id: The consultation session identifier.

    Returns:
        Transmission status with bundle summary.
    """
    # Fetch the consultation
    consultation = await get_consultation(session_id)
    if consultation is None:
        raise HTTPException(
            status_code=404,
            detail=f"Consultation {session_id} not found.",
        )

    fhir_bundle = consultation.get("fhir_bundle")
    if fhir_bundle is None:
        raise HTTPException(
            status_code=404,
            detail=f"No FHIR bundle available for consultation {session_id}.",
        )

    patient_id = consultation.get("patient_id", "unknown")

    # Save the transmission record
    result = await save_fhir_transmission(
        session_id=session_id,
        patient_id=patient_id,
        bundle=fhir_bundle,
    )

    # Audit log
    await log_audit(
        username=user.get("username", "unknown"),
        action="fhir_transmit",
        resource_type="fhir_bundle",
        resource_id=session_id,
        details={"patient_id": patient_id, "resource_count": len(fhir_bundle.get("entry", []))},
    )

    resource_count = len(fhir_bundle.get("entry", []))
    logger.info(
        "FHIR bundle transmitted for session %s (%d resources)",
        session_id,
        resource_count,
    )

    return {
        "status": "transmitted",
        "session_id": session_id,
        "patient_id": patient_id,
        "resource_count": resource_count,
        "bundle_type": fhir_bundle.get("type", "transaction"),
        "message": f"FHIR bundle with {resource_count} resources recorded successfully.",
    }
