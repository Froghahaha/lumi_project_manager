# 工作台需求定义

## 角色与工作台映射

| 角色 | code | 工作台 | workspace_key | 类别 |
|---|---|---|---|---|
| 超级管理员 | admin | AdminWorkspace | admin | admin |
| 技术主管 | tech_supervisor | SupervisorWorkspace | supervisor | supervisor |
| 售后主管 | after_sales_super | AfterSalesWorkspace | after_sales | supervisor |
| 项目经理 | project_manager | PMWorkspace | pm | executor |
| 销售 | salesman | SalesWorkspace | sales | executor |
| 销售助理 | sales_assistant | SalesWorkspace | sales | executor |
| 机械设计执行人 | mechanical_designer | ExecutionWorkspace | execution | executor |
| 软件设计执行人 | software_designer | SoftwareWorkspace | software | executor |
| 生产执行人 | production_executor | ExecutionWorkspace | execution | executor |
| 安调执行人 | tuning_executor | ExecutionWorkspace | execution | executor |

---

## 1. 超级管理员 (admin)

### 查看需求
- [x] 所有项目列表（含设备、终端客户、状态、工序进度）
- [x] 预警面板：异常项目列表 + 逾期工序列表（点击可跳转项目详情）
- [x] 人员列表（姓名、部门、角色、启用状态）
- [x] 项目总数、人员总数、逾期数统计标签
- [ ] 筛选查看处于各种工序的项目

### 操作需求
- [x] 添加/编辑客户（客户管理 Tab 内操作）
- [x] 添加/编辑人员（姓名、部门、角色）
- [x] 点击项目行跳转项目详情
- [x] 删除人员
- [x] 重置人员密码
- [ ] 系统配置（如修改模板）
- [ ] 数据导出

### 鉴权
- 创建项目: ✓ (已配置 require_roles)
- 管理项目: 全部可见
- 管理角色: ✓ (人员角色管理)


## 2. 技术主管 (tech_supervisor)

### 查看需求
- [x] 所有项目列表
- [x] 选中项目查看工序详情（阶段名、子项、责任人）
- [x] 工序级人员分配情况
- [x] 全局角色人员分配情况

### 操作需求
- [x] 按角色筛选人员列表（从 /persons?role_code=X 加载）
- [x] 将人员分配到工序（机械设计执行人→设计工序、生产执行人→生产工序）
- [x] 将人员分配到全局角色（项目经理、软件设计执行人）
- [x] 移除人员分配
- [x] 添加工序
- [x] 删除工序
- [x] 编辑工序子项名称/责任人
- [ ] 工序日期设置（开始日期、计划完成日期）

### 鉴权
- 创建项目: ✗
- 管理范围: 可分配的角色由 assigns_json 限定


## 3. 售后主管 (after_sales_super)

### 查看需求
- [x] 已进入生产阶段的项目列表
- [ ] 各项目生产/调机/验收工序状态

### 操作需求
- [x] 指派安调执行人到调机工序（含 phase_id）
- [x] 移除安调执行人
- [ ] 指派售后人员到验收工序
- [ ] 查看调机/验收的逾期状态

### 已知问题
- is_abnormal 过滤条件在 API 调用中未使用，当前返回所有进入生产阶段的项目


## 4. 项目经理 (project_manager)

### 查看需求
- [x] 指派给自己的项目卡片列表
- [x] 每张卡片显示：项目号、终端客户、工序状态Tag、交期
- [x] 项目进度百分比（基于工序完成率）
- [x] 异常/逾期标记

### 操作需求
- [x] 点击卡片跳转项目详情
- [ ] 添加/编辑事项（未来 Issue 功能）

### 鉴权
- 创建项目: ✗
- 编辑项目: ✗（当前 PATCH 端点无角色限制，但 UI 上编辑按钮未做角色控制）


## 5. 销售助理 (sales_assistant)

### 查看需求
- [x] 项目收款进度表（项目、收款比例、进度Tag）
- [ ] 所有项目列表（用于收款跟进，跟踪技术协议上传情况）

### 操作需求（有需求
- [ ] 新建项目表单（客户信息、项目简称（如 玉环武创-1）、合同编号、序号（自动生成）、模板、（设备类型（机型）、设备描述、数量）*N、项目生效日期（以收到定金为标志）、合同天数、定金比例（后台比实际比例低，防止无效）、收款进度、立项日期、上传技术协议）
    - 录入流程
        1. 录入客户信息（全称），系统自动联想客户名称候选，如果没有匹配项，提示用户确认是否创建新客户（需要弹出客户信息输入），并确认客户简称
        2. 项目建成自动生成项目简称（简称首拼-序号）
        3. 补充终端客户（如果存在）
        4. 选择项目模板（从 /templates 加载）
        5. 录入合同信息（合同编号、合同天数、定金比例、（设备类型（机型）、设备描述、数量）*N）
        6. 上传技术协议（可暂时跳过）WC
