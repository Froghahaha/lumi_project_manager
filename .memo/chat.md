[MODE: INNOVATE]

好。这两条补充很关键。让我重新想清楚。

---

## 机械设计拆子任务——数据模型变化

```
项目: 浙江东格马-13
 └── 工序1: 机械设计  状态: 设计中
      ├── 子任务: 桁架主体设计    负责人: 涂志鹏  状态: 图纸已下发
      ├── 子任务: 料盘夹爪设计    负责人: 张玉龙  状态: 设计中
      ├── 子任务: 防护钣金设计    负责人: 余皓然  状态: 未开始
      └── 子任务: 顶升机设计      负责人: 李枷明  状态: 未开始
```

这解释了为什么 Excel 日志里经常出现"桁架主体已上传"、"料盘夹爪已上传"——这些就是子任务的状态汇报。当前把它们当 incident 存是对的，但实际上它们是子任务的状态流转。

### 子任务需要一张独立的表

```sql
phase_subtask
  id / phase_id / name / responsible / status / seq
```

子状态的值从模板来：`机械设计 → ["未开始", "设计中", "图纸已下发"]`

一个子任务完成的标志是状态流转到最后一个子状态。

### 和 incident 的关系

子任务是**计划内的工作分解**，incident 是**计划外的意外事件**。日志里的"桁架主体已上传"以后应该改为子任务的状态变更，而不是靠文本记录。

---

## 修正后的完整数据模型

```
role_definition              角色定义 (系统预置)
 ├── code / name / category / assigns_json

project_assignment           项目人员指派 (替换 project_team)
 ├── project_id / person_name / role_code / target_phase_seq

project                      项目工单 (不变)
 ├── order_no / customer_id / contract ... / is_abnormal

project_phase                工序
 ├── seq / phase_name / responsible / status / 时间字段 ...

phase_subtask                子任务 (新增)
 ├── phase_id / name / responsible / status / seq

phase_incident               事故时间线 (不变)
 ├── phase_id / occurred_at / category / description

phase_template               模板 (不变)
phase_template_item          模板工序
 ├── phase_name / sub_statuses_json / seq
```

---

## 角色定义

```python
ROLE_DEFINITIONS = [
    {"code": "admin",             "name": "超级管理员",       "category": "admin"},
    {"code": "tech_supervisor",   "name": "技术主管",         "category": "supervisor",
     "assigns": ["project_manager", "mechanical_designer", "software_designer", "production_executor"]},
    {"code": "after_sales_super", "name": "售后主管",         "category": "supervisor",
     "assigns": ["tuning_executor"]},
    {"code": "project_manager",   "name": "项目经理",         "category": "executor"},
    {"code": "sales_assistant",   "name": "销售助理",         "category": "executor"},
    {"code": "mechanical_designer","name": "机械设计执行人",   "category": "executor"},
    {"code": "software_designer", "name": "软件设计执行人",   "category": "executor"},
    {"code": "production_executor","name": "生产执行人",      "category": "executor"},
    {"code": "tuning_executor",   "name": "安调执行人",       "category": "executor"},
]
```

项目中的指派关系：

```
project_assignment 示例:
  王文哲, project_manager,     target_phase_seq=null   (张胡斌的项目经理)
  张胡斌, mechanical_designer, target_phase_seq=1     (负责机械设计这道工序)
  闫凯,   software_designer,   target_phase_seq=null   (横跨机械设计→调机，不绑定单工序)
  王航炜, production_executor, target_phase_seq=2     (负责生产工序)
```

---

## 工序模板的重命名

```
旧                  新                 子状态
──────────────────────────────────────────────────
设计      →    机械设计      ["未开始", "设计中", "图纸已下发"]
生产      →    生产          ["未开始", "生产中", "生产完成", "已发货"]
调机派遣  →    调机          ["未开始", "安调中", "安调完成"]
验收      →    验收          ["未开始", "已验收"]
尾款      →    尾款          [] (收款进度替代)
```

`project_phase.status` 存当前子状态，`project_phase.phase_name` 存工序名。

---

## 软件设计执行人的查询

软件设计横跨三阶段，不绑定单工序：

