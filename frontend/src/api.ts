import type {
  Customer,
  PhaseTemplate,
  Project,
  ProjectPhase,
  ProjectTeamMember,
} from './types'

const API_BASE = 'http://localhost:8000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-User': 'demo',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function listProjects(params?: {
  customer_code?: string
  is_abnormal?: boolean
}): Promise<Project[]> {
  const sp = new URLSearchParams()
  if (params?.customer_code) sp.set('customer_code', params.customer_code)
  if (params?.is_abnormal !== undefined) sp.set('is_abnormal', String(params.is_abnormal))
  const qs = sp.toString()
  return request<Project[]>(`/projects${qs ? `?${qs}` : ''}`)
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`)
}

export async function createProject(input: {
  order_no: string
  customer_id?: string | null
  end_customer?: string | null
  template_id?: string | null
  equipment_category?: string | null
  equipment_quantity?: number
  equipment_spec?: string | null
  contract_start_date?: string | null
  contract_duration_days?: number | null
  contract_expected_delivery_date?: string | null
  contract_actual_delivery_days?: number | null
  contract_payment_progress?: number | null
  is_abnormal?: boolean
  phases?: {
    seq: number
    phase_name: string
    responsible?: string
    start_date?: string | null
    planned_end_date?: string | null
  }[]
  team?: { person_name: string; role: string }[]
}): Promise<Project> {
  return request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateProject(
  id: string,
  patch: {
    is_abnormal?: boolean
    contract_payment_progress?: number
    contract_actual_delivery_days?: number
  },
): Promise<Project> {
  return request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
    headers: { 'X-User': 'demo' },
  })
}

export async function listPhases(projectId: string): Promise<ProjectPhase[]> {
  return request<ProjectPhase[]>(`/projects/${projectId}/phases`)
}

export async function addPhase(
  projectId: string,
  input: {
    seq: number
    phase_name: string
    responsible?: string
    start_date?: string | null
    planned_end_date?: string | null
    incidents?: { occurred_at: string; category: string; description: string }[]
  },
): Promise<ProjectPhase> {
  return request<ProjectPhase>(`/projects/${projectId}/phases`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function deletePhase(projectId: string, phaseId: string): Promise<void> {
  await fetch(`${API_BASE}/projects/${projectId}/phases/${phaseId}`, {
    method: 'DELETE',
    headers: { 'X-User': 'demo' },
  })
}

export async function addIncident(
  phaseId: string,
  input: { occurred_at: string; category: string; description: string },
): Promise<void> {
  await fetch(`${API_BASE}/phases/${phaseId}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User': 'demo' },
    body: JSON.stringify(input),
  })
}

export async function listTeam(projectId: string): Promise<ProjectTeamMember[]> {
  return request<ProjectTeamMember[]>(`/projects/${projectId}/team`)
}

export async function addTeamMember(
  projectId: string,
  input: { person_name: string; role: string },
): Promise<ProjectTeamMember> {
  return request<ProjectTeamMember>(`/projects/${projectId}/team`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function removeTeamMember(projectId: string, teamId: string): Promise<void> {
  await fetch(`${API_BASE}/projects/${projectId}/team/${teamId}`, {
    method: 'DELETE',
    headers: { 'X-User': 'demo' },
  })
}

export async function listCustomers(): Promise<Customer[]> {
  return request<Customer[]>('/customers')
}

export async function listTemplates(): Promise<PhaseTemplate[]> {
  return request<PhaseTemplate[]>('/templates')
}
