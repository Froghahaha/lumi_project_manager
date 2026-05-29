from __future__ import annotations

import sys

import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from fastapi import Depends, HTTPException, Request
from sqlmodel import Session

from .authz import AppUser, oso
from .db import session_scope

# ─── Upload paths ──────────────────────────────────────────

if getattr(sys, 'frozen', False):
    UPLOAD_DIR = Path(sys.executable).parent / "uploads"
else:
    UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
AGREEMENT_DIR = UPLOAD_DIR / "agreements"
AGREEMENT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Token store (in-memory session) ───────────────────────

SESSION_TTL = 24 * 3600  # 24 hours
_token_store: dict[str, dict] = {}


def _cleanup_expired() -> None:
    now = time.time()
    expired = [t for t, v in _token_store.items() if v["expires"] < now]
    for t in expired:
        del _token_store[t]


# ─── FastAPI dependencies ──────────────────────────────────

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_session() -> Iterable[Session]:
    with session_scope() as session:
        yield session


def get_current_user(request: Request) -> AppUser:
    """Validate the Bearer token and return the authenticated user."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "未登录")
    token = auth[7:]
    _cleanup_expired()
    session = _token_store.get(token)
    if not session or session["expires"] < time.time():
        raise HTTPException(401, "登录已过期，请重新登录")
    return AppUser(
        person_id=session["person_id"],
        person_name=session["person_name"],
        roles=session["roles"],
    )


def require_permission(action: str, resource: str = "resource"):
    """Dependency factory: use Oso policy to check the permission."""
    def checker(actor: AppUser = Depends(get_current_user)):
        if not oso.is_allowed(actor, action, resource):
            raise HTTPException(403, "权限不足")
        return actor
    return checker


def deny_salesman(actor: AppUser = Depends(get_current_user)):
    """Block salesman role from write operations — they are view-only except incidents."""
    if "salesman" in actor.roles and "admin" not in actor.roles:
        raise HTTPException(403, "销售员无权编辑项目信息")
    return actor
