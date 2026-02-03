"""
Database connection helper: SQLite (local) or PostgreSQL (production).
When DATABASE_URL is set (e.g. on Render), use PostgreSQL so data persists.
Otherwise use SQLite (file users.db) for local development.
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any, List, Optional, Tuple

_DB_PATH = Path(__file__).resolve().parents[1] / "users.db"
_DATABASE_URL = os.environ.get("DATABASE_URL")

# Optional: psycopg2 for PostgreSQL (install: pip install psycopg2-binary)
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    _HAS_PSYCOPG2 = True
    _INTEGRITY_ERROR = (sqlite3.IntegrityError, psycopg2.IntegrityError)
except ImportError:
    _HAS_PSYCOPG2 = False
    _INTEGRITY_ERROR = (sqlite3.IntegrityError,)


def integrity_error():
    """Exception type(s) for duplicate key / constraint errors."""
    return _INTEGRITY_ERROR


def use_postgres() -> bool:
    """True if DATABASE_URL is set and we can use PostgreSQL."""
    return bool(_DATABASE_URL and _HAS_PSYCOPG2)


def get_connection():
    """Return a database connection (SQLite or PostgreSQL)."""
    if use_postgres():
        # Render PostgreSQL URL may use postgres://; some clients need postgresql://
        url = _DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql://" + url[9:]
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
        conn.autocommit = False
        return conn
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _sql_for_conn(sql: str, conn) -> str:
    """Convert SQLite ? placeholders to %s for PostgreSQL."""
    if use_postgres():
        return sql.replace("?", "%s")
    return sql


def execute(conn, sql: str, params: Optional[Tuple] = None):
    """Execute SQL with ? (SQLite) or %s (PostgreSQL) placeholders."""
    sql_adapted = _sql_for_conn(sql, conn)
    params = params or ()
    cur = conn.cursor()
    cur.execute(sql_adapted, params)
    return cur


def execute_fetchone(conn, sql: str, params: Optional[Tuple] = None):
    """Execute and return one row as dict-like (Row or RealDictRow)."""
    cur = execute(conn, sql, params)
    row = cur.fetchone()
    cur.close()
    return row


def execute_fetchall(conn, sql: str, params: Optional[Tuple] = None):
    """Execute and return all rows."""
    cur = execute(conn, sql, params)
    rows = cur.fetchall()
    cur.close()
    return rows


def execute_commit(conn, sql: str, params: Optional[Tuple] = None):
    """Execute SQL (UPDATE/DELETE) and commit."""
    cur = execute(conn, sql, params)
    conn.commit()
    cur.close()


def execute_insert(conn, sql: str, params: Optional[Tuple] = None) -> int:
    """Execute INSERT and return last row id."""
    sql_adapted = _sql_for_conn(sql, conn)
    params = params or ()
    cur = conn.cursor()
    cur.execute(sql_adapted, params)
    if use_postgres():
        cur.execute("SELECT LASTVAL()")
        last_id = cur.fetchone()[0]
    else:
        last_id = cur.lastrowid
    conn.commit()
    cur.close()
    return last_id


def row_to_dict(row) -> dict:
    """Convert DB row to dict (works for sqlite3.Row and RealDictRow)."""
    if row is None:
        return {}
    if hasattr(row, "keys"):
        return dict(row)
    return dict(zip([c[0] for c in row.__cursor__.description], row))
