"""User repository: SQLite (local) or PostgreSQL (production via DATABASE_URL)."""
from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import dataclass
from typing import List, Optional

import hashlib
import secrets

from ipo_readiness.services.db_helper import (
    get_connection,
    use_postgres,
    execute_fetchone,
    execute_fetchall,
    execute_insert,
    execute_commit,
    integrity_error,
)


def _hash_password(password: str) -> str:
    """Hash password using SHA256 with salt."""
    salt = secrets.token_hex(16)
    hash_obj = hashlib.sha256((salt + password).encode())
    return f"{salt}${hash_obj.hexdigest()}"


def _verify_password(password_hash: str, password: str) -> bool:
    """Verify password against hash."""
    try:
        salt, stored_hash = password_hash.split('$')
        hash_obj = hashlib.sha256((salt + password).encode())
        return hash_obj.hexdigest() == stored_hash
    except Exception:
        return False


@dataclass
class User:
    id: int
    name: str
    email: str
    role: str


def _row_to_user(row) -> User:
    if row is None:
        raise ValueError("ไม่พบข้อมูล")
    return User(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        role=row["role"],
    )


def init_user_store() -> None:
    """Create the users table when it does not exist."""
    if use_postgres():
        sql = """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
    else:
        sql = """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
    with closing(get_connection()) as conn:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()


def list_users() -> List[User]:
    with closing(get_connection()) as conn:
        rows = execute_fetchall(conn, "SELECT id, name, email, role FROM users ORDER BY created_at DESC")
    return [_row_to_user(row) for row in rows]


def create_user(name: str, email: str, role: str, password: str) -> User:
    email_normalized = email.strip().lower()
    if not email_normalized:
        raise ValueError("กรุณาระบุอีเมล")
    if not name.strip():
        raise ValueError("กรุณาระบุชื่อ")
    if not password:
        raise ValueError("กรุณาระบุรหัสผ่าน")

    password_hash = _hash_password(password)
    with closing(get_connection()) as conn:
        try:
            user_id = execute_insert(
                conn,
                "INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)",
                (name.strip(), email_normalized, role.strip() or "user", password_hash),
            )
        except integrity_error() as exc:
            raise ValueError("อีเมลนี้ถูกใช้งานแล้ว") from exc

    return User(
        id=user_id,
        name=name.strip(),
        email=email_normalized,
        role=role.strip() or "user",
    )


def authenticate_user(email: str, password: str) -> User:
    if not email.strip() or not password:
        raise ValueError("กรุณาระบุอีเมลและรหัสผ่าน")
    email_normalized = email.strip().lower()
    with closing(get_connection()) as conn:
        row = execute_fetchone(conn, "SELECT * FROM users WHERE email = ?", (email_normalized,))
    if row is None:
        raise ValueError("ไม่พบบัญชีผู้ใช้")
    if not _verify_password(row["password_hash"], password):
        raise ValueError("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    return _row_to_user(row)


def update_user(user_id: int, name: str, email: str, role: str, password: Optional[str] = None) -> User:
    if not name.strip():
        raise ValueError("กรุณาระบุชื่อ")
    email_normalized = email.strip().lower()
    if not email_normalized:
        raise ValueError("กรุณาระบุอีเมล")
    if not role.strip():
        raise ValueError("กรุณาระบุบทบาท")

    with closing(get_connection()) as conn:
        row = execute_fetchone(conn, "SELECT id FROM users WHERE id = ?", (user_id,))
        if row is None:
            raise ValueError("ไม่พบบัญชีผู้ใช้")
        conflict = execute_fetchone(conn, "SELECT id FROM users WHERE email = ? AND id != ?", (email_normalized, user_id))
        if conflict:
            raise ValueError("อีเมลนี้ถูกใช้งานแล้ว")

        if password:
            password_hash = _hash_password(password)
            execute_commit(
                conn,
                "UPDATE users SET name = ?, email = ?, role = ?, password_hash = ? WHERE id = ?",
                (name.strip(), email_normalized, role.strip(), password_hash, user_id),
            )
        else:
            execute_commit(
                conn,
                "UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?",
                (name.strip(), email_normalized, role.strip(), user_id),
            )
        row = execute_fetchone(conn, "SELECT id, name, email, role FROM users WHERE id = ?", (user_id,))

    return _row_to_user(row)


def delete_user(user_id: int) -> None:
    with closing(get_connection()) as conn:
        existing = execute_fetchone(conn, "SELECT id FROM users WHERE id = ?", (user_id,))
        if existing is None:
            raise ValueError("ไม่พบบัญชีผู้ใช้")
        execute_commit(conn, "DELETE FROM users WHERE id = ?", (user_id,))
