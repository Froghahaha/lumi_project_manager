"""
读取「项目节点进度表20260508.xlsx」并解析为结构化模型

数据原始结构:
  表头 Row0
  每个项目 5~6 行(少数项目多一行备注):
    Row N:   美尔斯-1  | 否 | 4台20KG | 销售人员  | 立项日期 | 45378  | 设计     | 余皓然 ...
    Row N+1:  [合并]   |     |         | 刘伟伟    | 合同天数 | 30     | 生产     | 周小浪 ...
    Row N+2:  [合并]   |     |         | 项目经理  | 预计交期 | ...    | 调机派遣 | 王文哲 ...
    Row N+3:  [合并]   |     |         | 张胡斌    | 实际交期 | ...    | 验收     | 无     ...
    Row N+4:  [合并]   |     |         | /         | 收款进度 | 0.375  | 尾款     | 刘伟伟 ...

  col[0] 合并单元格，非空即项目边界。
  col[16] 是工序的事故日志，格式为:
    "原因：..."\n"现状：MM-DD  事件...\n   MM-DD  事件..."\n"应急：..."
"""

import re
import pandas as pd
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from typing import Optional


# ============================================================
# 数据模型
# ============================================================

@dataclass
class Customer:
    code: str
    name: str


@dataclass
class Equipment:
    category: str
    quantity: int
    spec: str


@dataclass
class Contract:
    start_date: Optional[date] = None
    duration_days: Optional[int] = None
    expected_delivery_date: Optional[date] = None
    actual_delivery_duration: Optional[int] = None
    payment_progress: Optional[float] = None


@dataclass
class IncidentEvent:
    """事故事件——工序的意外事件时间线"""
    date_str: str                  # "1-8" 原始日期(无年)
    category: str                  # "原因"|"现状"|"应急"|"长效"|""
    description: str               # 事件描述


@dataclass
class Operation:
    """工序"""
    seq: int
    phase: str
    responsible: str
    start_date: Optional[date] = None
    warning_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    planned_duration: Optional[int] = None
    actual_end_date: Optional[date] = None
    actual_duration: Optional[int] = None
    incidents: list[IncidentEvent] = field(default_factory=list)


@dataclass
class TeamMember:
    name: str
    role: str


@dataclass
class WorkOrder:
    order_no: str                        # "13"
    customer: Customer
    equipment: Equipment
    contract: Contract
    is_abnormal: bool
    end_customer: str = ""               # "乐阳" (终端客户，选填)
    operations: list[Operation] = field(default_factory=list)
    team: list[TeamMember] = field(default_factory=list)


# ============================================================
# 解析引擎
# ============================================================

PHASE_SEQ = {"设计": 1, "生产": 2, "调机派遣": 3, "验收": 4, "尾款": 5}

# 工序到角色的映射
PHASE_ROLE = {
    "设计": "设计", "生产": "生产", "调机派遣": "调机",
    "验收": "验收", "尾款": "收款",
}

EQUIP_CATEGORY_RULES = [
    ("视觉", "视觉桁架"),
    ("关节", "关节"),
    ("联线", "联线"),
    ("桁架", "桁架"),
]

# 事故日志类别关键词
_INCIDENT_CATEGORIES = ["原因", "现状", "应急", "长效"]


def parse_incidents(raw: str) -> list[IncidentEvent]:
    """从 col16 文本解析出事故事件列表"""
    if not raw:
        return []

    events: list[IncidentEvent] = []
    current_cat = ""

    for line in raw.split("\n"):
        line = line.strip()
        if not line:
            continue

        # 检测类别行: "原因：..." "现状：..." "应急：..." "长效：..."
        cat_match = re.match(r"^(原因|现状|应急|长效)[：:]\s*(.*)", line)
        if cat_match:
            current_cat = cat_match.group(1)
            content = cat_match.group(2).strip()
            if content:
                # 内容可能也包含日期
                _parse_incident_line(events, current_cat, content)
            continue

        # 非类别行，使用当前类别
        if current_cat:
            _parse_incident_line(events, current_cat, line)

    return events


def _parse_incident_line(events: list, category: str, text: str):
    """解析单行事件文本"""
    # 尝试匹配 "MM-DD  内容" 或 "MM.DD  内容"
    date_match = re.match(r"(\d{1,2})[-\.](\d{1,2})\s+(.*)", text)
    if date_match:
        date_str = f"{date_match.group(1)}-{date_match.group(2)}"
        desc = date_match.group(3).strip()
        events.append(IncidentEvent(
            date_str=date_str,
            category=category,
            description=desc,
        ))
    else:
        events.append(IncidentEvent(
            date_str="",
            category=category,
            description=text,
        ))


def parse_excel(file_path: str) -> list[WorkOrder]:
    df = pd.read_excel(file_path, sheet_name=0, engine='calamine', header=None)

    orders: list[WorkOrder] = []
    customer_cache: dict[str, Customer] = {}
    contract_data: dict = {}
    persons: list[tuple[str, str]] = []  # (name, phase)
    current: Optional[WorkOrder] = None

    for idx in range(1, len(df)):
        row = df.iloc[idx]
        proj_name = str(row[0]).strip() if pd.notna(row[0]) else ""

        if proj_name:
            if current is not None:
                _finalize_workorder(current, contract_data, persons)
                orders.append(current)

            is_abnormal = (str(row[1]).strip() if pd.notna(row[1]) else "") != "正常"
            desc_raw = str(row[2]).strip() if pd.notna(row[2]) else ""
            equip = _parse_equipment(desc_raw)
            customer_name, order_no, end_customer = _parse_project_name(proj_name)

            if customer_name not in customer_cache:
                customer_cache[customer_name] = Customer(code=customer_name, name=customer_name)
            customer = customer_cache[customer_name]

            contract_data = {}
            persons = []
            _merge_contract(contract_data, str(row[4]).strip() if pd.notna(row[4]) else "", row[5])
            _collect_persons(persons, str(row[3]).strip() if pd.notna(row[3]) else "",
                             str(row[6]).strip() if pd.notna(row[6]) else "")

            current = WorkOrder(
                order_no=order_no,
                customer=customer,
                equipment=equip,
                contract=Contract(),
                is_abnormal=is_abnormal,
                end_customer=end_customer,
            )

        if current is None:
            continue

        label = str(row[4]).strip() if pd.notna(row[4]) else ""
        if label:
            _merge_contract(contract_data, label, row[5])

        raw_p = str(row[3]).strip() if pd.notna(row[3]) else ""
        phase_name = str(row[6]).strip() if pd.notna(row[6]) else ""
        if raw_p:
            _collect_persons(persons, raw_p, phase_name)

        if not phase_name:
            continue

        seq = PHASE_SEQ.get(phase_name, 99)

        log_raw = str(row[16]).strip() if pd.notna(row[16]) else ""
        incidents = parse_incidents(log_raw)

        op = Operation(
            seq=seq,
            phase=phase_name,
            responsible=str(row[7]).strip() if pd.notna(row[7]) else "",
            start_date=_to_date(row[8]),
            warning_date=_to_date(row[9]),
            planned_end_date=_to_date(row[10]),
            planned_duration=_to_int(row[11]),
            actual_end_date=_to_date(row[12]),
            actual_duration=_to_int(row[13]),
            incidents=incidents,
        )
        current.operations.append(op)

    if current is not None:
        _finalize_workorder(current, contract_data, persons)
        orders.append(current)

    return orders


def _finalize_workorder(wo: WorkOrder, contract_data: dict, persons: list[tuple[str, str]]):
    wo.contract = Contract(**{k: v for k, v in contract_data.items() if k in
                              ("start_date", "duration_days", "expected_delivery_date",
                               "actual_delivery_duration", "payment_progress")})
    # 构建团队——去重，保留先出现的角色
    seen = set()
    team: list[TeamMember] = []
    for name, phase in persons:
        if name in _ROLE_LABELS:
            continue
        role = _infer_role(name, phase)
        if name not in seen:
            seen.add(name)
            team.append(TeamMember(name=name, role=role))
        else:
            # 已有此人，升级角色信息
            for m in team:
                if m.name == name:
                    if m.role == "其他" and role != "其他":
                        m.role = role
                    break
    wo.team = team


