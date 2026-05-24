"""
Project Cura - Safety Service Tests.

Tests PII redaction, clinical safety verification, and drug interaction checking.
"""

import pytest
from app.services.safety import CuraSafety
from app.services.drug_safety import check_interactions, validate_dosage


class TestPIIRedaction:
    """Tests for PII redaction functionality."""

    def setup_method(self):
        self.safety = CuraSafety()

    def test_redact_email(self):
        text = "Contact patient at john.doe@example.com for follow-up."
        result = self.safety.redact_pii(text)
        assert "john.doe@example.com" not in result
        assert "[EMAIL_REDACTED]" in result

    def test_redact_phone_indian(self):
        text = "Patient phone: 9876543210"
        result = self.safety.redact_pii(text)
        assert "9876543210" not in result
        assert "[PHONE_REDACTED]" in result

    def test_redact_aadhaar(self):
        text = "Aadhaar: 1234 5678 9012"
        result = self.safety.redact_pii(text)
        assert "1234 5678 9012" not in result
        assert "[AADHAAR_REDACTED]" in result

    def test_redact_pan(self):
        text = "PAN card: ABCDE1234F"
        result = self.safety.redact_pii(text)
        assert "ABCDE1234F" not in result
        assert "[PAN_REDACTED]" in result

    def test_redact_name_with_title(self):
        text = "Referred by Dr. Sharma for consultation."
        result = self.safety.redact_pii(text)
        assert "[NAME_REDACTED]" in result

    def test_no_false_positive_on_medical_terms(self):
        text = "Patient diagnosed with Type 2 Diabetes Mellitus."
        result = self.safety.redact_pii(text)
        assert "Diabetes Mellitus" in result

    def test_empty_input(self):
        assert self.safety.redact_pii("") == ""
        assert self.safety.redact_pii(None) is None


class TestClinicalSafety:
    """Tests for clinical safety verification."""

    def setup_method(self):
        self.safety = CuraSafety()

    def test_flag_high_risk_terms(self):
        plan = "Consider emergency intubation. Start blood transfusion."
        requires_review, message = self.safety.verify_clinical_safety(plan)
        assert requires_review is True
        assert "intubation" in message
        assert "blood transfusion" in message

    def test_safe_plan(self):
        plan = "Prescribe amoxicillin 500mg TID for 7 days. Follow-up in 1 week."
        requires_review, message = self.safety.verify_clinical_safety(plan)
        assert requires_review is False

    def test_suicide_flag(self):
        plan = "Patient reports suicidal ideation. Refer to psychiatry."
        requires_review, message = self.safety.verify_clinical_safety(plan)
        assert requires_review is True
        assert "suicidal" in message

    def test_empty_plan(self):
        requires_review, _ = self.safety.verify_clinical_safety("")
        assert requires_review is False


class TestDrugInteractions:
    """Tests for drug-drug interaction checking."""

    def test_warfarin_aspirin_interaction(self):
        alerts = check_interactions(["warfarin", "aspirin"])
        assert len(alerts) >= 1
        assert alerts[0]["severity"] == "CRITICAL"

    def test_no_interaction(self):
        alerts = check_interactions(["amoxicillin", "metformin"])
        assert len(alerts) == 0

    def test_brand_name_alias(self):
        alerts = check_interactions(["coumadin", "ecosprin"])
        assert len(alerts) >= 1

    def test_single_drug(self):
        alerts = check_interactions(["ibuprofen"])
        assert len(alerts) == 0

    def test_empty_list(self):
        alerts = check_interactions([])
        assert len(alerts) == 0


class TestDosageValidation:
    """Tests for dosage range validation."""

    def test_normal_dosage(self):
        result = validate_dosage("metformin", "500mg")
        assert result is None  # within range

    def test_excessive_dosage(self):
        result = validate_dosage("paracetamol", "5000mg")
        assert result is not None
        assert result["severity"] == "CRITICAL"

    def test_low_dosage(self):
        result = validate_dosage("metformin", "100mg")
        assert result is not None
        assert result["severity"] == "INFO"

    def test_unknown_drug(self):
        result = validate_dosage("some_rare_drug", "500mg")
        assert result is None
