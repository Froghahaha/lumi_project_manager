"""
从 Excel 导入「项目节点进度表」到数据库

用法:
  conda activate LumiGrasp
  python -m backend.app.import_excel
"""

import sys
from pathlib import Path

# 添加项目根目录到 sys.path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from datetime import date, timedelta
from _read_excel import parse_excel, IncidentEvent

from backend.app.db import init_db, session_scope, engine, PRODUCTION_TEMPLATE_ID
from backend.app.models import (
    Customer,
    Project,
    ProjectAssignment,
    ProjectPhase,
    PhaseIncident,
    PhaseTemplate,
)


def _resolve_incident_date(
    inc: IncidentEvent,
    phase_start: date | None,
    phase_end: date | None,
) -> date:
    """将 IncidentEvent 的 date_str (如"1-8") 补齐为完整日期"""
    if not inc.date_str:
        return phase_start or date.today()

    parts = inc.date_str.split("-")
    if len(parts) != 2:
        return phase_start or date.today()

    try:
        m, d = int(parts[0]), int(parts[1])
    except ValueError:
        return phase_start or date.today()

    # 从工序开始/结束时间推断年份
    if phase_start and phase_end:
        ref_year = phase_end.year
        candidate = date(ref_year, m, d)
        # 如果事件在工序结束后，尝试前一年
        if candidate > phase_end + timedelta(days=60):
            candidate = date(ref_year - 1, m, d)
        # 如果事件在工序开始前很久，尝试下一年
        if candidate < phase_start - timedelta(days=60):
            candidate = date(ref_year + 1, m, d)
        return candidate

    if phase_start:
        return date(phase_start.year, m, d)

    return date(date.today().year, m, d)


def import_excel(file_path: str) -> dict:
    """导入 Excel 到数据库，返回统计摘要"""
    init_db()

    workorders = parse_excel(file_path)
    stats = {"projects": 0, "phases": 0, "incidents": 0, "team": 0, "customers": 0}

    tmpl_id = PRODUCTION_TEMPLATE_ID
    customer_cache: dict[str, Customer] = {}

    with session_scope() as session:
        for wo in workorders:
            # Customer
            customer_code = wo.customer.code
            if customer_code not in customer_cache:
                customer = session.exec(
                    Customer.__table__.select().where(Customer.code == customer_code)
                ).first()
                if not customer:
                    customer = Customer(code=customer_code, name=wo.customer.name)
                    session.add(customer)
                    session.flush()
                    stats["customers"] += 1
                customer_cache[customer_code] = customer
            customer = customer_cache[customer_code]

            # Project
            project = Project(
                order_no=wo.order_no,
                customer_id=customer.id,
                end_customer=wo.end_customer or None,
                template_id=tmpl_id,
                equipment_category=wo.equipment.category,
                equipment_quantity=wo.equipment.quantity,
                equipment_spec=wo.equipment.spec,
                contract_start_date=wo.contract.start_date,
                contract_duration_days=wo.contract.duration_days,
                contract_expected_delivery_date=wo.contract.expected_delivery_date,
                contract_actual_delivery_days=wo.contract.actual_delivery_duration,
                contract_payment_progress=wo.contract.payment_progress,
                is_abnormal=wo.is_abnormal,
            )
            session.add(project)
            session.flush()
            stats["projects"] += 1

            # 计算项目时间范围，用于补齐 incident 的年份
            phase_dates = [op.start_date for op in wo.operations if op.start_date]
            phase_dates += [op.actual_end_date for op in wo.operations if op.actual_end_date]
            proj_start = min(phase_dates) if phase_dates else None
            proj_end = max(phase_dates) if phase_dates else None

            # Phases
            for op in sorted(wo.operations, key=lambda x: x.seq):
                phase = ProjectPhase(
                    project_id=project.id,
                    seq=op.seq,
                    phase_name=op.phase,
                    sub_name="",
                    responsible=op.responsible,
                    start_date=op.start_date,
                    warning_date=op.warning_date,
                    planned_end_date=op.planned_end_date,
                    planned_duration=op.planned_duration,
                    actual_end_date=op.actual_end_date,
                    actual_duration=op.actual_duration,
                )
                session.add(phase)
                session.flush()
                stats["phases"] += 1

                # Incidents
                for inc in op.incidents:
                    occurred = _resolve_incident_date(inc, op.start_date, op.actual_end_date)
                    pi = PhaseIncident(
                        phase_id=phase.id,
                        occurred_at=occurred,
                        category=inc.category,
                        description=inc.description,
                    )
                    session.add(pi)
                    stats["incidents"] += 1

            # Assignments (从 team 数据推断角色)
            for tm in wo.team:
                # 将旧的 role 映射为 role_code
                role_map = {
                    "销售": "sales_assistant",
                    "项目经理": "project_manager",
                    "设计": "mechanical_designer",
                    "生产": "production_executor",
                    "调机": "tuning_executor",
                    "验收": "after_sales_super",
                    "收款": "sales_assistant",
                    "代理商": "sales_assistant",
                }
                role_code = role_map.get(tm.role, "project_manager")
                pa = ProjectAssignment(
                    project_id=project.id,
                    person_name=tm.name,
                    role_code=role_code,
                    phase_id=None,
                )
                session.add(pa)
                stats["team"] += 1

    return stats


if __name__ == "__main__":
    file_path = str(ROOT / "项目节点进度表20260508.xlsx")
    print(f"导入: {file_path}")
    stats = import_excel(file_path)
    print(f"完成: {stats}")
