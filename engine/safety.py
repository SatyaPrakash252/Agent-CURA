import re

class CuraSafety:
    def __init__(self):
        # Regex for Phone numbers, Emails, and typical Indian ID patterns
        self.patterns = {
            "phone": r'\b\d{10}\b',
            "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            "aadhaar": r'\b\d{4}\s\d{4}\s\d{4}\b'
        }

    def redact_pii(self, text):
        """Masks sensitive data locally."""
        redacted = text
        for label, pattern in self.patterns.items():
            redacted = re.sub(pattern, f"[{label.upper()}_REDACTED]", redacted)
        return redacted

    def verify_clinical_safety(self, plan_text):
        """Checks for high-risk medical hallucinations."""
        # Example: Flagging if AI suggests something extreme without a human sign-off
        high_risk_terms = ["immediate surgery", "experimental drug", "terminal"]
        for term in high_risk_terms:
            if term in plan_text.lower():
                return False, f"High-risk term '{term}' detected. Requires senior MD review."
        return True, "Safe"