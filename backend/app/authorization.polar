# ─── Helpers ────────────────────────────────────────────────
# AppUser is registered via oso.register_class(AppUser)
# fields: person_id, person_name, roles (list[str])

has_role(user: AppUser, role: String) if
    role in user.roles;

# ─── API Permissions ────────────────────────────────────────
# 格式: allow(actor, "resource:action", "resource_type")

# 项目
allow(actor: AppUser, "projects:create", "project") if
    has_role(actor, "admin") or has_role(actor, "sales_assistant");

allow(actor: AppUser, "projects:delete", "project") if
    has_role(actor, "admin");

allow(actor: AppUser, "projects:edit", "project") if
    has_role(actor, "admin") or has_role(actor, "sales_assistant");

# 人员管理
allow(actor: AppUser, "persons:manage", "person") if
    has_role(actor, "admin");

# 工序（主管可添删）
allow(actor: AppUser, "phases:add", "project") if
    has_role(actor, "admin") or
    has_role(actor, "tech_supervisor") or
    has_role(actor, "after_sales_super");

allow(actor: AppUser, "phases:delete", "project") if
    has_role(actor, "admin") or
    has_role(actor, "tech_supervisor") or
    has_role(actor, "after_sales_super");

# 客户管理
allow(actor: AppUser, "customers:manage", "customer") if
    has_role(actor, "admin") or has_role(actor, "sales_assistant");

# ─── UI Permissions ─────────────────────────────────────────
# 格式: allow(actor, "permission_key", "ui")

allow(actor: AppUser, "view_payment_column", "ui") if
    has_role(actor, "admin") or
    has_role(actor, "tech_supervisor") or
    has_role(actor, "salesman") or
    has_role(actor, "sales_assistant");

allow(actor: AppUser, "edit_payment", "ui") if
    has_role(actor, "admin") or has_role(actor, "sales_assistant");

allow(actor: AppUser, "create_project_form", "ui") if
    has_role(actor, "admin") or has_role(actor, "sales_assistant");

allow(actor: AppUser, "view_all_projects", "ui") if
    has_role(actor, "admin") or
    has_role(actor, "tech_supervisor") or
    has_role(actor, "after_sales_super") or
    has_role(actor, "project_manager") or
    has_role(actor, "sales_assistant") or
    has_role(actor, "salesman");

allow(actor: AppUser, "view_project_list_page", "ui") if
    has_role(actor, "admin") or
    has_role(actor, "tech_supervisor") or
    has_role(actor, "after_sales_super") or
    has_role(actor, "project_manager") or
    has_role(actor, "sales_assistant");

allow(actor: AppUser, "manage_customers", "ui") if
    has_role(actor, "admin") or has_role(actor, "sales_assistant");

allow(actor: AppUser, "manage_persons", "ui") if
    has_role(actor, "admin");

# ─── Workspace config ────────────────────────────────────────
# 执行人 → 负责的工序序号
allow(actor: AppUser, "phase_responsibility:1", "ui") if
    has_role(actor, "mechanical_designer");

allow(actor: AppUser, "phase_responsibility:2", "ui") if
    has_role(actor, "production_executor");

allow(actor: AppUser, "phase_responsibility:3", "ui") if
    has_role(actor, "tuning_executor") or has_role(actor, "acceptance_executor");

allow(actor: AppUser, "phase_responsibility:4", "ui") if
    has_role(actor, "salesman");

# 生产执行人的特殊 UI
allow(actor: AppUser, "show_prev_phase_status", "ui") if
    has_role(actor, "production_executor");

allow(actor: AppUser, "show_shipped_warning", "ui") if
    has_role(actor, "production_executor");

# 软件设计执行人 — 跨工序视图
allow(actor: AppUser, "cross_phase_view", "ui") if
    has_role(actor, "software_designer");

# 售后主管 — 安调执行人分配管理
allow(actor: AppUser, "manage_tuning_assignment", "ui") if
    has_role(actor, "after_sales_super");
