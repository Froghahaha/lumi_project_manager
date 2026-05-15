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


class Project(SQLModel, table=True):
    __tablename__ = "project"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    order_no: str = Field(index=True)
    customer_id: uuid.UUID = Field(foreign_key="customer.id", index=True)
    end_customer: str | None = None
    template_id: uuid.UUID | None = Field(default=None, foreign_key="phase_template.id")

    equipment_category: str | None = None
    equipment_quantity: int = 1
    equipment_spec: str | None = None

    contract_start_date: date | None = None
    contract_duration_days: int | None = None
    contract_expected_delivery_date: date | None = None
    contract_actual_delivery_days: int | None = None
    contract_payment_progress: float | None = None

    is_abnormal: bool = False
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

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class PhaseIncident(SQLModel, table=True):
    __tablename__ = "phase_incident"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    phase_id: uuid.UUID = Field(foreign_key="project_phase.id", index=True)
    occurred_at: date
    category: str = ""
    description: str
    created_at: datetime = Field(default_factory=utcnow)


class RoleDefinition(SQLModel, table=True):
    __tablename__ = "role_definition"
    code: str = Field(primary_key=True)
    name: str
    category: str
    assigns_json: str | None = None


class ProjectAssignment(SQLModel, table=True):
    __tablename__ = "project_assignment"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    person_name: str
    role_code: str = Field(foreign_key="role_definition.code")
    phase_id: uuid.UUID | None = Field(default=None, foreign_key="project_phase.id")
    created_at: datetime = Field(default_factory=utcnow)


class Person(SQLModel, table=True):
    __tablename__ = "person"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True, unique=True)
    department: str = ""
    password_hash: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class PersonRole(SQLModel, table=True):
    __tablename__ = "person_role"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    person_id: uuid.UUID = Field(foreign_key="person.id", index=True)
    role_code: str = Field(foreign_key="role_definition.code")
