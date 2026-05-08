from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import Column
from sqlalchemy.types import TEXT
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IssueStatus(str, Enum):
    todo = "待处理"
    doing = "处理中"
    verify = "待验证"
    done = "已完成"
    archived = "已归档"


class ProjectStatus(str, Enum):
    planning = "规划中"
    active = "进行中"
    done = "已完成"
    paused = "已暂停"


class AuditAction(str, Enum):
    create = "CREATE"
    update = "UPDATE"
    update_status = "UPDATE_STATUS"
    add_comment = "ADD_COMMENT"
    add_attachment = "ADD_ATTACHMENT"


class Project(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    code: str | None = Field(default=None, index=True)
    name: str = Field(index=True)
    type: str | None = Field(default=None, index=True)
    overview: str | None = Field(default=None, sa_column=Column(TEXT))
    priority: int = Field(default=3, ge=1, le=5, index=True)
    status: ProjectStatus = Field(default=ProjectStatus.active, index=True)
    start_date: date | None = None
    target_date: date | None = None
    archived: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)


class SubTask(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    name: str = Field(index=True)
    description: str | None = None
    priority: int = Field(default=3, ge=1, le=5, index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)


class Issue(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    issue_no: int | None = Field(default=None, index=True)
    issue_key: str | None = Field(default=None, index=True)

    title: str = Field(index=True)
    description: str | None = None

    project_id: uuid.UUID | None = Field(default=None, foreign_key="project.id", index=True)
    subtask_id: uuid.UUID | None = Field(default=None, foreign_key="subtask.id", index=True)

    type: str | None = Field(default=None, index=True)
    category_json: str = Field(
        default="[]",
        sa_column=Column(TEXT, nullable=False),
    )
    equipment_type_json: str = Field(
        default="[]",
        sa_column=Column(TEXT, nullable=False),
    )
    severity: str | None = Field(default=None, index=True)

    reporter: str | None = Field(default=None, index=True)
    assignee: str | None = Field(default=None, index=True)
    related_person_json: str = Field(
        default="[]",
        sa_column=Column(TEXT, nullable=False),
    )

    status: IssueStatus = Field(default=IssueStatus.todo, index=True)
    progress: int = Field(default=0, ge=0, le=100, index=True)
    is_blocked: bool = Field(default=False, index=True)
    block_reason: str | None = None

    planned_start: datetime | None = None
    planned_end: datetime | None = Field(default=None, index=True)
    actual_start: datetime | None = None
    actual_end: datetime | None = None

    tags_json: str = Field(
        default="[]",
        sa_column=Column(TEXT, nullable=False),
    )

    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)

    def set_list(self, field: str, values: list[str]) -> None:
        encoded = json.dumps(values, ensure_ascii=False)
        setattr(self, field, encoded)

    def get_list(self, field: str) -> list[str]:
        raw = getattr(self, field)
        try:
            parsed = json.loads(raw) if raw else []
            return [str(x) for x in parsed] if isinstance(parsed, list) else []
        except Exception:
            return []

    @property
    def is_delayed(self) -> bool:
        if not self.planned_end:
            return False
        planned_end = self.planned_end
        if planned_end.tzinfo is None:
            planned_end = planned_end.replace(tzinfo=timezone.utc)
        if self.status in (IssueStatus.done, IssueStatus.archived):
            if not self.actual_end:
                return False
            actual_end = self.actual_end
            if actual_end.tzinfo is None:
                actual_end = actual_end.replace(tzinfo=timezone.utc)
            return actual_end > planned_end
        return utcnow() > planned_end

    @property
    def delay_days(self) -> int:
        if not self.planned_end:
            return 0
        planned_end = self.planned_end
        if planned_end.tzinfo is None:
            planned_end = planned_end.replace(tzinfo=timezone.utc)
        end = self.actual_end or utcnow()
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        delta = end - planned_end
        return max(0, int(delta.total_seconds() // 86400))


class Comment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    issue_id: uuid.UUID = Field(foreign_key="issue.id", index=True)
    actor: str = Field(index=True)
    content: str
    is_internal: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class Attachment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    issue_id: uuid.UUID = Field(foreign_key="issue.id", index=True)
    comment_id: uuid.UUID | None = Field(default=None, foreign_key="comment.id", index=True)
    uploader: str = Field(index=True)
    filename: str
    content_type: str | None = None
    size: int = 0
    storage_path: str = Field(index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class ProjectOverviewImage(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    uploader: str = Field(index=True)
    filename: str
    content_type: str | None = None
    size: int = 0
    storage_path: str = Field(index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class TimelineEvent(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    issue_id: uuid.UUID | None = Field(default=None, foreign_key="issue.id", index=True)
    actor: str = Field(index=True)
    occurred_at: datetime = Field(default_factory=utcnow, index=True)
    description: str = Field(sa_column=Column(TEXT, nullable=False))
    related_person_json: str = Field(default="[]", sa_column=Column(TEXT, nullable=False))
    created_at: datetime = Field(default_factory=utcnow, index=True)

    def set_related_person(self, values: list[str]) -> None:
        self.related_person_json = json.dumps(values, ensure_ascii=False)

    def get_related_person(self) -> list[str]:
        try:
            parsed = json.loads(self.related_person_json) if self.related_person_json else []
            return [str(x) for x in parsed] if isinstance(parsed, list) else []
        except Exception:
            return []


class TimelineEventAttachment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    event_id: uuid.UUID = Field(foreign_key="timelineevent.id", index=True)
    uploader: str = Field(index=True)
    filename: str
    content_type: str | None = None
    size: int = 0
    storage_path: str = Field(index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class AuditLog(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    issue_id: uuid.UUID = Field(foreign_key="issue.id", index=True)
    actor: str = Field(index=True)
    action: AuditAction = Field(index=True)
    timestamp: datetime = Field(default_factory=utcnow, index=True)
    from_value: str = Field(default="{}", sa_column=Column(TEXT, nullable=False))
    to_value: str = Field(default="{}", sa_column=Column(TEXT, nullable=False))
    comment: str | None = None
    ip_address: str | None = None

    def set_from_to(self, from_value: dict[str, Any], to_value: dict[str, Any]) -> None:
        self.from_value = json.dumps(from_value, ensure_ascii=False, default=str)
        self.to_value = json.dumps(to_value, ensure_ascii=False, default=str)
