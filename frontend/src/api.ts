import type {
  Customer,
  LoginResponse,
  Person,
  PhaseTemplate,
  Project,
  ProjectAssignment,
  ProjectPhase,
  RoleDefinition,
} from './types'

const API_BASE = 'http://localhost:8000'

function getAuthHeaders() {
  try {
    const raw = localStorage.getItem('lumi_auth')
    if (raw) {
      const data = JSON.parse(raw)
      return {
        'X-User': encodeURIComponent(data.person?.name || ''),
        'X-User-Role': data.role || '',
      }
    }
  } catch { /* ignore */ }
  return { 'X-User': '', 'X-User-Role': '' }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
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
  assigned_person?: string
  role_code?: string
}): Promise<Project[]> {
  const sp = new URLSearchParams()
  if (params?.customer_code) sp.set('customer_code', params.customer_code)
  if (params?.is_abnormal !== undefined) sp.set('is_abnormal', String(params.is_abnormal))
  if (params?.assigned_person) sp.set('assigned_person', params.assigned_person)
  if (params?.role_code) sp.set('role_code', params.role_code)
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
  assignments?: { person_name: string; role_code: string; phase_id?: string | null }[]
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
    sub_name?: string
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

export async function updatePhase(
  projectId: string,
  phaseId: string,
  input: {
    seq: number
    phase_name: string
    sub_name?: string
    responsible?: string
    status?: string
    start_date?: string | null
    planned_end_date?: string | null
  },
): Promise<ProjectPhase> {
  return request<ProjectPhase>(`/projects/${projectId}/phases/${phaseId}`, {
    method: 'PATCH',
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

export async function listRoles(): Promise<RoleDefinition[]> {
  return request<RoleDefinition[]>('/roles')
}

export async function listAssignments(projectId: string): Promise<ProjectAssignment[]> {
  return request<ProjectAssignment[]>(`/projects/${projectId}/assignments`)
}

export async function addAssignment(
  projectId: string,
  input: { person_name: string; role_code: string; phase_id?: string | null },
): Promise<ProjectAssignment> {
  return request<ProjectAssignment>(`/projects/${projectId}/assignments`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function removeAssignment(projectId: string, assignmentId: string): Promise<void> {
  await fetch(`${API_BASE}/projects/${projectId}/assignments/${assignmentId}`, {
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

// Phases (global)
export async function listPhasesGlobal(params?: {
  responsible?: string
  project_id?: string
}): Promise<ProjectPhase[]> {
  const sp = new URLSearchParams()
  if (params?.responsible) sp.set('responsible', params.responsible)
  if (params?.project_id) sp.set('project_id', params.project_id)
  const qs = sp.toString()
  return request<ProjectPhase[]>(`/phases${qs ? `?${qs}` : ''}`)
}

export async function getPhase(phaseId: string): Promise<ProjectPhase> {
  return request<ProjectPhase>(`/phases/${phaseId}`)
}

export async function updatePhaseStatus(phaseId: string, status: string): Promise<ProjectPhase> {
  return request<ProjectPhase>(`/phases/${phaseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

// Assignments (global)
export async function listAssignmentsGlobal(params?: {
  person_name?: string
  role_code?: string
}): Promise<ProjectAssignment[]> {
  const sp = new URLSearchParams()
  if (params?.person_name) sp.set('person_name', params.person_name)
  if (params?.role_code) sp.set('role_code', params.role_code)
  const qs = sp.toString()
  return request<ProjectAssignment[]>(`/assignments${qs ? `?${qs}` : ''}`)
}

export async function listPersons(role_code?: string): Promise<Person[]> {
  const qs = role_code ? `?role_code=${encodeURIComponent(role_code)}` : ''
  return request<Person[]>(`/persons${qs}`)
}

export async function createPerson(input: { name: string; department?: string; roles: string[] }): Promise<Person> {
  return request<Person>('/persons', { method: 'POST', body: JSON.stringify(input) })
}

export async function updatePerson(id: string, input: { name?: string; department?: string; roles: string[] }): Promise<Person> {
  return request<Person>(`/persons/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export async function login(person_name: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/login', { method: 'POST', body: JSON.stringify({ person_name, password }) })
}
