"""
Project Cura - Multi-Agent Orchestrator.

Coordinates the Scribe, Auditor, and Billing agents in sequence,
with error recovery and timing instrumentation.
"""

import logging
import time
from datetime import datetime, timezone
from uuid import uuid4

from app.agents.auditor import AuditorAgent
from app.agents.billing import BillingAgent
from app.agents.scribe import ScribeAgent
from app.agents.diarizer_refiner import DiarizerRefinerAgent
from app.config import get_settings
from app.models.database import save_consultation
from app.models.schemas import (
    BillingCode,
    ClinicalIntent,
    ConsultationResult,
    SafetyFlag,
    SOAPNote,
    SpeakerSegment,
)
from app.services.fhir_bridge import (
    create_bundle,
    create_condition,
    create_encounter,
    create_medication_request,
    create_service_request,
)
from app.services.safety import CuraSafety

logger = logging.getLogger(__name__)


class Orchestrator:
    """
    Multi-agent coordinator that runs Scribe -> Auditor -> Billing
    in sequence with error recovery and timing instrumentation.
    """

    def __init__(self) -> None:
        """Initialize the orchestrator with all three agents and the safety service."""
        self._scribe = ScribeAgent()
        self._auditor = AuditorAgent()
        self._billing = BillingAgent()
        self._refiner = DiarizerRefinerAgent()
        self._safety = CuraSafety()

    async def process_consultation(
        self,
        transcript: str,
        patient_id: str,
        session_id: str,
        speaker_segments: list[SpeakerSegment] | None = None,
    ) -> ConsultationResult:
        """
        Process a complete consultation through the multi-agent pipeline.

        Pipeline: Scribe (SOAP) -> Auditor (validation) -> Billing (codes).
        Each agent failure is handled gracefully with partial results.

        Args:
            transcript: Raw consultation transcript text.
            patient_id: Patient identifier.
            session_id: Session identifier (auto-generated if empty).
            speaker_segments: Optional pre-computed speaker segments.

        Returns:
            Complete ConsultationResult with all available data.
        """
        if not session_id:
            session_id = str(uuid4())

        total_start = time.monotonic()
        soap = SOAPNote()
        billing_codes: list[BillingCode] = []
        intents: list[ClinicalIntent] = []
        safety_flags: list[SafetyFlag] = []
        confidence_score: float = 0.0
        fhir_bundle: dict | None = None

        # --- Stage 0: Speaker Diarization Refinement ---
        settings = get_settings()
        has_deepgram = bool(settings.DEEPGRAM_API_KEY and len(settings.DEEPGRAM_API_KEY.strip()) > 0)

        if speaker_segments:
            if has_deepgram:
                logger.info("[%s] Stage 0: Skipping Speaker Diarization Refinement (Deepgram native diarization active)", session_id)
            else:
                try:
                    logger.info("[%s] Stage 0: Running Speaker Diarization Refinement...", session_id)
                    speaker_segments = await self._refiner.refine_segments(speaker_segments)
                    # Re-generate the transcript with the corrected speaker labels
                    transcript = "\n".join([f"{seg.speaker}: {seg.text}" for seg in speaker_segments])
                except Exception as e:
                    logger.error("[%s] Speaker Diarization Refinement failed: %s", session_id, e)

        # --- Stage 1: Scribe Agent (SOAP Note Generation) ---
        logger.info("[%s] Stage 1: Running Scribe agent...", session_id)
        stage_start = time.monotonic()
        try:
            scribe_result = await self._scribe.generate_soap(transcript)
            soap = scribe_result.get("soap", SOAPNote())
            detected_language = scribe_result.get("detected_language", "unknown")
            elapsed = time.monotonic() - stage_start
            logger.info(
                "[%s] Scribe completed in %.2fs (language: %s)",
                session_id,
                elapsed,
                detected_language,
            )
        except Exception as e:
            elapsed = time.monotonic() - stage_start
            logger.error("[%s] Scribe failed after %.2fs: %s", session_id, elapsed, e)
            safety_flags.append(
                SafetyFlag(
                    level="CRITICAL",
                    message=f"SOAP note generation failed: {e}",
                    requires_review=True,
                )
            )

        # --- Stage 2: Auditor Agent (Clinical Validation) ---
        logger.info("[%s] Stage 2: Running Auditor agent...", session_id)
        stage_start = time.monotonic()
        try:
            auditor_result = await self._auditor.audit_soap(soap, transcript)

            # Collect safety flags from auditor
            audit_flags = auditor_result.get("safety_flags", [])
            safety_flags.extend(audit_flags)
            confidence_score = auditor_result.get("confidence_score", 50.0)

            # Apply corrections if any
            corrections = auditor_result.get("corrections", {})
            if corrections:
                if corrections.get("subjective"):
                    soap.subjective = corrections["subjective"]
                if corrections.get("objective"):
                    soap.objective = corrections["objective"]
                if corrections.get("assessment"):
                    soap.assessment = corrections["assessment"]
                if corrections.get("plan"):
                    soap.plan = corrections["plan"]
                logger.info("[%s] Auditor applied corrections to SOAP note", session_id)

            elapsed = time.monotonic() - stage_start
            logger.info(
                "[%s] Auditor completed in %.2fs (confidence: %.1f, flags: %d)",
                session_id,
                elapsed,
                confidence_score,
                len(audit_flags),
            )
        except Exception as e:
            elapsed = time.monotonic() - stage_start
            logger.error("[%s] Auditor failed after %.2fs: %s", session_id, elapsed, e)
            safety_flags.append(
                SafetyFlag(
                    level="WARNING",
                    message=f"Clinical audit could not be completed: {e}",
                    requires_review=True,
                )
            )

        # --- Stage 3: Billing Agent (Code Extraction) ---
        logger.info("[%s] Stage 3: Running Billing agent...", session_id)
        stage_start = time.monotonic()
        try:
            billing_result = await self._billing.extract_billing(soap)
            billing_codes = billing_result.get("billing_codes", [])
            intents = billing_result.get("intents", [])
            elapsed = time.monotonic() - stage_start
            logger.info(
                "[%s] Billing completed in %.2fs (codes: %d, intents: %d)",
                session_id,
                elapsed,
                len(billing_codes),
                len(intents),
            )
        except Exception as e:
            elapsed = time.monotonic() - stage_start
            logger.error("[%s] Billing failed after %.2fs: %s", session_id, elapsed, e)
            safety_flags.append(
                SafetyFlag(
                    level="INFO",
                    message=f"Billing code extraction could not be completed: {e}",
                    requires_review=False,
                )
            )

        # --- Post-processing: PII Redaction ---
        redacted_transcript = self._safety.redact_pii(transcript)

        # --- Post-processing: Clinical Safety Check ---
        if soap.plan:
            requires_review, safety_message = self._safety.verify_clinical_safety(
                soap.plan
            )
            if requires_review:
                safety_flags.append(
                    SafetyFlag(
                        level="CRITICAL",
                        message=safety_message,
                        requires_review=True,
                    )
                )

        # --- Post-processing: FHIR Bundle ---
        try:
            fhir_resources: list[dict] = []

            # Create Encounter resource
            encounter = create_encounter(patient_id, session_id, soap)
            fhir_resources.append(encounter)

            # Create Condition resources for each billing code
            for bc in billing_codes:
                condition = create_condition(patient_id, bc.description, bc.code)
                fhir_resources.append(condition)

            # Create resources based on intents
            for intent in intents:
                if intent.type == "LAB":
                    sr = create_service_request(patient_id, intent.item)
                    fhir_resources.append(sr)
                elif intent.type == "MEDICINE":
                    mr = create_medication_request(
                        patient_id, intent.item, intent.item
                    )
                    fhir_resources.append(mr)

            fhir_bundle = create_bundle(patient_id, session_id, fhir_resources)
        except Exception as e:
            logger.error("[%s] FHIR bundle creation failed: %s", session_id, e)
            fhir_bundle = None

        # --- Build final result ---
        result = ConsultationResult(
            session_id=session_id,
            patient_id=patient_id,
            soap=soap,
            billing_codes=billing_codes,
            intents=intents,
            safety_flags=safety_flags,
            speaker_segments=speaker_segments or [],
            raw_transcript=transcript,
            redacted_transcript=redacted_transcript,
            fhir_bundle=fhir_bundle,
            confidence_score=confidence_score,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

        # --- Save to database ---
        try:
            await save_consultation(session_id, patient_id, result)
        except Exception as e:
            logger.error("[%s] Failed to save consultation to DB: %s", session_id, e)

        total_elapsed = time.monotonic() - total_start
        logger.info(
            "[%s] Pipeline completed in %.2fs (confidence: %.1f, codes: %d, flags: %d)",
            session_id,
            total_elapsed,
            confidence_score,
            len(billing_codes),
            len(safety_flags),
        )

        return result
