"""Project CRUD, phases, assignments, agreements — /projects"""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from ..deps import AGREEMENT_DIR, deny_salesman, get_current_user, get_session, require_permission, utcnow
from ..db import PRODUCTION_TEMPLATE_ID
from ..models import (
    Customer,
    PhaseIncident,
    PhaseTemplateItem,
    Project,
    ProjectAssignment,
    ProjectEquipment,
    ProjectPhase,
    RoleDefinition,
)
from ..schemas import (
    PhaseStatusUpdate,
    ProjectAssignmentCreate,
    ProjectAssignmentOut,
    ProjectCreate,
    ProjectEquipmentCreate,
    ProjectOut,
    ProjectPhaseCreate,
    ProjectPhaseOut,
    ProjectUpdate,
)
from ..utils import (
    add_working_days,
    assignment_to_out,
    calc_warning_date,
    get_or_create_customer,
    incident_to_out,
    phase_to_out,
    project_to_out,
)

router = APIRouter(prefix="/projects", tags=["projects"])


# ─── Project CRUD ──────────────────────────────────────────

@router.get("", response_model=list[ProjectOut])
def list_projects(
    customer_code: str | None = Query(default=None),
    is_abnormal: bool | None = Query(default=None),
    assigned_person: str | None = Query(default=None),
    role_code: str | None = Query(default=None),
    actor=Depends(get_current_user),
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
        phases = list(session.exec(select(ProjectPhase).where(ProjectPhase.project_id == p.id)))
        team = list(session.exec(select(ProjectAssignment).where(ProjectAssignment.project_id == p.id)))
        out.append(project_to_out(p, phases, team, session))
    return out


@router.get("/next-order-seq", response_model=dict)
def get_next_order_seq(
    customer_code: str = Query(...),
    actor=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    prefix = f"{customer_code}-"
    projects = list(session.exec(select(Project).where(Project.order_no.like(f"{prefix}%"))))
    max_seq = 0
    for p in projects:
        suffix = p.order_no[len(prefix):]
        try:
            seq = int(suffix)
            max_seq = max(max_seq, seq)
        except ValueError:
            continue
    return {"customer_code": customer_code, "next_seq": max_seq + 1}


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: uuid.UUID, actor=Depends(get_current_user), session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    phases = list(session.exec(select(ProjectPhase).where(ProjectPhase.project_id == p.id)))
    team = list(session.exec(select(ProjectAssignment).where(ProjectAssignment.project_id == p.id)))
    return project_to_out(p, phases, team, session)


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    actor=Depends(require_permission("projects:create", "project")),
    session: Session = Depends(get_session),
):
    if body.customer_id:
        customer = session.get(Customer, body.customer_id)
        if not customer:
            raise HTTPException(400, "customer not found")
    else:
        customer_code = body.order_no.rsplit("-", 1)[0] if "-" in body.order_no else body.order_no
        customer = get_or_create_customer(session, customer_code)

    effective_template_id = body.template_id or PRODUCTION_TEMPLATE_ID
    p = Project(
        order_no=body.order_no, customer_id=customer.id,
        end_customer=body.end_customer, template_id=effective_template_id,
        contract_number=body.contract_number,
        contract_amount=body.contract_amount,
        contract_deposit_ratio=body.contract_deposit_ratio,
        contract_start_date=body.contract_start_date,
        contract_effective_date=body.contract_effective_date,
        contract_duration_days=body.contract_duration_days,
        contract_expected_delivery_date=body.contract_expected_delivery_date,
        contract_actual_delivery_days=body.contract_actual_delivery_days,
        is_abnormal=body.is_abnormal,
    )
    session.add(p)
    session.flush()

    for ph in body.phases:
        session.add(ProjectPhase(
            project_id=p.id, seq=ph.seq, phase_name=ph.phase_name,
            responsible=ph.responsible, start_date=ph.start_date,
            warning_date=ph.warning_date, planned_end_date=ph.planned_end_date,
            planned_duration=ph.planned_duration, actual_end_date=ph.actual_end_date,
            actual_duration=ph.actual_duration, is_rectify=ph.is_rectify,
            sub_statuses_json=ph.sub_statuses_json, terminal_statuses_json=ph.terminal_statuses_json,
        ))

    if not body.phases and effective_template_id:
        items = list(session.exec(
            select(PhaseTemplateItem).where(PhaseTemplateItem.template_id == effective_template_id)
        ))
        for item in sorted(items, key=lambda x: x.seq):
            session.add(ProjectPhase(project_id=p.id, seq=item.seq, phase_name=item.phase_name,
                                     sub_statuses_json=item.sub_statuses_json, terminal_statuses_json=item.terminal_statuses_json))

    for eq in body.equipment_list:
        session.add(ProjectEquipment(
            project_id=p.id, category=eq.category, spec=eq.spec, quantity=eq.quantity,
        ))

    for a in body.assignments:
        ph_id = uuid.UUID(a.phase_id) if a.phase_id else None
        session.add(ProjectAssignment(
            project_id=p.id, person_name=a.person_name,
            role_code=a.role_code, phase_id=ph_id,
        ))

    # Auto-assign salesman as 尾款 executor and set status to 进行中
    for a in body.assignments:
        if a.role_code == 'salesman':
            tail = session.exec(
                select(ProjectPhase).where(
                    ProjectPhase.project_id == p.id,
                    ProjectPhase.phase_name == '尾款',
                )
            ).first()
            if tail:
                tail.responsible = a.person_name
                tail.status = '进行中'
                session.add(tail)

    session.flush()
    phases = list(session.exec(select(ProjectPhase).where(ProjectPhase.project_id == p.id)))
    team = list(session.exec(select(ProjectAssignment).where(ProjectAssignment.project_id == p.id)))
    return project_to_out(p, phases, team, session)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    actor=Depends(require_permission("projects:edit", "project")),
    session: Session = Depends(get_session),
):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    for field in ["is_abnormal", "end_customer", "contract_number", "contract_amount",
                  "contract_deposit_ratio", "contract_start_date", "contract_duration_days",
                  "contract_expected_delivery_date", "contract_actual_delivery_days"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(p, field, val)

    if body.contract_effective_date is not None:
        p.contract_effective_date = body.contract_effective_date
        if p.contract_duration_days and p.contract_duration_days > 0 and not p.contract_expected_delivery_date:
            p.contract_expected_delivery_date = add_working_days(body.contract_effective_date, p.contract_duration_days)

    if body.contract_payment_progress is not None:
        p.contract_payment_progress = body.contract_payment_progress
        threshold = p.contract_deposit_ratio or 0.3
        if body.contract_payment_progress >= threshold and p.contract_effective_date is None:
            today = date.today()
            p.contract_effective_date = today
            if p.contract_duration_days and p.contract_duration_days > 0:
                p.contract_expected_delivery_date = add_working_days(today, p.contract_duration_days)

    p.updated_at = utcnow()
    session.add(p)
    session.flush()
    phases = list(session.exec(select(ProjectPhase).where(ProjectPhase.project_id == p.id)))
    team = list(session.exec(select(ProjectAssignment).where(ProjectAssignment.project_id == p.id)))
    return project_to_out(p, phases, team, session)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: uuid.UUID, actor=Depends(require_permission("projects:delete", "project")), session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    for a in session.exec(select(ProjectAssignment).where(ProjectAssignment.project_id == project_id)):
        session.delete(a)
    for ph in session.exec(select(ProjectPhase).where(ProjectPhase.project_id == project_id)):
        for inc in session.exec(select(PhaseIncident).where(PhaseIncident.phase_id == ph.id)):
            session.delete(inc)
        session.delete(ph)
    project_dir = AGREEMENT_DIR / str(project_id)
    if project_dir.exists():
        import shutil
        shutil.rmtree(project_dir)
    session.delete(p)


# ─── Agreement ─────────────────────────────────────────────

@router.post("/{project_id}/agreement", status_code=200)
def upload_agreement(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    actor=Depends(require_permission("projects:edit", "project")),
    session: Session = Depends(get_session),
):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    project_dir = AGREEMENT_DIR / str(project_id)
    if project_dir.exists():
        for old in project_dir.iterdir():
            old.unlink()
    else:
        project_dir.mkdir(parents=True, exist_ok=True)
    content = file.file.read()
    (project_dir / file.filename).write_bytes(content)
    p.agreement_filename = file.filename
    p.updated_at = utcnow()
    session.add(p)
    session.flush()
    return {"filename": file.filename, "size": len(content)}


@router.get("/{project_id}/agreement")
def download_agreement(project_id: uuid.UUID, actor=Depends(get_current_user), session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    if not p.agreement_filename:
        raise HTTPException(404, "未上传技术协议")
    file_path = AGREEMENT_DIR / str(project_id) / p.agreement_filename
    if not file_path.exists():
        raise HTTPException(404, "协议文件已丢失")
    return FileResponse(path=str(file_path), filename=p.agreement_filename, media_type="application/octet-stream")


# ─── Phases (nested under project) ─────────────────────────

@router.get("/{project_id}/phases", response_model=list[ProjectPhaseOut])
def list_phases(project_id: uuid.UUID, actor=Depends(get_current_user), session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    phases = list(session.exec(select(ProjectPhase).where(ProjectPhase.project_id == project_id)))
    return [phase_to_out(ph, session) for ph in sorted(phases, key=lambda x: x.seq)]


@router.post("/{project_id}/phases", response_model=ProjectPhaseOut, status_code=201)
def add_phase(project_id: uuid.UUID, body: ProjectPhaseCreate, actor=Depends(deny_salesman), session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    if "tech_supervisor" in actor.roles:
        if p.contract_effective_date and p.contract_expected_delivery_date:
            if body.start_date and body.start_date < p.contract_effective_date:
                raise HTTPException(400, "开始日期不能早于项目生效日期")
            if body.planned_end_date and body.planned_end_date > p.contract_expected_delivery_date:
                raise HTTPException(400, "计划完成日期不能晚于项目交期")

    ph = ProjectPhase(
        project_id=project_id, seq=body.seq, phase_name=body.phase_name,
        sub_name=body.sub_name, responsible=body.responsible, status=body.status,
        start_date=body.start_date,
        warning_date=body.warning_date or (calc_warning_date(body.planned_end_date) if body.planned_end_date else None),
        planned_end_date=body.planned_end_date, planned_duration=body.planned_duration,
        actual_end_date=body.actual_end_date, actual_duration=body.actual_duration,
        is_rectify=body.is_rectify,
        sub_statuses_json=body.sub_statuses_json, terminal_statuses_json=body.terminal_statuses_json,
    )
    session.add(ph)
    session.flush()
    for inc in body.incidents:
        session.add(PhaseIncident(phase_id=ph.id, occurred_at=inc.occurred_at, category=inc.category, description=inc.description))
    return phase_to_out(ph, session)


@router.patch("/{project_id}/phases/{phase_id}", response_model=ProjectPhaseOut)
def update_phase(
    project_id: uuid.UUID, phase_id: uuid.UUID,
    body: ProjectPhaseCreate,
    actor=Depends(deny_salesman),
    session: Session = Depends(get_session),
):
    ph = session.get(ProjectPhase, phase_id)
    if not ph or ph.project_id != project_id:
        raise HTTPException(404, "phase not found")
    if "tech_supervisor" in actor.roles:
        project = session.get(Project, project_id)
        if project and project.contract_effective_date and project.contract_expected_delivery_date:
            check_start = body.start_date if body.start_date is not None else ph.start_date
            check_end = body.planned_end_date if body.planned_end_date is not None else ph.planned_end_date
            if check_start and check_start < project.contract_effective_date:
                raise HTTPException(400, "开始日期不能早于项目生效日期")
            if check_end and check_end > project.contract_expected_delivery_date:
                raise HTTPException(400, "计划完成日期不能晚于项目交期")

    for field in ["seq", "phase_name", "sub_name", "responsible", "status"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(ph, field, val)
    if body.start_date is not None:
        ph.start_date = body.start_date
    if body.planned_end_date is not None:
        ph.planned_end_date = body.planned_end_date
    if body.planned_duration is not None:
        ph.planned_duration = body.planned_duration
    if body.warning_date is not None:
        ph.warning_date = body.warning_date
    if body.is_rectify is not None:
        ph.is_rectify = body.is_rectify
    if body.warning_date is None and ph.planned_end_date is not None:
        ph.warning_date = calc_warning_date(ph.planned_end_date)
    ph.actual_end_date = body.actual_end_date
    ph.actual_duration = body.actual_duration
    ph.updated_at = utcnow()
    session.add(ph)
    return phase_to_out(ph, session)


@router.delete("/{project_id}/phases/{phase_id}", status_code=204)
def delete_phase(project_id: uuid.UUID, phase_id: uuid.UUID, actor=Depends(deny_salesman), session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph or ph.project_id != project_id:
        raise HTTPException(404, "phase not found")
    for inc in session.exec(select(PhaseIncident).where(PhaseIncident.phase_id == phase_id)):
        session.delete(inc)
    session.delete(ph)


# ─── Assignments (nested under project) ────────────────────

@router.get("/{project_id}/assignments", response_model=list[ProjectAssignmentOut])
def list_assignments(project_id: uuid.UUID, actor=Depends(get_current_user), session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    return [assignment_to_out(a) for a in session.exec(select(ProjectAssignment).where(ProjectAssignment.project_id == project_id))]


@router.post("/{project_id}/assignments", response_model=ProjectAssignmentOut, status_code=201)
def add_assignment(project_id: uuid.UUID, body: ProjectAssignmentCreate, actor=Depends(deny_salesman), session: Session = Depends(get_session)):
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
    a = ProjectAssignment(project_id=project_id, person_name=body.person_name, role_code=body.role_code, phase_id=ph_id)
    session.add(a)
    session.flush()
    return assignment_to_out(a)


@router.delete("/{project_id}/assignments/{assignment_id}", status_code=204)
def remove_assignment(project_id: uuid.UUID, assignment_id: uuid.UUID, actor=Depends(deny_salesman), session: Session = Depends(get_session)):
    a = session.get(ProjectAssignment, assignment_id)
    if not a or a.project_id != project_id:
        raise HTTPException(404, "assignment not found")
    session.delete(a)
