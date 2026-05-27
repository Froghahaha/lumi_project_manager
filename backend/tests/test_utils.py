"""Unit tests for computed-phase-status helpers in app.utils."""

from datetime import date, timedelta
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils import compute_phase_progress, compute_project_status


today = date.today()


def _d(offset: int) -> date:
    return today + timedelta(days=offset)


# ─── compute_phase_progress ──────────────────────────────────


class TestComputePhaseProgress:
    def test_completed_with_actual_end_date(self):
        assert compute_phase_progress(
            status='设计中',
            planned_end_date=_d(-5),
            actual_end_date=_d(-3),
            _today=today,
        ) == '已完成'

    def test_overdue_past_planned_end(self):
        assert compute_phase_progress(
            status='生产中',
            planned_end_date=_d(-3),
            actual_end_date=None,
            _today=today,
        ) == '逾期'

    def test_warning_past_warning_not_yet_overdue(self):
        assert compute_phase_progress(
            status='生产中',
            planned_end_date=_d(5),
            warning_date=_d(-1),
            actual_end_date=None,
            _today=today,
        ) == '预警'

    def test_warning_no_warning_date_uses_calculated(self):
        # planned_end_date = +1 day is within the 3-working-day window
        assert compute_phase_progress(
            status='设计中',
            planned_end_date=_d(1),
            actual_end_date=None,
            _today=today,
        ) == '预警'

    def test_in_progress(self):
        assert compute_phase_progress(
            status='设计中',
            planned_end_date=_d(30),
            actual_end_date=None,
            _today=today,
        ) == '进行中'

    def test_not_started_empty(self):
        assert compute_phase_progress(
            status='',
            planned_end_date=None,
            actual_end_date=None,
            _today=today,
        ) == '未开始'

    def test_not_started_status_is_wei_kaishi(self):
        assert compute_phase_progress(
            status='未开始',
            planned_end_date=_d(30),
            actual_end_date=None,
            _today=today,
        ) == '未开始'

    def test_completed_via_success_status_no_dates(self):
        """Phase with status that maps to 'success' counts as completed."""
        assert compute_phase_progress(
            status='图纸已下发',
            planned_end_date=None,
            actual_end_date=None,
            _today=today,
        ) == '进行中'


# ─── compute_project_status ──────────────────────────────────


class TestComputeProjectStatus:
    def test_overdue_has_one_overdue_phase(self):
        phases = [
            {'phase_progress': '逾期'},
            {'phase_progress': '已完成'},
        ]
        assert compute_project_status(phases) == '逾期'

    def test_completed_all_phases_completed(self):
        phases = [
            {'phase_progress': '已完成'},
            {'phase_progress': '已完成'},
        ]
        assert compute_project_status(phases) == '已完成'

    def test_normal_mixed(self):
        phases = [
            {'phase_progress': '进行中'},
            {'phase_progress': '已完成'},
        ]
        assert compute_project_status(phases) == '正常'

    def test_normal_with_warning(self):
        phases = [
            {'phase_progress': '预警'},
            {'phase_progress': '进行中'},
        ]
        assert compute_project_status(phases) == '正常'

    def test_normal_empty(self):
        assert compute_project_status([]) == '正常'
