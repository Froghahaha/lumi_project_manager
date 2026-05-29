"""Public API — re-exports from utils_compute / utils_serialize."""

import hashlib
import secrets


def hash_password(password: str) -> str:
    salt = secrets.token_hex(8)
    h = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}:{h}"


def verify_password(password: str, password_hash: str) -> bool:
    if ":" not in password_hash:
        return False
    salt, h = password_hash.split(":", 1)
    return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest() == h


from .utils_compute import (  # noqa: E402, F401
    WARNING_LEAD_DAYS,
    add_working_days,
    calc_warning_date,
    compute_phase_progress,
    compute_payment_due_date,
    compute_project_status,
)

from .utils_serialize import (  # noqa: E402, F401
    assignment_to_out,
    customer_to_out,
    equipment_to_out,
    get_or_create_customer,
    incident_to_out,
    person_to_out,
    phase_to_out,
    project_to_out,
    role_to_out,
    template_to_out,
)
