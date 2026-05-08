from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlmodel import Session, col, func, select

from .db import init_db, session_scope
from .models import (
    Attachment,
    AuditAction,
    AuditLog,
    Comment,
    Issue,
    IssueStatus,
    Project,
    ProjectOverviewImage,
    SubTask,
    TimelineEvent,
    TimelineEventAttachment,
)
from .schemas import (
    AttachmentOut,
    AuditLogOut,
    CommentCreate,
    CommentOut,
    IssueCreate,
    IssueOut,
    IssueUpdate,
    ProjectActivityOut,
    ProjectCreate,
    ProjectOverviewImageOut,
    ProjectOut,
    ProjectUpdate,
    SubTaskCreate,
    SubTaskOut,
    SubTaskUpdate,
    TimelineEventAttachmentOut,
    TimelineEventCreate,
    TimelineEventOut,
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


def dumps_safe(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, default=str)


def issue_to_out(issue: Issue) -> IssueOut:
    if not issue.issue_key:
        raise ValueError("issue_key is missing")
    return IssueOut(
        id=issue.id,
        issue_key=issue.issue_key,
        title=issue.title,
        description=issue.description,
        project_id=issue.project_id,
        subtask_id=issue.subtask_id,
        type=issue.type,
        category=issue.get_list("category_json"),
        equipment_type=issue.get_list("equipment_type_json"),
        severity=issue.severity,
        reporter=issue.reporter,
        assignee=issue.assignee,
        related_person=issue.get_list("related_person_json"),
        status=issue.status,
        progress=issue.progress,
        is_blocked=issue.is_blocked,
        block_reason=issue.block_reason,
        planned_start=issue.planned_start,
        planned_end=issue.planned_end,
        actual_start=issue.actual_start,
        actual_end=issue.actual_end,
        tags=issue.get_list("tags_json"),
        created_at=issue.created_at,
        updated_at=issue.updated_at,
        is_delayed=issue.is_delayed,
        delay_days=issue.delay_days,
    )


def project_to_out(project: Project, overview_images: list[ProjectOverviewImageOut] | None = None) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        code=project.code,
        name=project.name,
        type=project.type,
        overview=project.overview,
        priority=project.priority,
        status=project.status,
        start_date=project.start_date,
        target_date=project.target_date,
        archived=project.archived,
        created_at=project.created_at,
        updated_at=project.updated_at,
        overview_images=overview_images or [],
    )


def attachment_to_out(att: Attachment, request: Request) -> AttachmentOut:
    return AttachmentOut(
        id=att.id,
        issue_id=att.issue_id,
        comment_id=att.comment_id,
        uploader=att.uploader,
        filename=att.filename,
        content_type=att.content_type,
        size=att.size,
        created_at=att.created_at,
        url=str(request.url_for("download_attachment", attachment_id=str(att.id))),
    )


def project_overview_image_to_out(img: ProjectOverviewImage, request: Request) -> ProjectOverviewImageOut:
    return ProjectOverviewImageOut(
        id=img.id,
        project_id=img.project_id,
        uploader=img.uploader,
        filename=img.filename,
        content_type=img.content_type,
        size=img.size,
        created_at=img.created_at,
        url=str(request.url_for("download_project_overview_image", image_id=str(img.id))),
    )


def timeline_event_to_out(
    e: TimelineEvent, *, attachments: list[TimelineEventAttachmentOut] | None = None
) -> TimelineEventOut:
    return TimelineEventOut(
        id=e.id,
        project_id=e.project_id,
        issue_id=e.issue_id,
        actor=e.actor,
        occurred_at=e.occurred_at,
        description=e.description,
        related_person=e.get_related_person(),
        created_at=e.created_at,
        attachments=attachments or [],
    )


def timeline_event_attachment_to_out(att: TimelineEventAttachment, request: Request) -> TimelineEventAttachmentOut:
    return TimelineEventAttachmentOut(
        id=att.id,
        event_id=att.event_id,
        uploader=att.uploader,
        filename=att.filename,
        content_type=att.content_type,
        size=att.size,
        created_at=att.created_at,
        url=str(request.url_for("download_timeline_event_attachment", attachment_id=str(att.id))),
    )


