"""
Project Cura - Agent C: The Billing Engine.

Extracts ICD-10-CM billing codes and clinical intents from SOAP notes.
Uses Groq's Llama 3.1 8B model for cost-effective extraction.
"""

import asyncio
import json
import logging

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.config import get_settings
from app.models.schemas import BillingCode, ClinicalIntent, SOAPNote
from app.utils.icd10_lookup import lookup_code, search_codes, validate_code

logger = logging.getLogger(__name__)

BILLING_SYSTEM_PROMPT = """You are a medical billing and coding specialist AI. Your task is to extract ICD-10-CM billing codes and clinical intents from a SOAP note.

For BILLING CODES:
- Extract relevant ICD-10-CM diagnosis codes based on the Assessment and Plan.
- Each code should have: code (e.g., "J06.9"), description, and code_type ("ICD-10-CM").
- Be specific - use the most specific code applicable.
- Include codes for all documented conditions, not just the primary diagnosis.
- Common code ranges: J00-J99 (Respiratory), E00-E89 (Endocrine), I00-I99 (Circulatory), K00-K95 (Digestive), M00-M99 (Musculoskeletal), R00-R99 (Symptoms).

For CLINICAL INTENTS:
- Extract actions the physician intends to take.
- Each intent should have:
  - type: "LAB" (laboratory tests), "MEDICINE" (prescriptions), "FOLLOWUP" (follow-up visits), or "REFERRAL" (specialist referrals)
  - item: Specific description of the action
  - urgency: "routine", "urgent", or "stat"

Return your response as a JSON object:
{{
    "billing_codes": [
        {{"code": "J06.9", "description": "Acute upper respiratory infection, unspecified", "code_type": "ICD-10-CM"}},
        ...
    ],
    "intents": [
        {{"type": "LAB", "item": "Complete Blood Count (CBC)", "urgency": "routine"}},
        {{"type": "MEDICINE", "item": "Amoxicillin 500mg TID x 7 days", "urgency": "routine"}},
        ...
    ]
}}

Return ONLY the JSON object, no other text."""

BILLING_USER_PROMPT = """Extract billing codes and clinical intents from the following SOAP note:

---SOAP NOTE---
Subjective: {subjective}

Objective: {objective}

Assessment: {assessment}

Plan: {plan}
---END SOAP NOTE---

Return the JSON response:"""


class BillingAgent:
    """
    Agent C - The Billing Engine.

    Extracts ICD-10-CM billing codes and clinical intents from SOAP notes,
    with cross-reference validation against the local ICD-10 lookup.
    """

    def __init__(self) -> None:
        """Initialize the Billing agent with Groq LLM (8B model)."""
        settings = get_settings()
        self._llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name="llama-3.1-8b-instant",
            temperature=0.0,
            max_tokens=1536,
        )
        self._prompt = ChatPromptTemplate.from_messages(
            [
                ("system", BILLING_SYSTEM_PROMPT),
                ("human", BILLING_USER_PROMPT),
            ]
        )
        self._parser = JsonOutputParser()
        self._chain = self._prompt | self._llm | self._parser
        self._max_retries = 3

    def _validate_and_enrich_codes(
        self, raw_codes: list[dict]
    ) -> list[BillingCode]:
        """
        Validate extracted billing codes against the local ICD-10 lookup
        and enrich with canonical descriptions.

        Args:
            raw_codes: List of raw code dicts from the LLM.

        Returns:
            List of validated BillingCode objects.
        """
        validated: list[BillingCode] = []
        for code_data in raw_codes:
            if not isinstance(code_data, dict):
                continue

            code = code_data.get("code", "").strip().upper()
            description = code_data.get("description", "")
            code_type = code_data.get("code_type", "ICD-10-CM")

            if not code:
                continue

            # Cross-reference with local lookup
            local_description = lookup_code(code)
            if local_description:
                # Use the canonical description from our lookup
                description = local_description
                logger.debug("Validated ICD-10 code: %s - %s", code, description)
            else:
                # Code not in our local lookup — still include it but log
                logger.info(
                    "ICD-10 code %s not in local lookup, using LLM description: %s",
                    code,
                    description,
                )

            validated.append(
                BillingCode(
                    code=code,
                    description=description,
                    code_type=code_type,
                )
            )

        return validated

    def _parse_intents(self, raw_intents: list[dict]) -> list[ClinicalIntent]:
        """
        Parse raw intent data into ClinicalIntent objects.

        Args:
            raw_intents: List of raw intent dicts from the LLM.

        Returns:
            List of ClinicalIntent objects.
        """
        valid_types = {"LAB", "MEDICINE", "FOLLOWUP", "REFERRAL"}
        valid_urgencies = {"routine", "urgent", "stat"}
        intents: list[ClinicalIntent] = []

        for intent_data in raw_intents:
            if not isinstance(intent_data, dict):
                continue

            intent_type = intent_data.get("type", "").upper()
            item = intent_data.get("item", "").strip()
            urgency = intent_data.get("urgency", "routine").lower()

            if not item:
                continue

            if intent_type not in valid_types:
                intent_type = "FOLLOWUP"  # default fallback

            if urgency not in valid_urgencies:
                urgency = "routine"

            intents.append(
                ClinicalIntent(
                    type=intent_type,
                    item=item,
                    urgency=urgency,
                )
            )

        return intents

    async def extract_billing(self, soap: SOAPNote) -> dict:
        """
        Extract billing codes and clinical intents from a SOAP note.

        Args:
            soap: The SOAPNote to analyze.

        Returns:
            Dict with keys:
                - billing_codes: list[BillingCode]
                - intents: list[ClinicalIntent]
        """
        if not soap.assessment and not soap.plan:
            logger.warning("Empty assessment and plan - no billing codes to extract")
            return {
                "billing_codes": [],
                "intents": [],
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
                    }
                )

                # Validate and enrich billing codes
                raw_codes = result.get("billing_codes", [])
                billing_codes = self._validate_and_enrich_codes(raw_codes)

                # Parse intents
                raw_intents = result.get("intents", [])
                intents = self._parse_intents(raw_intents)

                logger.info(
                    "Billing extracted: %d codes, %d intents (attempt %d)",
                    len(billing_codes),
                    len(intents),
                    attempt + 1,
                )
                return {
                    "billing_codes": billing_codes,
                    "intents": intents,
                }

            except Exception as e:
                last_error = e
                error_str = str(e).lower()

                if "rate_limit" in error_str or "429" in error_str or "rate limit" in error_str:
                    wait_time = (2 ** attempt) * 2
                    logger.warning(
                        "Groq rate limit hit in Billing (attempt %d/%d), waiting %ds...",
                        attempt + 1,
                        self._max_retries,
                        wait_time,
                    )
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(
                        "Billing agent error (attempt %d/%d): %s",
                        attempt + 1,
                        self._max_retries,
                        e,
                    )
                    if attempt < self._max_retries - 1:
                        await asyncio.sleep(1)

        logger.error("Billing agent failed after %d attempts: %s", self._max_retries, last_error)
        return {
            "billing_codes": [],
            "intents": [],
        }
