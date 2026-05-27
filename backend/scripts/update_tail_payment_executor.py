"""Update all existing projects: set 尾款 phase responsible to the project's salesman."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import select

from app.db import session_scope
from app.models import Project, ProjectAssignment, ProjectPhase


def migrate() -> None:
    with session_scope() as session:
        projects = session.exec(select(Project)).all()
        updated = 0
        skipped_no_salesman = 0
        skipped_no_tail = 0

        for p in projects:
            salesman = session.exec(
                select(ProjectAssignment).where(
                    ProjectAssignment.project_id == p.id,
                    ProjectAssignment.role_code == 'salesman',
                )
            ).first()
            if not salesman:
                skipped_no_salesman += 1
                continue

            tail = session.exec(
                select(ProjectPhase).where(
                    ProjectPhase.project_id == p.id,
                    ProjectPhase.phase_name == '尾款',
                )
            ).first()
            if not tail:
                skipped_no_tail += 1
                continue

            if tail.responsible != salesman.person_name:
                tail.responsible = salesman.person_name
                session.add(tail)
                updated += 1
                print(f"  {p.order_no}: 尾款 → {salesman.person_name}")

        print(f"\nDone. Updated {updated}, skipped (no salesman) {skipped_no_salesman}, skipped (no 尾款) {skipped_no_tail}")


if __name__ == '__main__':
    migrate()
