"""Service for managing audit logs."""
from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional
import datetime

_DB_PATH = Path(__file__).resolve().parents[1] / "users.db"


@dataclass
class AuditLog:
    id: int
    user_id: Optional[int]
    user_name: str
    action: str
    details: str
    created_at: str


def _get_connection() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_audit_store() -> None:
    """Create the audit_logs table when it does not exist."""
    with closing(_get_connection()) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                user_name TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def log_action(user_id: Optional[int], user_name: str, action: str, details: str = "") -> AuditLog:
    """Record a new audit log entry."""
    with closing(_get_connection()) as conn:
        cursor = conn.execute(
            "INSERT INTO audit_logs (user_id, user_name, action, details) VALUES (?, ?, ?, ?)",
            (user_id, user_name, action, details),
        )
        conn.commit()
        log_id = cursor.lastrowid
        
        # Fetch the created log to return it
        row = conn.execute("SELECT * FROM audit_logs WHERE id = ?", (log_id,)).fetchone()
        
    return _row_to_log(row)


def list_logs(limit: int = 100) -> List[AuditLog]:
    """List recent audit logs."""
    with closing(_get_connection()) as conn:
        rows = conn.execute(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?",
            (limit,)
        ).fetchall()
    return [_row_to_log(row) for row in rows]


def _row_to_log(row: sqlite3.Row) -> AuditLog:
    return AuditLog(
        id=row["id"],
        user_id=row["user_id"],
        user_name=row["user_name"],
        action=row["action"],
        details=row["details"],
        created_at=row["created_at"],
    )
