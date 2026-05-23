"""
Project Cura - Agent B: The Clinical Auditor.

Audits SOAP notes for clinical accuracy, safety, and completeness.
Uses Groq's Llama 3.1 8B model for cost-effective validation.
"""

import asyncio
import json
import logging

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.config import get_settings
from app.models.schemas import SafetyFlag, SOAPNote

logger = logging.getLogger(__name__)

AUDITOR_SYSTEM_PROMPT = """You are a clinical documentation auditor AI. Your task is to review a SOAP note against the original transcript for accuracy, completeness, and safety.

Perform these checks:
1. COMPLETENESS: Does the Plan address ALL symptoms mentioned in the Subjective section?
2. CONSISTENCY: Are the Assessment and Plan consistent with the Objective findings?
3. HALLUCINATION CHECK: Are there any medications, diagnoses, or procedures in the SOAP note that were NOT mentioned or implied in the transcript?
4. SAFETY: Are there any potentially dangerous omissions (e.g., allergies mentioned but not documented, critical symptoms without follow-up)?
5. OBJECTIVE FINDINGS: Does the Objective section contain actual clinical findings, or is it empty/vague?

For each issue found, create a safety flag with:
- level: "INFO" (minor suggestion), "WARNING" (should be reviewed), or "CRITICAL" (must be reviewed before finalizing)
- message: Clear description of the issue
- requires_review: true if a physician must review, false otherwise

Also provide:
- confidence_score: 0-100 indicating overall documentation quality
- corrections: Any suggested corrections to the SOAP note (provide corrected text for each section that needs changes, or null if no changes needed)

Return your response as a JSON object:
{{
    "safety_flags": [
        {{"level": "WARNING", "message": "...", "requires_review": true}},
        ...
    ],
    "confidence_score": 85,
    "corrections": {{
        "subjective": null,
        "objective": null,
        "assessment": null,
        "plan": "corrected plan text or null"
    }}
}}

Return ONLY the JSON object, no other text."""

AUDITOR_USER_PROMPT = """Review the following SOAP note against the original transcript:

---SOAP NOTE---
Subjective: {subjective}

Objective: {objective}

Assessment: {assessment}

Plan: {plan}
---END SOAP NOTE---

---ORIGINAL TRANSCRIPT---
{transcript}
---END TRANSCRIPT---

Return the JSON audit result:"""


class AuditorAgent:
    """
    Agent B - The Clinical Auditor.

    Reviews SOAP notes for clinical accuracy, completeness, and safety
    by cross-referencing against the original transcript.
    """

    def __init__(self) -> None:
        """Initialize the Auditor agent with Groq LLM (8B model for cost efficiency)."""
        settings = get_settings()
        self._llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name="llama-3.1-8b-instant",
            temperature=0.0,
            max_tokens=1536,
        )
        self._prompt = ChatPromptTemplate.from_messages(
            [
                ("system", AUDITOR_SYSTEM_PROMPT),
                ("human", AUDITOR_USER_PROMPT),
            ]
        )
        self._parser = JsonOutputParser()
        self._chain = self._prompt | self._llm | self._parser
        self._max_retries = 3

    async def audit_soap(self, soap: SOAPNote, transcript: str) -> dict:
        """
        Audit a SOAP note against the original transcript.

        Args:
            soap: The SOAPNote to audit.
            transcript: The original consultation transcript.

        Returns:
            Dict with keys:
                - safety_flags: list[SafetyFlag]
                - confidence_score: float (0-100)
                - corrections: dict with optional corrected SOAP sections
        """
        if not transcript or not transcript.strip():
            logger.warning("Empty transcript provided to Auditor agent")
            return {
                "safety_flags": [
                    SafetyFlag(
                        level="WARNING",
                        message="No transcript available for audit comparison.",
                        requires_review=True,
                    )
                ],
                "confidence_score": 0.0,
                "corrections": {},
            }

        last_error: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                result = await self._chain.ainvoke(
                    {
                        "subjective": soap.subjective,
                        "objective": soap.objective,
                        "assessment": soap.assessment,
                        "plan": soap.plan,
                        "transcript": transcript,
                    }
                )

                # Parse safety flags
                raw_flags = result.get("safety_flags", [])
                safety_flags: list[SafetyFlag] = []
                for flag_data in raw_flags:
                    if isinstance(flag_data, dict):
                        safety_flags.append(
                            SafetyFlag(
                                level=flag_data.get("level", "INFO"),
                                message=flag_data.get("message", ""),
                                requires_review=flag_data.get("requires_review", False),
                            )
                        )

                confidence_score = float(result.get("confidence_score", 50.0))
                confidence_score = max(0.0, min(100.0, confidence_score))

                corrections = result.get("corrections", {})
                if not isinstance(corrections, dict):
                    corrections = {}

                logger.info(
                    "Auditor completed: confidence=%.1f, flags=%d (attempt %d)",
                    confidence_score,
                    len(safety_flags),
                    attempt + 1,
                )
                return {
                    "safety_flags": safety_flags,
                    "confidence_score": confidence_score,
                    "corrections": corrections,
                }

            except Exception as e:
                last_error = e
                error_str = str(e).lower()

                if "rate_limit" in error_str or "429" in error_str or "rate limit" in error_str:
                    wait_time = (2 ** attempt) * 2
                    logger.warning(
                        "Groq rate limit hit in Auditor (attempt %d/%d), waiting %ds...",
                        attempt + 1,
                        self._max_retries,
                        wait_time,
                    )
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(
                        "Auditor agent error (attempt %d/%d): %s",
                        attempt + 1,
                        self._max_retries,
                        e,
                    )
                    if attempt < self._max_retries - 1:
                        await asyncio.sleep(1)

        logger.error("Auditor agent failed after %d attempts: %s", self._max_retries, last_error)
        return {
            "safety_flags": [
                SafetyFlag(
                    level="WARNING",
                    message=f"Audit could not be completed: {last_error}",
                    requires_review=True,
                )
            ],
            "confidence_score": 0.0,
            "corrections": {},
        }
