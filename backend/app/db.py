from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

DB_PATH = Path(__file__).resolve().parents[2] / "data.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        cols = conn.exec_driver_sql("PRAGMA table_info(project)").fetchall()
        names = {str(r[1]) for r in cols}
        if "overview" not in names:
            conn.execute(text("ALTER TABLE project ADD COLUMN overview TEXT"))

        issue_cols = conn.exec_driver_sql("PRAGMA table_info(issue)").fetchall()
        issue_names = {str(r[1]) for r in issue_cols}
        if "subtask_id" not in issue_names:
            conn.execute(text("ALTER TABLE issue ADD COLUMN subtask_id TEXT"))


@contextmanager
def session_scope() -> Session:
    with Session(engine) as session:
        yield session
