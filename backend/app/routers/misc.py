"""Misc — /templates, /roles, /phases (global), /incidents, /assignments (global)"""

from __future__ import annotations

import json
from datetime import date
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from ..deps import INCIDENT_DIR, deny_salesman, get_current_user, get_session, utcnow
from ..models import PhaseIncident, PhaseTemplate, PhaseTemplateItem, ProjectAssignment, ProjectPhase, RoleDefinition
from ..schemas import (
    PhaseIncidentCreate,
    PhaseIncidentOut,
    PhaseStatusUpdate,
    PhaseTemplateOut,
    ProjectAssignmentOut,
    ProjectPhaseOut,
    RoleDefinitionOut,
)
from ..utils import assignment_to_out, incident_to_out, phase_to_out, role_to_out, template_to_out

router = APIRouter(tags=["misc"])


# ─── Templates ─────────────────────────────────────────────

@router.get("/templates", response_model=list[PhaseTemplateOut])
def list_templates(actor=Depends(get_current_user), session: Session = Depends(get_session)):
    templates = list(session.exec(select(PhaseTemplate)))
    return [template_to_out(t, list(session.exec(
        select(PhaseTemplateItem).where(PhaseTemplateItem.template_id == t.id)
    ))) for t in templates]


# ─── Roles ─────────────────────────────────────────────────

@router.get("/roles", response_model=list[RoleDefinitionOut])
def list_roles(session: Session = Depends(get_session)):
    return [role_to_out(r) for r in session.exec(select(RoleDefinition))]


# ─── Phases (global) ───────────────────────────────────────

@router.get("/phases", response_model=list[ProjectPhaseOut])
def list_phases_global(
    responsible: str | None = Query(default=None),
    project_id: uuid.UUID | None = Query(default=None),
    actor=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    stmt = select(ProjectPhase)
    if responsible:
        stmt = stmt.where(ProjectPhase.responsible == responsible)
    if project_id:
        stmt = stmt.where(ProjectPhase.project_id == project_id)
    phases = list(session.exec(stmt))
    return [phase_to_out(ph, session) for ph in sorted(phases, key=lambda x: (x.project_id, x.seq))]


@router.get("/phases/{phase_id}", response_model=ProjectPhaseOut)
def get_phase(phase_id: uuid.UUID, actor=Depends(get_current_user), session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph:
        raise HTTPException(404, "phase not found")
    return phase_to_out(ph, session)


@router.patch("/phases/{phase_id}/status", response_model=ProjectPhaseOut)
def update_phase_status(phase_id: uuid.UUID, body: PhaseStatusUpdate, actor=Depends(deny_salesman), session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph:
        raise HTTPException(404, "phase not found")
    from ..models import Project
    proj = session.get(Project, ph.project_id)
    if proj and proj.template_id:
            items = session.exec(
                select(PhaseTemplateItem).where(
                    PhaseTemplateItem.template_id == proj.template_id,
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

    # 验收完成（调机阶段）→ 自动启动尾款工序
    if ph.seq == 3 and body.status == '验收完成':
        from datetime import date as dt_date
        tail = session.exec(
            select(ProjectPhase).where(
                ProjectPhase.project_id == ph.project_id,
                ProjectPhase.seq == 4,
            )
        ).first()
        if tail and not tail.start_date:
            tail.start_date = dt_date.today()
            tail.status = '进行中'
            session.add(tail)

    return phase_to_out(ph, session)


# ─── Incidents (global, under phases) ──────────────────────

@router.get("/phases/{phase_id}/incidents", response_model=list[PhaseIncidentOut])
def list_incidents(phase_id: uuid.UUID, actor=Depends(get_current_user), session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph:
        raise HTTPException(404, "phase not found")
    return [incident_to_out(i) for i in session.exec(select(PhaseIncident).where(PhaseIncident.phase_id == phase_id))]


@router.post("/phases/{phase_id}/incidents", response_model=PhaseIncidentOut, status_code=201)
def add_incident(phase_id: uuid.UUID, body: PhaseIncidentCreate, actor=Depends(get_current_user), session: Session = Depends(get_session)):
    ph = session.get(ProjectPhase, phase_id)
    if not ph:
        raise HTTPException(404, "phase not found")
    # Salesman can only add incidents on phases of projects they are assigned to
    if "salesman" in actor.roles and "admin" not in actor.roles:
        assignment = session.exec(
            select(ProjectAssignment).where(
                ProjectAssignment.person_name == actor.person_name,
                ProjectAssignment.project_id == ph.project_id,
            )
        ).first()
        if not assignment:
            raise HTTPException(403, "权限不足：销售员仅能更新自己被指派工序的事件")
    inc = PhaseIncident(phase_id=phase_id, occurred_at=body.occurred_at or date.today(), category=body.category or '现状描述', description=body.description, image_urls_json=json.dumps(body.image_urls, ensure_ascii=False) if body.image_urls else '[]')
    session.add(inc)
    session.flush()
    return incident_to_out(inc)


@router.delete("/phases/{phase_id}/incidents/{incident_id}", status_code=204)
def delete_incident(phase_id: uuid.UUID, incident_id: uuid.UUID, actor=Depends(get_current_user), session: Session = Depends(get_session)):
    inc = session.get(PhaseIncident, incident_id)
    if not inc or inc.phase_id != phase_id:
        raise HTTPException(404, "incident not found")
    ph = session.get(ProjectPhase, phase_id)
    # Salesman can only delete incidents on phases of projects they are assigned to
    if "salesman" in actor.roles and "admin" not in actor.roles:
        if not ph:
            raise HTTPException(404, "phase not found")
        assignment = session.exec(
            select(ProjectAssignment).where(
                ProjectAssignment.person_name == actor.person_name,
                ProjectAssignment.project_id == ph.project_id,
            )
        ).first()
        if not assignment:
            raise HTTPException(403, "权限不足：销售员仅能更新自己被指派工序的事件")
    session.delete(inc)


@router.post("/incidents/{incident_id}/images", status_code=201)
def upload_incident_image(incident_id: uuid.UUID, file: UploadFile = File(...), actor=Depends(get_current_user), session: Session = Depends(get_session)):
    inc = session.get(PhaseIncident, incident_id)
    if not inc:
        raise HTTPException(404, "incident not found")
    # Save file with unique name
    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "png"
    safe_name = f"{incident_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = INCIDENT_DIR / safe_name
    content = file.file.read()
    file_path.write_bytes(content)
    url = f"/uploads/incidents/{safe_name}"
    # Append URL to incident
    import json
    urls: list[str] = json.loads(inc.image_urls_json) if inc.image_urls_json else []
    urls.append(url)
    inc.image_urls_json = json.dumps(urls, ensure_ascii=False)
    session.add(inc)
    return {"url": url, "filename": file.filename, "size": len(content)}


@router.get("/uploads/incidents/{filename}")
def serve_incident_image(filename: str):
    file_path = INCIDENT_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "image not found")
    return FileResponse(path=str(file_path))


# ─── Assignments (global) ──────────────────────────────────

@router.get("/assignments", response_model=list[ProjectAssignmentOut])
def list_assignments_global(
    person_name: str | None = Query(default=None),
    role_code: str | None = Query(default=None),
    actor=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    from ..models import ProjectAssignment
    stmt = select(ProjectAssignment)
    if person_name:
        stmt = stmt.where(ProjectAssignment.person_name == person_name)
    if role_code:
        stmt = stmt.where(ProjectAssignment.role_code == role_code)
    return [assignment_to_out(a) for a in session.exec(stmt)]
