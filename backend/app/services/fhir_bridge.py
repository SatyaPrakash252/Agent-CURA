"""
Project Cura - FHIR R4 Resource Builder.

Creates FHIR R4-compliant resources for clinical data interoperability:
ServiceRequest, MedicationRequest, Condition, Encounter, and Bundle.
"""

import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.models.schemas import SOAPNote

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    """Return the current UTC time in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


def create_service_request(patient_id: str, test_name: str) -> dict:
    """
    Create a FHIR R4 ServiceRequest resource (e.g., lab order).

    Args:
        patient_id: The patient identifier.
        test_name: Name of the test or service being requested.

    Returns:
        A FHIR ServiceRequest resource dict.
    """
    return {
        "resourceType": "ServiceRequest",
        "id": str(uuid4()),
        "status": "active",
        "intent": "order",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "108252007",
                        "display": "Laboratory procedure",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "display": test_name,
                }
            ],
            "text": test_name,
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "authoredOn": _now_iso(),
        "requester": {"reference": "Practitioner/auto-generated"},
    }


def create_medication_request(
    patient_id: str, medication_name: str, dosage: str
) -> dict:
    """
    Create a FHIR R4 MedicationRequest resource.

    Args:
        patient_id: The patient identifier.
        medication_name: Name of the medication.
        dosage: Dosage instructions as free text.

    Returns:
        A FHIR MedicationRequest resource dict.
    """
    return {
        "resourceType": "MedicationRequest",
        "id": str(uuid4()),
        "status": "active",
        "intent": "order",
        "medicationCodeableConcept": {
            "coding": [
                {
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "display": medication_name,
                }
            ],
            "text": medication_name,
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "authoredOn": _now_iso(),
        "dosageInstruction": [
            {
                "text": dosage,
                "timing": {
                    "repeat": {
                        "frequency": 1,
                        "period": 1,
                        "periodUnit": "d",
                    }
                },
            }
        ],
        "requester": {"reference": "Practitioner/auto-generated"},
    }


def create_condition(patient_id: str, condition_name: str, icd_code: str) -> dict:
    """
    Create a FHIR R4 Condition resource.

    Args:
        patient_id: The patient identifier.
        condition_name: Display name of the condition.
        icd_code: ICD-10-CM code for the condition.

    Returns:
        A FHIR Condition resource dict.
    """
    return {
        "resourceType": "Condition",
        "id": str(uuid4()),
        "clinicalStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active",
                    "display": "Active",
                }
            ]
        },
        "verificationStatus": {
            "coding": [
                {
                    "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                    "code": "confirmed",
                    "display": "Confirmed",
                }
            ]
        },
        "code": {
            "coding": [
                {
                    "system": "http://hl7.org/fhir/sid/icd-10-cm",
                    "code": icd_code,
                    "display": condition_name,
                }
            ],
            "text": condition_name,
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "recordedDate": _now_iso(),
    }


def create_encounter(
    patient_id: str, session_id: str, soap_note: SOAPNote
) -> dict:
    """
    Create a FHIR R4 Encounter resource with embedded SOAP note.

    Args:
        patient_id: The patient identifier.
        session_id: The consultation session identifier.
        soap_note: The SOAPNote to embed in the encounter.

    Returns:
        A FHIR Encounter resource dict.
    """
    now = _now_iso()
    return {
        "resourceType": "Encounter",
        "id": str(uuid4()),
        "identifier": [
            {
                "system": "urn:project-cura:session",
                "value": session_id,
            }
        ],
        "status": "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "AMB",
            "display": "ambulatory",
        },
        "type": [
            {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "308335008",
                        "display": "Patient encounter procedure",
                    }
                ]
            }
        ],
        "subject": {"reference": f"Patient/{patient_id}"},
        "period": {
            "start": now,
            "end": now,
        },
        "reasonCode": [
            {
                "text": soap_note.subjective[:200] if soap_note.subjective else "Consultation",
            }
        ],
        "extension": [
            {
                "url": "urn:project-cura:soap-subjective",
                "valueString": soap_note.subjective,
            },
            {
                "url": "urn:project-cura:soap-objective",
                "valueString": soap_note.objective,
            },
            {
                "url": "urn:project-cura:soap-assessment",
                "valueString": soap_note.assessment,
            },
            {
                "url": "urn:project-cura:soap-plan",
                "valueString": soap_note.plan,
            },
        ],
    }


def create_bundle(
    patient_id: str, session_id: str, resources: list[dict]
) -> dict:
    """
    Create a FHIR R4 Bundle wrapping multiple resources.

    Args:
        patient_id: The patient identifier.
        session_id: The consultation session identifier.
        resources: List of FHIR resource dicts to include.

    Returns:
        A FHIR Bundle resource dict.
    """
    entries = []
    for resource in resources:
        resource_type = resource.get("resourceType", "Unknown")
        resource_id = resource.get("id", str(uuid4()))
        entries.append(
            {
                "fullUrl": f"urn:uuid:{resource_id}",
                "resource": resource,
                "request": {
                    "method": "POST",
                    "url": resource_type,
                },
            }
        )

    bundle = {
        "resourceType": "Bundle",
        "id": str(uuid4()),
        "type": "transaction",
        "timestamp": _now_iso(),
        "identifier": {
            "system": "urn:project-cura:bundle",
            "value": f"{patient_id}-{session_id}",
        },
        "entry": entries,
    }

    logger.info(
        "Created FHIR Bundle with %d entries for session %s",
        len(entries),
        session_id,
    )
    return bundle
