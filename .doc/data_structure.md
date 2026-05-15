# 本文件代表项目现状，不是任务目标

role_definition              角色定义 (系统预置)
 ├── code / name / category / assigns_json

project_assignment           项目人员指派
 ├── project_id / person_name / role_code(FK) / target_phase_seq

project                      项目工单
 ├── order_no / customer / contract / equipment / is_abnormal
 ├── assignments: list[ProjectAssignment]

project_phase                工序
 ├── seq / phase_name / responsible / status / 时间字段 ...
 ├── subtasks: list[PhaseSubtask]
 └── incidents: list[PhaseIncident]

phase_subtask                子任务 (工序级任务拆分)
 ├── phase_id / name / responsible / status / seq

phase_incident               事故时间线
 ├── phase_id / occurred_at / category / description

phase_template               模板
phase_template_item          模板工序
 ├── phase_name / sub_statuses_json / seq

## 工序模板 (种子数据)
| seq | phase_name | sub_statuses |
|-----|-----------|--------------|
| 1   | 机械设计   | 未开始 → 设计中 → 图纸已下发 |
| 2   | 生产       | 未开始 → 生产中 → 生产完成 → 已发货 |
| 3   | 调机       | 未开始 → 安调中 → 安调完成 |
| 4   | 验收       | 未开始 → 已验收 |
| 5   | 尾款       | (收款进度替代) |

## 角色定义 (种子数据)
| code | name | category |
|------|------|----------|
| admin | 超级管理员 | admin |
| tech_supervisor | 技术主管 | supervisor |
| after_sales_super | 售后主管 | supervisor |
| project_manager | 项目经理 | executor |
| sales_assistant | 销售助理 | executor |
| mechanical_designer | 机械设计执行人 | executor |
| software_designer | 软件设计执行人 | executor |
| production_executor | 生产执行人 | executor |
| tuning_executor | 安调执行人 | executor |