```sql
-- 软件设计执行人看自己参与的项目，以及当前所在工序的进度
SELECT p.*, 
       design_ph.status as design_status,
       prod_ph.status as prod_status, 
       tuning_ph.status as tuning_status
FROM project_assignment pa
JOIN project p ON p.id = pa.project_id
LEFT JOIN project_phase design_ph ON design_ph.project_id = p.id AND design_ph.phase_name = '机械设计'
LEFT JOIN project_phase prod_ph   ON prod_ph.project_id = p.id   AND prod_ph.phase_name = '生产'
LEFT JOIN project_phase tuning_ph ON tuning_ph.project_id = p.id AND tuning_ph.phase_name = '调机'
WHERE pa.role_code = 'software_designer'
  AND pa.person_name = '闫凯'
```

不需要新表，纯 SQL 查询。

---

## 总结：5 张表的变更

| 表 | 操作 | 内容 |
|----|------|------|
| `role_definition` | **新建** | 9条系统预置角色 |
| `project_assignment` | **新建**（替换 `project_team`） | person_name + role_code(FK) + target_phase_seq |
| `phase_subtask` | **新建** | phase_id / name / responsible / status / seq |
| `project_phase` | **改** | 加 `status VARCHAR` |
| `phase_template_item` | **改** | 加 `sub_statuses TEXT` (JSON数组) |
| `project_team` | **删** | 被 `project_assignment` 替代 |
| `phase_template` | 不动 | |
| `project` | 不动 | |
| `customer` | 不动 | |
| `phase_incident` | 不动 | |

工序模板的初始数据改为新名称 + 子状态。`project_phase.responsible` 保留——它是工序的主要执行人，`project_assignment` 补充其他平行责任人。

---

这个模型够狠了吗？还有没有需要调整的地方？



[MODE: PLAN]

---

## 实施清单

### 第一组：数据库模型

1. **删除** `backend/app/models.py` 中的 `ProjectTeam` 类
2. **新增** `RoleDefinition` 模型（表 `role_definition`）
3. **新增** `ProjectAssignment` 模型（表 `project_assignment`）
4. **新增** `PhaseSubtask` 模型（表 `phase_subtask`）
5. **修改** `ProjectPhase` — 新增 `status: str` 字段
6. **修改** `PhaseTemplateItem` — 新增 `sub_statuses_json: str` 字段
7. **修改** `backend/app/db.py` — `_seed_default_template` 更新为新工序名+子状态，新增 `_seed_role_definitions`

### 第二组：API Schema

8. **修改** `backend/app/schemas.py` — 新增 `ProjectPhase.status` 字段到 Create/Out，新增 `RoleDefinitionOut`、`ProjectAssignmentCreate/Out`、`PhaseSubtaskCreate/Out`、移除 `ProjectTeamCreate/Out`

### 第三组：Controller

9. **修改** `backend/app/main.py` — 移除所有 `ProjectTeam` 相关路由，新增 `ProjectAssignment` CRUD、`PhaseSubtask` CRUD、`GET /roles` 路由，修复所有引用 `team` 的地方改为 `assignments`

### 第四组：导入脚本

10. **修改** `backend/app/import_excel.py` — 移除 ProjectTeam 导入，适配新模型

### 第五组：文档

11. **更新** `.doc/系统设计说明书.md` — 写入总体流程图和角色模型
12. **更新** `.doc/data_structure.md` — 写入最新的数据模型树

### 第六组：前端适配

13. **修改** `frontend/src/types.ts` — 移除 `ProjectTeamMember`，新增 `RoleDefinition`、`ProjectAssignment`、`PhaseSubtask` 类型，`ProjectPhase` 加 `status`
14. **修改** `frontend/src/api.ts` — 移除 team 相关 API，新增 assignments/subtask 相关 API
15. **修改** `frontend/src/pages/ProjectPage.tsx` — team 改为 assignments
16. **修改** `frontend/src/pages/DashboardPage.tsx` — team 改为 assignments
17. **修改** `frontend/src/router.tsx` — 无需改动（loader 不变）

### 第七组：验证

18. **运行** `python backend/app/import_excel.py` 验证导入
19. **运行** `npx tsc --noEmit` 验证前端类型
20. **启动后端** 验证 API

---

现在是 EXECUTE 模式进入请求前，确认计划是否正确？