def _infer_role(name: str, phase: str) -> str:
    """根据人员名字和所在工序推断角色"""
    if "销售" in name:
        return "销售"
    if "经理" in name:
        return "项目经理"
    if "代理商" in name:
        return "代理商"
    if phase and phase in PHASE_ROLE:
        return PHASE_ROLE[phase]
    return "其他"


# 角色标签（非人名），不应作为团队成员导入
_ROLE_LABELS = {"销售人员", "项目经理", "代理商", "/", "无", ""}


def _collect_persons(acc: list[tuple[str, str]], raw: str, phase: str):
    """收集人员——过滤掉角色标签"""
    for p in raw.replace("/", "").split("\n"):
        p = p.strip()
        if p and p not in _ROLE_LABELS and (p, phase) not in acc:
            acc.append((p, phase))


def _parse_equipment(desc: str) -> Equipment:
    cat = "其他"
    for keyword, label in EQUIP_CATEGORY_RULES:
        if keyword in desc:
            cat = label
            break
    nums = re.findall(r"(\d+)\s*台", desc)
    qty = int(nums[0]) if nums else 1
    return Equipment(category=cat, quantity=qty, spec=desc)


_PROJECT_NAME_RE = re.compile(
    r"^(.+?)-(\S+?)(?:\n?[（(](.+?)[）)])?$"
)


def _parse_project_name(raw: str) -> tuple[str, str, str]:
    """解析"浙江东格马-13（乐阳）" → ("浙江东格马", "13", "乐阳")"""
    m = _PROJECT_NAME_RE.match(raw)
    if m:
        return m.group(1).strip(), m.group(2).strip(), (m.group(3) or "").strip()
    return raw, "", ""


_CONTRACT_MAP = {
    "立项日期": "start_date",
    "合同天数": "duration_days",
    "预计交期": "expected_delivery_date",
    "实际交期": "actual_delivery_duration",
    "收款进度": "payment_progress",
}


def _merge_contract(data: dict, label: str, value):
    field = _CONTRACT_MAP.get(label.strip())
    if not field:
        return
    if field in ("start_date", "expected_delivery_date"):
        dt = _to_date(value)
        if dt:
            data[field] = dt
    elif field in ("duration_days", "actual_delivery_duration"):
        v = _to_int(value)
        if v is not None:
            data[field] = v
    elif field == "payment_progress":
        try:
            data[field] = float(value)
        except (ValueError, TypeError):
            pass


def _to_int(val) -> Optional[int]:
    if pd.isna(val):
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _to_date(val) -> Optional[date]:
    if val is None or pd.isna(val):
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, pd.Timestamp):
        return val.date()
    if isinstance(val, (int, float)):
        base = datetime(1899, 12, 30)
        return (base + timedelta(days=float(val))).date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(val.strip(), fmt).date()
            except ValueError:
                continue
    return None


# ============================================================
# 分析报告
# ============================================================

