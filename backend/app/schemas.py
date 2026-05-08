from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from .models import IssueStatus, ProjectStatus


class ProjectCreate(BaseModel):
    name: str
    type: str
    overview: str | None = None
    priority: int = Field(default=3, ge=1, le=5)
    status: ProjectStatus = ProjectStatus.active
    start_date: date | None = None
    target_date: date | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    overview: str | None = None
    priority: int | None = Field(default=None, ge=1, le=5)
    status: ProjectStatus | None = None
    start_date: date | None = None
    target_date: date | None = None
    archived: bool | None = None


class ProjectOverviewImageOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    uploader: str
    filename: str
    content_type: str | None
    size: int
    created_at: datetime
    url: str


class ProjectOut(BaseModel):
    id: uuid.UUID
    code: str | None
    name: str
    type: str | None
    overview: str | None
    priority: int
    status: ProjectStatus
    start_date: date | None
    target_date: date | None
    archived: bool
    created_at: datetime
    updated_at: datetime
    overview_images: list[ProjectOverviewImageOut] = Field(default_factory=list)


class SubTaskCreate(BaseModel):
    name: str
    description: str | None = None
    priority: int = Field(default=3, ge=1, le=5)


class SubTaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: int | None = Field(default=None, ge=1, le=5)


class SubTaskOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str | None
    priority: int
    created_at: datetime
    updated_at: datetime


class IssueCreate(BaseModel):
    title: str
    description: str | None = None
    project_id: uuid.UUID | None = None
    subtask_id: uuid.UUID | None = None
    type: str | None = None
    category: list[str] = Field(default_factory=list)
    equipment_type: list[str] = Field(default_factory=list)
    severity: str | None = None
    reporter: str | None = None
    assignee: str | None = None
    related_person: list[str] = Field(default_factory=list)
    status: IssueStatus = IssueStatus.todo
    progress: int = Field(default=0, ge=0, le=100)
    is_blocked: bool = False
    block_reason: str | None = None
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    tags: list[str] = Field(default_factory=list)


class IssueUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    project_id: uuid.UUID | None = None
    subtask_id: uuid.UUID | None = None
    type: str | None = None
    category: list[str] | None = None
    equipment_type: list[str] | None = None
    severity: str | None = None
    reporter: str | None = None
    assignee: str | None = None
    related_person: list[str] | None = None
    status: IssueStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    is_blocked: bool | None = None
    block_reason: str | None = None
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    tags: list[str] | None = None


class IssueOut(BaseModel):
    id: uuid.UUID
    issue_key: str
    title: str
    description: str | None
    project_id: uuid.UUID | None
    subtask_id: uuid.UUID | None
    type: str | None
    category: list[str]
    equipment_type: list[str]
    severity: str | None
    reporter: str | None
    assignee: str | None
    related_person: list[str]
    status: IssueStatus
    progress: int
    is_blocked: bool
    block_reason: str | None
    planned_start: datetime | None
    planned_end: datetime | None
    actual_start: datetime | None
    actual_end: datetime | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    is_delayed: bool
    delay_days: int


class CommentCreate(BaseModel):
    content: str
    is_internal: bool = False


class CommentOut(BaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    actor: str
    content: str
    is_internal: bool
    created_at: datetime


class AttachmentOut(BaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    comment_id: uuid.UUID | None
    uploader: str
    filename: str
    content_type: str | None
    size: int
    created_at: datetime
    url: str


class AuditLogOut(BaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    actor: str
    action: str
    timestamp: datetime
    from_value: dict[str, Any]
    to_value: dict[str, Any]
    comment: str | None
    ip_address: str | None


class TimelineEventCreate(BaseModel):
    issue_id: uuid.UUID | None = None
    occurred_at: datetime
    description: str
    related_person: list[str] = Field(default_factory=list)


class TimelineEventAttachmentOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    uploader: str
    filename: str
    content_type: str | None
    size: int
    created_at: datetime
    url: str


class TimelineEventOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    issue_id: uuid.UUID | None
    actor: str
    occurred_at: datetime
    description: str
    related_person: list[str]
    created_at: datetime
    attachments: list[TimelineEventAttachmentOut] = Field(default_factory=list)

class ProjectActivityOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    issue_id: uuid.UUID
    issue_key: str
    issue_title: str
    actor: str
    action: str
    timestamp: datetime
    comment: str | None
    ip_address: str | None
