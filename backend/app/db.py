from __future__ import annotations

import hashlib
import secrets
import uuid
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine, select

# Ensure all models are registered in SQLModel.metadata before create_all
from . import models  # noqa: F401

DB_PATH = Path(__file__).resolve().parents[2] / "data.db"
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
    # 删除冗余设备字段（数据在 project_equipment 中）
    proj_cols = [c["name"] for c in sa_inspect(engine).get_columns("project")]
    for col in ["equipment_category", "equipment_spec", "equipment_quantity"]:
        if col in proj_cols:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE project DROP COLUMN {col}"))

    _migrate_person_role()
    _seed_default_template()
    _seed_role_definitions()
    _seed_persons()


def _seed_default_template() -> None:
    from .models import PhaseTemplate, PhaseTemplateItem

    with Session(engine) as session:
        tmpl = session.get(PhaseTemplate, PRODUCTION_TEMPLATE_ID)
        if not tmpl:
            tmpl = PhaseTemplate(
                id=PRODUCTION_TEMPLATE_ID,
                name="生产项目模板",
                description="标准生产项目 5 阶段: 机械设计->生产->调机->验收->尾款",
            )
            session.add(tmpl)
            session.flush()

        # 覆盖写入模板项（保证 db.py 是单一配置源）
        old_items = session.exec(
            select(PhaseTemplateItem).where(PhaseTemplateItem.template_id == PRODUCTION_TEMPLATE_ID)
        ).all()
        for o in old_items:
            session.delete(o)

        items = [
            PhaseTemplateItem(template_id=tmpl.id, seq=1, phase_name="机械设计",
                              sub_statuses_json='["未开始", "设计中", "图纸已下发"]',
                              terminal_statuses_json='["图纸已下发"]'),
            PhaseTemplateItem(template_id=tmpl.id, seq=2, phase_name="生产",
                              sub_statuses_json='["未开始", "生产中", "生产完成", "已发货"]',
                              terminal_statuses_json='["已发货"]'),
            PhaseTemplateItem(template_id=tmpl.id, seq=3, phase_name="调机",
                              sub_statuses_json='["未开始", "安调中", "安调完成"]',
                              terminal_statuses_json='["安调完成"]'),
            PhaseTemplateItem(template_id=tmpl.id, seq=4, phase_name="验收",
                              sub_statuses_json='["未开始", "已验收"]',
                              terminal_statuses_json='["已验收"]'),
            PhaseTemplateItem(template_id=tmpl.id, seq=5, phase_name="尾款",
                              sub_statuses_json='["收款中", "收款完成"]',
                              terminal_statuses_json='["收款完成"]'),
        ]
        for it in items:
            session.add(it)
        session.flush()

        # 同步存量项目阶段（保证 db.py 是单一配置源）
        from .models import ProjectPhase
        for item in items:
            phases = session.exec(
                select(ProjectPhase).where(
                    ProjectPhase.phase_name == item.phase_name,
                    (ProjectPhase.terminal_statuses_json != item.terminal_statuses_json) |
                    (ProjectPhase.sub_statuses_json != item.sub_statuses_json),
                )
            ).all()
            for ph in phases:
                ph.sub_statuses_json = item.sub_statuses_json
                ph.terminal_statuses_json = item.terminal_statuses_json
                session.add(ph)
        session.commit()


ROLE_DEFINITIONS = [
    {"code": "admin",              "name": "超级管理员",       "category": "admin",      "workspace": "admin"},
    {"code": "tech_supervisor",    "name": "技术主管",         "category": "supervisor", "workspace": "supervisor",
     "assigns": ["project_manager", "mechanical_designer", "software_designer", "production_executor"]},
    {"code": "after_sales_super",  "name": "售后主管",         "category": "supervisor", "workspace": "after_sales",
     "assigns": ["tuning_executor", "acceptance_executor"]},
    {"code": "project_manager",    "name": "项目经理",         "category": "executor",   "workspace": "pm"},
    {"code": "salesman",           "name": "销售",             "category": "executor",   "workspace": "sales"},
    {"code": "sales_assistant",    "name": "销售助理",         "category": "executor",   "workspace": "sales"},
    {"code": "mechanical_designer","name": "机械设计执行人",   "category": "executor",   "workspace": "execution"},
    {"code": "software_designer",  "name": "软件设计执行人",   "category": "executor",   "workspace": "software"},
    {"code": "production_executor","name": "生产执行人",       "category": "executor",   "workspace": "execution"},
    {"code": "tuning_executor",    "name": "安调执行人",       "category": "executor",   "workspace": "execution"},
    {"code": "acceptance_executor","name": "验收执行人",       "category": "executor",   "workspace": "execution"},
]


def _seed_role_definitions() -> None:
    from .models import RoleDefinition

    with Session(engine) as session:
        existing = session.get(RoleDefinition, "admin")
        if not existing:
            # First time: insert all role definitions
            for rd in ROLE_DEFINITIONS:
                import json
                session.add(RoleDefinition(
                    code=rd["code"],
                    name=rd["name"],
                    category=rd["category"],
                    workspace_key=rd.get("workspace", ""),
                    assigns_json=json.dumps(rd.get("assigns", []), ensure_ascii=False) if rd.get("assigns") else None,
                ))
        else:
            # Update: sync workspace_key + add any new roles
            import json
            for rd in ROLE_DEFINITIONS:
                role = session.get(RoleDefinition, rd["code"])
                if not role:
                    session.add(RoleDefinition(
                        code=rd["code"],
                        name=rd["name"],
                        category=rd["category"],
                        workspace_key=rd.get("workspace", ""),
                        assigns_json=json.dumps(rd.get("assigns", []), ensure_ascii=False) if rd.get("assigns") else None,
                    ))
                elif not role.workspace_key:
                    role.workspace_key = rd.get("workspace", "")
                    session.add(role)
        session.commit()


def _migrate_person_role() -> None:
    """Backfill person_role from person.role_code for existing data."""
    from .models import Person, PersonRole

    with Session(engine) as session:
        existing = session.exec(select(PersonRole).limit(1)).first()
        if existing:
            return  # already has data, skip

        persons = session.exec(select(Person)).all()
        for p in persons:
            if p.role_code:
                session.add(PersonRole(person_id=p.id, role_code=p.role_code))
            # 售后部人员同时拥有两个执行人角色
            if p.department == "售后部" and p.role_code != "after_sales_super":
                other = "acceptance_executor" if p.role_code == "tuning_executor" else "tuning_executor"
                session.add(PersonRole(person_id=p.id, role_code=other))
        session.commit()


SEED_PERSONS = [
    ("超级管理员", "管理部", "admin"),
    ("技术主管",   "技术部", "tech_supervisor"),
    ("售后主管",   "售后部", "after_sales_super"),
    ("销售助理",   "销售部", "sales_assistant"),
]


def _seed_persons() -> None:
    from .models import Person, PersonRole

    with Session(engine) as session:
        existing = session.exec(select(Person)).first()
        if existing:
            return

        default_hash = _hash_password("123456")

        for name, dept, role_code in SEED_PERSONS:
            p = Person(name=name, department=dept, role_code=role_code, password_hash=default_hash)
            session.add(p)
            session.flush()
            session.add(PersonRole(person_id=p.id, role_code=role_code))
        session.commit()


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(8)
    h = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}:{h}"


@contextmanager
def session_scope() -> Session:
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
