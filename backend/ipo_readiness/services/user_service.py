"""Simple SQLite-backed user repository and helpers for admin actions."""
from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from werkzeug.security import generate_password_hash, check_password_hash

_DB_PATH = Path(__file__).resolve().parents[1] / "users.db"


@dataclass
class User:
    id: int
    name: str
    email: str
    role: str


def _get_connection() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_user_store() -> None:
    """Create the users table when it does not exist."""
    with closing(_get_connection()) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def list_users() -> List[User]:
    with closing(_get_connection()) as conn:
        rows = conn.execute(
            "SELECT id, name, email, role FROM users ORDER BY created_at DESC"
        ).fetchall()
    return [_row_to_user(row) for row in rows]


def _row_to_user(row: sqlite3.Row) -> User:
    return User(id=row["id"], name=row["name"], email=row["email"], role=row["role"])


def create_user(name: str, email: str, role: str, password: str) -> User:
    email_normalized = email.strip().lower()
    if not email_normalized:
        raise ValueError("กรุณาระบุอีเมล")
    if not name.strip():
        raise ValueError("กรุณาระบุชื่อ")
    if not password:
        raise ValueError("กรุณาระบุรหัสผ่าน")

    password_hash = generate_password_hash(password)
    with closing(_get_connection()) as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)",
                (name.strip(), email_normalized, role.strip() or "user", password_hash),
            )
            conn.commit()
        except sqlite3.IntegrityError as exc:
            raise ValueError("อีเมลนี้ถูกใช้งานแล้ว") from exc

    return User(id=cursor.lastrowid, name=name.strip(), email=email_normalized, role=role.strip() or "user")


def authenticate_user(email: str, password: str) -> User:
    if not email.strip() or not password:
        raise ValueError("กรุณาระบุอีเมลและรหัสผ่าน")
    email_normalized = email.strip().lower()
    with closing(_get_connection()) as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email_normalized,),
        ).fetchone()
    if row is None:
        raise ValueError("ไม่พบบัญชีผู้ใช้")
    if not check_password_hash(row["password_hash"], password):
        raise ValueError("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    return _row_to_user(row)


def update_user(user_id: int, name: str, email: str, role: str, password: Optional[str] = None) -> User:
    """Update an existing user and return the updated record."""
    if not name.strip():
        raise ValueError("กรุณาระบุชื่อ")
    email_normalized = email.strip().lower()
    if not email_normalized:
        raise ValueError("กรุณาระบุอีเมล")
    if not role.strip():
        raise ValueError("กรุณาระบุบทบาท")

    with closing(_get_connection()) as conn:
        existing = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if existing is None:
            raise ValueError("ไม่พบบัญชีผู้ใช้")
        conflict = conn.execute(
            "SELECT id FROM users WHERE email = ? AND id != ?",
            (email_normalized, user_id),
        ).fetchone()
        if conflict:
            raise ValueError("อีเมลนี้ถูกใช้งานแล้ว")

        params = [name.strip(), email_normalized, role.strip()]
        set_clause = "name = ?, email = ?, role = ?"
        if password:
            params.append(generate_password_hash(password))
            set_clause += ", password_hash = ?"
        params.append(user_id)
        conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", params)
        conn.commit()
        row = conn.execute("SELECT id, name, email, role FROM users WHERE id = ?", (user_id,)).fetchone()

    return _row_to_user(row)


def delete_user(user_id: int) -> None:
    with closing(_get_connection()) as conn:
        existing = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
        if existing is None:
            raise ValueError("ไม่พบบัญชีผู้ใช้")
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
