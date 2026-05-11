from __future__ import annotations

import uuid
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

DB_PATH = Path(__file__).resolve().parents[2] / "data.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

PRODUCTION_TEMPLATE_ID = uuid.uuid5(uuid.NAMESPACE_DNS, "template.production")


def init_db() -> None:
    current_tables = set(SQLModel.metadata.tables.keys())

    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())

    stale = existing_tables - current_tables
    if stale:
        with engine.begin() as conn:
            for table in stale:
                conn.execute(text(f"DROP TABLE IF EXISTS {table}"))

    SQLModel.metadata.create_all(engine)
    _seed_default_template()


def _seed_default_template() -> None:
    from .models import PhaseTemplate, PhaseTemplateItem

    with Session(engine) as session:
        existing = session.get(PhaseTemplate, PRODUCTION_TEMPLATE_ID)
        if existing:
            return

        tmpl = PhaseTemplate(
            id=PRODUCTION_TEMPLATE_ID,
            name="生产项目模板",
            description="标准生产项目 5 阶段: 设计->生产->调机派遣->验收->尾款",
        )
        items = [
            PhaseTemplateItem(template_id=tmpl.id, seq=1, phase_name="设计"),
            PhaseTemplateItem(template_id=tmpl.id, seq=2, phase_name="生产"),
            PhaseTemplateItem(template_id=tmpl.id, seq=3, phase_name="调机派遣"),
            PhaseTemplateItem(template_id=tmpl.id, seq=4, phase_name="验收"),
            PhaseTemplateItem(template_id=tmpl.id, seq=5, phase_name="尾款"),
        ]
        session.add(tmpl)
        for it in items:
            session.add(it)
        session.commit()


@contextmanager
def session_scope() -> Session:
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
