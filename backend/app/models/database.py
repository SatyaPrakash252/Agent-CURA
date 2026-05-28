"""
Project Cura - Supabase Database Client with Local SQLite Fallback.

Key design change: Instead of a permanent one-way _use_local_sqlite flag,
every operation now dynamically tries Supabase first and falls back to SQLite
per-operation. This ensures that if Supabase comes back online after a temporary
outage, data automatically goes to Supabase again.

The SQLite fallback ensures the app works even if Supabase is completely down.
"""

import logging
import os
import sqlite3
import json
import time
from datetime import datetime, timezone

from supabase import Client, create_client

from app.config import get_settings
from app.models.schemas import ConsultationResult, PatientCreate

logger = logging.getLogger(__name__)

_supabase_client: Client | None = None
_local_db_initialized = False
_supabase_available: bool | None = None  # None = not checked yet, True/False = last known state
_supabase_last_check: float = 0.0
_SUPABASE_RECHECK_INTERVAL = 120.0  # Re-check Supabase availability every 2 minutes

DB_FILE = "cura_local.db"


def _init_local_db():
    """Initialize local SQLite database tables matching Supabase schema."""
    global _local_db_initialized
    if _local_db_initialized:
        return
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        # Create consultations table
        c.execute("""
        CREATE TABLE IF NOT EXISTS consultations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE,
            patient_id TEXT,
            subjective TEXT,
            objective TEXT,
            assessment TEXT,
            plan TEXT,
            raw_transcript TEXT,
            redacted_transcript TEXT,
            confidence_score REAL,
            fhir_payload TEXT,
            created_at TEXT
        )
        """)

        # Create patients table
        c.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT UNIQUE,
            name TEXT,
            age INTEGER,
            gender TEXT,
            contact TEXT,
            notes TEXT,
            created_at TEXT
        )
        """)

        # Create audio_recordings table
        c.execute("""
        CREATE TABLE IF NOT EXISTS audio_recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            patient_id TEXT,
            file_url TEXT,
            duration_seconds REAL,
            created_at TEXT
        )
        """)

        # Create users table
        c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            full_name TEXT,
            role TEXT,
            expertise TEXT,
            credentials TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT,
            last_login TEXT
        )
        """)

        # Create audit_log table
        c.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            action TEXT,
            resource_type TEXT,
            resource_id TEXT,
            ip_address TEXT,
            details TEXT,
            created_at TEXT
        )
        """)

        # Create fhir_transmissions table
        c.execute("""
        CREATE TABLE IF NOT EXISTS fhir_transmissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            patient_id TEXT,
            bundle TEXT,
            status TEXT,
            transmitted_at TEXT,
            created_at TEXT
        )
        """)

        conn.commit()
        conn.close()
        _local_db_initialized = True
        logger.info("Local SQLite database fallback initialized at '%s'", DB_FILE)
    except Exception as e:
        logger.error("Failed to initialize local SQLite database: %s", e)


def is_supabase_available() -> bool:
    """
    Dynamically check if Supabase is available. Caches the result for
    _SUPABASE_RECHECK_INTERVAL seconds to avoid hammering the network.
    """
    global _supabase_available, _supabase_last_check

    now = time.monotonic()

    # Use cached result if within recheck interval
    if _supabase_available is not None and (now - _supabase_last_check) < _SUPABASE_RECHECK_INTERVAL:
        return _supabase_available

    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        _supabase_available = False
        _supabase_last_check = now
        return False

    try:
        # Verify tables exist (this also tests network connectivity)
        client = get_supabase()
        client.table("users").select("id").limit(1).execute()

        _supabase_available = True
        _supabase_last_check = now
        if _supabase_available:
            logger.info("Supabase connectivity confirmed — using cloud database.")
        return True
    except Exception as e:
        _supabase_available = False
        _supabase_last_check = now
        logger.warning("Supabase unavailable (%s) — using local SQLite fallback.", e)
        return False


def get_supabase() -> Client:
    """Return a singleton Supabase client instance."""
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _supabase_client


def init_db():
    """Pre-initialize database tables and check Supabase connectivity at startup."""
    _init_local_db()
    # Initial Supabase check — result is cached
    is_supabase_available()


def get_db_mode() -> str:
    """Return current database mode string for display purposes."""
    return "Supabase (Cloud)" if is_supabase_available() else "SQLite (Local)"


# ── Consultations ────────────────────────────────────────────

async def save_consultation(
    session_id: str, patient_id: str, result: ConsultationResult
) -> dict | None:
    """
    Save a complete consultation result to the 'consultations' table.
    Auto-registers patient in patients table if they do not exist.
    """
    # Check if patient exists, if not, auto-register them
    try:
        p_record = await get_patient(patient_id)
        if p_record is None:
            logger.info("Patient %s not found in DB. Auto-registering...", patient_id)
            new_p = PatientCreate(
                patient_id=patient_id,
                name=f"Patient {patient_id}",
                age=35,
                gender="Unknown",
                contact="N/A",
                notes="Auto-registered during clinical consultation."
            )
            await create_patient(new_p)
    except Exception as pe:
        logger.error("Failed to auto-register patient %s: %s", patient_id, pe)

    extended_data = {
        "billing_codes": [bc.model_dump() for bc in result.billing_codes],
        "intents": [intent.model_dump() for intent in result.intents],
        "safety_flags": [sf.model_dump() for sf in result.safety_flags],
        "speaker_segments": [seg.model_dump() for seg in result.speaker_segments],
        "fhir_bundle": result.fhir_bundle,
    }

    # Try Supabase first, fall back to SQLite
    if is_supabase_available():
        try:
            client = get_supabase()
            record = {
                "session_id": session_id,
                "patient_id": patient_id,
                "subjective": result.soap.subjective,
                "objective": result.soap.objective,
                "assessment": result.soap.assessment,
                "plan": result.soap.plan,
                "raw_transcript": result.raw_transcript,
                "redacted_transcript": result.redacted_transcript,
                "confidence_score": result.confidence_score,
                "fhir_payload": extended_data,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            response = client.table("consultations").insert(record).execute()
            logger.info("Saved consultation %s for patient %s in Supabase", session_id, patient_id)
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error("Supabase save failed for consultation %s: %s. Falling back to SQLite.", session_id, e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
        INSERT INTO consultations (
            session_id, patient_id, subjective, objective, assessment, plan,
            raw_transcript, redacted_transcript, confidence_score, fhir_payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id,
            patient_id,
            result.soap.subjective,
            result.soap.objective,
            result.soap.assessment,
            result.soap.plan,
            result.raw_transcript,
            result.redacted_transcript,
            result.confidence_score,
            json.dumps(extended_data),
            datetime.now(timezone.utc).isoformat()
        ))
        conn.commit()
        conn.close()
        logger.info("Saved consultation %s locally (SQLite)", session_id)
        return {"session_id": session_id}
    except Exception as e:
        logger.error("Failed to save consultation locally: %s", e)
        return None


async def get_consultation(session_id: str) -> dict | None:
    """Fetch a single consultation by session_id."""
    if is_supabase_available():
        try:
            client = get_supabase()
            response = (
                client.table("consultations")
                .select("*")
                .eq("session_id", session_id)
                .limit(1)
                .execute()
            )
            if response.data:
                return _normalize_row(response.data[0])

            # Fallback: search inside fhir_payload for older records
            response = (
                client.table("consultations")
                .select("*")
                .limit(50)
                .order("created_at", desc=True)
                .execute()
            )
            if response.data:
                for row in response.data:
                    payload = row.get("fhir_payload") or {}
                    if isinstance(payload, dict) and payload.get("session_id") == session_id:
                        return _normalize_row(row)
            return None
        except Exception as e:
            logger.error("Supabase fetch failed for consultation %s: %s. Trying SQLite.", session_id, e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM consultations WHERE session_id = ?", (session_id,))
        row = c.fetchone()
        conn.close()
        if row:
            row_dict = dict(row)
            try:
                row_dict["fhir_payload"] = json.loads(row_dict["fhir_payload"])
            except Exception:
                row_dict["fhir_payload"] = {}
            return _normalize_row(row_dict)
        return None
    except Exception as e:
        logger.error("Failed to fetch consultation locally: %s", e)
        return None


async def get_recent_consultations(limit: int = 10) -> list[dict]:
    """Fetch the most recent consultations across all patients."""
    if is_supabase_available():
        try:
            client = get_supabase()
            response = (
                client.table("consultations")
                .select("*")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            if response.data:
                return [_normalize_row(row) for row in response.data]
            return []
        except Exception as e:
            logger.error("Supabase recent consultations failed: %s. Trying SQLite.", e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM consultations ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = c.fetchall()
        conn.close()
        results = []
        for r in rows:
            rd = dict(r)
            try:
                rd["fhir_payload"] = json.loads(rd["fhir_payload"])
            except Exception:
                rd["fhir_payload"] = {}
            results.append(_normalize_row(rd))
        return results
    except Exception as e:
        logger.error("Failed to fetch recent consultations locally: %s", e)
        return []


def _normalize_row(row: dict) -> dict:
    """Normalize a raw database row to the format the frontend expects."""
    payload = row.get("fhir_payload") or {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}

    if isinstance(payload, list):
        payload = {
            "intents": payload,
            "billing_codes": [],
            "safety_flags": [],
            "fhir_bundle": None,
        }
    elif not isinstance(payload, dict):
        payload = {}

    return {
        "session_id": row.get("session_id") or payload.get("session_id") or str(row.get("id", "")),
        "patient_id": row.get("patient_id", ""),
        "soap_subjective": row.get("subjective", ""),
        "soap_objective": row.get("objective", ""),
        "soap_assessment": row.get("assessment", ""),
        "soap_plan": row.get("plan", ""),
        "raw_transcript": row.get("raw_transcript", ""),
        "redacted_transcript": row.get("redacted_transcript", ""),
        "billing_codes": payload.get("billing_codes") or [],
        "intents": payload.get("intents") or [],
        "safety_flags": payload.get("safety_flags") or [],
        "confidence_score": row.get("confidence_score") or payload.get("confidence_score") or 0,
        "fhir_bundle": payload.get("fhir_bundle"),
        "created_at": row.get("created_at", ""),
    }


async def get_patient_history(patient_id: str) -> list[dict]:
    """Fetch all consultations for a patient, ordered by created_at descending."""
    if is_supabase_available():
        try:
            client = get_supabase()
            response = (
                client.table("consultations")
                .select("*")
                .eq("patient_id", patient_id)
                .order("created_at", desc=True)
                .execute()
            )
            if response.data:
                return [_normalize_row(row) for row in response.data]
            return []
        except Exception as e:
            logger.error("Supabase history failed for %s: %s. Trying SQLite.", patient_id, e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM consultations WHERE patient_id = ? ORDER BY created_at DESC", (patient_id,))
        rows = c.fetchall()
        conn.close()
        results = []
        for r in rows:
            rd = dict(r)
            try:
                rd["fhir_payload"] = json.loads(rd["fhir_payload"])
            except Exception:
                rd["fhir_payload"] = {}
            results.append(_normalize_row(rd))
        return results
    except Exception as e:
        logger.error("Failed to fetch history locally: %s", e)
        return []


# ── Patients ─────────────────────────────────────────────────

async def create_patient(patient: PatientCreate) -> dict | None:
    """Create a patient record in the patients table."""
    if is_supabase_available():
        try:
            client = get_supabase()
            record = {
                "patient_id": patient.patient_id,
                "name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
                "contact": patient.contact,
                "notes": patient.notes,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            response = client.table("patients").insert(record).execute()
            logger.info("Created patient %s in Supabase", patient.patient_id)
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error("Supabase patient create failed for %s: %s. Falling back to SQLite.", patient.patient_id, e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
        INSERT OR REPLACE INTO patients (patient_id, name, age, gender, contact, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            patient.patient_id,
            patient.name,
            patient.age,
            patient.gender,
            patient.contact,
            patient.notes,
            datetime.now(timezone.utc).isoformat()
        ))
        conn.commit()
        conn.close()
        logger.info("Created/Updated patient %s locally (SQLite)", patient.patient_id)
        return {"patient_id": patient.patient_id, "name": patient.name}
    except Exception as e:
        logger.error("Failed to save patient locally: %s", e)
        return None


async def get_patient(patient_id: str) -> dict | None:
    """Fetch a single patient by patient_id."""
    if is_supabase_available():
        try:
            client = get_supabase()
            response = (
                client.table("patients")
                .select("*")
                .eq("patient_id", patient_id)
                .limit(1)
                .execute()
            )
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            logger.error("Supabase patient fetch failed for %s: %s. Trying SQLite.", patient_id, e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else None
    except Exception as e:
        logger.error("Failed to fetch patient locally: %s", e)
        return None


async def list_patients(search: str = "", limit: int = 50) -> list[dict]:
    """List patients with optional search filtering."""
    if is_supabase_available():
        try:
            client = get_supabase()
            query = client.table("patients").select("*")
            if search:
                query = query.or_(
                    f"name.ilike.%{search}%,patient_id.ilike.%{search}%"
                )
            response = query.limit(limit).order("created_at", desc=True).execute()
            if response.data is not None:
                return response.data
            return []
        except Exception as e:
            logger.error("Supabase list patients failed: %s. Trying SQLite.", e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        if search:
            c.execute("""
            SELECT * FROM patients 
            WHERE name LIKE ? OR patient_id LIKE ? 
            ORDER BY created_at DESC LIMIT ?
            """, (f"%{search}%", f"%{search}%", limit))
        else:
            c.execute("SELECT * FROM patients ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = c.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("Failed to list patients locally: %s", e)
        return []


async def get_patient_count() -> int:
    """Get total number of unique patients."""
    if is_supabase_available():
        try:
            client = get_supabase()
            response = client.table("patients").select("id", count="exact").execute()
            return response.count or 0
        except Exception:
            pass

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM patients")
        cnt = c.fetchone()[0]
        conn.close()
        return cnt
    except Exception:
        return 0


# ── Audio Recordings ─────────────────────────────────────────

async def save_audio_metadata(
    session_id: str, patient_id: str, file_url: str, duration_seconds: float
) -> dict | None:
    """Save audio recording metadata."""
    if is_supabase_available():
        try:
            client = get_supabase()
            record = {
                "session_id": session_id,
                "patient_id": patient_id,
                "file_url": file_url,
                "duration_seconds": duration_seconds,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            response = client.table("audio_recordings").insert(record).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error("Supabase audio metadata save failed: %s. Falling back to SQLite.", e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
        INSERT INTO audio_recordings (session_id, patient_id, file_url, duration_seconds, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (session_id, patient_id, file_url, duration_seconds, datetime.now(timezone.utc).isoformat()))
        conn.commit()
        conn.close()
        logger.info("Saved audio recording locally (SQLite)")
        return {"session_id": session_id}
    except Exception as e:
        logger.error("Failed to save audio recording metadata locally: %s", e)
        return None


# ── Audit Log ────────────────────────────────────────────────

async def log_audit(
    username: str,
    action: str,
    resource_type: str = "",
    resource_id: str = "",
    ip_address: str = "",
    details: dict | None = None,
) -> None:
    """Record an audit log entry for compliance tracking."""
    if is_supabase_available():
        try:
            client = get_supabase()
            record = {
                "username": username,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "ip_address": ip_address,
                "details": details or {},
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            client.table("audit_log").insert(record).execute()
            return
        except Exception as e:
            logger.error("Supabase audit log failed: %s. Falling back to SQLite.", e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
        INSERT INTO audit_log (username, action, resource_type, resource_id, ip_address, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            username,
            action,
            resource_type,
            resource_id,
            ip_address,
            json.dumps(details or {}),
            datetime.now(timezone.utc).isoformat()
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Failed to save local audit log: %s", e)


# ── Users ────────────────────────────────────────────────────

async def get_user_by_username(username: str) -> dict | None:
    """Fetch a user by username."""
    if is_supabase_available():
        try:
            client = get_supabase()
            response = (
                client.table("users")
                .select("*")
                .eq("username", username)
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            if response.data:
                return response.data[0]
        except Exception as e:
            logger.error("Supabase user fetch failed for %s: %s. Trying SQLite.", username, e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ? AND is_active = 1", (username,))
        row = c.fetchone()
        conn.close()
        if row:
            return dict(row)
    except Exception as e:
        logger.error("Failed to get local user: %s", e)

    # Hardcoded admin fallback — always works
    settings = get_settings()
    if username == settings.ADMIN_USERNAME:
        import hashlib
        admin_pwd_hash = hashlib.sha256(settings.ADMIN_PASSWORD.encode()).hexdigest()
        return {
            "username": settings.ADMIN_USERNAME,
            "password_hash": admin_pwd_hash,
            "full_name": "Administrator",
            "role": "admin",
            "expertise": "General Administration",
            "credentials": "ADMIN-001"
        }
    return None


async def create_user(
    username: str, password_hash: str, full_name: str = "", role: str = "doctor", expertise: str = "", credentials: str = ""
) -> dict | None:
    """Create a new user record."""
    if is_supabase_available():
        try:
            client = get_supabase()
            record = {
                "username": username,
                "password_hash": password_hash,
                "full_name": full_name,
                "role": role,
                "expertise": expertise,
                "credentials": credentials,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            response = client.table("users").insert(record).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error("Supabase user create failed for %s: %s. Falling back to SQLite.", username, e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
        INSERT INTO users (username, password_hash, full_name, role, expertise, credentials, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        """, (username, password_hash, full_name, role, expertise, credentials, datetime.now(timezone.utc).isoformat()))
        conn.commit()
        conn.close()
        logger.info("Created local user %s (SQLite)", username)
        return {"username": username, "full_name": full_name}
    except Exception as e:
        logger.error("Failed to create local user: %s", e)
        return None


