"""Seed data — templates, roles, persons. 每次启动覆盖写入，db.py 是唯一配置源."""

from .db import PRODUCTION_TEMPLATE_ID, engine
from sqlmodel import Session, select


def _hash_password(password: str) -> str:
    import hashlib
    import secrets
    salt = secrets.token_hex(8)
    h = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}:{h}"


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

SEED_PERSONS = [
    ("超级管理员", "管理部", "admin"),
    ("技术主管",   "技术部", "tech_supervisor"),
    ("售后主管",   "售后部", "after_sales_super"),
    ("销售助理",   "销售部", "sales_assistant"),
]


def seed_default_template() -> None:
    from .models import PhaseTemplate, PhaseTemplateItem, ProjectPhase

    with Session(engine) as session:
        tmpl = session.get(PhaseTemplate, PRODUCTION_TEMPLATE_ID)
        if not tmpl:
            tmpl = PhaseTemplate(
                id=PRODUCTION_TEMPLATE_ID,
                name="生产项目模板",
                description="标准生产项目 4 阶段: 机械设计->生产->调机->尾款",
            )
            session.add(tmpl)
            session.flush()

        # 覆盖写入模板项
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
                              sub_statuses_json='["未开始", "安调中", "安调完成", "验收完成"]',
                              terminal_statuses_json='["验收完成"]'),
            PhaseTemplateItem(template_id=tmpl.id, seq=4, phase_name="尾款",
                              sub_statuses_json='["收款中", "收款完成"]',
                              terminal_statuses_json='["收款完成"]'),
        ]
        for it in items:
            session.add(it)
        session.flush()

        # 同步存量项目阶段
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


def seed_role_definitions() -> None:
    from .models import RoleDefinition
    import json

    with Session(engine) as session:
        existing = session.get(RoleDefinition, "admin")
        if not existing:
            for rd in ROLE_DEFINITIONS:
                session.add(RoleDefinition(
                    code=rd["code"], name=rd["name"], category=rd["category"],
                    workspace_key=rd.get("workspace", ""),
                    assigns_json=json.dumps(rd.get("assigns", []), ensure_ascii=False) if rd.get("assigns") else None,
                ))
        else:
            for rd in ROLE_DEFINITIONS:
                role = session.get(RoleDefinition, rd["code"])
                if not role:
                    session.add(RoleDefinition(
                        code=rd["code"], name=rd["name"], category=rd["category"],
                        workspace_key=rd.get("workspace", ""),
                        assigns_json=json.dumps(rd.get("assigns", []), ensure_ascii=False) if rd.get("assigns") else None,
                    ))
                elif not role.workspace_key:
                    role.workspace_key = rd.get("workspace", "")
                    session.add(role)
        session.commit()


def seed_persons() -> None:
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


def migrate_person_role() -> None:
    from .models import Person, PersonRole

    with Session(engine) as session:
        existing = session.exec(select(PersonRole).limit(1)).first()
        if existing:
            return
        persons = session.exec(select(Person)).all()
        for p in persons:
            if p.role_code:
                session.add(PersonRole(person_id=p.id, role_code=p.role_code))
            if p.department == "售后部" and p.role_code != "after_sales_super":
                other = "acceptance_executor" if p.role_code == "tuning_executor" else "tuning_executor"
                session.add(PersonRole(person_id=p.id, role_code=other))
        session.commit()
