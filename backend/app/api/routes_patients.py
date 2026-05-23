"""
Project Cura - Patient REST API Routes.

Provides endpoints for creating, listing, and querying patients
and their consultation history.
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from app.models.database import (
    create_patient,
    get_patient,
    get_patient_history,
    list_patients,
)
from app.models.schemas import PatientCreate, PatientResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/patients", tags=["Patients"])


@router.get("/")
async def list_all_patients(
    search: str = Query(default="", description="Search term for patient name or ID"),
    limit: int = Query(default=50, ge=1, le=200, description="Max results to return"),
) -> list[dict]:
    """
    List all patients with optional search filtering.

    Args:
        search: Optional search term to filter by name or patient_id.
        limit: Maximum number of results (1-200).

    Returns:
        List of patient records.
    """
    patients = await list_patients(search=search, limit=limit)
    return patients


@router.get("/{patient_id}")
async def get_single_patient(patient_id: str) -> dict:
    """
    Retrieve a single patient by patient_id.

    Args:
        patient_id: The patient identifier.

    Returns:
        The patient record.

    Raises:
        HTTPException: 404 if patient not found.
    """
    patient = await get_patient(patient_id)
    if patient is None:
        raise HTTPException(
            status_code=404,
            detail=f"Patient {patient_id} not found.",
        )
    return patient


@router.post("/", response_model=dict)
async def create_new_patient(patient: PatientCreate) -> dict:
    """
    Create a new patient record.

    Args:
        patient: PatientCreate schema with patient details.

    Returns:
        The created patient record.

    Raises:
        HTTPException: 400 if patient_id is empty, 500 on creation failure.
    """
    if not patient.patient_id or not patient.patient_id.strip():
        raise HTTPException(
            status_code=400,
            detail="patient_id is required.",
        )

    logger.info("Creating patient: %s", patient.patient_id)
    result = await create_patient(patient)
    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to create patient. The patient_id may already exist.",
        )
    return result


@router.get("/{patient_id}/history")
async def get_patient_consultation_history(patient_id: str) -> list[dict]:
    """
    Retrieve all consultation records for a patient.

    Args:
        patient_id: The patient identifier.

    Returns:
        List of consultation records ordered by created_at descending.
    """
    history = await get_patient_history(patient_id)
    return history
