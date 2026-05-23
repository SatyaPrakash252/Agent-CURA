"""
Project Cura - Agent D: Speaker Diarization Refiner.

Refines the raw speaker labels of a transcription using Groq's Llama 3.1 8B.
Determines clinical roles (Doctor vs Patient) based on the dialogue context.
"""

import asyncio
import json
import logging

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.config import get_settings
from app.models.schemas import SpeakerSegment

logger = logging.getLogger(__name__)

REFINER_SYSTEM_PROMPT = """You are a clinical transcription assistant. Your task is to review and correct the speaker labels of a medical consultation transcript.
A simple real-time silence detector has attempted to assign speaker labels ("Doctor" or "Patient") to dialogue turns, but it is frequently wrong and gets them mixed up.

Analyze the clinical context of each turn:
- The speaker asking about symptoms, medical history, performing examinations, explaining diagnoses, prescribing treatments, or giving clinical instructions is the DOCTOR.
- The speaker describing symptoms, answering the doctor's questions, asking about their condition, or explaining their concerns is the PATIENT.

Rules:
1. Every turn MUST be labeled as either "Doctor" or "Patient".
2. Preserve the EXACT text and order of the turns. DO NOT edit or skip the text.
3. Return a JSON object with a single key "speakers" which contains a list of strings ("Doctor" or "Patient") matching the sequence of input turns.

Example:
Input turns:
0. Doctor: "Hello, what brings you in today?"
1. Doctor: "My back is hurting a lot."
2. Patient: "When did it start?"
3. Patient: "About three days ago."

Response:
{{
    "speakers": ["Doctor", "Patient", "Doctor", "Patient"]
}}

Return ONLY the JSON object, no other text."""

REFINER_USER_PROMPT = """Review and correct the speaker labels for these transcript turns:

{turns}

Return the JSON response:"""


class DiarizerRefinerAgent:
    """
    Agent D - Speaker Diarization Refiner.
    
    Refines speaker labels for a list of SpeakerSegments by analyzing
    the conversation context using Groq.
    """

    def __init__(self) -> None:
        """Initialize the Refiner agent with Groq LLM (8B model for speed)."""
        settings = get_settings()
        self._llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name="llama-3.1-8b-instant",
            temperature=0.0,
            max_tokens=1024,
        )
        self._prompt = ChatPromptTemplate.from_messages(
            [
                ("system", REFINER_SYSTEM_PROMPT),
                ("human", REFINER_USER_PROMPT),
            ]
        )
        self._parser = JsonOutputParser()
        self._chain = self._prompt | self._llm | self._parser
        self._max_retries = 3

    async def refine_segments(
        self, segments: list[SpeakerSegment]
    ) -> list[SpeakerSegment]:
        """
        Refine the speaker labels for a list of segments.

        Args:
            segments: List of SpeakerSegment objects.

        Returns:
            List of SpeakerSegment objects with corrected speaker labels.
        """
        if not segments:
            return []

        # Format segments for the LLM prompt
        turns_text = []
        for idx, seg in enumerate(segments):
            turns_text.append(f"{idx}. {seg.speaker}: \"{seg.text}\"")
        turns_payload = "\n".join(turns_text)

        last_error: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                result = await self._chain.ainvoke({"turns": turns_payload})
                speakers = result.get("speakers", [])

                if len(speakers) == len(segments):
                    refined_segments = []
                    for idx, seg in enumerate(segments):
                        refined_segments.append(
                            SpeakerSegment(
                                speaker=speakers[idx],
                                text=seg.text,
                                start_time=seg.start_time,
                                end_time=seg.end_time,
                            )
                        )
                    logger.info(
                        "DiarizerRefiner refined %d segments successfully (attempt %d)",
                        len(refined_segments),
                        attempt + 1,
                    )
                    return refined_segments
                else:
                    logger.warning(
                        "DiarizerRefiner output length mismatch: got %d, expected %d. Retrying...",
                        len(speakers),
                        len(segments),
                    )
                    raise ValueError("Length mismatch between input and output speaker labels")

            except Exception as e:
                last_error = e
                error_str = str(e).lower()

                if "rate_limit" in error_str or "429" in error_str or "rate limit" in error_str:
                    wait_time = (2 ** attempt) * 2
                    logger.warning(
                        "Groq rate limit hit in DiarizerRefiner (attempt %d/%d), waiting %ds...",
                        attempt + 1,
                        self._max_retries,
                        wait_time,
                    )
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(
                        "DiarizerRefiner agent error (attempt %d/%d): %s",
                        attempt + 1,
                        self._max_retries,
                        e,
                    )
                    if attempt < self._max_retries - 1:
                        await asyncio.sleep(1)

        # On failure, return original segments with alternating doctor/patient as fallback
        logger.error(
            "DiarizerRefiner agent failed after %d attempts: %s. Using original segments.",
            self._max_retries,
            last_error,
        )
        return segments
