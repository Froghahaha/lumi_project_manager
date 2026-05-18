"""pytest fixtures — temp-file SQLite & FastAPI TestClient."""

import os
import tempfile
import uuid
from typing import Iterable

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from backend.app.db import PRODUCTION_TEMPLATE_ID, _hash_password
from backend.app.main import app, get_session

# Prevent the real init_db from running during tests
import backend.app.db as db_module
db_module.init_db = lambda: None  # no-op

# Register all tables in SQLModel.metadata
from backend.app import models  # noqa: F401


def _seed_test_data(engine):
    """Minimal seed data for tests."""
    from sqlmodel import select
    from backend.app.models import RoleDefinition, Person, PersonRole, PhaseTemplate, PhaseTemplateItem, Customer

    with Session(engine) as session:
        # Role definitions
        if not session.get(RoleDefinition, "admin"):
            roles = [
                RoleDefinition(code="admin", name="超级管理员", category="admin", workspace_key="admin"),
                RoleDefinition(code="tech_supervisor", name="技术主管", category="supervisor",
                               workspace_key="supervisor",
                               assigns_json='["project_manager","mechanical_designer","production_executor"]'),
                RoleDefinition(code="after_sales_super", name="售后主管", category="supervisor",
                               workspace_key="after_sales",
                               assigns_json='["tuning_executor"]'),
                RoleDefinition(code="project_manager", name="项目经理", category="executor", workspace_key="pm"),
                RoleDefinition(code="salesman", name="销售", category="executor", workspace_key="sales"),
                RoleDefinition(code="sales_assistant", name="销售助理", category="executor", workspace_key="sales"),
                RoleDefinition(code="mechanical_designer", name="机械设计执行人", category="executor", workspace_key="execution"),
                RoleDefinition(code="software_designer", name="软件设计执行人", category="executor", workspace_key="software"),
                RoleDefinition(code="production_executor", name="生产执行人", category="executor", workspace_key="execution"),
                RoleDefinition(code="tuning_executor", name="安调执行人", category="executor", workspace_key="execution"),
            ]
            for r in roles:
                session.add(r)

        # Persons
        existing = session.exec(select(Person)).first()
        if not existing:
            pw = _hash_password("123456")
            persons = [
                Person(id=uuid.UUID("00000000-0000-0000-0000-000000000001"), name="超级管理员", department="管理部", password_hash=pw),
                Person(id=uuid.UUID("00000000-0000-0000-0000-000000000002"), name="技术主管", department="技术部", password_hash=pw),
                Person(id=uuid.UUID("00000000-0000-0000-0000-000000000003"), name="王文哲", department="技术部", password_hash=pw),
            ]
            for p in persons:
                session.add(p)
            session.add(PersonRole(person_id=persons[0].id, role_code="admin"))
            session.add(PersonRole(person_id=persons[1].id, role_code="tech_supervisor"))
            session.add(PersonRole(person_id=persons[2].id, role_code="project_manager"))
            session.add(PersonRole(person_id=persons[2].id, role_code="mechanical_designer"))

        # Template
        if not session.get(PhaseTemplate, PRODUCTION_TEMPLATE_ID):
            tmpl = PhaseTemplate(id=PRODUCTION_TEMPLATE_ID, name="生产项目模板", description="标准模板")
            session.add(tmpl)
            items = [
                PhaseTemplateItem(template_id=tmpl.id, seq=1, phase_name="机械设计", sub_statuses_json='["未开始","设计中","图纸已下发"]'),
                PhaseTemplateItem(template_id=tmpl.id, seq=2, phase_name="生产", sub_statuses_json='["未开始","生产中","生产完成","已发货"]'),
                PhaseTemplateItem(template_id=tmpl.id, seq=3, phase_name="调机", sub_statuses_json='["未开始","安调中","安调完成"]'),
                PhaseTemplateItem(template_id=tmpl.id, seq=4, phase_name="验收", sub_statuses_json='["未开始","已验收"]'),
                PhaseTemplateItem(template_id=tmpl.id, seq=5, phase_name="尾款", sub_statuses_json="[]"),
            ]
            for it in items:
                session.add(it)

        # Customer
        if not session.exec(select(Customer)).first():
            session.add(Customer(id=uuid.UUID("00000000-0000-0000-0000-000000000010"), code="TEST", name="测试客户"))

        session.commit()


def _make_session_override():
    """Return a get_session override bound to the current test's engine."""
    engine = getattr(_make_session_override, "_engine", None)
    if engine is None:
        raise RuntimeError("no test engine — _setup_db didn't run")

    def _override() -> Iterable[Session]:
        with Session(engine) as session:
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise

    return _override


@pytest.fixture(autouse=True)
def _setup_db():
    """Before each test: create tables + seed data in a temp SQLite file."""
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    _seed_test_data(engine)

    # Store engine for _make_session_override to pick up
    _make_session_override._engine = engine
    yield
    engine.dispose()
    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture
def client():
    """FastAPI TestClient with overridden DB session."""
    app.dependency_overrides[get_session] = _make_session_override()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client) -> dict:
    """Login as admin and return auth headers."""
    resp = client.post("/login", json={"person_name": "超级管理员", "password": "123456"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}
