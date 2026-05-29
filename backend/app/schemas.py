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


class CustomerUpdate(BaseModel):
    code: str | None = None
    name: str | None = None


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
    sub_statuses_json: str = ""
    terminal_statuses_json: str = ""


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
    sub_statuses_json: str = ""
    terminal_statuses_json: str = ""


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
    occurred_at: date | None = None  # defaults to today if not provided
    category: str = "现状描述"  # 现状描述 | 逾期原因
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
    sub_name: str = ""
    responsible: str = ""
    status: str = ""
    start_date: date | None = None
    warning_date: date | None = None
    planned_end_date: date | None = None
    planned_duration: int | None = None
    actual_end_date: date | None = None
    actual_duration: int | None = None
    incidents: list[PhaseIncidentCreate] = Field(default_factory=list)
    is_rectify: bool = False
    sub_statuses_json: str = ""  # valid options, denormalized from template
    terminal_statuses_json: str = ""


class ProjectPhaseOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    seq: int
    phase_name: str
    sub_name: str = ""
    responsible: str
    status: str = ""

    start_date: date | None = None
    warning_date: date | None = None
    planned_end_date: date | None = None
    planned_duration: int | None = None
    actual_end_date: date | None = None
    actual_duration: int | None = None
    is_rectify: bool = False

    phase_progress: str = ""  # 未开始|进行中|预警|逾期|已完成 — computed by backend
    sub_statuses_json: str = ""  # valid options, denormalized from template
    terminal_statuses_json: str = ""  # single source for completion criteria

    incidents: list[PhaseIncidentOut] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime


# ============================================================
# PhaseStatusUpdate
# ============================================================

class PhaseStatusUpdate(BaseModel):
    status: str


# ============================================================
# Person
# ============================================================

class PersonCreate(BaseModel):
    name: str
    department: str = ""
    role_code: str = ""


class PersonStatusUpdate(BaseModel):
    is_active: bool


class PersonOut(BaseModel):
    id: uuid.UUID
    name: str
    department: str
    role_code: str = ""
    is_active: bool
    created_at: datetime


# ============================================================
# Auth / Login
# ============================================================

class LoginRequest(BaseModel):
    person_name: str
    password: str


class LoginResponse(BaseModel):
    person: PersonOut
    token: str


class ResetPasswordRequest(BaseModel):
    new_password: str


class ResetPasswordResponse(BaseModel):
    password: str


# ============================================================
# RoleDefinition
# ============================================================

class RoleDefinitionOut(BaseModel):
    code: str
    name: str
    category: str
    workspace_key: str = ""
    assigns_json: str | None = None


# ============================================================
# ProjectAssignment
# ============================================================

class ProjectAssignmentCreate(BaseModel):
    person_name: str
    role_code: str
    phase_id: str | None = None


class ProjectAssignmentOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    person_name: str
    role_code: str
    phase_id: str | None = None
    created_at: datetime


# ============================================================
# ProjectEquipment
# ============================================================

class ProjectEquipmentCreate(BaseModel):
    category: str = ""
    spec: str = ""
    quantity: int = 1


class ProjectEquipmentOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    category: str
    spec: str
    quantity: int


# ============================================================
# Project
# ============================================================

class ProjectCreate(BaseModel):
    order_no: str
    customer_id: uuid.UUID | None = None
    end_customer: str | None = None
    template_id: uuid.UUID | None = None

    contract_number: str | None = None
    contract_amount: float | None = None  # 合同金额
    contract_deposit_ratio: float | None = None  # 首付比例阈值
    contract_start_date: date | None = None
    contract_effective_date: date | None = None
    contract_duration_days: int | None = None
    contract_expected_delivery_date: date | None = None
    contract_actual_delivery_days: int | None = None
    contract_payment_progress: float | None = None
    payment_due_type: str | None = None


    is_abnormal: bool = False

    phases: list[ProjectPhaseCreate] = Field(default_factory=list)
    assignments: list[ProjectAssignmentCreate] = Field(default_factory=list)
    equipment_list: list[ProjectEquipmentCreate] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    is_abnormal: bool | None = None
    end_customer: str | None = None
    contract_number: str | None = None
    contract_amount: float | None = None
    contract_deposit_ratio: float | None = None
    contract_start_date: date | None = None
    contract_effective_date: date | None = None
    contract_duration_days: int | None = None
    contract_expected_delivery_date: date | None = None
    contract_actual_delivery_days: int | None = None
    contract_payment_progress: float | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    order_no: str
    customer_id: uuid.UUID
    end_customer: str | None = None
    template_id: uuid.UUID | None = None

    contract_number: str | None = None
    contract_amount: float | None = None
    contract_deposit_ratio: float | None = None
    contract_start_date: date | None = None
    contract_effective_date: date | None = None
    contract_duration_days: int | None = None
    contract_expected_delivery_date: date | None = None
    contract_actual_delivery_days: int | None = None
    contract_payment_progress: float | None = None


    is_abnormal: bool = False

    payment_due_date: str | None = None  # computed

    agreement_filename: str = ""

    project_status: str = ""  # 正常|逾期|已完成 — computed by backend

    phases: list[ProjectPhaseOut] = Field(default_factory=list)
    assignments: list[ProjectAssignmentOut] = Field(default_factory=list)
    equipment_list: list[ProjectEquipmentOut] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime
