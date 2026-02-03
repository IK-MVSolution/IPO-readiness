"""Service for managing audit logs. Uses SQLite (local) or PostgreSQL (DATABASE_URL)."""
from __future__ import annotations

from contextlib import closing
from dataclasses import dataclass
from typing import List, Optional

from ipo_readiness.services.db_helper import get_connection, use_postgres, execute_fetchone, execute_fetchall, execute_insert


@dataclass
class AuditLog:
    id: int
    user_id: Optional[int]
    user_name: str
    action: str
    details: str
    created_at: str


def _row_to_log(row) -> AuditLog:
    if row is None:
        raise ValueError("ไม่พบข้อมูล")
    return AuditLog(
        id=row["id"],
        user_id=row["user_id"],
        user_name=row["user_name"],
        action=row["action"],
        details=row["details"],
        created_at=str(row["created_at"]),
    )


def init_audit_store() -> None:
    """Create the audit_logs table when it does not exist."""
    if use_postgres():
        sql = """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                user_name TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
    else:
        sql = """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                user_name TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
    with closing(get_connection()) as conn:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()


def log_action(user_id: Optional[int], user_name: str, action: str, details: str = "") -> AuditLog:
    """Record a new audit log entry."""
    with closing(get_connection()) as conn:
        log_id = execute_insert(
            conn,
            "INSERT INTO audit_logs (user_id, user_name, action, details) VALUES (?, ?, ?, ?)",
            (user_id, user_name, action, details),
        )
        row = execute_fetchone(conn, "SELECT * FROM audit_logs WHERE id = ?", (log_id,))
    return _row_to_log(row)


def list_logs(limit: int = 100) -> List[AuditLog]:
    """List recent audit logs."""
    with closing(get_connection()) as conn:
        rows = execute_fetchall(
            conn,
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
    return [_row_to_log(row) for row in rows]