- [ ] 修改收款进度（表内 InputNumber），如果是定金以收到，标记项目生效 或受到特批，标记项目生效



### 鉴权
- 创建项目: ✓
- 编辑项目: ✓


## 6. 销售 (salesman)

### 查看需求
- [ ] 同项目经理

### 操作需求
- [ ] 不允许操作项目中的任何信息

### 鉴权
- 创建项目: ✗（API 限制 sales_assistant/admin，UI 上表单仍可见但提交会 403）
- 编辑项目: ✗（同上）

### 已知问题
- UI 上新建项目表单可见但 API 会拒绝。应隐藏表单或展示权限提示。


## 7. 机械设计执行人 (mechanical_designer)

### 查看需求
- [x] 分配给我的项目列表（按 assigned_person + role_code 过滤）
- [x] 我负责的工序：机械设计（seq=1）
- [x] 项目交期
- [x] 工序时间（开始→计划完成）
- [x] 事故事件列表（最多 3 条摘要）

### 操作需求
- [x] 点击"项目详情"跳转项目详情页
- [x] 更新工序状态（PhaseStatusSelect 下拉）
- [ ] 添加事故事件（需在项目详情页操作，工作台未提供快捷入口）

### 工序状态选项
未开始 → 设计中 → 图纸已下发


## 8. 软件设计执行人 (software_designer)

### 查看需求
- [x] 分配给我的项目卡片列表
- [x] 跨工序视图（机械设计 seq=1、生产 seq=2、调机 seq=3，因为软件设计横跨多个阶段）
- [x] 各工序状态Tag
- [x] 合同信息（立项日起→交期、合同天数）
- [x] 异常标记

### 操作需求
- [x] 点击卡片跳转项目详情
- [ ] 更新软件相关工序状态（当前工作台无状态选择器，需在项目详情操作）

### 已知问题
- 工作台不提供状态更新组件（不同于 ExecutionWorkspace 有 PhaseStatusSelect），只能跳转项目详情后操作


## 9. 生产执行人 (production_executor)

### 查看需求
- [x] 分配给我的项目列表
- [x] 我负责的工序：生产（seq=2）
- [x] 前一工序状态（机械设计）
- [x] 项目交期
- [x] 工序时间
- [ ] 已完成下发但未上传技术协议的项目黄色警告（卡片内 Alert + 黄色边框卡片）

### 操作需求
- [x] 更新工序状态
- [x] 点击跳转项目详情（可上传技术协议）
- [ ] 未开始→生产中时提示技术协议上传情况，未上传的不允许切换到生产中

### 工序状态选项
未开始 → 生产中 → 生产完成 → 已发货


## 10. 安调执行人 (tuning_executor)

### 查看需求
- [x] 分配给我的项目列表
- [x] 我负责的工序：调机（seq=3）
- [x] 前一工序状态（生产）
- [x] 项目交期
- [x] 工序时间
- [x] 事故事件列表

### 操作需求
- [x] 更新工序状态
- [x] 点击跳转项目详情

### 工序状态选项
未开始 → 安调中 → 安调完成

### 特殊说明
售后主管负责将人指派到调机工序。当人被指派到调机工序时，按现有代码逻辑会进入 ExecutionWorkspace。


## 鉴权框架

### 架构总览

本系统采用 **Oso 策略引擎** (v0.27.3) 实现声明式、中心化的权限管理。所有权限规则集中在单一 Polar 策略文件中，后端通过 Oso 引擎求值，前端通过 `/me/permissions` 端点获取当前用户的权限字典。

```
authorization.polar          ← 所有权限规则的唯一来源
    ↓ 加载
authz.py                     ← Oso 实例 + FastAPI 依赖
    ↓ 注入
main.py                      ← require_permission() 保护 API 端点
    ↓ 暴露
GET /me/permissions          ← 返回 {"permission_key": bool}
    ↓ 消费
AuthContext.can              ← 前端 hasPermission("key") 替代硬编码
```

### 文件说明

| 文件 | 作用 |
|---|---|
| `backend/app/authorization.polar` | Polar 策略文件，定义所有 `allow(actor, action, resource)` 规则 |
| `backend/app/authz.py` | Oso 实例初始化、`AppUser` 类、`require_permission` 依赖工厂、`get_all_permissions` 导出 |
| `frontend/src/contexts/AuthContext.tsx` | 前端权限状态管理：`can` 字典 + `hasPermission(key)` + 登录/切换角色时自动刷新 |
| `frontend/src/api.ts` | `getMyPermissions()` → `GET /me/permissions` |

### Polar 策略文件结构 (authorization.polar)

```polar
# 辅助规则
has_role(user: AppUser, role: String) if role in user.roles;

# API 权限 — 格式: allow(actor, "resource:action", "resource_type")
allow(actor, "projects:create", "project") if has_role(actor, "admin") or has_role(actor, "sales_assistant");
allow(actor, "projects:delete", "project") if has_role(actor, "admin");
# ...

# UI 权限 — 格式: allow(actor, "permission_key", "ui")
allow(actor, "view_payment_column", "ui") if has_role(actor, "admin") or has_role(actor, "project_manager") or ...;
allow(actor, "create_project_form", "ui") if has_role(actor, "admin") or has_role(actor, "sales_assistant");
# ...
```

