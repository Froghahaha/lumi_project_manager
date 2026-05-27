"""Set all existing 尾款 phase status to '进行中'."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import select

from app.db import session_scope
from app.models import ProjectPhase


def migrate() -> None:
    with session_scope() as session:
        tails = session.exec(
            select(ProjectPhase).where(ProjectPhase.phase_name == '尾款')
        ).all()

        updated = 0
        for ph in tails:
            if ph.status != '进行中':
                ph.status = '进行中'
                session.add(ph)
                updated += 1
                print(f"  {ph.project_id}: {ph.status} → 进行中")

        print(f"\nDone. Updated {updated} of {len(tails)} 尾款 phases.")


if __name__ == '__main__':
    migrate()
