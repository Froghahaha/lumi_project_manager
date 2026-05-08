export type ProjectStatus = '规划中' | '进行中' | '已完成' | '已暂停'

export type IssueStatus = '待处理' | '处理中' | '待验证' | '已完成' | '已归档'

export type Project = {
  id: string
  code: string | null
  name: string
  type: string | null
  overview: string | null
  priority: number
  status: ProjectStatus
  start_date: string | null
  target_date: string | null
  archived: boolean
  created_at: string
  updated_at: string
  overview_images: ProjectOverviewImage[]
}

export type SubTask = {
  id: string
  project_id: string
  name: string
  description: string | null
  priority: number
  created_at: string
  updated_at: string
}

export type Issue = {
  id: string
  issue_key: string
  title: string
  description: string | null
  project_id: string | null
  subtask_id: string | null
  type: string | null
  category: string[]
  equipment_type: string[]
  severity: string | null
  reporter: string | null
  assignee: string | null
  related_person: string[]
  status: IssueStatus
  progress: number
  is_blocked: boolean
  block_reason: string | null
  planned_start: string | null
  planned_end: string | null
  actual_start: string | null
  actual_end: string | null
  tags: string[]
  created_at: string
  updated_at: string
  is_delayed: boolean
  delay_days: number
}

export type Comment = {
  id: string
  issue_id: string
  actor: string
  content: string
  is_internal: boolean
  created_at: string
}

export type AuditLog = {
  id: string
  issue_id: string
  actor: string
  action: string
  timestamp: string
  from_value: Record<string, unknown>
  to_value: Record<string, unknown>
  comment: string | null
  ip_address: string | null
}

export type ProjectActivity = {
  id: string
  project_id: string
  issue_id: string
  issue_key: string
  issue_title: string
  actor: string
  action: string
  timestamp: string
  comment: string | null
  ip_address: string | null
}

export type ProjectOverviewImage = {
  id: string
  project_id: string
  uploader: string
  filename: string
  content_type: string | null
  size: number
  created_at: string
  url: string
}

export type TimelineEvent = {
  id: string
  project_id: string
  issue_id: string | null
  actor: string
  occurred_at: string
  description: string
  related_person: string[]
  created_at: string
  attachments: TimelineEventAttachment[]
}

export type TimelineEventAttachment = {
  id: string
  event_id: string
  uploader: string
  filename: string
  content_type: string | null
  size: number
  created_at: string
  url: string
}

export type Attachment = {
  id: string
  issue_id: string
  comment_id: string | null
  uploader: string
  filename: string
  content_type: string | null
  size: number
  created_at: string
  url: string
}

