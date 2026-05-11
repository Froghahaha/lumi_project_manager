from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ============================================================
# Customer
# ============================================================

class CustomerCreate(BaseModel):
    code: str
    name: str


class CustomerOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    created_at: datetime
    updated_at: datetime


# ============================================================
# PhaseTemplate
# ============================================================

class PhaseTemplateItemCreate(BaseModel):
    seq: int
    phase_name: str
    description: str | None = None


class PhaseTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    items: list[PhaseTemplateItemCreate] = Field(default_factory=list)


class PhaseTemplateItemOut(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    seq: int
    phase_name: str
    description: str | None = None


class PhaseTemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    items: list[PhaseTemplateItemOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ============================================================
# PhaseIncident
# ============================================================

class PhaseIncidentCreate(BaseModel):
    occurred_at: date
    category: str = ""
    description: str


class PhaseIncidentOut(BaseModel):
    id: uuid.UUID
    phase_id: uuid.UUID
    occurred_at: date
    category: str
    description: str
    created_at: datetime


# ============================================================
# ProjectPhase
# ============================================================

class ProjectPhaseCreate(BaseModel):
    seq: int
    phase_name: str
    responsible: str = ""
    start_date: date | None = None
    warning_date: date | None = None
    planned_end_date: date | None = None
    planned_duration: int | None = None
    actual_end_date: date | None = None
    actual_duration: int | None = None
    incidents: list[PhaseIncidentCreate] = Field(default_factory=list)


class ProjectPhaseOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    seq: int
    phase_name: str
    responsible: str

    start_date: date | None = None
    warning_date: date | None = None
    planned_end_date: date | None = None
    planned_duration: int | None = None
    actual_end_date: date | None = None
    actual_duration: int | None = None

    incidents: list[PhaseIncidentOut] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime


# ============================================================
# ProjectTeam
# ============================================================

class ProjectTeamCreate(BaseModel):
    person_name: str
    role: str


class ProjectTeamOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    person_name: str
    role: str
    created_at: datetime


# ============================================================
# Project
# ============================================================

class ProjectCreate(BaseModel):
    order_no: str
    customer_id: uuid.UUID | None = None
    end_customer: str | None = None
    template_id: uuid.UUID | None = None

    equipment_category: str | None = None
    equipment_quantity: int = 1
    equipment_spec: str | None = None

    contract_start_date: date | None = None
    contract_duration_days: int | None = None
    contract_expected_delivery_date: date | None = None
    contract_actual_delivery_days: int | None = None
    contract_payment_progress: float | None = None

    is_abnormal: bool = False

    phases: list[ProjectPhaseCreate] = Field(default_factory=list)
    team: list[ProjectTeamCreate] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    is_abnormal: bool | None = None
    contract_payment_progress: float | None = None
    contract_actual_delivery_days: int | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    order_no: str
    customer_id: uuid.UUID
    end_customer: str | None = None
    template_id: uuid.UUID | None = None

    equipment_category: str | None = None
    equipment_quantity: int = 1
    equipment_spec: str | None = None

    contract_start_date: date | None = None
    contract_duration_days: int | None = None
    contract_expected_delivery_date: date | None = None
    contract_actual_delivery_days: int | None = None
    contract_payment_progress: float | None = None

    is_abnormal: bool = False

    phases: list[ProjectPhaseOut] = Field(default_factory=list)
    team: list[ProjectTeamOut] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime
