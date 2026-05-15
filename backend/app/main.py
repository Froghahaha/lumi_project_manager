from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, update

from .db import init_db, session_scope, PRODUCTION_TEMPLATE_ID
from .models import (
    Customer,
    Person,
    PersonRole,
    PhaseIncident,
    PhaseTemplateItem,
    Project,
    ProjectAssignment,
    ProjectPhase,
    RoleDefinition,
)
from .schemas import (
    CustomerCreate,
    CustomerOut,
    LoginRequest,
    LoginResponse,
    PersonCreate,
    PersonOut,
    PhaseIncidentCreate,
    PhaseIncidentOut,
    PhaseStatusUpdate,
    PhaseTemplateItemOut,
    PhaseTemplateOut,
    ProjectAssignmentCreate,
    ProjectAssignmentOut,
    ProjectCreate,
    ProjectOut,
    ProjectPhaseCreate,
    ProjectPhaseOut,
    ProjectUpdate,
    RoleDefinitionOut,
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_session() -> Iterable[Session]:
    with session_scope() as session:
        yield session


def get_actor(x_user: str | None = Header(default=None)) -> str:
    return x_user.strip() if x_user and x_user.strip() else "system"


# ─── Password helpers ────────────────────────────────────────

def _hash_password(password: str) -> str:
    salt = secrets.token_hex(8)
    h = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}:{h}"


def _verify_password(password: str, password_hash: str) -> bool:
    if ":" not in password_hash:
        return False
    salt, h = password_hash.split(":", 1)
    return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest() == h


def _phase_to_out(ph: ProjectPhase, session: Session | None = None) -> ProjectPhaseOut:
    incidents: list[PhaseIncidentOut] = []
    if session is not None:
        incidents = [_incident_to_out(i) for i in session.exec(
            select(PhaseIncident).where(PhaseIncident.phase_id == ph.id)
        )]
    return ProjectPhaseOut(
        id=ph.id,
        project_id=ph.project_id,
        seq=ph.seq,
        phase_name=ph.phase_name,
        sub_name=ph.sub_name,
        responsible=ph.responsible,
        status=ph.status,
        start_date=ph.start_date,
        warning_date=ph.warning_date,
        planned_end_date=ph.planned_end_date,
        planned_duration=ph.planned_duration,
        actual_end_date=ph.actual_end_date,
        actual_duration=ph.actual_duration,
        incidents=incidents,
        created_at=ph.created_at,
        updated_at=ph.updated_at,
    )


def _incident_to_out(inc: PhaseIncident) -> PhaseIncidentOut:
    return PhaseIncidentOut(
        id=inc.id,
        phase_id=inc.phase_id,
        occurred_at=inc.occurred_at,
        category=inc.category,
        description=inc.description,
        created_at=inc.created_at,
    )


def _assignment_to_out(a: ProjectAssignment) -> ProjectAssignmentOut:
    return ProjectAssignmentOut(
        id=a.id,
        project_id=a.project_id,
        person_name=a.person_name,
        role_code=a.role_code,
        phase_id=str(a.phase_id) if a.phase_id else None,
        created_at=a.created_at,
    )


def _project_to_out(p: Project, phases: list[ProjectPhase], assignments: list[ProjectAssignment], session: Session | None = None) -> ProjectOut:
    return ProjectOut(
        id=p.id,
        order_no=p.order_no,
        customer_id=p.customer_id,
        end_customer=p.end_customer,
        template_id=p.template_id,
        equipment_category=p.equipment_category,
        equipment_quantity=p.equipment_quantity,
        equipment_spec=p.equipment_spec,
        contract_start_date=p.contract_start_date,
        contract_duration_days=p.contract_duration_days,
        contract_expected_delivery_date=p.contract_expected_delivery_date,
        contract_actual_delivery_days=p.contract_actual_delivery_days,
        contract_payment_progress=p.contract_payment_progress,
        is_abnormal=p.is_abnormal,
        phases=[_phase_to_out(ph, session) for ph in phases],
        assignments=[_assignment_to_out(a) for a in assignments],
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _customer_to_out(c: Customer) -> CustomerOut:
    return CustomerOut(
        id=c.id, code=c.code, name=c.name,
        created_at=c.created_at, updated_at=c.updated_at,
    )


def _role_to_out(r: RoleDefinition) -> RoleDefinitionOut:
    return RoleDefinitionOut(
        code=r.code, name=r.name, category=r.category,
        assigns_json=r.assigns_json,
    )


def _get_or_create_customer(session: Session, code: str) -> Customer:
    customer = session.exec(select(Customer).where(Customer.code == code)).first()
    if not customer:
        customer = Customer(code=code, name=code)
        session.add(customer)
        session.flush()
    return customer


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ═══════════════════════════════════════════════════════════
# Customer
# ═══════════════════════════════════════════════════════════

@app.get("/customers", response_model=list[CustomerOut])
def list_customers(session: Session = Depends(get_session)):
    return [_customer_to_out(c) for c in session.exec(select(Customer))]


@app.post("/customers", response_model=CustomerOut, status_code=201)
def create_customer(body: CustomerCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(Customer).where(Customer.code == body.code)).first()
    if existing:
        raise HTTPException(400, "customer code already exists")
    c = Customer(code=body.code, name=body.name)
    session.add(c)
    session.flush()
    return _customer_to_out(c)


# ═══════════════════════════════════════════════════════════
# Template
# ═══════════════════════════════════════════════════════════

@app.get("/templates", response_model=list[PhaseTemplateOut])
def list_templates(session: Session = Depends(get_session)):
    from .models import PhaseTemplate
    templates = list(session.exec(select(PhaseTemplate)))
    out = []
    for t in templates:
        items = list(session.exec(
            select(PhaseTemplateItem).where(PhaseTemplateItem.template_id == t.id)
        ))
        out.append(PhaseTemplateOut(
            id=t.id,
            name=t.name,
            description=t.description,
            items=[PhaseTemplateItemOut(
                id=item.id, template_id=item.template_id,
                seq=item.seq, phase_name=item.phase_name,
                description=item.description,
                sub_statuses_json=item.sub_statuses_json,
            ) for item in sorted(items, key=lambda x: x.seq)],
            created_at=t.created_at,
            updated_at=t.updated_at,
        ))
    return out


# ═══════════════════════════════════════════════════════════
# Project CRUD
# ═══════════════════════════════════════════════════════════

@app.get("/projects", response_model=list[ProjectOut])
def list_projects(
    customer_code: str | None = Query(default=None),
    is_abnormal: bool | None = Query(default=None),
    assigned_person: str | None = Query(default=None),
    role_code: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    stmt = select(Project)
    if customer_code:
        stmt = stmt.join(Customer).where(Customer.code == customer_code)
    if is_abnormal is not None:
        stmt = stmt.where(Project.is_abnormal == is_abnormal)
    if assigned_person:
        stmt = stmt.join(ProjectAssignment, ProjectAssignment.project_id == Project.id) \
                     .where(ProjectAssignment.person_name == assigned_person)
        if role_code:
            stmt = stmt.where(ProjectAssignment.role_code == role_code)
        stmt = stmt.distinct()

    projects = list(session.exec(stmt))
    out = []
    for p in projects:
        phases = list(session.exec(
            select(ProjectPhase).where(ProjectPhase.project_id == p.id)
        ))
        team = list(session.exec(
            select(ProjectAssignment).where(ProjectAssignment.project_id == p.id)
        ))
        out.append(_project_to_out(p, phases, team, session))
    return out


@app.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: uuid.UUID, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    phases = list(session.exec(
        select(ProjectPhase).where(ProjectPhase.project_id == p.id)
    ))
    team = list(session.exec(
        select(ProjectAssignment).where(ProjectAssignment.project_id == p.id)
    ))
    return _project_to_out(p, phases, team, session)


@app.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, session: Session = Depends(get_session)):
    if body.customer_id:
        customer = session.get(Customer, body.customer_id)
        if not customer:
            raise HTTPException(400, "customer not found")
    else:
        customer_code = body.order_no.rsplit("-", 1)[0] if "-" in body.order_no else body.order_no
        customer = _get_or_create_customer(session, customer_code)

    p = Project(
        order_no=body.order_no,
        customer_id=customer.id,
        end_customer=body.end_customer,
        template_id=body.template_id,
        equipment_category=body.equipment_category,
        equipment_quantity=body.equipment_quantity,
        equipment_spec=body.equipment_spec,
        contract_start_date=body.contract_start_date,
        contract_duration_days=body.contract_duration_days,
        contract_expected_delivery_date=body.contract_expected_delivery_date,
        contract_actual_delivery_days=body.contract_actual_delivery_days,
        contract_payment_progress=body.contract_payment_progress,
        is_abnormal=body.is_abnormal,
    )
    session.add(p)
    session.flush()

    # 为每个传入的 phase 创建记录
    for ph in body.phases:
        session.add(ProjectPhase(
            project_id=p.id,
            seq=ph.seq,
            phase_name=ph.phase_name,
            responsible=ph.responsible,
            start_date=ph.start_date,
            warning_date=ph.warning_date,
            planned_end_date=ph.planned_end_date,
            planned_duration=ph.planned_duration,
            actual_end_date=ph.actual_end_date,
            actual_duration=ph.actual_duration,
        ))

    # 如果没有传入 phases，从模板自动生成
    if not body.phases and body.template_id:
        items = list(session.exec(
            select(PhaseTemplateItem).where(PhaseTemplateItem.template_id == body.template_id)
        ))
        for item in sorted(items, key=lambda x: x.seq):
            session.add(ProjectPhase(
                project_id=p.id,
                seq=item.seq,
                phase_name=item.phase_name,
            ))

    # Assignments
    for a in body.assignments:
        session.add(ProjectAssignment(
            project_id=p.id,
            person_name=a.person_name,
            role_code=a.role_code,
            target_phase_seq=a.target_phase_seq,
        ))

    session.flush()
    phases = list(session.exec(
        select(ProjectPhase).where(ProjectPhase.project_id == p.id)
    ))
    team = list(session.exec(
        select(ProjectAssignment).where(ProjectAssignment.project_id == p.id)
    ))
    return _project_to_out(p, phases, team, session)


@app.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    session: Session = Depends(get_session),
):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    if body.is_abnormal is not None:
        p.is_abnormal = body.is_abnormal
    if body.contract_payment_progress is not None:
        p.contract_payment_progress = body.contract_payment_progress
    if body.contract_actual_delivery_days is not None:
        p.contract_actual_delivery_days = body.contract_actual_delivery_days
    p.updated_at = utcnow()
    session.add(p)
    session.flush()
    phases = list(session.exec(
        select(ProjectPhase).where(ProjectPhase.project_id == p.id)
    ))
    team = list(session.exec(
        select(ProjectAssignment).where(ProjectAssignment.project_id == p.id)
    ))
    return _project_to_out(p, phases, team, session)


