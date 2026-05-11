from __future__ import annotations

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
    PhaseIncident,
    PhaseTemplateItem,
    Project,
    ProjectPhase,
    ProjectTeam,
)
from .schemas import (
    CustomerCreate,
    CustomerOut,
    PhaseIncidentCreate,
    PhaseIncidentOut,
    PhaseTemplateItemOut,
    PhaseTemplateOut,
    ProjectCreate,
    ProjectOut,
    ProjectPhaseCreate,
    ProjectPhaseOut,
    ProjectTeamCreate,
    ProjectTeamOut,
    ProjectUpdate,
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


def _phase_to_out(ph: ProjectPhase) -> ProjectPhaseOut:
    return ProjectPhaseOut(
        id=ph.id,
        project_id=ph.project_id,
        seq=ph.seq,
        phase_name=ph.phase_name,
        responsible=ph.responsible,
        start_date=ph.start_date,
        warning_date=ph.warning_date,
        planned_end_date=ph.planned_end_date,
        planned_duration=ph.planned_duration,
        actual_end_date=ph.actual_end_date,
        actual_duration=ph.actual_duration,
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


def _team_to_out(tm: ProjectTeam) -> ProjectTeamOut:
    return ProjectTeamOut(
        id=tm.id,
        project_id=tm.project_id,
        person_name=tm.person_name,
        role=tm.role,
        created_at=tm.created_at,
    )


def _project_to_out(p: Project, phases: list[ProjectPhase], team: list[ProjectTeam]) -> ProjectOut:
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
        phases=[_phase_to_out(ph) for ph in phases],
        team=[_team_to_out(tm) for tm in team],
        created_at=p.created_at,
        updated_at=p.updated_at,
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
    return list(session.exec(select(Customer)))


@app.post("/customers", response_model=CustomerOut, status_code=201)
def create_customer(body: CustomerCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(Customer).where(Customer.code == body.code)).first()
    if existing:
        raise HTTPException(400, "customer code already exists")
    c = Customer(code=body.code, name=body.name)
    session.add(c)
    return c


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
    session: Session = Depends(get_session),
):
    stmt = select(Project)
    if customer_code:
        stmt = stmt.join(Customer).where(Customer.code == customer_code)
    if is_abnormal is not None:
        stmt = stmt.where(Project.is_abnormal == is_abnormal)

    projects = list(session.exec(stmt))
    out = []
    for p in projects:
        phases = list(session.exec(
            select(ProjectPhase).where(ProjectPhase.project_id == p.id)
        ))
        team = list(session.exec(
            select(ProjectTeam).where(ProjectTeam.project_id == p.id)
        ))
        out.append(_project_to_out(p, phases, team))
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
        select(ProjectTeam).where(ProjectTeam.project_id == p.id)
    ))
    return _project_to_out(p, phases, team)


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

    # Team
    for tm in body.team:
        session.add(ProjectTeam(
            project_id=p.id,
            person_name=tm.person_name,
            role=tm.role,
        ))

    session.flush()
    phases = list(session.exec(
        select(ProjectPhase).where(ProjectPhase.project_id == p.id)
    ))
    team = list(session.exec(
        select(ProjectTeam).where(ProjectTeam.project_id == p.id)
    ))
    return _project_to_out(p, phases, team)


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
        select(ProjectTeam).where(ProjectTeam.project_id == p.id)
    ))
    return _project_to_out(p, phases, team)


@app.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: uuid.UUID, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
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
    return [_phase_to_out(ph) for ph in sorted(phases, key=lambda x: x.seq)]


@app.post("/projects/{project_id}/phases", response_model=ProjectPhaseOut, status_code=201)
def add_phase(project_id: uuid.UUID, body: ProjectPhaseCreate, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    ph = ProjectPhase(
        project_id=project_id,
        seq=body.seq,
        phase_name=body.phase_name,
        responsible=body.responsible,
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

    return _phase_to_out(ph)


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
    if body.responsible is not None:
        ph.responsible = body.responsible
    ph.start_date = body.start_date
    ph.warning_date = body.warning_date
    ph.planned_end_date = body.planned_end_date
    ph.planned_duration = body.planned_duration
    ph.actual_end_date = body.actual_end_date
    ph.actual_duration = body.actual_duration
    ph.updated_at = utcnow()
    session.add(ph)
    return _phase_to_out(ph)


@app.delete("/projects/{project_id}/phases/{phase_id}", status_code=204)
def delete_phase(project_id: uuid.UUID, phase_id: uuid.UUID, session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph or ph.project_id != project_id:
        raise HTTPException(404, "phase not found")
    session.delete(ph)


# ═══════════════════════════════════════════════════════════
# Incidents (nested under phase)
# ═══════════════════════════════════════════════════════════

@app.get("/phases/{phase_id}/incidents", response_model=list[PhaseIncidentOut])
def list_incidents(phase_id: uuid.UUID, session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph:
        raise HTTPException(404, "phase not found")
    return list(session.exec(
        select(PhaseIncident).where(PhaseIncident.phase_id == phase_id)
    ))


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
# Team
# ═══════════════════════════════════════════════════════════

@app.get("/projects/{project_id}/team", response_model=list[ProjectTeamOut])
def list_team(project_id: uuid.UUID, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    return list(session.exec(
        select(ProjectTeam).where(ProjectTeam.project_id == project_id)
    ))


@app.post("/projects/{project_id}/team", response_model=ProjectTeamOut, status_code=201)
def add_team_member(project_id: uuid.UUID, body: ProjectTeamCreate, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    tm = ProjectTeam(project_id=project_id, person_name=body.person_name, role=body.role)
    session.add(tm)
    session.flush()
    return _team_to_out(tm)


@app.delete("/projects/{project_id}/team/{team_id}", status_code=204)
def remove_team_member(project_id: uuid.UUID, team_id: uuid.UUID, session: Session = Depends(get_session)):
    tm = session.get(ProjectTeam, team_id)
    if not tm or tm.project_id != project_id:
        raise HTTPException(404, "team member not found")
    session.delete(tm)
