"""
Project Cura - ICD-10-CM Code Lookup.

Provides a local dictionary of ~100 common ICD-10-CM codes
with lookup, search, and validation functions.
"""

# Common ICD-10-CM codes organized by category
ICD10_CODES: dict[str, str] = {
    # Common infections (A00-B99)
    "A09": "Infectious gastroenteritis and colitis, unspecified",
    "A49.9": "Bacterial infection, unspecified",
    "B34.9": "Viral infection, unspecified",
    "B37.0": "Candidal stomatitis (oral thrush)",
    # Endocrine, nutritional and metabolic diseases (E00-E89)
    "E03.9": "Hypothyroidism, unspecified",
    "E05.90": "Thyrotoxicosis, unspecified",
    "E11.9": "Type 2 diabetes mellitus without complications",
    "E11.65": "Type 2 diabetes mellitus with hyperglycemia",
    "E11.40": "Type 2 diabetes mellitus with diabetic neuropathy, unspecified",
    "E11.21": "Type 2 diabetes mellitus with diabetic nephropathy",
    "E13.9": "Other specified diabetes mellitus without complications",
    "E55.9": "Vitamin D deficiency, unspecified",
    "E66.01": "Morbid (severe) obesity due to excess calories",
    "E66.9": "Obesity, unspecified",
    "E78.0": "Pure hypercholesterolemia, unspecified",
    "E78.5": "Dyslipidemia, unspecified",
    "E87.6": "Hypokalemia",
    # Mental and behavioral disorders (F00-F99)
    "F32.9": "Major depressive disorder, single episode, unspecified",
    "F33.0": "Major depressive disorder, recurrent, mild",
    "F41.1": "Generalized anxiety disorder",
    "F41.9": "Anxiety disorder, unspecified",
    "F51.01": "Primary insomnia",
    # Diseases of the nervous system (G00-G99)
    "G43.909": "Migraine, unspecified, not intractable, without status migrainosus",
    "G47.00": "Insomnia, unspecified",
    "G89.29": "Other chronic pain",
    # Diseases of the eye (H00-H59)
    "H10.9": "Unspecified conjunctivitis",
    "H66.90": "Otitis media, unspecified, unspecified ear",
    # Diseases of the circulatory system (I00-I99)
    "I10": "Essential (primary) hypertension",
    "I11.9": "Hypertensive heart disease without heart failure",
    "I20.9": "Angina pectoris, unspecified",
    "I25.10": "Atherosclerotic heart disease of native coronary artery without angina pectoris",
    "I25.9": "Chronic ischemic heart disease, unspecified",
    "I48.91": "Unspecified atrial fibrillation",
    "I50.9": "Heart failure, unspecified",
    "I63.9": "Cerebral infarction, unspecified",
    "I70.0": "Atherosclerosis of aorta",
    # Diseases of the respiratory system (J00-J99)
    "J00": "Acute nasopharyngitis (common cold)",
    "J02.9": "Acute pharyngitis, unspecified",
    "J03.90": "Acute tonsillitis, unspecified",
    "J06.9": "Acute upper respiratory infection, unspecified",
    "J18.9": "Pneumonia, unspecified organism",
    "J20.9": "Acute bronchitis, unspecified",
    "J30.1": "Allergic rhinitis due to pollen",
    "J30.9": "Allergic rhinitis, unspecified",
    "J40": "Bronchitis, not specified as acute or chronic",
    "J44.1": "Chronic obstructive pulmonary disease with acute exacerbation",
    "J44.9": "Chronic obstructive pulmonary disease, unspecified",
    "J45.20": "Mild intermittent asthma, uncomplicated",
    "J45.909": "Unspecified asthma, uncomplicated",
    "J98.8": "Other specified respiratory disorders",
    # Diseases of the digestive system (K00-K95)
    "K21.0": "Gastro-esophageal reflux disease with esophagitis",
    "K21.9": "Gastro-esophageal reflux disease without esophagitis",
    "K25.9": "Gastric ulcer, unspecified, without hemorrhage or perforation",
    "K29.70": "Gastritis, unspecified, without bleeding",
    "K30": "Functional dyspepsia",
    "K35.80": "Unspecified acute appendicitis",
    "K58.9": "Irritable bowel syndrome without diarrhea",
    "K59.00": "Constipation, unspecified",
    "K76.0": "Fatty (change of) liver, not elsewhere classified",
    "K80.20": "Calculus of gallbladder without cholecystitis, without obstruction",
    # Diseases of the skin (L00-L99)
    "L20.9": "Atopic dermatitis, unspecified",
    "L30.9": "Dermatitis, unspecified",
    "L50.9": "Urticaria, unspecified",
    "L70.0": "Acne vulgaris",
    # Diseases of the musculoskeletal system (M00-M99)
    "M06.9": "Rheumatoid arthritis, unspecified",
    "M10.9": "Gout, unspecified",
    "M17.9": "Osteoarthritis of knee, unspecified",
    "M19.90": "Unspecified osteoarthritis, unspecified site",
    "M25.50": "Pain in unspecified joint",
    "M54.2": "Cervicalgia",
    "M54.5": "Low back pain",
    "M54.9": "Dorsalgia, unspecified",
    "M62.830": "Muscle spasm of back",
    "M79.3": "Panniculitis, unspecified",
    # Diseases of the genitourinary system (N00-N99)
    "N18.9": "Chronic kidney disease, unspecified",
    "N30.00": "Acute cystitis without hematuria",
    "N39.0": "Urinary tract infection, site not specified",
    "N40.0": "Benign prostatic hyperplasia without lower urinary tract symptoms",
    # Pregnancy related (O00-O9A)
    "O80": "Encounter for full-term uncomplicated delivery",
    # Symptoms, signs (R00-R99)
    "R00.0": "Tachycardia, unspecified",
    "R05.9": "Cough, unspecified",
    "R06.00": "Dyspnea, unspecified",
    "R06.02": "Shortness of breath",
    "R07.9": "Chest pain, unspecified",
    "R10.9": "Unspecified abdominal pain",
    "R10.84": "Generalized abdominal pain",
    "R11.0": "Nausea",
    "R11.2": "Nausea with vomiting, unspecified",
    "R19.7": "Diarrhea, unspecified",
    "R42": "Dizziness and giddiness",
    "R50.9": "Fever, unspecified",
    "R51.9": "Headache, unspecified",
    "R53.83": "Other fatigue",
    "R63.4": "Abnormal weight loss",
    "R68.89": "Other general symptoms and signs",
    # Injury, poisoning (S00-T88)
    "S93.401A": "Unspecified sprain of right ankle, initial encounter",
    "T78.40XA": "Allergy, unspecified, initial encounter",
    # Factors influencing health status (Z00-Z99)
    "Z00.00": "Encounter for general adult medical examination without abnormal findings",
    "Z23": "Encounter for immunization",
    "Z87.891": "Personal history of nicotine dependence",
}


def lookup_code(code: str) -> str | None:
    """
    Look up the description for a given ICD-10-CM code.

    Args:
        code: The ICD-10-CM code to look up (case-insensitive).

    Returns:
        The description string if found, or None.
    """
    return ICD10_CODES.get(code.upper().strip())


def search_codes(query: str) -> list[dict]:
    """
    Search ICD-10-CM codes by description (case-insensitive fuzzy match).

    Args:
        query: Search term to match against code descriptions.

    Returns:
        List of dicts with 'code' and 'description' keys.
    """
    query_lower = query.lower().strip()
    if not query_lower:
        return []

    results: list[dict] = []
    query_terms = query_lower.split()

    for code, description in ICD10_CODES.items():
        desc_lower = description.lower()
        # Match if all query terms appear in the description
        if all(term in desc_lower for term in query_terms):
            results.append({"code": code, "description": description})

    # Sort by code for consistent ordering
    results.sort(key=lambda x: x["code"])
    return results


def validate_code(code: str) -> bool:
    """
    Check whether an ICD-10-CM code exists in the local lookup.

    Args:
        code: The ICD-10-CM code to validate (case-insensitive).

    Returns:
        True if the code exists, False otherwise.
    """
    return code.upper().strip() in ICD10_CODES
