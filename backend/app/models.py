from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Customer(SQLModel, table=True):
    __tablename__ = "customer"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    code: str = Field(index=True, unique=True)
    name: str
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class PhaseTemplate(SQLModel, table=True):
    __tablename__ = "phase_template"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    description: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class PhaseTemplateItem(SQLModel, table=True):
    __tablename__ = "phase_template_item"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    template_id: uuid.UUID = Field(foreign_key="phase_template.id", index=True)
    seq: int
    phase_name: str
    description: str | None = None
    sub_statuses_json: str = ""
    terminal_statuses_json: str = ""


class Project(SQLModel, table=True):
    __tablename__ = "project"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    order_no: str = Field(index=True)
    customer_id: uuid.UUID = Field(foreign_key="customer.id", index=True)
    end_customer: str | None = None
    template_id: uuid.UUID | None = Field(default=None, foreign_key="phase_template.id")

    contract_number: str | None = None  # 合同编号
    contract_amount: float | None = None  # 合同金额
    contract_deposit_ratio: float | None = None  # 首付比例阈值（合同约定）
    contract_start_date: date | None = None
    contract_effective_date: date | None = None  # 项目生效日期（实际收款达标）
    contract_duration_days: int | None = None
    contract_expected_delivery_date: date | None = None
    contract_actual_delivery_days: int | None = None
    contract_payment_progress: float | None = None  # 实际收款进度

    payment_due_type: str | None = None  # after_tuning | after_shipping
    payment_due_days: int | None = None  # 尾款到期天数 N

    is_abnormal: bool = False

    agreement_filename: str = ""  # 技术协议扫描件原始文件名

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class ProjectPhase(SQLModel, table=True):
    __tablename__ = "project_phase"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
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
    is_rectify: bool = False  # 整改工序标记
    sub_statuses_json: str = ""  # valid status options copied from template
    terminal_statuses_json: str = ""  # JSON array of statuses that count as complete

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class PhaseIncident(SQLModel, table=True):
    __tablename__ = "phase_incident"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    phase_id: uuid.UUID = Field(foreign_key="project_phase.id", index=True)
    occurred_at: date
    category: str = ""
    description: str
    image_urls_json: str = ""  # JSON array of image URLs
    created_at: datetime = Field(default_factory=utcnow)


class RoleDefinition(SQLModel, table=True):
    __tablename__ = "role_definition"
    code: str = Field(primary_key=True)
    name: str
    category: str
    workspace_key: str = ""
    assigns_json: str | None = None


class ProjectAssignment(SQLModel, table=True):
    __tablename__ = "project_assignment"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    person_name: str
    role_code: str = Field(foreign_key="role_definition.code")
    phase_id: uuid.UUID | None = Field(default=None, foreign_key="project_phase.id")
    created_at: datetime = Field(default_factory=utcnow)


class ProjectEquipment(SQLModel, table=True):
    __tablename__ = "project_equipment"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    category: str = ""
    spec: str = ""
    quantity: int = 1


class PersonRole(SQLModel, table=True):
    __tablename__ = "person_role"
    person_id: uuid.UUID = Field(foreign_key="person.id", primary_key=True)
    role_code: str = Field(foreign_key="role_definition.code", primary_key=True)


class Person(SQLModel, table=True):
    __tablename__ = "person"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True, unique=True)
    department: str = ""
    role_code: str = Field(default="", foreign_key="role_definition.code")
    password_hash: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)