@app.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: uuid.UUID, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    for a in session.exec(select(ProjectAssignment).where(ProjectAssignment.project_id == project_id)):
        session.delete(a)
    for ph in session.exec(select(ProjectPhase).where(ProjectPhase.project_id == project_id)):
        for inc in session.exec(select(PhaseIncident).where(PhaseIncident.phase_id == ph.id)):
            session.delete(inc)
        session.delete(ph)
    session.delete(p)


# ═══════════════════════════════════════════════════════════
# Phases (nested under project)
# ═══════════════════════════════════════════════════════════

@app.get("/projects/{project_id}/phases", response_model=list[ProjectPhaseOut])
def list_phases(project_id: uuid.UUID, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    phases = list(session.exec(
        select(ProjectPhase).where(ProjectPhase.project_id == project_id)
    ))
    return [_phase_to_out(ph, session) for ph in sorted(phases, key=lambda x: x.seq)]


@app.post("/projects/{project_id}/phases", response_model=ProjectPhaseOut, status_code=201)
def add_phase(project_id: uuid.UUID, body: ProjectPhaseCreate, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    ph = ProjectPhase(
        project_id=project_id,
        seq=body.seq,
        phase_name=body.phase_name,
        sub_name=body.sub_name,
        responsible=body.responsible,
        status=body.status,
        start_date=body.start_date,
        warning_date=body.warning_date,
        planned_end_date=body.planned_end_date,
        planned_duration=body.planned_duration,
        actual_end_date=body.actual_end_date,
        actual_duration=body.actual_duration,
    )
    session.add(ph)
    session.flush()

    for inc in body.incidents:
        session.add(PhaseIncident(
            phase_id=ph.id,
            occurred_at=inc.occurred_at,
            category=inc.category,
            description=inc.description,
        ))

    return _phase_to_out(ph, session)


@app.patch("/projects/{project_id}/phases/{phase_id}", response_model=ProjectPhaseOut)
def update_phase(
    project_id: uuid.UUID,
    phase_id: uuid.UUID,
    body: ProjectPhaseCreate,
    session: Session = Depends(get_session),
):
    ph = session.get(ProjectPhase, phase_id)
    if not ph or ph.project_id != project_id:
        raise HTTPException(404, "phase not found")
    if body.seq is not None:
        ph.seq = body.seq
    if body.phase_name is not None:
        ph.phase_name = body.phase_name
    if body.sub_name is not None:
        ph.sub_name = body.sub_name
    if body.responsible is not None:
        ph.responsible = body.responsible
    if body.status is not None:
        ph.status = body.status
    ph.start_date = body.start_date
    ph.warning_date = body.warning_date
    ph.planned_end_date = body.planned_end_date
    ph.planned_duration = body.planned_duration
    ph.actual_end_date = body.actual_end_date
    ph.actual_duration = body.actual_duration
    ph.updated_at = utcnow()
    session.add(ph)
    return _phase_to_out(ph, session)


@app.delete("/projects/{project_id}/phases/{phase_id}", status_code=204)
def delete_phase(project_id: uuid.UUID, phase_id: uuid.UUID, session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph or ph.project_id != project_id:
        raise HTTPException(404, "phase not found")
    for inc in session.exec(select(PhaseIncident).where(PhaseIncident.phase_id == phase_id)):
        session.delete(inc)
    session.delete(ph)


# ═══════════════════════════════════════════════════════════
# Phases (global)
# ═══════════════════════════════════════════════════════════

@app.get("/phases", response_model=list[ProjectPhaseOut])
def list_phases_global(
    responsible: str | None = Query(default=None),
    project_id: uuid.UUID | None = Query(default=None),
    session: Session = Depends(get_session),
):
    stmt = select(ProjectPhase)
    if responsible:
        stmt = stmt.where(ProjectPhase.responsible == responsible)
    if project_id:
        stmt = stmt.where(ProjectPhase.project_id == project_id)
    phases = list(session.exec(stmt))
    return [_phase_to_out(ph, session) for ph in sorted(phases, key=lambda x: (x.project_id, x.seq))]


@app.get("/phases/{phase_id}", response_model=ProjectPhaseOut)
def get_phase(phase_id: uuid.UUID, session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph:
        raise HTTPException(404, "phase not found")
    return _phase_to_out(ph, session)


@app.patch("/phases/{phase_id}/status", response_model=ProjectPhaseOut)
def update_phase_status(phase_id: uuid.UUID, body: PhaseStatusUpdate, session: Session = Depends(get_session)):
    import json
    ph = session.get(ProjectPhase, phase_id)
    if not ph:
        raise HTTPException(404, "phase not found")
    # 验证状态是否在模板定义的子状态列表中
    project = session.get(Project, ph.project_id)
    if project and project.template_id:
        items = session.exec(
            select(PhaseTemplateItem).where(
                PhaseTemplateItem.template_id == project.template_id,
                PhaseTemplateItem.seq == ph.seq,
            )
        ).all()
        if items and items[0].sub_statuses_json:
            valid = json.loads(items[0].sub_statuses_json)
            if valid and body.status not in valid:
                raise HTTPException(400, f"无效状态 '{body.status}'，有效选项: {valid}")
    ph.status = body.status
    ph.updated_at = utcnow()
    session.add(ph)
    return _phase_to_out(ph, session)


# ═══════════════════════════════════════════════════════════
# Incidents (nested under phase)
# ═══════════════════════════════════════════════════════════

@app.get("/phases/{phase_id}/incidents", response_model=list[PhaseIncidentOut])
def list_incidents(phase_id: uuid.UUID, session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph:
        raise HTTPException(404, "phase not found")
    return [_incident_to_out(i) for i in session.exec(
        select(PhaseIncident).where(PhaseIncident.phase_id == phase_id)
    )]


@app.post("/phases/{phase_id}/incidents", response_model=PhaseIncidentOut, status_code=201)
def add_incident(phase_id: uuid.UUID, body: PhaseIncidentCreate, session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph:
        raise HTTPException(404, "phase not found")
    inc = PhaseIncident(
        phase_id=phase_id,
        occurred_at=body.occurred_at,
        category=body.category,
        description=body.description,
    )
    session.add(inc)
    session.flush()
    return _incident_to_out(inc)


@app.delete("/phases/{phase_id}/incidents/{incident_id}", status_code=204)
def delete_incident(phase_id: uuid.UUID, incident_id: uuid.UUID, session: Session = Depends(get_session)):
    inc = session.get(PhaseIncident, incident_id)
    if not inc or inc.phase_id != phase_id:
        raise HTTPException(404, "incident not found")
    session.delete(inc)


# ═══════════════════════════════════════════════════════════
# Roles
# ═══════════════════════════════════════════════════════════

@app.get("/roles", response_model=list[RoleDefinitionOut])
def list_roles(session: Session = Depends(get_session)):
    return [_role_to_out(r) for r in session.exec(select(RoleDefinition))]


# ═══════════════════════════════════════════════════════════
# Assignments
# ═══════════════════════════════════════════════════════════

@app.get("/projects/{project_id}/assignments", response_model=list[ProjectAssignmentOut])
def list_assignments(project_id: uuid.UUID, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    return [_assignment_to_out(a) for a in session.exec(
        select(ProjectAssignment).where(ProjectAssignment.project_id == project_id)
    )]


@app.post("/projects/{project_id}/assignments", response_model=ProjectAssignmentOut, status_code=201)
def add_assignment(project_id: uuid.UUID, body: ProjectAssignmentCreate, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    role = session.get(RoleDefinition, body.role_code)
    if not role:
        raise HTTPException(400, f"invalid role_code: {body.role_code}")
    ph_id = uuid.UUID(body.phase_id) if body.phase_id else None
    if ph_id:
        ph = session.get(ProjectPhase, ph_id)
        if not ph or ph.project_id != project_id:
            raise HTTPException(400, "phase not found or not in this project")
    a = ProjectAssignment(
        project_id=project_id,
        person_name=body.person_name,
        role_code=body.role_code,
        phase_id=ph_id,
    )
    session.add(a)
    session.flush()
    return _assignment_to_out(a)


@app.delete("/projects/{project_id}/assignments/{assignment_id}", status_code=204)
def remove_assignment(project_id: uuid.UUID, assignment_id: uuid.UUID, session: Session = Depends(get_session)):
    a = session.get(ProjectAssignment, assignment_id)
    if not a or a.project_id != project_id:
        raise HTTPException(404, "assignment not found")
    session.delete(a)


# ═══════════════════════════════════════════════════════════
# Assignments (global)
# ═══════════════════════════════════════════════════════════

@app.get("/assignments", response_model=list[ProjectAssignmentOut])
def list_assignments_global(
    person_name: str | None = Query(default=None),
    role_code: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    stmt = select(ProjectAssignment)
    if person_name:
        stmt = stmt.where(ProjectAssignment.person_name == person_name)
    if role_code:
        stmt = stmt.where(ProjectAssignment.role_code == role_code)
    return [_assignment_to_out(a) for a in session.exec(stmt)]


# ═══════════════════════════════════════════════════════════
# Persons
# ═══════════════════════════════════════════════════════════

def _person_to_out(p: Person, session: Session) -> PersonOut:
    roles = [pr.role_code for pr in session.exec(
        select(PersonRole).where(PersonRole.person_id == p.id)
    )]
    return PersonOut(
        id=p.id, name=p.name, department=p.department,
        is_active=p.is_active, roles=roles, created_at=p.created_at,
    )


@app.get("/persons", response_model=list[PersonOut])
def list_persons(
    role_code: str | None = Query(default=None),
    session: Session = Depends(get_session),
):
    stmt = select(Person)
    if role_code:
        stmt = stmt.join(PersonRole, PersonRole.person_id == Person.id).where(PersonRole.role_code == role_code).distinct()
    persons = list(session.exec(stmt))
    return [_person_to_out(p, session) for p in persons]


@app.post("/persons", response_model=PersonOut, status_code=201)
def create_person(body: PersonCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(Person).where(Person.name == body.name)).first()
    if existing:
        raise HTTPException(400, "person already exists")
    p = Person(name=body.name, department=body.department)
    session.add(p)
    session.flush()
    for rc in body.roles:
        role = session.get(RoleDefinition, rc)
        if not role:
            raise HTTPException(400, f"invalid role_code: {rc}")
        session.add(PersonRole(person_id=p.id, role_code=rc))
    session.flush()
    return _person_to_out(p, session)


@app.patch("/persons/{person_id}", response_model=PersonOut)
def update_person(person_id: uuid.UUID, body: PersonCreate, session: Session = Depends(get_session)):
    p = session.get(Person, person_id)
    if not p:
        raise HTTPException(404, "person not found")
    if body.name:
        p.name = body.name
    if body.department:
        p.department = body.department
    # 替换角色列表
    existing_roles = list(session.exec(select(PersonRole).where(PersonRole.person_id == person_id)))
    for pr in existing_roles:
        session.delete(pr)
    for rc in body.roles:
        role = session.get(RoleDefinition, rc)
        if not role:
            raise HTTPException(400, f"invalid role_code: {rc}")
        session.add(PersonRole(person_id=person_id, role_code=rc))
    session.add(p)
    session.flush()
    return _person_to_out(p, session)


# ═══════════════════════════════════════════════════════════
# Auth / Login
# ═══════════════════════════════════════════════════════════

@app.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    person = session.exec(select(Person).where(Person.name == body.person_name)).first()
    if not person:
        raise HTTPException(401, "人员不存在")
    if not _verify_password(body.password, person.password_hash):
        raise HTTPException(401, "密码错误")
    token = secrets.token_hex(32)
    person_out = _person_to_out(person, session)
    return LoginResponse(person=person_out, token=token)
