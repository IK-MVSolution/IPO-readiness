"""Service for dashboard data (Projects & Team Members)."""
from __future__ import annotations

import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

_DB_PATH = Path(__file__).resolve().parents[1] / "users.db"


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


def _get_connection() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_dashboard_store() -> None:
    """Create the dashboard tables when they do not exist."""
    with closing(_get_connection()) as conn:
        # Projects Table
        conn.execute(
            """
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
        )
        # Team Members Table
        conn.execute(
            """
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
        )
        conn.commit()
    
    _seed_data_if_empty()


def _seed_data_if_empty():
    """Seed initial data if tables are empty."""
    with closing(_get_connection()) as conn:
        project_count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        if project_count == 0:
            projects = [
                ("Siam Tech Innovation", "Filing Prep", 85, "On Track", "Submit Filing (15 Days)", "Low"),
                ("Green Agro Export", "Internal Audit", 62, "At Risk", "Close Audit Findings", "High"),
                ("Vana Logistics", "Pre-Audit", 45, "Delayed", "Financial Restructure", "Medium"),
                ("Blue Ocean Food", "Filing Prep", 92, "On Track", "SEC Q&A", "Low"),
                ("NextGen Retail", "Internal Audit", 70, "Pending Review", "Approve Q3 Reports", "Medium"),
            ]
            conn.executemany(
                "INSERT INTO projects (client, phase, readiness, status, next_milestone, risk) VALUES (?, ?, ?, ?, ?, ?)",
                projects
            )
            conn.commit()

        team_count = conn.execute("SELECT COUNT(*) FROM team_members").fetchone()[0]
        if team_count == 0:
            members = [
                ("Piyapong W.", "Lead", 12, 2, 85, "P"),
                ("Somchai J.", "Finance", 18, 5, 95, "S"),
                ("Suda R.", "Legal", 8, 0, 60, "S"),
                ("Wichai K.", "Audit", 15, 8, 110, "W"),
                ("Malee S.", "Coord", 22, 1, 75, "M"),
            ]
            conn.executemany(
                "INSERT INTO team_members (name, role, active_tasks, pending, load, avatar) VALUES (?, ?, ?, ?, ?, ?)",
                members
            )
            conn.commit()


def list_projects() -> List[Project]:
    with closing(_get_connection()) as conn:
        rows = conn.execute(
            "SELECT id, client, phase, readiness, status, next_milestone, risk FROM projects ORDER BY id ASC"
        ).fetchall()
    return [Project(**dict(row)) for row in rows]


from ipo_readiness.services.user_service import list_users

# ... (Previous code)

def list_team_members() -> List[TeamMember]:
    """Fetch all registered users and map them to TeamMember view."""
    # Start with real users
    real_users = list_users()
    
    # We can join with a local stats table later, 
    # but for now let's map them dynamically to show "Real Data"
    members = []
    for u in real_users:
        # Mocking activity for now since we don't have a tasks table yet
        # In a real app, this would query a 'tasks' table counting assigned items
        is_admin = u.role == 'admin'
        
        members.append(TeamMember(
            id=u.id,
            name=u.name,
            role=u.role.capitalize(),
            active_tasks=0,  # Placeholder
            pending=0,       # Placeholder
            load=0,          # Placeholder
            avatar=u.name[0].upper() if u.name else "?"
        ))
        
    return members


def create_project(client: str, phase: str, readiness: int, status: str, next_milestone: str, risk: str) -> Project:
    with closing(_get_connection()) as conn:
        cursor = conn.execute(
            "INSERT INTO projects (client, phase, readiness, status, next_milestone, risk) VALUES (?, ?, ?, ?, ?, ?)",
            (client, phase, readiness, status, next_milestone, risk),
        )
        conn.commit()
        project_id = cursor.lastrowid
    return Project(project_id, client, phase, readiness, status, next_milestone, risk)