async def update_user_last_login(username: str) -> None:
    """Update the last_login timestamp for a user."""
    if is_supabase_available():
        try:
            client = get_supabase()
            client.table("users").update(
                {"last_login": datetime.now(timezone.utc).isoformat()}
            ).eq("username", username).execute()
            return
        except Exception as e:
            logger.error("Supabase last_login update failed for %s: %s", username, e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("UPDATE users SET last_login = ? WHERE username = ?", (datetime.now(timezone.utc).isoformat(), username))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Failed to update last login locally: %s", e)


# ── FHIR Transmissions ──────────────────────────────────────

async def save_fhir_transmission(
    session_id: str, patient_id: str, bundle: dict
) -> dict | None:
    """Save a FHIR transmission record."""
    if is_supabase_available():
        try:
            client = get_supabase()
            record = {
                "session_id": session_id,
                "patient_id": patient_id,
                "bundle": bundle,
                "status": "transmitted",
                "transmitted_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            response = client.table("fhir_transmissions").insert(record).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.error("Supabase FHIR save failed for %s: %s. Falling back to SQLite.", session_id, e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("""
        INSERT INTO fhir_transmissions (session_id, patient_id, bundle, status, transmitted_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (session_id, patient_id, json.dumps(bundle), "transmitted", datetime.now(timezone.utc).isoformat(), datetime.now(timezone.utc).isoformat()))
        conn.commit()
        conn.close()
        return {"session_id": session_id}
    except Exception as e:
        logger.error("Failed to save local FHIR transmission: %s", e)
        return None


# ── Dashboard Stats ──────────────────────────────────────────

async def get_dashboard_stats() -> dict:
    """Aggregate statistics for the dashboard."""
    if is_supabase_available():
        try:
            client = get_supabase()

            # Patient count
            p_resp = client.table("patients").select("id", count="exact").execute()
            patient_count = p_resp.count or 0

            # Today's consultations
            today_start = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            ).isoformat()
            c_resp = (
                client.table("consultations")
                .select("id", count="exact")
                .gte("created_at", today_start)
                .execute()
            )
            today_sessions = c_resp.count or 0

            # Average confidence (from recent 50)
            conf_resp = (
                client.table("consultations")
                .select("confidence_score")
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            scores = [
                r.get("confidence_score", 0)
                for r in (conf_resp.data or [])
                if r.get("confidence_score")
            ]
            avg_confidence = round(sum(scores) / len(scores), 1) if scores else 0

            return {
                "patient_count": patient_count,
                "today_sessions": today_sessions,
                "avg_confidence": avg_confidence,
            }
        except Exception as e:
            logger.error("Supabase dashboard stats failed: %s. Trying SQLite.", e)

    # SQLite fallback
    try:
        _init_local_db()
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()

        c.execute("SELECT COUNT(*) FROM patients")
        p_cnt = c.fetchone()[0]

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        c.execute("SELECT COUNT(*) FROM consultations WHERE created_at >= ?", (today_start,))
        c_cnt = c.fetchone()[0]

        c.execute("SELECT confidence_score FROM consultations ORDER BY created_at DESC LIMIT 50")
        rows = c.fetchall()
        conn.close()

        scores = [r[0] for r in rows if r[0]]
        avg_conf = round(sum(scores) / len(scores), 1) if scores else 0.0

        return {
            "patient_count": p_cnt,
            "today_sessions": c_cnt,
            "avg_confidence": avg_conf
        }
    except Exception as e:
        logger.error("Failed to fetch dashboard stats locally: %s", e)
        return {
            "patient_count": 0,
            "today_sessions": 0,
            "avg_confidence": 0
        }
