"""
Project Cura - Pydantic v2 Data Models.

Defines all request/response schemas used across the application.
"""

from pydantic import BaseModel


class SOAPNote(BaseModel):
    """SOAP (Subjective, Objective, Assessment, Plan) clinical note."""

    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""


class BillingCode(BaseModel):
    """Medical billing code (ICD-10-CM or HCPCS)."""

    code: str
    description: str
    code_type: str = "ICD-10-CM"


class ClinicalIntent(BaseModel):
    """Detected clinical intent from a consultation."""

    type: str  # LAB, MEDICINE, FOLLOWUP, REFERRAL
    item: str
    urgency: str = "routine"


class SafetyFlag(BaseModel):
    """Safety or quality flag raised during audit."""

    level: str  # INFO, WARNING, CRITICAL
    message: str
    requires_review: bool = False


class SpeakerSegment(BaseModel):
    """A segment of speech attributed to a specific speaker."""

    speaker: str  # "Doctor" or "Patient"
    text: str
    start_time: float = 0.0
    end_time: float = 0.0


class TranscriptChunk(BaseModel):
    """A chunk of transcribed text sent over WebSocket."""

    text: str
    speaker: str = "Unknown"
    timestamp: float = 0.0
    is_final: bool = False


class ConsultationResult(BaseModel):
    """Complete result of processing a medical consultation."""

    session_id: str
    patient_id: str
    soap: SOAPNote
    billing_codes: list[BillingCode] = []
    intents: list[ClinicalIntent] = []
    safety_flags: list[SafetyFlag] = []
    speaker_segments: list[SpeakerSegment] = []
    raw_transcript: str = ""
    redacted_transcript: str = ""
    fhir_bundle: dict | None = None
    confidence_score: float = 0.0
    created_at: str = ""


class PatientCreate(BaseModel):
    """Schema for creating a new patient record."""

    patient_id: str
    name: str = ""
    age: int | None = None
    gender: str = ""
    contact: str = ""
    notes: str = ""


class PatientResponse(PatientCreate):
    """Schema for returning patient data including metadata."""

    id: int | None = None
    created_at: str = ""
    consultation_count: int = 0


class ConsultationStartRequest(BaseModel):
    """Request to start a new consultation session."""

    patient_id: str
    session_id: str = ""  # auto-generated if empty


class ConsultationFinalizeRequest(BaseModel):
    """Request to finalize a consultation with transcript data."""

    session_id: str
    patient_id: str
    transcript: str
    speaker_segments: list[SpeakerSegment] = []
    patient_name: str | None = None
    patient_age: int | None = None
    patient_gender: str | None = None
    patient_contact: str | None = None
    patient_notes: str | None = None


class HealthResponse(BaseModel):
    """API health check response."""

    status: str = "healthy"
    whisper_loaded: bool = False
    groq_configured: bool = False
    supabase_connected: bool = False
    deepgram_configured: bool = False
    version: str = "2.0.0"