def audit_to_out(a: AuditLog) -> AuditLogOut:
    try:
        from_value = json.loads(a.from_value) if a.from_value else {}
    except Exception:
        from_value = {}
    try:
        to_value = json.loads(a.to_value) if a.to_value else {}
    except Exception:
        to_value = {}
    return AuditLogOut(
        id=a.id,
        issue_id=a.issue_id,
        actor=a.actor,
        action=str(a.action),
        timestamp=a.timestamp,
        from_value=from_value,
        to_value=to_value,
        comment=a.comment,
        ip_address=a.ip_address,
    )


def record_audit(
    *,
    session: Session,
    issue_id: uuid.UUID,
    actor: str,
    action: AuditAction,
    from_value: dict[str, Any],
    to_value: dict[str, Any],
    comment: str | None,
    ip_address: str | None,
) -> None:
    log = AuditLog(
        issue_id=issue_id,
        actor=actor,
        action=action,
        comment=comment,
        ip_address=ip_address,
    )
    log.set_from_to(from_value, to_value)
    session.add(log)


def issue_snapshot(issue: Issue) -> dict[str, Any]:
    return {
        "title": issue.title,
        "description": issue.description,
        "project_id": str(issue.project_id) if issue.project_id else None,
        "subtask_id": str(issue.subtask_id) if issue.subtask_id else None,
        "type": issue.type,
        "category": issue.get_list("category_json"),
        "equipment_type": issue.get_list("equipment_type_json"),
        "severity": issue.severity,
        "reporter": issue.reporter,
        "assignee": issue.assignee,
        "related_person": issue.get_list("related_person_json"),
        "status": str(issue.status),
        "progress": issue.progress,
        "is_blocked": issue.is_blocked,
        "block_reason": issue.block_reason,
        "planned_start": issue.planned_start,
        "planned_end": issue.planned_end,
        "actual_start": issue.actual_start,
        "actual_end": issue.actual_end,
        "tags": issue.get_list("tags_json"),
        "updated_at": issue.updated_at,
    }


def compute_issue_key(*, year: int, issue_no: int) -> str:
    return f"ISS-{year}-{issue_no:04d}"


def subtask_to_out(st: SubTask) -> SubTaskOut:
    return SubTaskOut(
        id=st.id,
        project_id=st.project_id,
        name=st.name,
        description=st.description,
        priority=st.priority,
        created_at=st.created_at,
        updated_at=st.updated_at,
    )


