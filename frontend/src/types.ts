export type Project = {
  id: string
  order_no: string
  customer_id: string
  end_customer: string | null
  template_id: string | null

  equipment_category: string | null
  equipment_quantity: number
  equipment_spec: string | null

  contract_start_date: string | null
  contract_duration_days: number | null
  contract_expected_delivery_date: string | null
  contract_actual_delivery_days: number | null
  contract_payment_progress: number | null

  is_abnormal: boolean

  phases: ProjectPhase[]
  assignments: ProjectAssignment[]

  created_at: string
  updated_at: string
}

export type ProjectPhase = {
  id: string
  project_id: string
  seq: number
  phase_name: string
  sub_name: string
  responsible: string
  status: string

  start_date: string | null
  warning_date: string | null
  planned_end_date: string | null
  planned_duration: number | null
  actual_end_date: string | null
  actual_duration: number | null

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
  roles: string[]
  created_at: string
}

export type RoleDefinition = {
  code: string
  name: string
  category: string
  assigns_json: string | null
}

export type ProjectAssignment = {
  id: string
  project_id: string
  person_name: string
  role_code: string
  phase_id: string | null
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
}

export type LoginResponse = {
  person: Person
  token: string
}
