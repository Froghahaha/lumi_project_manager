"""Phase lifecycle — single source of truth for all phase behavior.

Template data in DB (seed.py) is the master config. This module reads
from DB on startup and provides a zero-DB-lookup API for hot-path
computation functions.

Add a new phase type or change behavior: edit seed.py template items,
restart. Everything flows from here.
"""

from __future__ import annotations

import json
from datetime import date, timedelta

from sqlmodel import Session, select

from .db import PRODUCTION_TEMPLATE_ID, engine

# ── In-memory config cache (loaded from DB template at startup) ──

_config: dict[int, dict] = {}
_loaded = False

PHASE_ORDER = [1, 2, 3, 4, 5]


def _load():
    global _config, _loaded
    if _loaded:
        return
    from .models import PhaseTemplateItem
    with Session(engine) as session:
        items = session.exec(
            select(PhaseTemplateItem).where(
                PhaseTemplateItem.template_id == PRODUCTION_TEMPLATE_ID
            )
        ).all()
        for item in items:
            _config[item.seq] = {
                'name': item.phase_name,
                'sub_statuses': json.loads(item.sub_statuses_json) if item.sub_statuses_json else [],
                'terminal_statuses': json.loads(item.terminal_statuses_json) if item.terminal_statuses_json else [],
            }
    _loaded = True


def reload():
    global _loaded
    _loaded = False
    _load()


# ── Public API ─────────────────────────────────────────────────


def get_config(seq: int) -> dict | None:
    _load()
    return _config.get(seq)


def get_name(seq: int) -> str:
    cfg = get_config(seq)
    return cfg['name'] if cfg else ''


def get_sub_statuses(seq: int) -> list[str]:
    cfg = get_config(seq)
    return cfg['sub_statuses'] if cfg else []


def get_terminal_statuses(seq: int) -> list[str]:
    cfg = get_config(seq)
    return cfg['terminal_statuses'] if cfg else []


def is_valid_status(seq: int, status: str) -> bool:
    """Check if status is in the phase's allowed status list."""
    sub = get_sub_statuses(seq)
    if not sub:
        return True  # no restriction
    return status in sub


def is_terminal(seq: int, status: str) -> bool:
    return status in get_terminal_statuses(seq)


def get_init_status(seq: int) -> str:
    """Phase-specific initial status when created/started."""
    mapping = {5: '进行中'}  # 尾款 starts in-progress
    return mapping.get(seq, '')


# Phase completion → triggers tail start (per payment_due_type config)
TAIL_TRIGGER: dict[str, int] = {
    'after_tuning': 3,      # 调机完成
    'after_shipping': 2,    # 生产已发货
    'after_acceptance': 4,  # 验收完成
}


def apply_terminal_side_effect(seq: int, status: str, project_id: str, session: Session) -> bool:
    """Called after a phase status is updated. Returns True if side effect applied."""
    if not is_terminal(seq, status):
        return False

    from .models import Project
    proj = session.get(Project, project_id)
    trigger_seq = TAIL_TRIGGER.get(proj.payment_due_type, 4) if proj else 4
    if seq == trigger_seq:
        _activate_tail(project_id, session)
        return True
    return False




# ── Phase-level access control ───────────────────────────────

SUPERVISOR_MANAGED: dict[str, list[int]] = {
    'tech_supervisor': [1, 2],
    'after_sales_super': [3, 4, 5],
}

def can_manage_phase(roles: list[str], seq: int) -> bool:
    """Check if any of the actor's roles can manage this phase seq."""
    if 'admin' in roles:
        return True
    for role, seqs in SUPERVISOR_MANAGED.items():
        if role in roles and seq in seqs:
            return True
    return False
def _activate_tail(project_id: str, session: Session) -> None:
    from .models import Project, ProjectPhase
    proj = session.get(Project, project_id)
    if not proj:
        return
    tail = session.exec(
        select(ProjectPhase).where(
            ProjectPhase.project_id == project_id,
            ProjectPhase.seq == 5,
        )
    ).first()
    if not tail or tail.start_date:
        return
    tail.start_date = date.today()
    if proj.payment_due_days:
        tail.planned_end_date = tail.start_date + timedelta(days=proj.payment_due_days)
    tail.status = '进行中'
    session.add(tail)

