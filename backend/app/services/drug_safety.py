"""
Project Cura - Drug Safety Service.

Provides basic drug-drug interaction checking and dosage validation.
Uses a local lookup table for common interactions.
"""

import logging
import re

logger = logging.getLogger(__name__)

# Common drug-drug interactions (simplified lookup)
# Format: (drug_a, drug_b) -> severity, description
DRUG_INTERACTIONS: dict[tuple[str, str], dict] = {
    ("warfarin", "aspirin"): {
        "severity": "CRITICAL",
        "description": "Increased risk of bleeding. Concurrent use requires close INR monitoring.",
    },
    ("warfarin", "ibuprofen"): {
        "severity": "CRITICAL",
        "description": "NSAIDs increase bleeding risk with warfarin. Avoid concurrent use.",
    },
    ("metformin", "contrast dye"): {
        "severity": "WARNING",
        "description": "Hold metformin 48h before/after contrast imaging (risk of lactic acidosis).",
    },
    ("ace inhibitor", "potassium"): {
        "severity": "WARNING",
        "description": "Risk of hyperkalemia. Monitor potassium levels.",
    },
    ("lisinopril", "potassium"): {
        "severity": "WARNING",
        "description": "ACE inhibitors + potassium supplements increase hyperkalemia risk.",
    },
    ("simvastatin", "erythromycin"): {
        "severity": "CRITICAL",
        "description": "CYP3A4 inhibition increases statin levels. Risk of rhabdomyolysis.",
    },
    ("methotrexate", "nsaid"): {
        "severity": "CRITICAL",
        "description": "NSAIDs reduce renal clearance of methotrexate. Risk of toxicity.",
    },
    ("ssri", "tramadol"): {
        "severity": "WARNING",
        "description": "Risk of serotonin syndrome. Monitor for symptoms.",
    },
    ("fluoxetine", "tramadol"): {
        "severity": "WARNING",
        "description": "SSRI + tramadol increases serotonin syndrome risk.",
    },
    ("ciprofloxacin", "theophylline"): {
        "severity": "WARNING",
        "description": "Ciprofloxacin inhibits theophylline metabolism. Risk of toxicity.",
    },
    ("digoxin", "amiodarone"): {
        "severity": "CRITICAL",
        "description": "Amiodarone increases digoxin levels. Reduce digoxin dose by 50%.",
    },
    ("clopidogrel", "omeprazole"): {
        "severity": "WARNING",
        "description": "Omeprazole reduces clopidogrel efficacy via CYP2C19 inhibition.",
    },
}

# Drug name aliases for fuzzy matching
DRUG_ALIASES: dict[str, list[str]] = {
    "warfarin": ["coumadin", "warfarin"],
    "aspirin": ["aspirin", "ecosprin", "disprin"],
    "ibuprofen": ["ibuprofen", "advil", "brufen", "motrin"],
    "metformin": ["metformin", "glucophage", "glycomet"],
    "lisinopril": ["lisinopril", "zestril", "prinivil"],
    "simvastatin": ["simvastatin", "zocor"],
    "fluoxetine": ["fluoxetine", "prozac"],
    "tramadol": ["tramadol", "ultram"],
    "digoxin": ["digoxin", "lanoxin"],
    "amiodarone": ["amiodarone", "cordarone"],
    "clopidogrel": ["clopidogrel", "plavix"],
    "omeprazole": ["omeprazole", "prilosec"],
    "ciprofloxacin": ["ciprofloxacin", "cipro"],
    "erythromycin": ["erythromycin"],
    "methotrexate": ["methotrexate"],
}

# Common dosage ranges (drug_name -> (min_mg, max_mg, unit, frequency))
DOSAGE_RANGES: dict[str, dict] = {
    "metformin": {"min": 500, "max": 2550, "unit": "mg", "freq": "daily"},
    "amoxicillin": {"min": 250, "max": 3000, "unit": "mg", "freq": "daily"},
    "ibuprofen": {"min": 200, "max": 1200, "unit": "mg", "freq": "daily"},
    "paracetamol": {"min": 325, "max": 4000, "unit": "mg", "freq": "daily"},
    "acetaminophen": {"min": 325, "max": 4000, "unit": "mg", "freq": "daily"},
    "aspirin": {"min": 75, "max": 650, "unit": "mg", "freq": "daily"},
    "lisinopril": {"min": 5, "max": 40, "unit": "mg", "freq": "daily"},
    "amlodipine": {"min": 2.5, "max": 10, "unit": "mg", "freq": "daily"},
    "atorvastatin": {"min": 10, "max": 80, "unit": "mg", "freq": "daily"},
    "omeprazole": {"min": 20, "max": 40, "unit": "mg", "freq": "daily"},
}


def _normalize_drug(name: str) -> str:
    """Normalize a drug name to lowercase, stripping dosage info."""
    return re.sub(r'\d+\s*(mg|ml|mcg|g)\b', '', name.lower()).strip()


def _resolve_alias(name: str) -> str:
    """Resolve a drug name to its canonical form using aliases."""
    normalized = _normalize_drug(name)
    for canonical, aliases in DRUG_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                return canonical
    return normalized


def check_interactions(medications: list[str]) -> list[dict]:
    """
    Check a list of medications for known drug-drug interactions.

    Args:
        medications: List of medication names (may include dosage info).

    Returns:
        List of interaction alerts with severity, drugs involved, and description.
    """
    alerts = []
    resolved = [(med, _resolve_alias(med)) for med in medications]

    for i in range(len(resolved)):
        for j in range(i + 1, len(resolved)):
            orig_a, canon_a = resolved[i]
            orig_b, canon_b = resolved[j]

            # Check both orderings
            key = (canon_a, canon_b)
            interaction = DRUG_INTERACTIONS.get(key) or DRUG_INTERACTIONS.get((canon_b, canon_a))

            if interaction:
                alerts.append({
                    "drug_a": orig_a,
                    "drug_b": orig_b,
                    "severity": interaction["severity"],
                    "description": interaction["description"],
                })

    return alerts


def validate_dosage(drug_name: str, dosage_text: str) -> dict | None:
    """
    Validate a dosage against known safe ranges.

    Args:
        drug_name: Drug name.
        dosage_text: Dosage string (e.g., "500mg", "1000 mg").

    Returns:
        Warning dict if dosage is outside safe range, None if OK or unknown.
    """
    canonical = _resolve_alias(drug_name)
    range_info = DOSAGE_RANGES.get(canonical)
    if not range_info:
        return None

    # Extract number from dosage text
    match = re.search(r'(\d+(?:\.\d+)?)\s*(mg|g|ml|mcg)', dosage_text.lower())
    if not match:
        return None

    value = float(match.group(1))
    unit = match.group(2)

    # Convert to mg for comparison
    if unit == "g":
        value *= 1000
    elif unit == "mcg":
        value /= 1000

    if value > range_info["max"]:
        return {
            "drug": drug_name,
            "severity": "CRITICAL",
            "message": f"Dosage {dosage_text} exceeds maximum recommended dose of {range_info['max']}{range_info['unit']} {range_info['freq']} for {canonical}.",
        }
    elif value < range_info["min"]:
        return {
            "drug": drug_name,
            "severity": "INFO",
            "message": f"Dosage {dosage_text} is below typical minimum of {range_info['min']}{range_info['unit']} for {canonical}. Verify intent.",
        }

    return None