### 后端 enforce：require_permission

```python
# 旧（已移除）：
def create_project(..., actor = Depends(require_roles("admin", "sales_assistant")))

# 新：
def create_project(..., actor = Depends(require_permission("projects:create", "project")))
```

`require_permission(action, resource)` 调用 `oso.is_allowed(actor, action, resource)` 进行策略求值。未匹配任何 allow 规则时默认拒绝（返回 403）。

### 当前 API 权限配置

| 端点 | 权限 key | 允许的角色 |
|---|---|---|
| POST /projects | `projects:create` | admin, sales_assistant |
| PATCH /projects/{id} | 未保护 | 所有登录用户 |
| DELETE /projects/{id} | `projects:delete` | admin |
| POST /persons | `persons:manage` | admin |
| PATCH /persons/{id} | `persons:manage` | admin |
| DELETE /persons/{id} | `persons:manage` | admin |
| POST /persons/{id}/reset-password | `persons:manage` | admin |
| POST /customers | `customers:manage` | admin |
| PATCH /customers/{id} | `customers:manage` | admin |
| 其他 CRUD | 未保护 | 所有登录用户 |

### 当前 UI 权限配置

| 权限 key | 含义 | 允许的角色 |
|---|---|---|
| `create_project_form` | 显示新建项目表单 | admin, sales_assistant |
| `edit_payment` | 修改收款进度 | admin, sales_assistant |
| `view_payment_column` | 看到收款进度列 | admin, project_manager, salesman, sales_assistant |
| `view_all_projects` | 看到全部项目列表 | admin, tech_supervisor, after_sales_super, project_manager, sales_assistant, salesman |
| `view_project_list_page` | 侧边栏"项目列表"入口 | admin, tech_supervisor, after_sales_super, project_manager, sales_assistant |
| `manage_persons` | 人员管理（增/改/删） | admin |
| `manage_customers` | 客户管理（增/改） | admin |
| `phases:add` | 添加工序 | admin, tech_supervisor, after_sales_super |
| `phases:delete` | 删除工序 | admin, tech_supervisor, after_sales_super |

### 前端消费模式

```typescript
// 旧：各组件内硬编码角色数组
const CAN_EDIT = ['sales_assistant']
const canEdit = CAN_EDIT.includes(auth.role)

// 新：统一 hasPermission 方法
const canEdit = auth.hasPermission('create_project_form')
```

### 新增权限的步骤

1. 在 `authorization.polar` 添加 `allow(actor, "新权限key", "resource_type") if ...`
2. 在 `authz.py` 的 `PERMISSION_RESOURCE` 字典中添加映射
3. 后端需 enforce 时使用 `require_permission("新权限key", "resource_type")`
4. 前端消息使用 `auth.hasPermission("新权限key")` 进行判断
5. （可选）在 `workspace_requirements.md` 本文档中记录

### 关键设计决策

1. **Polar 不设 catch-all fallback**：每项权限必须显式列出，避免意外开放。未列出的端点暂保持开放（仅需登录）。
2. **API 与 UI 权限分在同一文件中分别定义**：共用的辅助规则 `has_role`，但 allow 规则按 domain 分组（API 前缀为 `resource:`，UI 前缀无特殊格式）。
3. **前端 `can` 是扁平字典**：`Record<string, boolean>`，通过 `GET /me/permissions` 一次性获取并缓存在 AuthContext 中。
4. **权限刷新时机**：登录后自动刷新 + 角色切换后自动刷新。权限字典不持久化到 localStorage（始终从服务端获取最新策略）。

---

## 通用规范

1. **所有工作台**：title 显示"工作台 - {角色名}"，右上角显示当前人员姓名 Tag
2. **loading 状态**：居中 Spin
3. **error 状态**：Alert type="error" 显示错误描述
4. **empty 状态**：Empty 组件 + 相应描述文本
5. **颜色规范**：
   - 异常/逾期 → red
   - 进行中 → blue/processing
   - 已完成 → green/success
   - 预警 → orange/warning
   - 未开始 → default/gray

---


## 0519
1. 交期以工作日推算，生效日期向后按工作日(双休制)推算。
2. 技术主管只能在交期内分配时间
3. 增加项目生效制度：销售助理更新为收到定金，项目生效，随后生产
4. 管理员角色+项目经理都可以看收款进度，工序执行人不看
5. 增加工序预警时间，可以手动调整自结束节点向前倒推几个工作日
6. 项目看板增加总览计数+筛选卡片

## 0520
1. 项目可增加整改工序，如果有整改工序，所有相关人员都要能够得到警示，所有人员都可以在整改工序中更新自己的进度



*文档版本: 2026-05-26*
*变更: Oso 策略引擎集成，集中化权限管理*