app = FastAPI(title="Project Manager API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    with session_scope() as session:
        projects = session.exec(select(Project)).all()
        for p in projects:
            default_stmt = select(SubTask).where(SubTask.project_id == p.id, SubTask.name == "未分组")
            default = session.exec(default_stmt).first()
            if not default:
                now = utcnow()
                default = SubTask(project_id=p.id, name="未分组", description=None, priority=1, created_at=now, updated_at=now)
                session.add(default)
                session.commit()
                session.refresh(default)

            issue_stmt = select(Issue).where(Issue.project_id == p.id)
            for i in session.exec(issue_stmt).all():
                if i.subtask_id is None:
                    i.subtask_id = default.id
                if i.project_id is None:
                    i.project_id = p.id
                session.add(i)
        session.commit()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/projects", response_model=ProjectOut)
def create_project(
    payload: ProjectCreate,
    session: Session = Depends(get_session),
) -> ProjectOut:
    now = utcnow()
    day_key = now.strftime("%Y%m%d")
    prefix = f"PRJ-{day_key}-"
    count_stmt = select(func.count()).select_from(Project).where(col(Project.code).like(f"{prefix}%"))
    count_today = session.exec(count_stmt).one()
    code = f"{prefix}{int(count_today) + 1:03d}"

    project = Project(
        code=code,
        name=payload.name,
        type=payload.type,
        overview=payload.overview,
        priority=payload.priority,
        status=payload.status,
        start_date=payload.start_date,
        target_date=payload.target_date,
        created_at=now,
        updated_at=now,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project_to_out(project)


@app.get("/projects", response_model=list[ProjectOut])
def list_projects(
    include_archived: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> list[ProjectOut]:
    stmt = select(Project)
    if not include_archived:
        stmt = stmt.where(Project.archived == False)  # noqa: E712
    stmt = stmt.order_by(col(Project.updated_at).desc())
    projects = session.exec(stmt).all()
    return [project_to_out(p) for p in projects]


@app.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(request: Request, project_id: uuid.UUID, session: Session = Depends(get_session)) -> ProjectOut:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    imgs_stmt = (
        select(ProjectOverviewImage)
        .where(ProjectOverviewImage.project_id == project_id)
        .order_by(col(ProjectOverviewImage.created_at).desc())
    )
    imgs = session.exec(imgs_stmt).all()
    return project_to_out(project, overview_images=[project_overview_image_to_out(i, request) for i in imgs])


@app.get("/projects/{project_id}/subtasks", response_model=list[SubTaskOut])
def list_subtasks(project_id: uuid.UUID, session: Session = Depends(get_session)) -> list[SubTaskOut]:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    stmt = select(SubTask).where(SubTask.project_id == project_id).order_by(col(SubTask.priority).desc(), col(SubTask.updated_at).desc())
    rows = session.exec(stmt).all()
    return [subtask_to_out(s) for s in rows]


@app.post("/projects/{project_id}/subtasks", response_model=SubTaskOut)
def create_subtask(
    project_id: uuid.UUID,
    payload: SubTaskCreate,
    session: Session = Depends(get_session),
) -> SubTaskOut:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")
    now = utcnow()
    st = SubTask(
        project_id=project_id,
        name=payload.name,
        description=payload.description,
        priority=payload.priority,
        created_at=now,
        updated_at=now,
    )
    session.add(st)
    project.updated_at = now
    session.add(project)
    session.commit()
    session.refresh(st)
    return subtask_to_out(st)


@app.patch("/subtasks/{subtask_id}", response_model=SubTaskOut)
def update_subtask(
    subtask_id: uuid.UUID,
    payload: SubTaskUpdate,
    session: Session = Depends(get_session),
) -> SubTaskOut:
    st = session.get(SubTask, subtask_id)
    if not st:
        raise HTTPException(status_code=404, detail="subtask not found")
    now = utcnow()
    if payload.name is not None:
        st.name = payload.name
    if payload.description is not None:
        st.description = payload.description
    if payload.priority is not None:
        st.priority = payload.priority
    st.updated_at = now
    project = session.get(Project, st.project_id)
    if project:
        project.updated_at = now
        session.add(project)
    session.add(st)
    session.commit()
    session.refresh(st)
    return subtask_to_out(st)


@app.post("/projects/{project_id}/overview_images", response_model=ProjectOverviewImageOut)
def upload_project_overview_image(
    request: Request,
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    actor: str = Depends(get_actor),
) -> ProjectOverviewImageOut:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")

    img_id = uuid.uuid4()
    safe_name = Path(file.filename or "file").name
    stored = UPLOAD_DIR / f"proj_{img_id}_{safe_name}"
    content = file.file.read()
    stored.write_bytes(content)

    img = ProjectOverviewImage(
        id=img_id,
        project_id=project_id,
        uploader=actor,
        filename=safe_name,
        content_type=file.content_type,
        size=len(content),
        storage_path=str(stored),
    )
    project.updated_at = utcnow()
    session.add(img)
    session.add(project)
    session.commit()
    session.refresh(img)
    return project_overview_image_to_out(img, request)


@app.get("/projects/{project_id}/overview_images", response_model=list[ProjectOverviewImageOut])
def list_project_overview_images(
    request: Request,
    project_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> list[ProjectOverviewImageOut]:
    stmt = (
        select(ProjectOverviewImage)
        .where(ProjectOverviewImage.project_id == project_id)
        .order_by(col(ProjectOverviewImage.created_at).desc())
    )
    imgs = session.exec(stmt).all()
    return [project_overview_image_to_out(i, request) for i in imgs]


@app.get("/projects/overview_images/{image_id}/download", name="download_project_overview_image")
def download_project_overview_image(image_id: uuid.UUID, session: Session = Depends(get_session)) -> FileResponse:
    img = session.get(ProjectOverviewImage, image_id)
    if not img:
        raise HTTPException(status_code=404, detail="image not found")
    p = Path(img.storage_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="file missing on disk")
    return FileResponse(path=str(p), filename=img.filename, media_type=img.content_type)


@app.get("/projects/{project_id}/activity", response_model=list[ProjectActivityOut])
def list_project_activity(project_id: uuid.UUID, session: Session = Depends(get_session)) -> list[ProjectActivityOut]:
    stmt = (
        select(AuditLog, Issue)
        .join(Issue, AuditLog.issue_id == Issue.id)
        .where(Issue.project_id == project_id)
        .order_by(col(AuditLog.timestamp).desc())
    )
    rows = session.exec(stmt).all()
    out: list[ProjectActivityOut] = []
    for a, i in rows:
        out.append(
            ProjectActivityOut(
                id=a.id,
                project_id=project_id,
                issue_id=a.issue_id,
                issue_key=i.issue_key or "-",
                issue_title=i.title,
                actor=a.actor,
                action=str(a.action),
                timestamp=a.timestamp,
                comment=a.comment,
                ip_address=a.ip_address,
            )
        )
    return out


@app.post("/projects/{project_id}/timeline_events", response_model=TimelineEventOut)
def create_timeline_event(
    request: Request,
    project_id: uuid.UUID,
    payload: TimelineEventCreate,
    session: Session = Depends(get_session),
    actor: str = Depends(get_actor),
) -> TimelineEventOut:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")

    issue_id = payload.issue_id
    if issue_id is not None:
        issue = session.get(Issue, issue_id)
        if not issue:
            raise HTTPException(status_code=404, detail="issue not found")
        if issue.project_id != project_id:
            raise HTTPException(status_code=400, detail="issue does not belong to project")

    e = TimelineEvent(
        project_id=project_id,
        issue_id=issue_id,
        actor=actor,
        occurred_at=payload.occurred_at,
        description=payload.description,
    )
    e.set_related_person(payload.related_person)
    project.updated_at = utcnow()
    session.add(e)
    session.add(project)
    session.commit()
    session.refresh(e)
    return timeline_event_to_out(e, attachments=[])


@app.get("/projects/{project_id}/timeline_events", response_model=list[TimelineEventOut])
def list_project_timeline_events(
    request: Request, project_id: uuid.UUID, session: Session = Depends(get_session)
) -> list[TimelineEventOut]:
    stmt = select(TimelineEvent).where(TimelineEvent.project_id == project_id).order_by(col(TimelineEvent.occurred_at).desc())
    events = session.exec(stmt).all()
    if not events:
        return []

    ids = [e.id for e in events]
    att_stmt = select(TimelineEventAttachment).where(col(TimelineEventAttachment.event_id).in_(ids))
    atts = session.exec(att_stmt).all()
    grouped: dict[uuid.UUID, list[TimelineEventAttachmentOut]] = {}
    for a in atts:
        grouped.setdefault(a.event_id, []).append(timeline_event_attachment_to_out(a, request))

    return [timeline_event_to_out(e, attachments=grouped.get(e.id, [])) for e in events]


@app.get("/issues/{issue_id}/timeline_events", response_model=list[TimelineEventOut])
def list_issue_timeline_events(
    request: Request, issue_id: uuid.UUID, session: Session = Depends(get_session)
) -> list[TimelineEventOut]:
    stmt = select(TimelineEvent).where(TimelineEvent.issue_id == issue_id).order_by(col(TimelineEvent.occurred_at).desc())
    events = session.exec(stmt).all()
    if not events:
        return []

    ids = [e.id for e in events]
    att_stmt = select(TimelineEventAttachment).where(col(TimelineEventAttachment.event_id).in_(ids))
    atts = session.exec(att_stmt).all()
    grouped: dict[uuid.UUID, list[TimelineEventAttachmentOut]] = {}
    for a in atts:
        grouped.setdefault(a.event_id, []).append(timeline_event_attachment_to_out(a, request))

    return [timeline_event_to_out(e, attachments=grouped.get(e.id, [])) for e in events]


@app.post("/timeline_events/{event_id}/attachments", response_model=TimelineEventAttachmentOut)
def upload_timeline_event_attachment(
    request: Request,
    event_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    actor: str = Depends(get_actor),
) -> TimelineEventAttachmentOut:
    e = session.get(TimelineEvent, event_id)
    if not e:
        raise HTTPException(status_code=404, detail="event not found")

    att_id = uuid.uuid4()
    safe_name = Path(file.filename or "file").name
    stored = UPLOAD_DIR / f"evt_{att_id}_{safe_name}"
    content = file.file.read()
    stored.write_bytes(content)

    att = TimelineEventAttachment(
        id=att_id,
        event_id=event_id,
        uploader=actor,
        filename=safe_name,
        content_type=file.content_type,
        size=len(content),
        storage_path=str(stored),
    )
    session.add(att)
    session.commit()
    session.refresh(att)
    return timeline_event_attachment_to_out(att, request)


@app.get("/timeline_events/{event_id}/attachments", response_model=list[TimelineEventAttachmentOut])
def list_timeline_event_attachments(
    request: Request,
    event_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> list[TimelineEventAttachmentOut]:
    stmt = (
        select(TimelineEventAttachment)
        .where(TimelineEventAttachment.event_id == event_id)
        .order_by(col(TimelineEventAttachment.created_at).desc())
    )
    atts = session.exec(stmt).all()
    return [timeline_event_attachment_to_out(a, request) for a in atts]


@app.get("/timeline_attachments/{attachment_id}/download", name="download_timeline_event_attachment")
def download_timeline_event_attachment(attachment_id: uuid.UUID, session: Session = Depends(get_session)) -> FileResponse:
    att = session.get(TimelineEventAttachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="attachment not found")
    p = Path(att.storage_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="file missing on disk")
    return FileResponse(path=str(p), filename=att.filename, media_type=att.content_type)


@app.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    session: Session = Depends(get_session),
) -> ProjectOut:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(project, k, v)
    project.updated_at = utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project_to_out(project)


@app.post("/issues", response_model=IssueOut)
def create_issue(
    request: Request,
    payload: IssueCreate,
    session: Session = Depends(get_session),
    actor: str = Depends(get_actor),
) -> IssueOut:
    if payload.subtask_id is None:
        if payload.project_id is None:
            raise HTTPException(status_code=400, detail="subtask_id is required")
        default_stmt = select(SubTask).where(SubTask.project_id == payload.project_id, SubTask.name == "未分组")
        default = session.exec(default_stmt).first()
        if not default:
            now = utcnow()
            default = SubTask(
                project_id=payload.project_id,
                name="未分组",
                description=None,
                priority=1,
                created_at=now,
                updated_at=now,
            )
            session.add(default)
            session.commit()
            session.refresh(default)
        st = default
    else:
        st = session.get(SubTask, payload.subtask_id)
        if not st:
            raise HTTPException(status_code=404, detail="subtask not found")
        if payload.project_id is not None and st.project_id != payload.project_id:
            raise HTTPException(status_code=400, detail="subtask does not belong to project")

    now = utcnow()
    year = now.year

    max_no_stmt = select(func.max(Issue.issue_no)).where(col(Issue.issue_key).like(f"ISS-{year}-%"))
    max_no = session.exec(max_no_stmt).one()
    next_no = (max_no or 0) + 1

    issue = Issue(
        issue_no=next_no,
        issue_key=compute_issue_key(year=year, issue_no=next_no),
        title=payload.title,
        description=payload.description,
        project_id=st.project_id,
        subtask_id=st.id,
        type=payload.type,
        severity=payload.severity,
        reporter=payload.reporter,
        assignee=payload.assignee,
        status=payload.status,
        progress=payload.progress,
        is_blocked=payload.is_blocked,
        block_reason=payload.block_reason,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
        created_at=now,
        updated_at=now,
    )
    issue.set_list("category_json", payload.category)
    issue.set_list("equipment_type_json", payload.equipment_type)
    issue.set_list("related_person_json", payload.related_person)
    issue.set_list("tags_json", payload.tags)

    session.add(issue)
    record_audit(
        session=session,
        issue_id=issue.id,
        actor=actor,
        action=AuditAction.create,
        from_value={},
        to_value=issue_snapshot(issue),
        comment=None,
        ip_address=request.client.host if request.client else None,
    )
    session.commit()
    session.refresh(issue)
    return issue_to_out(issue)


@app.get("/issues", response_model=list[IssueOut])
def list_issues(
    project_id: uuid.UUID | None = Query(default=None),
    subtask_id: uuid.UUID | None = Query(default=None),
    status: IssueStatus | None = Query(default=None),
    assignee: str | None = Query(default=None),
    q: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    session: Session = Depends(get_session),
) -> list[IssueOut]:
    stmt = select(Issue)
    if project_id:
        stmt = stmt.where(Issue.project_id == project_id)
    if subtask_id:
        stmt = stmt.where(Issue.subtask_id == subtask_id)
    if status:
        stmt = stmt.where(Issue.status == status)
    if assignee:
        stmt = stmt.where(Issue.assignee == assignee)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Issue.title.like(like)) | (Issue.description.like(like)))
    if not include_archived:
        stmt = stmt.where(Issue.status != IssueStatus.archived)
    stmt = stmt.order_by(col(Issue.updated_at).desc())
    issues = session.exec(stmt).all()
    return [issue_to_out(i) for i in issues]


@app.get("/issues/{issue_id}", response_model=IssueOut)
def get_issue(issue_id: uuid.UUID, session: Session = Depends(get_session)) -> IssueOut:
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="issue not found")
    return issue_to_out(issue)


@app.patch("/issues/{issue_id}", response_model=IssueOut)
def update_issue(
    request: Request,
    issue_id: uuid.UUID,
    payload: IssueUpdate,
    session: Session = Depends(get_session),
    actor: str = Depends(get_actor),
) -> IssueOut:
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="issue not found")

    before = issue_snapshot(issue)
    data = payload.model_dump(exclude_unset=True)
    if "project_id" in data and data.get("project_id") is not None:
        if issue.project_id and data["project_id"] != issue.project_id:
            raise HTTPException(status_code=400, detail="project_id is derived from subtask")
        data.pop("project_id", None)
    if "subtask_id" in data and data.get("subtask_id") is None:
        raise HTTPException(status_code=400, detail="subtask_id cannot be null")
    list_fields = {
        "category": "category_json",
        "equipment_type": "equipment_type_json",
        "related_person": "related_person_json",
        "tags": "tags_json",
    }
    for k, v in data.items():
        if k in list_fields and v is not None:
            issue.set_list(list_fields[k], v)
        else:
            setattr(issue, k, v)
    if "subtask_id" in data and data.get("subtask_id") is not None:
        st = session.get(SubTask, data["subtask_id"])
        if not st:
            raise HTTPException(status_code=404, detail="subtask not found")
        issue.project_id = st.project_id
    issue.updated_at = utcnow()
    session.add(issue)
    record_audit(
        session=session,
        issue_id=issue.id,
        actor=actor,
        action=AuditAction.update_status if "status" in data else AuditAction.update,
        from_value=before,
        to_value=issue_snapshot(issue),
        comment=None,
        ip_address=request.client.host if request.client else None,
    )
    session.commit()
    session.refresh(issue)
    return issue_to_out(issue)


