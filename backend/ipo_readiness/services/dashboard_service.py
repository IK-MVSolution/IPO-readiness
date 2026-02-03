"""Service for dashboard data (Projects & Team Members). Uses SQLite or PostgreSQL."""
from __future__ import annotations

from contextlib import closing
from dataclasses import dataclass
from typing import List

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


@dataclass
class TeamMember:
    id: int
    name: str
    role: str
    active_tasks: int
    pending: int
    load: int
    avatar: str


def _row_to_project(row) -> Project:
    return Project(
        id=row["id"],
        client=row["client"],
        phase=row["phase"],
        readiness=row["readiness"],
        status=row["status"],
        next_milestone=row["next_milestone"],
        risk=row["risk"],
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
    with closing(get_connection()) as conn:
        cur = conn.cursor()
        cur.execute(projects_sql)
        cur.execute(team_sql)
        conn.commit()

    _seed_data_if_empty()


def _seed_data_if_empty() -> None:
    """Seed initial data if tables are empty."""
    with closing(get_connection()) as conn:
        row = execute_fetchone(conn, "SELECT COUNT(*) as c FROM projects", ())
        count = row["c"] if row else 0
        if count == 0:
            projects = [
                ("Siam Tech Innovation", "Filing Prep", 85, "On Track", "Submit Filing (15 Days)", "Low"),
                ("Green Agro Export", "Internal Audit", 62, "At Risk", "Close Audit Findings", "High"),
                ("Vana Logistics", "Pre-Audit", 45, "Delayed", "Financial Restructure", "Medium"),
                ("Blue Ocean Food", "Filing Prep", 92, "On Track", "SEC Q&A", "Low"),
                ("NextGen Retail", "Internal Audit", 70, "Pending Review", "Approve Q3 Reports", "Medium"),
            ]
            for p in projects:
                execute_insert(
                    conn,
                    "INSERT INTO projects (client, phase, readiness, status, next_milestone, risk) VALUES (?, ?, ?, ?, ?, ?)",
                    p,
                )

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


def list_projects() -> List[Project]:
    with closing(get_connection()) as conn:
        rows = execute_fetchall(
            conn,
            "SELECT id, client, phase, readiness, status, next_milestone, risk FROM projects ORDER BY id ASC",
        )
    return [_row_to_project(row) for row in rows]


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


def create_project(
    client: str, phase: str, readiness: int, status: str, next_milestone: str, risk: str
) -> Project:
    with closing(get_connection()) as conn:
        project_id = execute_insert(
            conn,
            "INSERT INTO projects (client, phase, readiness, status, next_milestone, risk) VALUES (?, ?, ?, ?, ?, ?)",
            (client, phase, readiness, status, next_milestone, risk),
        )
    return Project(project_id, client, phase, readiness, status, next_milestone, risk)
