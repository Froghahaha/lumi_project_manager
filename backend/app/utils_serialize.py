"""Model → Pydantic schema serialization."""

from __future__ import annotations

import json

from sqlmodel import Session, select

from .models import (
    Customer, Person, PhaseIncident, PhaseTemplate, PhaseTemplateItem,
    Project, ProjectAssignment, ProjectEquipment, ProjectPhase, RoleDefinition,
)
from .schemas import (
    CustomerOut, PersonOut, PhaseIncidentOut, PhaseTemplateItemOut,
    PhaseTemplateOut, ProjectAssignmentOut, ProjectEquipmentOut,
    ProjectOut, ProjectPhaseOut, RoleDefinitionOut,
)
from .utils_compute import (
    compute_phase_progress, compute_payment_due_date,
    compute_project_status,
)


def incident_to_out(inc: PhaseIncident) -> PhaseIncidentOut:
    image_urls: list[str] = []
    if inc.image_urls_json:
        try:
            image_urls = json.loads(inc.image_urls_json)
        except (json.JSONDecodeError, TypeError):
            pass
    return PhaseIncidentOut(
        id=inc.id, phase_id=inc.phase_id,
        occurred_at=inc.occurred_at, category=inc.category,
        description=inc.description, image_urls=image_urls,
        created_at=inc.created_at,
    )


def phase_to_out(ph: ProjectPhase, session: Session | None = None) -> ProjectPhaseOut:
    incidents: list[PhaseIncidentOut] = []
    if session is not None:
        incidents = [incident_to_out(i) for i in session.exec(
            select(PhaseIncident).where(PhaseIncident.phase_id == ph.id)
        )]
    progress = compute_phase_progress(
        status=ph.status, planned_end_date=ph.planned_end_date,
        actual_end_date=ph.actual_end_date, warning_date=ph.warning_date,
        terminal_statuses=json.loads(ph.terminal_statuses_json) if ph.terminal_statuses_json else None,
    )
    return ProjectPhaseOut(
        id=ph.id, project_id=ph.project_id,
        seq=ph.seq, phase_name=ph.phase_name,
        sub_name=ph.sub_name, responsible=ph.responsible, status=ph.status,
        start_date=ph.start_date, warning_date=ph.warning_date,
        planned_end_date=ph.planned_end_date, planned_duration=ph.planned_duration,
        actual_end_date=ph.actual_end_date, actual_duration=ph.actual_duration,
        is_rectify=ph.is_rectify,
        phase_progress=progress, sub_statuses_json=ph.sub_statuses_json,
        terminal_statuses_json=ph.terminal_statuses_json,
        incidents=incidents,
        created_at=ph.created_at, updated_at=ph.updated_at,
    )


def assignment_to_out(a: ProjectAssignment) -> ProjectAssignmentOut:
    return ProjectAssignmentOut(
        id=a.id, project_id=a.project_id,
        person_name=a.person_name, role_code=a.role_code,
        phase_id=str(a.phase_id) if a.phase_id else None,
        created_at=a.created_at,
    )


def equipment_to_out(e: ProjectEquipment) -> ProjectEquipmentOut:
    return ProjectEquipmentOut(
        id=e.id, project_id=e.project_id,
        category=e.category, spec=e.spec, quantity=e.quantity,
    )


def project_to_out(
    p: Project, phases: list[ProjectPhase],
    assignments: list[ProjectAssignment], session: Session | None = None,
) -> ProjectOut:
    equip_list = list(session.exec(
        select(ProjectEquipment).where(ProjectEquipment.project_id == p.id)
    )) if session else []
    phase_outs = [phase_to_out(ph, session) for ph in phases]
    phase_dicts = [
        {'seq': po.seq, 'status': po.status, 'phase_progress': po.phase_progress,
         'start_date': po.start_date, 'actual_end_date': po.actual_end_date,
         'terminal_statuses_json': po.terminal_statuses_json}
        for po in phase_outs
    ]
    due_dt = compute_payment_due_date(p.payment_due_type, p.payment_due_days, phase_dicts)
    # Extract PM and salesman names from assignments
    pm_name = next((a.person_name for a in assignments if a.role_code == 'project_manager'), None)
    salesman_name = next((a.person_name for a in assignments if a.role_code == 'salesman'), None)
    return ProjectOut(
        id=p.id, order_no=p.order_no,
        customer_id=p.customer_id, end_customer=p.end_customer,
        template_id=p.template_id,
        contract_number=p.contract_number,
        contract_amount=p.contract_amount,
        contract_deposit_ratio=p.contract_deposit_ratio,
        contract_start_date=p.contract_start_date,
        contract_effective_date=p.contract_effective_date,
        contract_duration_days=p.contract_duration_days,
        contract_expected_delivery_date=p.contract_expected_delivery_date,
        contract_actual_delivery_days=p.contract_actual_delivery_days,
        contract_payment_progress=p.contract_payment_progress,
        is_abnormal=p.is_abnormal,
        agreement_filename=p.agreement_filename,
        payment_due_type=p.payment_due_type,
        payment_due_days=p.payment_due_days,
        project_status=compute_project_status([{'phase_progress': po.phase_progress} for po in phase_outs]),
        payment_due_date=due_dt.isoformat() if due_dt else None,
        project_manager_name=pm_name,
        salesman_name=salesman_name,
        phases=phase_outs,
        assignments=[assignment_to_out(a) for a in assignments],
        equipment_list=[equipment_to_out(e) for e in equip_list],
        created_at=p.created_at, updated_at=p.updated_at,
    )


def template_to_out(t: PhaseTemplate, items: list[PhaseTemplateItem]) -> PhaseTemplateOut:
    return PhaseTemplateOut(
        id=t.id, name=t.name, description=t.description,
        items=[PhaseTemplateItemOut(
            id=item.id, template_id=item.template_id, seq=item.seq,
            phase_name=item.phase_name, description=item.description,
            sub_statuses_json=item.sub_statuses_json,
            terminal_statuses_json=item.terminal_statuses_json,
        ) for item in sorted(items, key=lambda x: x.seq)],
        created_at=t.created_at, updated_at=t.updated_at,
    )


def customer_to_out(c: Customer) -> CustomerOut:
    return CustomerOut(id=c.id, code=c.code, name=c.name,
                       created_at=c.created_at, updated_at=c.updated_at)


def role_to_out(r: RoleDefinition) -> RoleDefinitionOut:
    return RoleDefinitionOut(
        code=r.code, name=r.name, category=r.category,
        workspace_key=r.workspace_key, assigns_json=r.assigns_json,
    )


def person_to_out(p: Person) -> PersonOut:
    return PersonOut(
        id=p.id, name=p.name, department=p.department,
        role_code=p.role_code, is_active=p.is_active, created_at=p.created_at,
    )


def get_or_create_customer(session: Session, code: str) -> Customer:
    from .models import Customer
    from sqlmodel import select
    customer = session.exec(select(Customer).where(Customer.code == code)).first()
    if not customer:
        customer = Customer(code=code, name=code)
        session.add(customer)
        session.flush()
    return customer
