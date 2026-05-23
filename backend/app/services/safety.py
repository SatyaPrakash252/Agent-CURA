"""
Project Cura - PII Redaction and Clinical Safety Service.

Provides comprehensive regex-based PII masking and
clinical safety verification for medical documents.
"""

import logging
import re

logger = logging.getLogger(__name__)


class CuraSafety:
    """
    Handles PII redaction and clinical safety verification.

    Uses comprehensive regex patterns tuned for Indian healthcare data
    (Aadhaar, PAN, Indian phone numbers) as well as international patterns.
    """

    def __init__(self) -> None:
        """Initialize the safety service with compiled regex patterns."""
        # PII detection patterns — order matters (more specific first)
        self._pii_patterns: list[tuple[str, re.Pattern]] = [
            # Aadhaar number: 4-4-4 digit format
            (
                "AADHAAR_REDACTED",
                re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"),
            ),
            # PAN card: 5 alpha + 4 digit + 1 alpha
            (
                "PAN_REDACTED",
                re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b", re.IGNORECASE),
            ),
            # Email addresses
            (
                "EMAIL_REDACTED",
                re.compile(
                    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
                ),
            ),
            # Indian mobile numbers (10-digit, optionally with +91 or 0 prefix)
            (
                "PHONE_REDACTED",
                re.compile(
                    r"(?:\+91[\s-]?|0)?[6-9]\d{9}\b"
                ),
            ),
            # International phone numbers
            (
                "PHONE_REDACTED",
                re.compile(
                    r"\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b"
                ),
            ),
            # Dates: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD
            (
                "DATE_REDACTED",
                re.compile(
                    r"\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b"
                ),
            ),
            (
                "DATE_REDACTED",
                re.compile(
                    r"\b\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}\b"
                ),
            ),
            # Indian names: Title + Capitalized word(s)
            (
                "NAME_REDACTED",
                re.compile(
                    r"\b(?:Mr|Mrs|Ms|Dr|Shri|Smt|Prof|Master)\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b"
                ),
            ),
        ]

        # High-risk clinical terms that should trigger safety review
        self._high_risk_terms: list[str] = [
            "anaphylaxis",
            "cardiac arrest",
            "stroke",
            "hemorrhage",
            "hemorrhaging",
            "sepsis",
            "septic shock",
            "respiratory failure",
            "intubation",
            "ventilator",
            "code blue",
            "thrombolysis",
            "blood transfusion",
            "overdose",
            "toxic",
            "suicidal",
            "suicide",
            "self-harm",
            "chest pain",
            "myocardial infarction",
            "pulmonary embolism",
            "meningitis",
            "status epilepticus",
            "diabetic ketoacidosis",
            "hypertensive crisis",
            "allergic reaction",
        ]

    def redact_pii(self, text: str) -> str:
        """
        Replace all detected PII in the text with [TYPE_REDACTED] tokens.

        Args:
            text: The raw text to redact.

        Returns:
            The text with all PII replaced by redaction tokens.
        """
        if not text:
            return text

        redacted = text
        for label, pattern in self._pii_patterns:
            redacted = pattern.sub(f"[{label}]", redacted)

        return redacted

    def verify_clinical_safety(self, plan_text: str) -> tuple[bool, str]:
        """
        Check the clinical plan for high-risk terms that require physician review.

        Args:
            plan_text: The plan section of a SOAP note.

        Returns:
            A tuple of (requires_review: bool, message: str).
            If requires_review is True, the message describes which terms were flagged.
        """
        if not plan_text:
            return False, "No plan text provided."

        plan_lower = plan_text.lower()
        found_terms: list[str] = []

        for term in self._high_risk_terms:
            if term in plan_lower:
                found_terms.append(term)

        if found_terms:
            terms_str = ", ".join(found_terms)
            message = (
                f"SAFETY REVIEW REQUIRED: The following high-risk terms were detected "
                f"in the clinical plan: {terms_str}. "
                f"A supervising physician must review this documentation before finalization."
            )
            logger.warning("Clinical safety flag: %s", message)
            return True, message

        return False, "No high-risk terms detected. Plan appears routine."
