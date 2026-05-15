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
    _seed_role_definitions()
    _seed_persons()


def _seed_default_template() -> None:
    from .models import PhaseTemplate, PhaseTemplateItem

    with Session(engine) as session:
        existing = session.get(PhaseTemplate, PRODUCTION_TEMPLATE_ID)
        if existing:
            return

        tmpl = PhaseTemplate(
            id=PRODUCTION_TEMPLATE_ID,
            name="生产项目模板",
            description="标准生产项目 5 阶段: 机械设计->生产->调机->验收->尾款",
        )
        items = [
            PhaseTemplateItem(template_id=tmpl.id, seq=1, phase_name="机械设计",
                              sub_statuses_json='["未开始", "设计中", "图纸已下发"]'),
            PhaseTemplateItem(template_id=tmpl.id, seq=2, phase_name="生产",
                              sub_statuses_json='["未开始", "生产中", "生产完成", "已发货"]'),
            PhaseTemplateItem(template_id=tmpl.id, seq=3, phase_name="调机",
                              sub_statuses_json='["未开始", "安调中", "安调完成"]'),
            PhaseTemplateItem(template_id=tmpl.id, seq=4, phase_name="验收",
                              sub_statuses_json='["未开始", "已验收"]'),
            PhaseTemplateItem(template_id=tmpl.id, seq=5, phase_name="尾款",
                              sub_statuses_json="[]"),
        ]
        session.add(tmpl)
        for it in items:
            session.add(it)
        session.commit()


ROLE_DEFINITIONS = [
    {"code": "admin",              "name": "超级管理员",       "category": "admin"},
    {"code": "tech_supervisor",    "name": "技术主管",         "category": "supervisor",
     "assigns": ["project_manager", "mechanical_designer", "software_designer", "production_executor"]},
    {"code": "after_sales_super",  "name": "售后主管",         "category": "supervisor",
     "assigns": ["tuning_executor"]},
    {"code": "project_manager",    "name": "项目经理",         "category": "executor"},
    {"code": "sales_assistant",    "name": "销售助理",         "category": "executor"},
    {"code": "mechanical_designer","name": "机械设计执行人",   "category": "executor"},
    {"code": "software_designer",  "name": "软件设计执行人",   "category": "executor"},
    {"code": "production_executor","name": "生产执行人",       "category": "executor"},
    {"code": "tuning_executor",    "name": "安调执行人",       "category": "executor"},
]


def _seed_role_definitions() -> None:
    from .models import RoleDefinition

    with Session(engine) as session:
        existing = session.get(RoleDefinition, "admin")
        if existing:
            return

        for rd in ROLE_DEFINITIONS:
            import json
            session.add(RoleDefinition(
                code=rd["code"],
                name=rd["name"],
                category=rd["category"],
                assigns_json=json.dumps(rd.get("assigns", []), ensure_ascii=False) if rd.get("assigns") else None,
            ))
        session.commit()


SEED_PERSONS = [
    # 基础角色人员（姓名即角色）
    ("超级管理员", "管理部", ["admin"]),
    ("技术主管",   "技术部", ["tech_supervisor"]),
    ("售后主管",   "售后部", ["after_sales_super"]),
    ("销售助理",   "销售部", ["sales_assistant"]),
    # 实际执行人员
    ("王文哲", "技术部", ["project_manager", "mechanical_designer"]),
    ("张胡斌", "技术部", ["project_manager", "production_executor"]),
    ("闫凯",   "技术部", ["software_designer"]),
    ("王航炜", "生产部", ["production_executor", "tuning_executor"]),
    ("柳轩洋", "售后部", ["tuning_executor"]),
    ("涂志鹏", "技术部", ["mechanical_designer"]),
    ("张玉龙", "技术部", ["mechanical_designer"]),
    ("余皓然", "技术部", ["mechanical_designer"]),
    ("李枷明", "技术部", ["mechanical_designer"]),
    ("刘伟伟", "销售部", []),
    ("周小浪", "生产部", ["production_executor"]),
    ("赵建国", "售后部", ["tuning_executor"]),
    ("钱学森", "技术部", ["software_designer"]),
    ("孙志远", "技术部", ["project_manager"]),
    ("李明亮", "生产部", ["production_executor"]),
    ("周大福", "销售部", []),
]


def _seed_persons() -> None:
    from .models import Person, PersonRole

    with Session(engine) as session:
        existing = session.exec(select(Person)).first()
        if existing:
            return

        default_hash = _hash_password("123456")

        for name, dept, roles in SEED_PERSONS:
            p = Person(name=name, department=dept, password_hash=default_hash)
            session.add(p)
            session.flush()
            for rc in roles:
                session.add(PersonRole(person_id=p.id, role_code=rc))
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
