// ─── Branded types ──────────────────────────────────────────
// PhaseId is NOT interchangeable with string — prevents accidental
// use of seq or phase_name where a real phase id is required.

declare const PhaseIdBrand: unique symbol
export type PhaseId = string & { [PhaseIdBrand]: true }
export const asPhaseId = (s: string): PhaseId => s as PhaseId

// ─── Phase status values ───────────────────────────────────

export const PHASE_STATUSES = [
  '未开始',
  '设计中', '图纸已下发',                           // 机械设计
  '生产中', '生产完成', '已发货',                    // 生产
  '安调中', '安调完成',                              // 调机
  '已验收',                                          // 验收
] as const

export type PhaseStatus = typeof PHASE_STATUSES[number] | ''
export const isPhaseStatus = (s: string): s is PhaseStatus =>
  s === '' || (PHASE_STATUSES as readonly string[]).includes(s)

// ─── Domain types ──────────────────────────────────────────

export type Project = {
  id: string
  order_no: string
  customer_id: string
  end_customer: string | null
  template_id: string | null

  contract_number: string | null
  contract_amount: number | null
  contract_deposit_ratio: number | null
  contract_start_date: string | null
  contract_effective_date: string | null
  contract_duration_days: number | null
  contract_expected_delivery_date: string | null
  contract_actual_delivery_days: number | null
  contract_payment_progress: number | null

  is_abnormal: boolean

  agreement_filename: string

  project_status: string  // 正常|逾期|已完成 — computed by backend

  phases: ProjectPhase[]
  assignments: ProjectAssignment[]
  equipment_list: ProjectEquipment[]

  created_at: string
  updated_at: string
}

export type ProjectEquipment = {
  id: string
  project_id: string
  category: string
  spec: string
  quantity: number
}

export type ProjectPhase = {
  id: PhaseId
  project_id: string
  seq: number
  phase_name: string
  sub_name: string
  responsible: string
  status: PhaseStatus

  start_date: string | null
  warning_date: string | null
  planned_end_date: string | null
  planned_duration: number | null
  actual_end_date: string | null
  actual_duration: number | null

  is_rectify: boolean

  phase_progress: string  // 未开始|进行中|预警|逾期|已完成 — computed by backend
  sub_statuses_json: string  // valid status options, denormalized from template
  terminal_statuses_json: string  // JSON array of statuses that count as complete

  incidents: PhaseIncident[]
  created_at: string
  updated_at: string
}

export type PhaseIncident = {
  id: string
  phase_id: string
  occurred_at: string
  category: string
  description: string
  created_at: string
}

export type Person = {
  id: string
  name: string
  department: string
  is_active: boolean
  role_code: string
  created_at: string
}

export type RoleDefinition = {
  code: string
  name: string
  category: string
  workspace_key: string
  assigns_json: string | null
}

export type ProjectAssignment = {
  id: string
  project_id: string
  person_name: string
  role_code: string
  phase_id: PhaseId | null
  created_at: string
}

export type Customer = {
  id: string
  code: string
  name: string
  created_at: string
  updated_at: string
}

export type PhaseTemplate = {
  id: string
  name: string
  description: string | null
  items: PhaseTemplateItem[]
  created_at: string
  updated_at: string
}

export type PhaseTemplateItem = {
  id: string
  template_id: string
  seq: number
  phase_name: string
  description: string | null
  sub_statuses_json: string
  terminal_statuses_json: string
}

export type LoginResponse = {
  person: Person
  token: string
}
