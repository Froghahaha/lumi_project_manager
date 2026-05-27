"""Person CRUD — /persons"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..deps import get_session, require_permission
from ..models import Person, PersonRole
from ..schemas import PersonCreate, PersonOut, PersonStatusUpdate, ResetPasswordRequest, ResetPasswordResponse
from ..utils import hash_password, person_to_out

router = APIRouter(prefix="/persons", tags=["persons"])


@router.get("", response_model=list[PersonOut])
def list_persons(
    role_code: str | None = None,
    session: Session = Depends(get_session),
):
    stmt = select(Person)
    if role_code:
        stmt = stmt.where(
            (Person.role_code == role_code) |
            Person.id.in_(
                select(PersonRole.person_id).where(PersonRole.role_code == role_code)
            )
        )
    return [person_to_out(p) for p in session.exec(stmt)]


@router.post("", response_model=PersonOut, status_code=201)
def create_person(
    body: PersonCreate,
    actor=Depends(require_permission("persons:manage", "person")),
    session: Session = Depends(get_session),
):
    existing = session.exec(select(Person).where(Person.name == body.name)).first()
    if existing:
        raise HTTPException(400, "person already exists")
    p = Person(name=body.name, department=body.department, role_code=body.role_code)
    session.add(p)
    session.flush()
    if body.role_code:
        session.add(PersonRole(person_id=p.id, role_code=body.role_code))
        # 售后部执行人自动拥有双角色
        if body.department == "售后部" and body.role_code != "after_sales_super":
            other = "acceptance_executor" if body.role_code == "tuning_executor" else "tuning_executor"
            session.add(PersonRole(person_id=p.id, role_code=other))
    session.flush()
    return person_to_out(p)


@router.patch("/{person_id}", response_model=PersonOut)
def update_person(
    person_id: uuid.UUID,
    body: PersonCreate,
    actor=Depends(require_permission("persons:manage", "person")),
    session: Session = Depends(get_session),
):
    p = session.get(Person, person_id)
    if not p:
        raise HTTPException(404, "person not found")
    if body.name:
        p.name = body.name
    if body.department is not None:
        p.department = body.department
    if body.role_code:
        p.role_code = body.role_code
        # 同步 person_role: 删除旧角色重新添加
        old_roles = session.exec(
            select(PersonRole).where(PersonRole.person_id == p.id)
        ).all()
        for r in old_roles:
            session.delete(r)
        session.add(PersonRole(person_id=p.id, role_code=body.role_code))
        if body.department == "售后部" and body.role_code != "after_sales_super":
            other = "acceptance_executor" if body.role_code == "tuning_executor" else "tuning_executor"
            session.add(PersonRole(person_id=p.id, role_code=other))
    session.add(p)
    session.flush()
    return person_to_out(p)


@router.delete("/{person_id}", status_code=204)
def delete_person(
    person_id: uuid.UUID,
    actor=Depends(require_permission("persons:manage", "person")),
    session: Session = Depends(get_session),
):
    p = session.get(Person, person_id)
    if not p:
        raise HTTPException(404, "person not found")
    session.delete(p)


@router.patch("/{person_id}/status", response_model=PersonOut)
def toggle_person_status(
    person_id: uuid.UUID,
    body: PersonStatusUpdate,
    actor=Depends(require_permission("persons:manage", "person")),
    session: Session = Depends(get_session),
):
    p = session.get(Person, person_id)
    if not p:
        raise HTTPException(404, "person not found")
    p.is_active = body.is_active
    session.add(p)
    session.flush()
    return person_to_out(p)


@router.post("/{person_id}/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    person_id: uuid.UUID,
    body: ResetPasswordRequest,
    actor=Depends(require_permission("persons:manage", "person")),
    session: Session = Depends(get_session),
):
    p = session.get(Person, person_id)
    if not p:
        raise HTTPException(404, "person not found")
    p.password_hash = hash_password(body.new_password)
    session.add(p)
    session.flush()
    return ResetPasswordResponse(password=body.new_password)
