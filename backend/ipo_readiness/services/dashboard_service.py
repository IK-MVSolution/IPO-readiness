"""Service for dashboard data (Projects & Team Members). Uses SQLite or PostgreSQL."""
from __future__ import annotations

import json
from contextlib import closing
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ipo_readiness.services.db_helper import (
    get_connection,
    use_postgres,
    execute_fetchone,
    execute_fetchall,
    execute_insert,
    execute_commit,
)
from ipo_readiness.services.user_service import list_users


@dataclass
class Project:
    id: int
    client: str
    phase: str
    readiness: int
    status: str
    next_milestone: str
    risk: str
    user_id: Optional[int] = None
    assessed_by: Optional[str] = None


@dataclass
class TeamMember:
    id: int
    name: str
    role: str
    active_tasks: int
    pending: int
    load: int
    avatar: str


def _row_get(row, key: str, default=None):
    """Get value from row (works for sqlite3.Row and dict-like RealDictRow)."""
    if hasattr(row, "get"):
        return row.get(key, default)
    try:
        return row[key] if key in row.keys() else default
    except (KeyError, TypeError, AttributeError):
        return default


def _row_to_project(row) -> Project:
    return Project(
        id=row["id"],
        client=row["client"],
        phase=row["phase"],
        readiness=row["readiness"],
        status=row["status"],
        next_milestone=row["next_milestone"],
        risk=row["risk"],
        user_id=_row_get(row, "user_id"),
        assessed_by=_row_get(row, "assessed_by"),
    )


def init_dashboard_store() -> None:
    """Create the dashboard tables when they do not exist."""
    if use_postgres():
        projects_sql = """
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                client TEXT NOT NULL,
                phase TEXT NOT NULL,
                readiness INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                next_milestone TEXT,
                risk TEXT DEFAULT 'Low',
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        team_sql = """
            CREATE TABLE IF NOT EXISTS team_members (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                active_tasks INTEGER DEFAULT 0,
                pending INTEGER DEFAULT 0,
                load INTEGER DEFAULT 0,
                avatar TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        assessments_sql = """
            CREATE TABLE IF NOT EXISTS assessments (
                id SERIAL PRIMARY KEY,
                company_name TEXT NOT NULL,
                user_id INTEGER,
                readiness_score INTEGER,
                readiness_level TEXT,
                set_eligible BOOLEAN,
                mai_eligible BOOLEAN,
                phase TEXT,
                status TEXT,
                risk TEXT,
                next_milestone TEXT,
                metrics_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
    else:
        projects_sql = """
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client TEXT NOT NULL,
                phase TEXT NOT NULL,
                readiness INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                next_milestone TEXT,
                risk TEXT DEFAULT 'Low',
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        team_sql = """
            CREATE TABLE IF NOT EXISTS team_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                active_tasks INTEGER DEFAULT 0,
                pending INTEGER DEFAULT 0,
                load INTEGER DEFAULT 0,
                avatar TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        assessments_sql = """
            CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_name TEXT NOT NULL,
                user_id INTEGER,
                readiness_score INTEGER,
                readiness_level TEXT,
                set_eligible INTEGER,
                mai_eligible INTEGER,
                phase TEXT,
                status TEXT,
                risk TEXT,
                next_milestone TEXT,
                metrics_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
    with closing(get_connection()) as conn:
        cur = conn.cursor()
        cur.execute(projects_sql)
        cur.execute(team_sql)
        cur.execute(assessments_sql)
        # Migration: add user_id to projects if missing (existing DBs)
        try:
            if use_postgres():
                cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)")
            else:
                cur.execute("ALTER TABLE projects ADD COLUMN user_id INTEGER")
        except Exception:
            pass  # column may already exist
        conn.commit()

    _seed_team_if_empty()


def _seed_team_if_empty() -> None:
    """Seed team_members only if empty (used when no users exist yet)."""
    with closing(get_connection()) as conn:
        row = execute_fetchone(conn, "SELECT COUNT(*) as c FROM team_members", ())
        count = row["c"] if row else 0
        if count == 0:
            members = [
                ("Piyapong W.", "Lead", 12, 2, 85, "P"),
                ("Somchai J.", "Finance", 18, 5, 95, "S"),
                ("Suda R.", "Legal", 8, 0, 60, "S"),
                ("Wichai K.", "Audit", 15, 8, 110, "W"),
                ("Malee S.", "Coord", 22, 1, 75, "M"),
            ]
            for m in members:
                execute_insert(
                    conn,
                    "INSERT INTO team_members (name, role, active_tasks, pending, load, avatar) VALUES (?, ?, ?, ?, ?, ?)",
                    m,
                )


