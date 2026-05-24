"""
Project Cura - Pydantic Schema Tests.

Tests model validation, serialization, and edge cases for all schemas.
"""

import pytest
from app.models.schemas import (
    SOAPNote,
    BillingCode,
    ClinicalIntent,
    SafetyFlag,
    SpeakerSegment,
    TranscriptChunk,
    ConsultationResult,
    PatientCreate,
    HealthResponse,
    ConsultationStartRequest,
    ConsultationFinalizeRequest,
)


class TestSOAPNote:
    def test_default_values(self):
        soap = SOAPNote()
        assert soap.subjective == ""
        assert soap.objective == ""
        assert soap.assessment == ""
        assert soap.plan == ""

    def test_with_values(self):
        soap = SOAPNote(
            subjective="Headache for 3 days",
            objective="BP 120/80",
            assessment="Tension headache",
            plan="Ibuprofen 400mg TID",
        )
        assert soap.subjective == "Headache for 3 days"
        assert soap.plan == "Ibuprofen 400mg TID"

    def test_serialization(self):
        soap = SOAPNote(subjective="Test")
        data = soap.model_dump()
        assert isinstance(data, dict)
        assert data["subjective"] == "Test"


class TestBillingCode:
    def test_required_fields(self):
        bc = BillingCode(code="J06.9", description="Acute URI")
        assert bc.code == "J06.9"
        assert bc.code_type == "ICD-10-CM"  # default

    def test_custom_code_type(self):
        bc = BillingCode(code="99213", description="Office visit", code_type="CPT")
        assert bc.code_type == "CPT"


class TestClinicalIntent:
    def test_defaults(self):
        intent = ClinicalIntent(type="LAB", item="CBC")
        assert intent.urgency == "routine"

    def test_urgent(self):
        intent = ClinicalIntent(type="LAB", item="Troponin", urgency="stat")
        assert intent.urgency == "stat"


class TestSafetyFlag:
    def test_default_no_review(self):
        flag = SafetyFlag(level="INFO", message="Minor note")
        assert flag.requires_review is False

    def test_critical_with_review(self):
        flag = SafetyFlag(level="CRITICAL", message="High-risk", requires_review=True)
        assert flag.requires_review is True


class TestConsultationResult:
    def test_minimal(self):
        result = ConsultationResult(
            session_id="test-1",
            patient_id="PAT-1",
            soap=SOAPNote(),
        )
        assert result.billing_codes == []
        assert result.confidence_score == 0.0
        assert result.fhir_bundle is None

    def test_full(self):
        result = ConsultationResult(
            session_id="s1",
            patient_id="p1",
            soap=SOAPNote(subjective="Test"),
            billing_codes=[BillingCode(code="J06.9", description="URI")],
            intents=[ClinicalIntent(type="LAB", item="CBC")],
            safety_flags=[SafetyFlag(level="WARNING", message="Check")],
            confidence_score=92.5,
        )
        assert len(result.billing_codes) == 1
        assert result.confidence_score == 92.5


class TestPatientCreate:
    def test_minimal(self):
        patient = PatientCreate(patient_id="PAT-1")
        assert patient.name == ""
        assert patient.age is None

    def test_full(self):
        patient = PatientCreate(
            patient_id="PAT-1",
            name="Satya",
            age=25,
            gender="M",
            contact="9876543210",
        )
        assert patient.name == "Satya"
        assert patient.age == 25


class TestHealthResponse:
    def test_defaults(self):
        health = HealthResponse()
        assert health.status == "healthy"
        assert health.whisper_loaded is False
        assert health.version == "2.0.0"