@app.get("/issues/{issue_id}/audit", response_model=list[AuditLogOut])
def list_issue_audit(issue_id: uuid.UUID, session: Session = Depends(get_session)) -> list[AuditLogOut]:
    stmt = select(AuditLog).where(AuditLog.issue_id == issue_id).order_by(col(AuditLog.timestamp).desc())
    logs = session.exec(stmt).all()
    return [audit_to_out(a) for a in logs]


@app.post("/issues/{issue_id}/comments", response_model=CommentOut)
def add_comment(
    request: Request,
    issue_id: uuid.UUID,
    payload: CommentCreate,
    session: Session = Depends(get_session),
    actor: str = Depends(get_actor),
) -> CommentOut:
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="issue not found")

    comment = Comment(issue_id=issue_id, actor=actor, content=payload.content, is_internal=payload.is_internal)
    issue.updated_at = utcnow()
    session.add(comment)
    session.add(issue)
    record_audit(
        session=session,
        issue_id=issue_id,
        actor=actor,
        action=AuditAction.add_comment,
        from_value={},
        to_value={"comment_id": str(comment.id), "is_internal": comment.is_internal},
        comment=payload.content,
        ip_address=request.client.host if request.client else None,
    )
    session.commit()
    session.refresh(comment)
    return CommentOut(
        id=comment.id,
        issue_id=comment.issue_id,
        actor=comment.actor,
        content=comment.content,
        is_internal=comment.is_internal,
        created_at=comment.created_at,
    )


