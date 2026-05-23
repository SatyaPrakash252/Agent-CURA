/* ===========================================
   Project Cura – Client-side PII Masking
   Mirrors backend patterns for consistency
   =========================================== */

interface PIIPattern {
  name: string;
  regex: RegExp;
  replacement: string;
}

const PII_PATTERNS: PIIPattern[] = [
  {
    name: "PHONE",
    regex: /\b(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    name: "PHONE_INTL",
    regex: /\b\+?\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    name: "EMAIL",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: "[EMAIL_REDACTED]",
  },
  {
    name: "AADHAAR",
    regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: "[AADHAAR_REDACTED]",
  },
  {
    name: "PAN",
    regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    replacement: "[PAN_REDACTED]",
  },
  {
    name: "DATE_OF_BIRTH",
    regex:
      /\b(?:0[1-9]|[12]\d|3[01])[\/\-](?:0[1-9]|1[0-2])[\/\-](?:19|20)\d{2}\b/g,
    replacement: "[DOB_REDACTED]",
  },
  {
    name: "SSN",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[SSN_REDACTED]",
  },
  {
    name: "CREDIT_CARD",
    regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    replacement: "[CC_REDACTED]",
  },
];

/**
 * Mask PII in text using regex patterns that mirror the backend.
 * Each detected PII is replaced with a [TYPE_REDACTED] placeholder.
 */
export function maskPII(text: string): string {
  if (!text) return text;

  let masked = text;
  for (const pattern of PII_PATTERNS) {
    masked = masked.replace(pattern.regex, pattern.replacement);
  }
  return masked;
}

/**
 * Check if text contains any PII patterns.
 */
export function containsPII(text: string): boolean {
  if (!text) return false;

  for (const pattern of PII_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(text)) {
      return true;
    }
    pattern.regex.lastIndex = 0;
  }
  return false;
}