def _backfill_assessed_by(projects: List[Project]) -> List[Project]:
    """Fill assessed_by from assessments table for projects that have no user_id (old or manual)."""
    need_fill = [p for p in projects if not p.assessed_by and p.client]
    if not need_fill:
        return projects
    clients = list({p.client for p in need_fill})
    user_id_to_name = {u.id: u.name for u in list_users()}
    with closing(get_connection()) as conn:
        # Latest assessment per client (company_name) -> user_id
        placeholders = ",".join("?" * len(clients))
        if use_postgres():
            sql = f"""
                SELECT DISTINCT ON (company_name) company_name, user_id
                FROM assessments
                WHERE company_name IN ({placeholders}) AND user_id IS NOT NULL
                ORDER BY company_name, created_at DESC
            """
        else:
            sql = f"""
                SELECT a.company_name, a.user_id
                FROM assessments a
                WHERE a.company_name IN ({placeholders}) AND a.user_id IS NOT NULL
                AND a.created_at = (SELECT MAX(a2.created_at) FROM assessments a2 WHERE a2.company_name = a.company_name)
            """
        rows = execute_fetchall(conn, sql, tuple(clients))
    client_to_name = {}
    for row in rows:
        c = _row_get(row, "company_name")
        uid = _row_get(row, "user_id")
        if c and uid and uid in user_id_to_name:
            client_to_name[c] = user_id_to_name[uid]
    if not client_to_name:
        return projects
    out = []
    for p in projects:
        if not p.assessed_by and p.client in client_to_name:
            out.append(Project(
                p.id, p.client, p.phase, p.readiness, p.status, p.next_milestone, p.risk,
                user_id=p.user_id, assessed_by=client_to_name[p.client],
            ))
        else:
            out.append(p)
    return out


def list_projects() -> List[Project]:
    with closing(get_connection()) as conn:
        try:
            rows = execute_fetchall(
                conn,
                """SELECT p.id, p.client, p.phase, p.readiness, p.status, p.next_milestone, p.risk, p.user_id,
                          u.name AS assessed_by
                   FROM projects p LEFT JOIN users u ON p.user_id = u.id
                   ORDER BY p.id DESC""",
            )
        except Exception:
            # Fallback when user_id column or join not available (old DB)
            rows = execute_fetchall(
                conn,
                "SELECT id, client, phase, readiness, status, next_milestone, risk FROM projects ORDER BY id DESC",
            )
    projects = [_row_to_project(row) for row in rows]
    return _backfill_assessed_by(projects)


def list_team_members() -> List[TeamMember]:
    """Fetch all registered users and map them to TeamMember view."""
    real_users = list_users()
    members = []
    for u in real_users:
        members.append(TeamMember(
            id=u.id,
            name=u.name,
            role=u.role.capitalize(),
            active_tasks=0,
            pending=0,
            load=0,
            avatar=u.name[0].upper() if u.name else "?",
        ))
    return members


def save_assessment_and_create_project(
    company_name: str,
    user_id: Optional[int],
    metrics: Dict[str, Any],
) -> Project:
    """Save assessment result and create a project for Client Portfolio (ข้อมูลจริง)."""
    ipo = metrics.get("ipo_assessment") or {}
    readiness_score = ipo.get("readiness_score") or 0
    readiness_level = str(ipo.get("readiness_level") or "")
    set_eligible = bool(ipo.get("set_assessment", {}).get("passed"))
    mai_eligible = bool(ipo.get("mai_assessment", {}).get("passed"))

    if set_eligible:
        phase = "Filing Prep"
        status = "On Track"
        risk = "Low"
        next_milestone = "พร้อมยื่น SET"
    elif mai_eligible:
        phase = "Filing Prep"
        status = "On Track"
        risk = "Low"
        next_milestone = "พร้อมยื่น mai"
    elif readiness_score >= 50:
        phase = "Pre-Audit"
        status = "At Risk"
        risk = "Medium"
        recs = ipo.get("recommendations") or []
        next_milestone = recs[0].get("message", "ปรับปรุงเกณฑ์ IPO")[:50] if recs else "ปรับปรุงเกณฑ์ IPO"
    else:
        phase = "Internal Audit"
        status = "Delayed"
        risk = "High"
        recs = ipo.get("recommendations") or []
        next_milestone = recs[0].get("message", "พัฒนาเพิ่มเติม")[:50] if recs else "พัฒนาเพิ่มเติม"

    metrics_json = json.dumps(metrics, ensure_ascii=False, default=str)[:10000]
    with closing(get_connection()) as conn:
        execute_insert(
            conn,
            """INSERT INTO assessments (company_name, user_id, readiness_score, readiness_level,
               set_eligible, mai_eligible, phase, status, risk, next_milestone, metrics_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (company_name, user_id, readiness_score, readiness_level, set_eligible, mai_eligible,
             phase, status, risk, next_milestone, metrics_json),
        )
        project = create_project(
            client=company_name,
            phase=phase,
            readiness=readiness_score,
            status=status,
            next_milestone=next_milestone,
            risk=risk,
            user_id=user_id,
        )
    # Reload to get assessed_by from join
    for p in list_projects():
        if p.id == project.id:
            return p
    return project


def create_project(
    client: str,
    phase: str,
    readiness: int,
    status: str,
    next_milestone: str,
    risk: str,
    user_id: Optional[int] = None,
) -> Project:
    with closing(get_connection()) as conn:
        project_id = execute_insert(
            conn,
            "INSERT INTO projects (client, phase, readiness, status, next_milestone, risk, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (client, phase, readiness, status, next_milestone, risk, user_id),
        )
    return Project(
        project_id, client, phase, readiness, status, next_milestone, risk,
        user_id=user_id, assessed_by=None,
    )
