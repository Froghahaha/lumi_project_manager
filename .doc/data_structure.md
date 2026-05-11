WorkOrder (工单)
 ├── order_no: str
 ├── customer: Customer
 ├── equipment: Equipment
 ├── contract: Contract
 ├── is_abnormal: bool
 │
 ├── team: list[ResourceAssignment]     ← 人员角色化
 │     └── name / role
 │
 ├── operations: list[Operation]        ← 5 工序
 │     ├── seq / phase / responsible
 │     ├── start_date / planned_end_date / actual_end_date
 │     ├── planned_duration / actual_duration
 │     ├── overdue_days / is_overdue
 │     └── incidents: list[IncidentEvent]  ← 事故事件时间线
 │           ├── date_str: str
 │           ├── category: "原因"|"现状"|"应急"|"长效"|""
 │           └── description: str
 │
 ├── Resource (全局)
 │     └── name / role / workload
 │
 └── @property
       ├── total_overdue_days
       ├── has_overdue
       ├── project_start_date
       └── project_end_date