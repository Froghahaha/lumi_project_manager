"""Auth — /login, /me/permissions"""

from __future__ import annotations

import secrets
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..deps import SESSION_TTL, _token_store, get_current_user, get_session
from ..models import Person, PersonRole
from ..schemas import LoginRequest, LoginResponse, ResetPasswordRequest, ResetPasswordResponse
from ..utils import hash_password, person_to_out, verify_password

router = APIRouter(tags=["auth"])

from ..authz import get_all_permissions  # noqa: E402 — avoid circular


@router.get("/me/permissions")
def my_permissions(actor=Depends(get_current_user)):
    return get_all_permissions(actor)


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    person = session.exec(select(Person).where(Person.name == body.person_name)).first()
    if not person:
        raise HTTPException(401, "人员不存在")
    if not verify_password(body.password, person.password_hash):
        raise HTTPException(401, "密码错误")
    # 从 person_role 多对多表读取所有角色
    role_rows = session.exec(
        select(PersonRole.role_code).where(PersonRole.person_id == person.id)
    ).all()
    roles = list(role_rows) if role_rows else ([person.role_code] if person.role_code else [])

    token = secrets.token_hex(32)
    _token_store[token] = {
        "person_id": str(person.id),
        "person_name": person.name,
        "roles": roles,
        "expires": time.time() + SESSION_TTL,
    }
    person_out = person_to_out(person)
    return LoginResponse(person=person_out, token=token)