@app.get("/issues/{issue_id}/comments", response_model=list[CommentOut])
def list_comments(issue_id: uuid.UUID, session: Session = Depends(get_session)) -> list[CommentOut]:
    stmt = select(Comment).where(Comment.issue_id == issue_id).order_by(col(Comment.created_at).desc())
    comments = session.exec(stmt).all()
    return [
        CommentOut(
            id=c.id,
            issue_id=c.issue_id,
            actor=c.actor,
            content=c.content,
            is_internal=c.is_internal,
            created_at=c.created_at,
        )
        for c in comments
    ]


@app.post("/issues/{issue_id}/attachments", response_model=AttachmentOut)
def upload_attachment(
    request: Request,
    issue_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    actor: str = Depends(get_actor),
) -> AttachmentOut:
    issue = session.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="issue not found")

    att_id = uuid.uuid4()
    safe_name = Path(file.filename or "file").name
    stored = UPLOAD_DIR / f"{att_id}_{safe_name}"
    content = file.file.read()
    stored.write_bytes(content)

    att = Attachment(
        id=att_id,
        issue_id=issue_id,
        comment_id=None,
        uploader=actor,
        filename=safe_name,
        content_type=file.content_type,
        size=len(content),
        storage_path=str(stored),
    )
    issue.updated_at = utcnow()
    session.add(att)
    session.add(issue)
    record_audit(
        session=session,
        issue_id=issue_id,
        actor=actor,
        action=AuditAction.add_attachment,
        from_value={},
        to_value={"attachment_id": str(att.id), "filename": att.filename},
        comment=None,
        ip_address=request.client.host if request.client else None,
    )
    session.commit()
    session.refresh(att)
    return attachment_to_out(att, request)


@app.get("/issues/{issue_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(request: Request, issue_id: uuid.UUID, session: Session = Depends(get_session)) -> list[AttachmentOut]:
    stmt = select(Attachment).where(Attachment.issue_id == issue_id).order_by(col(Attachment.created_at).desc())
    atts = session.exec(stmt).all()
    return [attachment_to_out(a, request) for a in atts]


@app.get("/attachments/{attachment_id}/download", name="download_attachment")
def download_attachment(attachment_id: uuid.UUID, session: Session = Depends(get_session)) -> FileResponse:
    att = session.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="attachment not found")
    p = Path(att.storage_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="file missing on disk")
    return FileResponse(path=str(p), filename=att.filename, media_type=att.content_type)
