"""
Project Cura - Database Explorer REST API Routes.

Provides generic administrative endpoints to inspect tables
and evict records from either local SQLite or Supabase fallback.
"""

import logging
import sqlite3
from fastapi import APIRouter, HTTPException, Depends

from app.models.database import is_supabase_available, get_db_mode, DB_FILE, get_supabase
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/database", tags=["Database Explorer"])

VALID_TABLES = [
    "patients",
    "consultations",
    "audio_recordings",
    "users",
    "audit_log",
    "fhir_transmissions"
]


def _get_sqlite_row_count(table_name: str) -> int:
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute(f"SELECT COUNT(*) FROM {table_name}")
        cnt = c.fetchone()[0]
        conn.close()
        return cnt
    except Exception as e:
        logger.error("Failed to count SQLite rows for %s: %s", table_name, e)
        return 0


@router.get("/tables")
async def list_tables(current_user: dict = Depends(get_current_user)) -> list[dict]:
    """
    List all tables with their metadata and record counts.
    """
    db_mode = get_db_mode()
    use_supabase = is_supabase_available()
    logger.info("Database Explorer accessed by %s (Mode: %s)", current_user.get("username"), db_mode)

    results = []
    for tbl in VALID_TABLES:
        row_count = 0
        if use_supabase:
            try:
                client = get_supabase()
                resp = client.table(tbl).select("id", count="exact").limit(1).execute()
                row_count = resp.count or 0
            except Exception as e:
                logger.error("Failed to count Supabase rows for %s: %s", tbl, e)
                # Fallback to local SQLite if Supabase resolution failed midway
                row_count = _get_sqlite_row_count(tbl)
        else:
            row_count = _get_sqlite_row_count(tbl)

        results.append({
            "name": tbl,
            "rows": row_count,
            "mode": db_mode
        })
    return results


@router.get("/tables/{table_name}")
async def get_table_data(
    table_name: str,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
) -> list[dict]:
    """
    Retrieve all rows (up to limit) for a given database table.
    """
    if table_name not in VALID_TABLES:
        raise HTTPException(status_code=400, detail="Invalid table name")

    if is_supabase_available():
        try:
            client = get_supabase()
            resp = client.table(table_name).select("*").order("id", desc=True).limit(limit).execute()
            return resp.data or []
        except Exception as e:
            logger.error("Failed to fetch Supabase table %s: %s. Trying SQLite.", table_name, e)

    # SQLite fallback
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute(f"SELECT * FROM {table_name} ORDER BY id DESC LIMIT ?", (limit,))
        rows = c.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error("Failed to fetch SQLite table %s: %s", table_name, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tables/{table_name}/{row_id}")
async def delete_table_row(
    table_name: str,
    row_id: int,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Safely delete a single record by integer ID.
    """
    if table_name not in VALID_TABLES:
        raise HTTPException(status_code=400, detail="Invalid table name")

    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administrative privileges required to delete records")

    logger.warning("User %s requested deletion of row %d from table %s", current_user.get("username"), row_id, table_name)

    if is_supabase_available():
        try:
            client = get_supabase()
            resp = client.table(table_name).delete().eq("id", row_id).execute()
            if resp.data:
                return {"status": "deleted", "id": row_id, "table": table_name}
        except Exception as e:
            logger.error("Failed to delete Supabase row in %s: %s. Trying SQLite.", table_name, e)

    # SQLite fallback
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute(f"DELETE FROM {table_name} WHERE id = ?", (row_id,))
        conn.commit()
        changes = conn.changes()
        conn.close()
        if changes == 0:
            raise HTTPException(status_code=404, detail="Row not found")
        return {"status": "deleted", "id": row_id, "table": table_name}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete SQLite row in %s: %s", table_name, e)
        raise HTTPException(status_code=500, detail=str(e))
