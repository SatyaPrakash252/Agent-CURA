"""
Project Cura - Agent A: The Scribe.

Generates SOAP notes from raw consultation transcripts using
Groq's Llama 3.3 70B model. Handles language detection and
translation to medical English.
"""

import asyncio
import json
import logging

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.config import get_settings
from app.models.schemas import SOAPNote

logger = logging.getLogger(__name__)

SCRIBE_SYSTEM_PROMPT = """You are a professional medical scribe AI. Your task is to:

1. DETECT the language of the transcript (e.g., English, Hindi, Tamil, Telugu, etc.)
2. If the transcript is NOT in English, TRANSLATE it to medical English while preserving clinical accuracy.
3. Generate a structured SOAP note from the transcript content.

Rules:
- Subjective: Document the patient's reported symptoms, history, and complaints in their own words (translated to English). Include duration, severity, and any relevant context.
- Objective: Document any clinical observations, vital signs, examination findings, or test results mentioned. If none are mentioned, state "No objective findings documented in transcript."
- Assessment: Provide a clinical assessment based on the subjective and objective findings. List differential diagnoses if appropriate.
- Plan: Document the treatment plan, medications prescribed, tests ordered, follow-up instructions, and referrals. Be specific about dosages, frequencies, and timelines when mentioned.

IMPORTANT:
- Do NOT hallucinate or add information not present in the transcript.
- If information is unclear, note it as "unclear from transcript."
- Preserve medical terminology accurately.
- Be concise but thorough.

Return your response as a JSON object with exactly these keys:
{{
    "detected_language": "<language name>",
    "subjective": "<subjective section>",
    "objective": "<objective section>",
    "assessment": "<assessment section>",
    "plan": "<plan section>"
}}

Return ONLY the JSON object, no other text."""

SCRIBE_USER_PROMPT = """Analyze the following medical consultation transcript and generate a SOAP note:

---TRANSCRIPT START---
{transcript}
---TRANSCRIPT END---

Return the JSON response:"""


class ScribeAgent:
    """
    Agent A - The Scribe.

    Processes raw consultation transcripts to produce structured SOAP notes
    with language detection and translation capabilities.
    """

    def __init__(self) -> None:
        """Initialize the Scribe agent with Groq LLM and prompt template."""
        settings = get_settings()
        self._llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name="llama-3.3-70b-versatile",
            temperature=0.1,
            max_tokens=2048,
        )
        self._prompt = ChatPromptTemplate.from_messages(
            [
                ("system", SCRIBE_SYSTEM_PROMPT),
                ("human", SCRIBE_USER_PROMPT),
            ]
        )
        self._parser = JsonOutputParser()
        self._chain = self._prompt | self._llm | self._parser
        self._max_retries = 3

    async def generate_soap(self, transcript: str) -> dict:
        """
        Generate a SOAP note from a raw transcript.

        Includes retry logic with exponential backoff for Groq rate limits.

        Args:
            transcript: Raw consultation transcript text.

        Returns:
            Dict with keys: soap (SOAPNote), detected_language (str).
            On failure, returns a SOAPNote with error information.
        """
        if not transcript or not transcript.strip():
            logger.warning("Empty transcript provided to Scribe agent")
            return {
                "soap": SOAPNote(
                    subjective="No transcript provided.",
                    objective="No objective findings documented.",
                    assessment="Unable to assess - no transcript.",
                    plan="No plan generated.",
                ),
                "detected_language": "unknown",
            }

        last_error: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                result = await self._chain.ainvoke({"transcript": transcript})

                soap = SOAPNote(
                    subjective=result.get("subjective", ""),
                    objective=result.get("objective", ""),
                    assessment=result.get("assessment", ""),
                    plan=result.get("plan", ""),
                )
                detected_language = result.get("detected_language", "English")

                logger.info(
                    "Scribe generated SOAP note (language: %s, attempt: %d)",
                    detected_language,
                    attempt + 1,
                )
                return {
                    "soap": soap,
                    "detected_language": detected_language,
                }

            except Exception as e:
                last_error = e
                error_str = str(e).lower()

                # Check for rate limit errors
                if "rate_limit" in error_str or "429" in error_str or "rate limit" in error_str:
                    wait_time = (2 ** attempt) * 2  # 2, 4, 8 seconds
                    logger.warning(
                        "Groq rate limit hit (attempt %d/%d), waiting %ds...",
                        attempt + 1,
                        self._max_retries,
                        wait_time,
                    )
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(
                        "Scribe agent error (attempt %d/%d): %s",
                        attempt + 1,
                        self._max_retries,
                        e,
                    )
                    if attempt < self._max_retries - 1:
                        await asyncio.sleep(1)

        # All retries exhausted
        logger.error("Scribe agent failed after %d attempts: %s", self._max_retries, last_error)
        return {
            "soap": SOAPNote(
                subjective=f"Error generating SOAP note: {last_error}",
                objective="",
                assessment="",
                plan="",
            ),
            "detected_language": "unknown",
        }
