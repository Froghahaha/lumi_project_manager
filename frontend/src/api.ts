import type {
  Attachment,
  AuditLog,
  Comment,
  Issue,
  IssueStatus,
  Project,
  ProjectActivity,
  ProjectOverviewImage,
  SubTask,
  TimelineEvent,
  TimelineEventAttachment,
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

export async function listProjects(): Promise<Project[]> {
  return request<Project[]>('/projects')
}

export async function createProject(input: {
  name: string
  type: string
  overview?: string
  priority?: number
  status?: Project['status']
}): Promise<Project> {
  return request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) })
}

export async function getProject(projectId: string): Promise<Project> {
  return request<Project>(`/projects/${projectId}`)
}

export async function listProjectActivity(projectId: string): Promise<ProjectActivity[]> {
  return request<ProjectActivity[]>(`/projects/${projectId}/activity`)
}

export async function listSubTasks(projectId: string): Promise<SubTask[]> {
  return request<SubTask[]>(`/projects/${projectId}/subtasks`)
}

export async function createSubTask(
  projectId: string,
  input: { name: string; description?: string; priority?: number },
): Promise<SubTask> {
  return request<SubTask>(`/projects/${projectId}/subtasks`, { method: 'POST', body: JSON.stringify(input) })
}

export async function updateSubTask(subtaskId: string, patch: Partial<SubTask>): Promise<SubTask> {
  return request<SubTask>(`/subtasks/${subtaskId}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function listProjectTimelineEvents(projectId: string): Promise<TimelineEvent[]> {
  return request<TimelineEvent[]>(`/projects/${projectId}/timeline_events`)
}

export async function createProjectTimelineEvent(
  projectId: string,
  input: { issue_id?: string; occurred_at: string; description: string; related_person?: string[] },
): Promise<TimelineEvent> {
  return request<TimelineEvent>(`/projects/${projectId}/timeline_events`, { method: 'POST', body: JSON.stringify(input) })
}

export async function listIssueTimelineEvents(issueId: string): Promise<TimelineEvent[]> {
  return request<TimelineEvent[]>(`/issues/${issueId}/timeline_events`)
}

export async function uploadTimelineEventAttachment(eventId: string, file: File): Promise<TimelineEventAttachment> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${API_BASE}/timeline_events/${eventId}/attachments`, {
    method: 'POST',
    headers: { 'X-User': 'demo' },
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as TimelineEventAttachment
}

export async function listTimelineEventAttachments(eventId: string): Promise<TimelineEventAttachment[]> {
  return request<TimelineEventAttachment[]>(`/timeline_events/${eventId}/attachments`)
}

export async function updateProject(projectId: string, patch: Partial<Project>): Promise<Project> {
  return request<Project>(`/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function uploadProjectOverviewImage(projectId: string, file: File): Promise<ProjectOverviewImage> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${API_BASE}/projects/${projectId}/overview_images`, {
    method: 'POST',
    headers: { 'X-User': 'demo' },
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as ProjectOverviewImage
}

export async function listIssues(params: {
  project_id?: string
  subtask_id?: string
  status?: IssueStatus
  assignee?: string
  q?: string
}): Promise<Issue[]> {
  const sp = new URLSearchParams()
  if (params.project_id) sp.set('project_id', params.project_id)
  if (params.subtask_id) sp.set('subtask_id', params.subtask_id)
  if (params.status) sp.set('status', params.status)
  if (params.assignee) sp.set('assignee', params.assignee)
  if (params.q) sp.set('q', params.q)
  const qs = sp.toString()
  return request<Issue[]>(`/issues${qs ? `?${qs}` : ''}`)
}

export async function createIssue(input: {
  title: string
  description?: string
  project_id?: string
  subtask_id?: string
  type?: string
  category?: string[]
  equipment_type?: string[]
  severity?: string
  reporter?: string
  assignee?: string
  related_person?: string[]
  status?: IssueStatus
  progress?: number
  is_blocked?: boolean
  block_reason?: string
  planned_start?: string
  planned_end?: string
  tags?: string[]
}): Promise<Issue> {
  return request<Issue>('/issues', { method: 'POST', body: JSON.stringify(input) })
}

export async function getIssue(issueId: string): Promise<Issue> {
  return request<Issue>(`/issues/${issueId}`)
}

export async function updateIssue(issueId: string, patch: Partial<Issue>): Promise<Issue> {
  return request<Issue>(`/issues/${issueId}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function listIssueAudit(issueId: string): Promise<AuditLog[]> {
  return request<AuditLog[]>(`/issues/${issueId}/audit`)
}

export async function listComments(issueId: string): Promise<Comment[]> {
  return request<Comment[]>(`/issues/${issueId}/comments`)
}

export async function addComment(
  issueId: string,
  input: { content: string; is_internal?: boolean },
): Promise<Comment> {
  return request<Comment>(`/issues/${issueId}/comments`, { method: 'POST', body: JSON.stringify(input) })
}

export async function listAttachments(issueId: string): Promise<Attachment[]> {
  return request<Attachment[]>(`/issues/${issueId}/attachments`)
}

export async function uploadAttachment(issueId: string, file: File): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${API_BASE}/issues/${issueId}/attachments`, {
    method: 'POST',
    headers: { 'X-User': 'demo' },
    body: form,
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as Attachment
}
