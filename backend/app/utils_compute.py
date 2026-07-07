"""Phase / project status computation — single source of truth."""
from __future__ import annotations

import json
from datetime import date, timedelta

WARNING_LEAD_DAYS = 3


def add_working_days(start: date, n_days: int) -> date:
    current = start; added = 0
    while added < n_days:
        current += timedelta(days=1)
        if current.weekday() < 5: added += 1
    return current


def calc_warning_date(planned_end: date, lead_days: int = WARNING_LEAD_DAYS) -> date:
    current = planned_end; count = 0
    while count < lead_days:
        current -= timedelta(days=1)
        if current.weekday() < 5: count += 1
    return current


def compute_phase_progress(
    status: str,
    planned_end_date: date | None,
    actual_end_date: date | None,
    warning_date: date | None = None,
    terminal_statuses: list[str] | None = None,
    *,
    _today: date | None = None,
) -> str:
    if terminal_statuses:
        if status in terminal_statuses: return '已完成'
    elif actual_end_date is not None: return '已完成'
    today = _today or date.today()
    if planned_end_date is not None:
        if today > planned_end_date: return '逾期'
        wd = warning_date or calc_warning_date(planned_end_date)
        if today >= wd: return '预警'
    if status and status != '未开始': return '进行中'
    return '未开始'


def compute_project_status(phases: list[dict]) -> str:
    if not phases: return '正常'
    if any(ph.get('phase_progress') == '逾期' for ph in phases): return '逾期'
    if all(ph.get('phase_progress') == '已完成' for ph in phases): return '已完成'
    return '正常'



def compute_payment_due_date(
    due_type: str | None, due_days: int | None, phases: list[dict],
    *, _today: date | None = None,
) -> date | None:
    if not due_type or due_days is None: return None
    today = _today or date.today()
    if due_type == "after_shipping":
        for prod in phases:
            if prod.get("seq") == 2 and prod.get("status") == "已发货":
                return (prod.get("actual_end_date") or today) + timedelta(days=due_days)
    elif due_type in ("after_acceptance", "after_tuning"):
        for tune in phases:
            if tune.get("seq") == 3:
                base = tune.get("actual_end_date") or (
                    tune.get("start_date") and (tune["start_date"] + timedelta(days=30)))
                if base:
                    return base + timedelta(days=due_days)
    return None
