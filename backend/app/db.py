from __future__ import annotations

import sys

import hashlib
import secrets
import uuid
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine, select

# Ensure all models are registered in SQLModel.metadata before create_all
from . import models  # noqa: F401

if getattr(sys, 'frozen', False):
    DB_PATH = Path(sys.executable).parent / 'data.db'
else:
    DB_PATH = Path(__file__).resolve().parents[2] / 'data.db'
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

PRODUCTION_TEMPLATE_ID = uuid.uuid5(uuid.NAMESPACE_DNS, "template.production")


def init_db() -> None:
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())

    # Phase 1: pre-migration — migrate data from person_role before it's dropped
    from sqlalchemy import inspect as sa_inspect
    if "person" in existing_tables:
        person_cols = [c["name"] for c in sa_inspect(engine).get_columns("person")]
        if "role_code" not in person_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE person ADD COLUMN role_code TEXT NOT NULL DEFAULT ''"))
            if "person_role" in existing_tables:
                with engine.begin() as conn:
                    try:
                        conn.execute(text("""
                            UPDATE person SET role_code = (
                                SELECT role_code FROM person_role WHERE person_role.person_id = person.id LIMIT 1
                            ) WHERE role_code = ''
                        """))
                    except Exception:
                        pass

    # Phase 2: drop stale tables, create new ones
    current_tables = set(SQLModel.metadata.tables.keys())
    stale = existing_tables - current_tables
    if stale:
        with engine.begin() as conn:
            for table in stale:
                conn.execute(text(f"DROP TABLE IF EXISTS {table}"))

    SQLModel.metadata.create_all(engine)

    # Phase 3: post-migration — add missing columns on existing tables
    from sqlalchemy import inspect as sa_inspect
    col_names = [c["name"] for c in sa_inspect(engine).get_columns("project")]
    if "agreement_filename" not in col_names:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project ADD COLUMN agreement_filename TEXT NOT NULL DEFAULT ''"))
    if "workspace_key" not in [c["name"] for c in sa_inspect(engine).get_columns("role_definition")]:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE role_definition ADD COLUMN workspace_key TEXT NOT NULL DEFAULT ''"))
    if "contract_effective_date" not in [c["name"] for c in sa_inspect(engine).get_columns("project")]:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project ADD COLUMN contract_effective_date DATE"))
    if "is_rectify" not in [c["name"] for c in sa_inspect(engine).get_columns("project_phase")]:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project_phase ADD COLUMN is_rectify INTEGER NOT NULL DEFAULT 0"))
    phase_cols = [c["name"] for c in sa_inspect(engine).get_columns("project_phase")]
    if "terminal_statuses_json" not in phase_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project_phase ADD COLUMN terminal_statuses_json TEXT NOT NULL DEFAULT ''"))
    if "sub_statuses_json" not in phase_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project_phase ADD COLUMN sub_statuses_json TEXT NOT NULL DEFAULT ''"))
    tpl_cols = [c["name"] for c in sa_inspect(engine).get_columns("phase_template_item")]
    if "terminal_statuses_json" not in tpl_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE phase_template_item ADD COLUMN terminal_statuses_json TEXT NOT NULL DEFAULT ''"))
    if "contract_number" not in [c["name"] for c in sa_inspect(engine).get_columns("project")]:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project ADD COLUMN contract_number TEXT"))
    if "contract_amount" not in [c["name"] for c in sa_inspect(engine).get_columns("project")]:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project ADD COLUMN contract_amount REAL"))
    if "contract_deposit_ratio" not in [c["name"] for c in sa_inspect(engine).get_columns("project")]:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project ADD COLUMN contract_deposit_ratio REAL"))
    proj_cols2 = [c["name"] for c in sa_inspect(engine).get_columns("project")]
    if "payment_due_type" not in proj_cols2:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project ADD COLUMN payment_due_type TEXT"))
    if "payment_due_days" not in proj_cols2:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE project ADD COLUMN payment_due_days INTEGER"))
    # 删除冗余设备字段（数据在 project_equipment 中）
    proj_cols = [c["name"] for c in sa_inspect(engine).get_columns("project")]
    for col in ["equipment_category", "equipment_spec", "equipment_quantity"]:
        if col in proj_cols:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE project DROP COLUMN {col}"))
    # 添加 incident image_urls_json 字段
    inc_cols = [c["name"] for c in sa_inspect(engine).get_columns("phase_incident")]
    if "image_urls_json" not in inc_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE phase_incident ADD COLUMN image_urls_json TEXT NOT NULL DEFAULT ''"))

    from .seed import migrate_person_role, seed_default_template, seed_persons, seed_role_definitions
    migrate_person_role()
    seed_default_template()
    seed_role_definitions()
    seed_persons()


from contextlib import contextmanager

@contextmanager
def session_scope() -> Session:
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
