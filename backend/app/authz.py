from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from oso import Oso


@dataclass
class AppUser:
    person_id: str
    person_name: str
    roles: list[str]


# ─── Oso instance ──────────────────────────────────────────

oso = Oso()
oso.register_class(AppUser)
oso.load_files([str(Path(__file__).parent / "authorization.polar")])

# ─── Permission keys → resource type mapping ───────────────

PERMISSION_RESOURCE = {
    # API
    "projects:create": "project",
    "projects:edit": "project",
    "projects:delete": "project",
    "persons:manage": "person",
    "phases:add": "project",
    "phases:delete": "project",
    "customers:manage": "customer",
    # UI
    "view_payment_column": "ui",
    "edit_payment": "ui",
    "create_project_form": "ui",
    "view_all_projects": "ui",
    "view_project_list_page": "ui",
    "manage_customers": "ui",
    "manage_persons": "ui",
    # Workspace config
    "phase_responsibility:1": "ui",
    "phase_responsibility:2": "ui",
    "phase_responsibility:3": "ui",
    "phase_responsibility:4": "ui",
    "show_prev_phase_status": "ui",
    "show_shipped_warning": "ui",
    "cross_phase_view": "ui",
    "manage_tuning_assignment": "ui",
}

ALL_PERMISSIONS = list(PERMISSION_RESOURCE.keys())


def check_permission(actor: AppUser, permission: str) -> bool:
    resource = PERMISSION_RESOURCE.get(permission, "resource")
    return bool(oso.is_allowed(actor, permission, resource))


def get_all_permissions(actor: AppUser) -> dict[str, bool]:
    return {p: check_permission(actor, p) for p in ALL_PERMISSIONS}