def print_report(orders: list[WorkOrder]):
    from collections import Counter

    def _is_overdue(op: Operation) -> bool:
        if not op.planned_end_date:
            return False
        end = op.actual_end_date or date.today()
        return end > op.planned_end_date

    def _overdue_days(op: Operation) -> int:
        if not op.planned_end_date:
            return 0
        end = op.actual_end_date or date.today()
        delta = end - op.planned_end_date
        return max(0, delta.days)

    def _project_start(wo: WorkOrder) -> date | None:
        dates = [op.start_date for op in wo.operations if op.start_date]
        return min(dates) if dates else None

    def _project_end(wo: WorkOrder) -> date | None:
        dates = [op.actual_end_date for op in wo.operations if op.actual_end_date]
        return max(dates) if dates else None

    print(f"{'=' * 120}")
    print(f"解析完成: {len(orders)} 工单, {len({o.customer.code for o in orders})} 客户")
    print(f"{'=' * 120}")

    abnormal = sum(1 for o in orders if o.is_abnormal)
    overdue_ops = sum(1 for o in orders for op in o.operations if _is_overdue(op))
    total_incidents = sum(len(op.incidents) for o in orders for op in o.operations)
    print(f"  异常工单: {abnormal}  逾期工序: {overdue_ops}  事故事件: {total_incidents}")

    cat_cnt = Counter(o.equipment.category for o in orders)
    print(f"\n设备类型: {dict(cat_cnt)}")

    person_load: dict[str, Counter] = {}
    for wo in orders:
        for m in wo.team:
            if m.name not in person_load:
                person_load[m.name] = Counter()
            person_load[m.name][m.role] += 1
    overloaded = sorted(
        person_load.items(),
        key=lambda x: -sum(x[1].values()),
    )
    print(f"\n人员跨项目负载:")
    for name, roles in overloaded[:15]:
        total = sum(roles.values())
        role_str = ",".join(f"{r}({c})" for r, c in roles.most_common(3))
        print(f"  {name:<8}  {total:>2} 个项目参与  角色: {role_str}")

    root_causes = Counter()
    for o in orders:
        for op in o.operations:
            for inc in op.incidents:
                if inc.category == "原因":
                    root_causes[inc.description[:30]] += 1
    if root_causes:
        print(f"\n根因统计 (Top 10):")
        for desc, cnt in root_causes.most_common(10):
            print(f"  \"{desc}...\" x {cnt}")

    print(f"\n{'=' * 120}")
    print(f"工单明细")
    print(f"{'=' * 120}")
    for i, wo in enumerate(orders[:5], 1):
        print(f"\n{'─' * 100}")
        ec = f" (终端: {wo.end_customer})" if wo.end_customer else ""
        print(f"  [{i}] {wo.customer.code}-{wo.order_no}{ec}")
        print(f"      设备: {wo.equipment.spec[:40]}")
        print(f"      异常: {'[是]' if wo.is_abnormal else '否'}")
        c = wo.contract
        print(f"      合同: 立项={c.start_date or '-'}  {c.duration_days or '-'}天  "
              f"预计交期={c.expected_delivery_date or '-'}  "
              f"收款={f'{c.payment_progress*100:.1f}%' if c.payment_progress is not None else '-'}")
        print(f"      团队: {', '.join(f'{m.name}({m.role})' for m in wo.team)}")

        print(f"      工序 ({len(wo.operations)}):")
        print(f"        {'序':>2} {'名称':<8} {'责任人':<8} {'开始':<8} {'预计':<8} "
              f"{'完结':<8} {'逾天':>4} {'逾期':<5}")
        print(f"        {'-'*59}")
        for op in sorted(wo.operations, key=lambda x: x.seq):
            s = op.start_date.strftime('%m-%d') if op.start_date else '--'
            e = op.planned_end_date.strftime('%m-%d') if op.planned_end_date else '--'
            a = op.actual_end_date.strftime('%m-%d') if op.actual_end_date else '--'
            flag = "[逾]" if _is_overdue(op) else "[OK]"
            print(f"        {op.seq:>2} {op.phase:<8} {op.responsible:<8} "
                  f"{s:<8} {e:<8} {a:<8} {_overdue_days(op):>4} {flag:<5}")
            if op.incidents:
                for inc in op.incidents[:3]:
                    tag = f"({inc.category})" if inc.category else ""
                    short = inc.description[:40]
                    dt = f"{inc.date_str} " if inc.date_str else ""
                    print(f"          {dt}{tag} {short}")
                if len(op.incidents) > 3:
                    print(f"          ... 还有 {len(op.incidents)-3} 条事件")

    print(f"\n{'=' * 100}")
    print(f"工单聚合信息 (前5)")
    print(f"{'=' * 100}")
    for wo in orders[:5]:
        total_inc = sum(len(op.incidents) for op in wo.operations)
        total_od = sum(_overdue_days(op) for op in wo.operations)
        label = f"{wo.customer.code}-{wo.order_no}"
        if wo.end_customer:
            label += f"({wo.end_customer})"
        print(f"  {label}:  开始={_project_start(wo) or '-'}  "
              f"完结={_project_end(wo) or '-'}  "
              f"逾期合计={total_od}天  "
              f"事故数={total_inc}")


if __name__ == "__main__":
    fp = r'c:\Code\lumi_project_manager\项目节点进度表20260508.xlsx'
    orders = parse_excel(fp)
    print_report(orders)
